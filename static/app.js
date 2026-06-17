(() => {
  const articles = Array.isArray(window.CONSTITUTION_ARTICLES) ? window.CONSTITUTION_ARTICLES : [];
  const stopwords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'my', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'who', 'why', 'with', 'can', 'do', 'does', 'under', 'about', 'please', 'tell', 'me']);
  const emptyState = `
    <div class="empty-state">
      <span class="spark">✧</span>
      <h3>Begin a consultation</h3>
      <p>Try a prompt below or type your own question. Responses are grounded in constitutional Articles.</p>
      <div class="prompt-grid">
        <button type="button" class="prompt">Explain Article 21 — Right to Life — in plain language.</button>
        <button type="button" class="prompt">What is the doctrine of basic structure?</button>
        <button type="button" class="prompt">Difference between Fundamental Rights and Directive Principles.</button>
        <button type="button" class="prompt">Can the President promulgate an ordinance during Parliament’s session?</button>
      </div>
    </div>`;
  let activePart = 'All Parts';
  let currentQuery = '';

  function $(selector) { return document.querySelector(selector); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }
  function tokens(text) { return String(text || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => !stopwords.has(word)) || []; }
  function haystack(article) { return `${article.number} ${article.title} ${article.part} ${article.summary} ${(article.keywords || []).join(' ')}`.toLowerCase(); }
  function partLabel(article) { return (article.part.match(/Part [A-Z]+(?:-[A-Z]+)?|Part [A-Z]+/i) || ['Part'])[0]; }
  function partName(article) { return article.part.split('—')[0].trim(); }
  function search(query, limit = 999) {
    const terms = tokens(query);
    const filtered = activePart === 'All Parts' ? articles : articles.filter((article) => partName(article) === activePart);
    if (!terms.length) return filtered.slice(0, limit);
    return filtered.map((article) => {
      const text = haystack(article);
      let score = 0;
      terms.forEach((term) => {
        if (term === String(article.number)) score += 40;
        if (article.title.toLowerCase().includes(term)) score += 14;
        if (article.part.toLowerCase().includes(term)) score += 8;
        if (text.includes(term)) score += text.split(term).length - 1;
      });
      return { score, article };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.article.number - b.article.number).slice(0, limit).map((item) => item.article);
  }
  function snippet(text, max = 170) { return text.length > max ? `${text.slice(0, max).trim()}...` : text; }
  function renderResults(items) {
    const matchCount = $('#matchCount');
    const results = $('#results');
    if (!matchCount || !results) return;
    matchCount.textContent = items.length;
    results.innerHTML = items.slice(0, 24).map((article) => `
      <article class="article-card" data-article-number="${article.number}">
        <div class="article-top"><span>${escapeHtml(partLabel(article))}</span><a href="#consult" data-ask-article="${article.number}" aria-label="Ask about Article ${article.number}">↗</a></div>
        <strong>${article.number}</strong>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(snippet(article.summary))}</p>
      </article>`).join('') || '<p class="empty-results">No articles found. Try another keyword or clear the selected Part.</p>';
  }
  function renderFilters() {
    const filters = $('#partFilters');
    if (!filters) return;
    const counts = articles.reduce((acc, article) => {
      const name = partName(article);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const parts = ['All Parts', ...Object.keys(counts)];
    filters.innerHTML = parts.map((part) => {
      const count = part === 'All Parts' ? articles.length : counts[part];
      return `<button type="button" class="part-chip ${part === activePart ? 'active' : ''}" data-part="${escapeHtml(part)}">${escapeHtml(part)} <span>· ${count}</span></button>`;
    }).join('');
  }
  function consult(question) {
    const previousPart = activePart;
    activePart = 'All Parts';
    const matches = search(question, 5);
    activePart = previousPart;
    if (!matches.length) return { confidence: 'Low', answer: 'No direct constitutional article was found. Try a more specific right, institution, or article number.', relatedArticles: [] };
    const primary = matches[0];
    const related = matches.slice(0, 3).map((article) => `Article ${article.number} — ${article.title}`).join('; ');
    return { confidence: matches.length >= 3 ? 'High' : 'Medium', answer: `Most relevant: Article ${primary.number} — ${primary.title}. ${primary.summary} Related constitutional hooks include ${related}. This is legal information, not a substitute for advice from a licensed advocate.`, relatedArticles: matches };
  }
  function formatAnswer(text) {
    // Split on double or single newlines into paragraphs
    return text
      .split(/\n\n+|\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p>${line}</p>`)
      .join('');
  }
  function renderAnswer(question, data, mode = 'AI response') {
    const answerBox = $('#answer');
    if (!answerBox) return;
    const formattedAnswer = formatAnswer(data.answer || '');
    answerBox.innerHTML = `
      <div class="message">
        <div class="question-bubble">${escapeHtml(question)}</div>
        <div class="answer-card">
          <span>${escapeHtml(mode)} · ${escapeHtml(data.confidence || 'Static')} confidence</span>
          <div class="answer-body">${formattedAnswer}</div>
        </div>
      </div>`;
  }
  function renderStreamStart(question) {
    const answerBox = $('#answer');
    if (!answerBox) return;
    answerBox.innerHTML = `
      <div class="message">
        <div class="question-bubble">${escapeHtml(question)}</div>
        <div class="answer-card">
          <span>Flask AI · Streaming</span>
          <div class="answer-body" id="streamBody"><span class="cursor-blink">▍</span></div>
        </div>
      </div>`;
  }
  async function askQuestion(question) {
    if (!question) return;
    const canUseApi = window.location.protocol.startsWith('http') && !window.location.hostname.endsWith('github.io');
    if (canUseApi && typeof fetch === 'function') {
      renderStreamStart(question);
      try {
        const response = await fetch('api/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });
        if (!response.ok) throw new Error('API error');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.text) {
                fullText += data.text;
                const body = document.getElementById('streamBody');
                if (body) {
                  body.innerHTML = formatAnswer(fullText) + '<span class="cursor-blink">▍</span>';
                  body.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
              }
            } catch (_) { }
          }
        }
        // Remove cursor when done
        const body = document.getElementById('streamBody');
        if (body) body.innerHTML = formatAnswer(fullText);
        return;
      } catch (_) { }
    }
    // Fallback to static mode
    const answerBox = $('#answer');
    if (!answerBox) return;
    const data = consult(question);
    const formattedAnswer = formatAnswer(data.answer || '');
    answerBox.innerHTML = `
      <div class="message">
        <div class="question-bubble">${escapeHtml(question)}</div>
        <div class="answer-card">
          <span>Static AI mode · ${escapeHtml(data.confidence || 'Static')} confidence</span>
          <div class="answer-body">${formattedAnswer}</div>
        </div>
      </div>`;
  }
  function resetChat() {
    const answerBox = $('#answer');
    if (answerBox) answerBox.innerHTML = emptyState;
  }
  function askAboutArticle(number) {
    const article = articles.find((item) => String(item.number) === String(number));
    if (article) askQuestion(`Explain Article ${article.number}: ${article.title}`);
  }
  function bindEvents() {
    $('#search')?.addEventListener('input', (event) => { currentQuery = event.target.value; renderResults(search(currentQuery)); });
    $('#partFilters')?.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-part]');
      if (!chip) return;
      activePart = chip.dataset.part;
      renderFilters();
      renderResults(search(currentQuery));
    });
    $('#results')?.addEventListener('click', (event) => {
      const askLink = event.target.closest('[data-ask-article]');
      if (!askLink) return;
      askAboutArticle(askLink.dataset.askArticle);
    });
    $('#consultForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = $('#question');
      askQuestion(input.value.trim());
      input.value = '';
    });
    document.addEventListener('click', (event) => {
      const prompt = event.target.closest('.prompt');
      if (prompt) askQuestion(prompt.textContent.trim());
    });
    $('#newChat')?.addEventListener('click', resetChat);
  }
  function init() {
    $('#articleTotal') && ($('#articleTotal').textContent = articles.length);
    renderFilters();
    renderResults(articles);
    bindEvents();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();