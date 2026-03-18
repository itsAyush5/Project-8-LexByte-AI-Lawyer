// ===== Global State =====
let constitutionData = null;
let currentSection = 'consultation';
let conversationHistory = [];

// ===== DOM Elements =====
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const articleSearch = document.getElementById('articleSearch');
const partsGrid = document.getElementById('partsGrid');
const articlesList = document.getElementById('articlesList');

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadConstitutionData();
    initializeNavigation();
    initializeChatInput();
    initializeQuickQuestions();
    initializeProvisionLinks();
    initializeArticleSearch();
    initializeClearChat();
    initializeScrollTop();
    displayPartsSummary();
});

// ===== Data Loading =====
async function loadConstitutionData() {
    showLoading();
    try {
        const response = await fetch('static/constitution_data.json');
        if (!response.ok) throw new Error('Failed to fetch constitution data');
        constitutionData = await response.json();
    } catch (error) {
        console.error('Error loading constitution data:', error);
        addMessage('Error loading constitution data. Please refresh the page.', 'bot');
    } finally {
        hideLoading();
    }
}

// ===== Legal Logic =====
const LEGAL_TERMS = {
    'fundamental rights': ['14', '15', '16', '17', '18', '19', '20', '21', '21A', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32'],
    'right to equality': ['14', '15', '16', '17', '18'],
    'right to freedom': ['19', '20', '21', '21A', '22'],
    'right against exploitation': ['23', '24'],
    'right to freedom of religion': ['25', '26', '27', '28'],
    'cultural and educational rights': ['29', '30'],
    'directive principles': Array.from({length: 16}, (_, i) => (i + 36).toString()),
    'fundamental duties': ['51A'],
    'president': Array.from({length: 26}, (_, i) => (i + 52).toString()),
    'parliament': Array.from({length: 45}, (_, i) => (i + 79).toString()),
    'supreme court': Array.from({length: 24}, (_, i) => (i + 124).toString()),
    'citizenship': ['5', '6', '7', '8', '9', '10', '11'],
    'privacy': ['21'],
    'property': ['300A', '31A', '31B', '31C'],
    'emergency': ['352', '356', '360'],
    'secular': ['25', '26', '27', '28'],
    'amnesty': ['72', '161'],
    'women': ['15', '39', '42', '51A'],
    'children': ['24', '39', '45'],
    'environment': ['48A', '51A'],
    'language': ['343', '344', '345', '346', '347', '348', '349', '350', '350A', '350B', '351'],
    'panchayat': Array.from({length: 16}, (_, i) => (i === 0 ? '243' : '243' + String.fromCharCode(64 + i))),
    'municipality': Array.from({length: 18}, (_, i) => '243' + String.fromCharCode(80 + i)),
    'trade': ['301', '302', '303', '304', '305', '306', '307'],
    'election': ['324', '325', '326', '327', '328', '329'],
    'finance': ['264', '265', '266', '267', '280']
};

function searchArticles(query) {
    if (!constitutionData) return [];
    
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\W+/).filter(w => w.length > 2);
    const results = [];
    
    constitutionData.parts.forEach(part => {
        part.articles.forEach(article => {
            let score = 0;
            
            if (queryLower.includes(`article ${article.number}`) || queryLower.includes(`art ${article.number}`)) {
                score += 100;
            }
            
            keywords.forEach(kw => {
                if (article.keywords && article.keywords.includes(kw)) score += 10;
                if (article.title.toLowerCase().includes(kw)) score += 15;
                if (article.text.toLowerCase().includes(kw)) score += 5;
            });
            
            for (const [term, articleNumbers] of Object.entries(LEGAL_TERMS)) {
                if (queryLower.includes(term) && articleNumbers.includes(article.number)) {
                    score += 20;
                }
            }
            
            if (score > 0) {
                results.push({
                    article: article,
                    part: part.part,
                    part_title: part.title,
                    score: score
                });
            }
        });
    });
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
}

function generateLegalAdvice(query, relevantArticles) {
    if (relevantArticles.length === 0) {
        return {
            advice: "I couldn't find specific constitutional articles related to your query. Please try rephrasing your question or ask about specific fundamental rights, directive principles, or constitutional provisions.",
            articles: [],
            disclaimer: "This is an AI-generated response based on the Indian Constitution. For specific legal matters, please consult a qualified lawyer."
        };
    }
    
    const topArticles = relevantArticles.slice(0, 5);
    let adviceParts = ["Based on the Indian Constitution, here's what I found:\n"];
    
    topArticles.forEach((result, idx) => {
        const article = result.article;
        adviceParts.push(`\n${idx + 1}. **Article ${article.number}: ${article.title}** (Part ${result.part} - ${result.part_title})`);
        adviceParts.push(`   ${article.text.substring(0, 300)}${article.text.length > 300 ? '...' : ''}\n`);
    });
    
    const queryLower = query.toLowerCase();
    
    if (/\bright|rights|can i|allowed\b/.test(queryLower)) {
        adviceParts.push("\n**Legal Interpretation:**");
        adviceParts.push("The above constitutional provisions establish your rights and protections under Indian law. These are fundamental guarantees that the State must respect.");
    }
    
    if (/\barrest|detention|police\b/.test(queryLower)) {
        adviceParts.push("\n**Important Rights regarding Arrest:**");
        adviceParts.push("- You have the right to be informed of grounds for arrest (Article 22)");
        adviceParts.push("- Right to legal representation of your choice");
        adviceParts.push("- Must be produced before magistrate within 24 hours");
        adviceParts.push("- Protection against self-incrimination (Article 20)");
    }
    
    if (/\bdiscrimination|equality|equal\b/.test(queryLower)) {
        adviceParts.push("\n**Equality Provisions:**");
        adviceParts.push("The Constitution guarantees equality before law (Article 14) and prohibits discrimination on grounds of religion, race, caste, sex, or place of birth (Article 15).");
    }
    
    if (/\bspeech|expression|freedom\b/.test(queryLower)) {
        adviceParts.push("\n**Freedom of Speech:**");
        adviceParts.push("Article 19(1)(a) guarantees freedom of speech and expression, subject to reasonable restrictions in the interest of sovereignty, security, public order, decency, morality, contempt of court, defamation, or incitement to an offence.");
    }

    if (/\bemergency|president rule\b/.test(queryLower)) {
        adviceParts.push("\n**Emergency Provisions:**");
        adviceParts.push("The Constitution provides for National Emergency (Art 352), State Emergency (Art 356), and Financial Emergency (Art 360). During emergency, some fundamental rights may be suspended.");
    }

    if (/\benvironment|forest|wildlife\b/.test(queryLower)) {
        adviceParts.push("\n**Environmental Protection:**");
        adviceParts.push("Article 48A (DPSP) and Article 51A(g) (Fundamental Duties) mandate the protection and improvement of the environment.");
    }

    if (/\blanguage|hindi|english|official\b/.test(queryLower)) {
        adviceParts.push("\n**Official Language:**");
        adviceParts.push("Article 343 declares Hindi as the official language. Article 345 deals with official languages of States, and Article 348 covers the language of Supreme Court and High Courts.");
    }

    if (/\bpanchayat|village|local government\b/.test(queryLower)) {
        adviceParts.push("\n**Panchayati Raj:**");
        adviceParts.push("Part IX (Articles 243 to 243O) provides for the Constitution of Panchayats at the village, intermediate and district levels, ensuring local self-governance.");
    }

    if (/\bmunicipality|city|urban government\b/.test(queryLower)) {
        adviceParts.push("\n**Municipalities:**");
        adviceParts.push("Part IXA (Articles 243P to 243ZG) deals with Municipalities, providing for their constitution, composition, and powers in urban areas.");
    }

    if (/\btrade|commerce|business\b/.test(queryLower)) {
        adviceParts.push("\n**Trade and Commerce:**");
        adviceParts.push("Article 301 guarantees that trade, commerce, and intercourse throughout the territory of India shall be free, subject to certain restrictions.");
    }
    
    return {
        advice: adviceParts.join('\n'),
        articles: topArticles.map(r => ({
            number: r.article.number,
            title: r.article.title,
            text: r.article.text,
            part: r.part,
            part_title: r.part_title
        })),
        disclaimer: "⚖️ **Legal Disclaimer:** This is an AI-generated response based on the Indian Constitution. It is for informational purposes only and does not constitute legal advice. For specific legal matters, please consult a qualified lawyer or legal professional."
    };
}

// ===== UI Logic =====
function initializeNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.dataset.section;
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
            currentSection = targetSection;
        });
    });
}

function initializeChatInput() {
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    sendBtn.addEventListener('click', sendMessage);
}

function initializeQuickQuestions() {
    document.querySelectorAll('.quick-btn[data-question]').forEach(btn => {
        btn.addEventListener('click', () => {
            chatInput.value = btn.dataset.question;
            sendMessage();
        });
    });
}

function initializeProvisionLinks() {
    document.querySelectorAll('.provision-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            chatInput.value = `What is Article ${item.dataset.article}?`;
            sendMessage();
        });
    });
}

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    showLoading();

    setTimeout(() => {
        const relevantArticles = searchArticles(message);
        const response = generateLegalAdvice(message, relevantArticles);
        addBotResponse(response);
        conversationHistory.push({
            query: message,
            response: response,
            timestamp: new Date().toISOString()
        });
        hideLoading();
    }, 400);
}

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${sender === 'user' ? '👤' : '⚖️'}</div>
        <div class="message-content">
            <div class="message-text"><p>${escapeHtml(text)}</p></div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addBotResponse(response) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    
    let formattedAdvice = response.advice
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    let articlesHtml = '';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '⚖️';

    const content = document.createElement('div');
    content.className = 'message-content';

    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.innerHTML = `<p>${formattedAdvice}</p>`;

    if (response.articles && response.articles.length > 0) {
        response.articles.forEach(article => {
            const articleRef = document.createElement('div');
            articleRef.className = 'article-reference';
            articleRef.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4>Article ${article.number}: ${escapeHtml(article.title)}</h4>
                    <button class="copy-btn">Copy</button>
                </div>
                <p><strong>Part ${article.part}:</strong> ${escapeHtml(article.part_title)}</p>
                <p>${escapeHtml(article.text.substring(0, 200))}${article.text.length > 200 ? '...' : ''}</p>
            `;
            
            articleRef.querySelector('.copy-btn').addEventListener('click', () => {
                copyToClipboard(article.text, articleRef.querySelector('.copy-btn'));
            });

            messageText.appendChild(articleRef);
        });
    }

    const disclaimer = document.createElement('div');
    disclaimer.className = 'disclaimer';
    disclaimer.textContent = response.disclaimer.replace(/⚖️ \*\*Legal Disclaimer:\*\* /g, '');
    messageText.appendChild(disclaimer);

    content.appendChild(messageText);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== Article Section =====
function initializeArticleSearch() {
    const searchBtn = document.querySelector('.search-btn');
    articleSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchArticlesAction(); });
    searchBtn.addEventListener('click', searchArticlesAction);
}

function displayPartsSummary() {
    if (!constitutionData) return;
    partsGrid.innerHTML = '';
    constitutionData.parts.forEach(part => {
        const partCard = document.createElement('div');
        partCard.className = 'part-card';
        partCard.innerHTML = `
            <div class="part-number">Part ${part.part}</div>
            <div class="part-title">${escapeHtml(part.title)}</div>
            <div class="part-count">${part.articles.length} Articles</div>
        `;
        partCard.addEventListener('click', () => displayArticles(part.articles, `Part ${part.part}: ${part.title}`));
        partsGrid.appendChild(partCard);
    });
}

function searchArticlesAction() {
    const query = articleSearch.value.trim();
    if (!query) {
        displayPartsSummary();
        articlesList.innerHTML = '';
        return;
    }
    const results = searchArticles(query);
    displayArticles(results.map(r => ({...r.article, part: r.part, part_title: r.part_title})), `Search Results for "${query}"`);
}

function displayArticles(articles, title) {
    articlesList.innerHTML = `<h3 style="color: var(--accent-gold); font-size: 1.5rem; margin-bottom: 1.5rem;">${escapeHtml(title)}</h3>`;
    if (articles.length === 0) {
        articlesList.innerHTML += '<p style="color: var(--text-secondary);">No articles found.</p>';
        return;
    }
    articles.forEach(article => {
        const articleCard = document.createElement('div');
        articleCard.className = 'article-card';
        articleCard.style.cursor = 'pointer';
        articleCard.innerHTML = `
            <div class="article-header">
                <div class="article-number-badge">Art. ${article.number}</div>
                <div class="article-title-section">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="article-title">${escapeHtml(article.title)}</div>
                        <button class="copy-btn">Copy</button>
                    </div>
                    <div class="article-part">Part ${article.part || 'N/A'} - ${escapeHtml(article.part_title || '')}</div>
                </div>
            </div>
            <div class="article-text">${escapeHtml(article.text.substring(0, 200))}${article.text.length > 200 ? '...' : ''}</div>
        `;

        articleCard.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(article.text, articleCard.querySelector('.copy-btn'));
        });

        articleCard.addEventListener('click', () => showArticleModal(article));
        articlesList.appendChild(articleCard);
    });
    articlesList.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Globals & Modals =====
window.copyToClipboard = async function(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.borderColor = 'var(--success-color)';
        btn.style.color = 'var(--success-color)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2000);
    } catch (err) { console.error('Failed to copy: ', err); }
};

function showArticleModal(article) {
    const modal = document.getElementById('articleModal');
    document.getElementById('modalArticleNumber').textContent = `Article ${article.number}`;
    document.getElementById('modalArticleTitle').textContent = article.title;
    document.getElementById('modalArticlePart').textContent = `Part ${article.part || 'N/A'} - ${article.part_title || 'Not specified'}`;
    document.getElementById('modalArticleText').textContent = article.text;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (!modal.dataset.handlersInitialized) {
        document.getElementById('modalCloseBtn').addEventListener('click', closeArticleModal);
        modal.querySelector('.article-modal-backdrop').addEventListener('click', closeArticleModal);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) closeArticleModal(); });
        modal.dataset.handlersInitialized = 'true';
    }
}

function closeArticleModal() {
    document.getElementById('articleModal').classList.remove('active');
    document.body.style.overflow = '';
}

function initializeClearChat() {
    const clearBtn = document.getElementById('clearChat');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the chat history?')) {
                chatMessages.innerHTML = '';
                conversationHistory = [];
                addMessage('Welcome to AI Lawyer! I\'m your constitutional legal assistant.', 'bot');
            }
        });
    }
}

function initializeScrollTop() {
    const scrollBtn = document.getElementById('scrollTopBtn');
    if (scrollBtn) {
        window.addEventListener('scroll', () => { scrollBtn.style.display = window.pageYOffset > 300 ? 'flex' : 'none'; });
        scrollBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
}

function showLoading() { loadingOverlay.classList.add('active'); }
function hideLoading() { loadingOverlay.classList.remove('active'); }
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
