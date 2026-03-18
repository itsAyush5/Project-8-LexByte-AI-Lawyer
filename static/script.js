// ===== Global State =====
const API_BASE = window.location.origin;
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
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeChatInput();
    initializeQuickQuestions();
    initializeProvisionLinks();
    initializeArticleSearch();
    initializeClearChat();
    initializeScrollTop();
    loadParts();
});

// ===== Navigation =====
function initializeNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.dataset.section;

            // Update active states
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');

            currentSection = targetSection;
        });
    });
}

// ===== Chat Functionality =====
function initializeChatInput() {
    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });

    // Send on Enter (Shift+Enter for new line)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button click
    sendBtn.addEventListener('click', sendMessage);
}

function initializeQuickQuestions() {
    const quickBtns = document.querySelectorAll('.quick-btn');
    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.dataset.question;
            chatInput.value = question;
            sendMessage();
        });
    });
}

function initializeProvisionLinks() {
    const provisionItems = document.querySelectorAll('.provision-item');
    provisionItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const articleNumber = item.dataset.article;
            chatInput.value = `What is Article ${articleNumber}?`;
            sendMessage();
        });
    });
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Show loading
    showLoading();

    try {
        // Send to API
        const response = await fetch(`${API_BASE}/api/consult`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: message })
        });

        if (!response.ok) {
            throw new Error('Failed to get response');
        }

        const data = await response.json();

        // Add bot response
        addBotResponse(data.response);

        // Store in history
        conversationHistory.push({
            query: message,
            response: data.response,
            timestamp: data.timestamp
        });

    } catch (error) {
        console.error('Error:', error);
        addMessage('Sorry, I encountered an error processing your request. Please try again.', 'bot');
    } finally {
        hideLoading();
    }
}

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? '👤' : '⚖️';

    const content = document.createElement('div');
    content.className = 'message-content';

    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.innerHTML = `<p>${escapeHtml(text)}</p>`;

    content.appendChild(messageText);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addBotResponse(response) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '⚖️';

    const content = document.createElement('div');
    content.className = 'message-content';

    const messageText = document.createElement('div');
    messageText.className = 'message-text';

    // Format the advice text (convert markdown-style formatting)
    let formattedAdvice = response.advice
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    messageText.innerHTML = `<p>${formattedAdvice}</p>`;

    // Add article references if available
    if (response.articles && response.articles.length > 0) {
        response.articles.forEach(article => {
            const articleRef = document.createElement('div');
            articleRef.className = 'article-reference';
            articleRef.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4>Article ${article.number}: ${escapeHtml(article.title)}</h4>
                    <button class="copy-btn" title="Copy article text">Copy</button>
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

    // Add disclaimer
    if (response.disclaimer) {
        const disclaimer = document.createElement('div');
        disclaimer.className = 'disclaimer';
        disclaimer.textContent = response.disclaimer.replace(/⚖️ \*\*Legal Disclaimer:\*\* /g, '');
        messageText.appendChild(disclaimer);
    }

    content.appendChild(messageText);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== Articles Section =====
function initializeArticleSearch() {
    const searchBtn = document.querySelector('.search-btn');

    articleSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchArticles();
        }
    });

    searchBtn.addEventListener('click', searchArticles);
}

async function loadParts() {
    try {
        const response = await fetch(`${API_BASE}/api/articles`);
        const data = await response.json();

        if (data.parts) {
            displayParts(data.parts);
        }
    } catch (error) {
        console.error('Error loading parts:', error);
    }
}

function displayParts(parts) {
    partsGrid.innerHTML = '';

    parts.forEach(part => {
        const partCard = document.createElement('div');
        partCard.className = 'part-card';
        partCard.innerHTML = `
            <div class="part-number">Part ${part.part}</div>
            <div class="part-title">${escapeHtml(part.title)}</div>
            <div class="part-count">${part.article_count} Articles</div>
        `;

        partCard.addEventListener('click', () => loadPartArticles(part.part));
        partsGrid.appendChild(partCard);
    });
}

async function loadPartArticles(partNumber) {
    showLoading();

    try {
        const response = await fetch(`${API_BASE}/api/articles?part=${partNumber}`);
        const data = await response.json();

        if (data.articles) {
            displayArticles(data.articles, `Part ${data.part}: ${data.title}`);
        }
    } catch (error) {
        console.error('Error loading articles:', error);
    } finally {
        hideLoading();
    }
}

async function searchArticles() {
    const query = articleSearch.value.trim();
    if (!query) {
        loadParts();
        articlesList.innerHTML = '';
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE}/api/articles?search=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.results) {
            displayArticles(data.results, `Search Results for "${query}"`);
        }
    } catch (error) {
        console.error('Error searching articles:', error);
    } finally {
        hideLoading();
    }
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
                        <button class="copy-btn" title="Copy full article text">Copy</button>
                    </div>
                    <div class="article-part">Part ${article.part || 'N/A'} - ${escapeHtml(article.part_title || '')}</div>
                </div>
            </div>
            <div class="article-text">${escapeHtml(article.text.substring(0, 200))}${article.text.length > 200 ? '...' : ''}</div>
        `;

        // Copy button handler
        articleCard.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(article.text, articleCard.querySelector('.copy-btn'));
        });

        // Add click handler to open modal with full article details
        articleCard.addEventListener('click', () => showArticleModal(article));
        articlesList.appendChild(articleCard);
    });

    // Scroll to articles list
    articlesList.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initializeClearChat() {
    const clearBtn = document.getElementById('clearChat');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the chat history?')) {
                chatMessages.innerHTML = '';
                conversationHistory = [];
                // Add initial greeting back
                addMessage('Welcome to AI Lawyer! I\'m your constitutional legal assistant.', 'bot');
            }
        });
    }
}

function initializeScrollTop() {
    const scrollBtn = document.getElementById('scrollTopBtn');
    if (scrollBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollBtn.style.display = 'flex';
            } else {
                scrollBtn.style.display = 'none';
            }
        });

        scrollBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

async function copyToClipboard(text, btn) {
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
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}

// ===== Article Modal Functions =====
function showArticleModal(article) {
    const modal = document.getElementById('articleModal');
    const modalNumber = document.getElementById('modalArticleNumber');
    const modalTitle = document.getElementById('modalArticleTitle');
    const modalPart = document.getElementById('modalArticlePart');
    const modalText = document.getElementById('modalArticleText');

    // Populate modal with article data
    modalNumber.textContent = `Article ${article.number}`;
    modalTitle.textContent = article.title;
    modalPart.textContent = `Part ${article.part || 'N/A'} - ${article.part_title || 'Not specified'}`;
    modalText.textContent = article.text;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Initialize modal close handlers if not already done
    if (!modal.dataset.handlersInitialized) {
        initializeModalCloseHandlers();
        modal.dataset.handlersInitialized = 'true';
    }
}

function closeArticleModal() {
    const modal = document.getElementById('articleModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
}

function initializeModalCloseHandlers() {
    const modal = document.getElementById('articleModal');
    const closeBtn = document.getElementById('modalCloseBtn');
    const backdrop = modal.querySelector('.article-modal-backdrop');

    // Close button click
    closeBtn.addEventListener('click', closeArticleModal);

    // Backdrop click
    backdrop.addEventListener('click', closeArticleModal);

    // ESC key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeArticleModal();
        }
    });
}

// ===== Utility Functions =====
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Error Handling =====
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

// ===== Service Worker (Optional - for offline support) =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js');
    });
}
