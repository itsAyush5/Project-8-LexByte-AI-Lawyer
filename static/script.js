// AI Lawyer - Premium Interactive Logic
document.addEventListener('DOMContentLoaded', () => {
    const aiLawyer = new AILawyerController();
});

class AILawyerController {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.articlesGrid = document.getElementById('articlesGrid');
        this.articleSearch = document.getElementById('articleSearch');

        this.init();
    }

    init() {
        this.setupTabs();
        this.setupChat();
        this.setupLibrary();
        this.loadInitialData();
    }

    setupTabs() {
        const navItems = document.querySelectorAll('.nav-item[data-tab]');
        const sections = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.dataset.tab;

                navItems.forEach(ni => ni.classList.remove('active'));
                item.classList.add('active');

                sections.forEach(s => s.style.display = 'none');
                document.getElementById(`${tab}-section`).style.display = tab === 'consult' ? 'flex' : 'block';
            });
        });

        document.getElementById('clearChat').onclick = () => {
            if (confirm('Clear all consultation history?')) {
                this.chatMessages.innerHTML = '';
                this.addMessage("Bot history cleared. How can I help you?", 'bot');
            }
        };
    }

    setupChat() {
        this.sendBtn.onclick = () => this.handleSendMessage();
        this.chatInput.onkeydown = (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        };
    }

    setupLibrary() {
        this.articleSearch.oninput = (e) => this.debounce(() => this.searchArticles(e.target.value), 400)();
    }

    async loadInitialData() {
        try {
            const res = await fetch('/api/articles');
            const data = await res.json();
            this.renderArticles(data.parts ? data.parts.flatMap(p => p.articles.map(a => ({ ...a, part: p.part, part_title: p.title }))) : []);
        } catch (e) {
            console.error("Failed to load articles", e);
        }
    }

    async handleSendMessage() {
        const query = this.chatInput.value.trim();
        if (!query) return;

        this.addMessage(query, 'user');
        this.chatInput.value = '';
        this.setLoading(true);

        try {
            const res = await fetch('/api/consult', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);
            this.addBotResponse(data.response);
        } catch (e) {
            this.addMessage(`Error: ${e.message}`, 'bot');
        } finally {
            this.setLoading(false);
        }
    }

    addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;
        div.innerHTML = `
            <div class="message-avatar">${sender === 'user' ? '👤' : '⚖️'}</div>
            <div class="message-content">
                <div class="message-bubble"><p>${this.escape(text)}</p></div>
            </div>
        `;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addBotResponse(response) {
        const div = document.createElement('div');
        div.className = 'message bot-message';

        let articlesHtml = response.articles.map(a => `
            <div class="glass-card article-card" style="margin-top: 10px; padding: 10px; font-size: 0.9rem;">
                <strong>Article ${a.number}: ${a.title}</strong>
                <p style="margin-top: 5px; color: var(--text-secondary);">${a.text.substring(0, 100)}...</p>
            </div>
        `).join('');

        div.innerHTML = `
            <div class="message-avatar">⚖️</div>
            <div class="message-content">
                <div class="message-bubble">
                    <div class="advice-content">${this.formatMarkdown(response.advice)}</div>
                    ${articlesHtml}
                    <div style="margin-top: 15px; font-size: 0.8rem; color: var(--accent-gold); border-top: 1px solid var(--glass-border); padding-top: 10px;">
                        ${this.escape(response.disclaimer)}
                    </div>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async searchArticles(query) {
        if (!query) return this.loadInitialData();
        const res = await fetch(`/api/articles?search=${encodeURIComponent(query)}`);
        const data = await res.json();
        this.renderArticles(data.results || []);
    }

    renderArticles(articles) {
        this.articlesGrid.innerHTML = articles.map(a => `
            <div class="glass-card article-card">
                <div style="color: var(--accent-gold); font-weight: bold; margin-bottom: 5px;">Article ${a.number}</div>
                <h3 style="font-size: 1.1rem; margin-bottom: 10px;">${this.escape(a.title)}</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">${this.escape(a.text.substring(0, 150))}...</p>
            </div>
        `).join('');
    }

    setLoading(isLoading) {
        this.loadingIndicator.style.display = isLoading ? 'block' : 'none';
        this.sendBtn.disabled = isLoading;
    }

    formatMarkdown(text) {
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    }

    escape(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}
