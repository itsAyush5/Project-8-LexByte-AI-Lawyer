(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  let currentQuery = '';
  let activePart = 'All Parts';
  let articles = [];
  let parts = [];
  const emptyState = '<div class="empty-state"><span class="spark">✧</span><h3>Begin a consultation</h3><p>Try a prompt below or type your own question. Responses are grounded in constitutional Articles.</p></div>';

  function renderFilters() {
    const container = $('#partFilters');
    if (!container) return;
    container.innerHTML = `
      <button type="button" class="filter-chip ${activePart === 'All Parts' ? 'active' : ''}" data-part="All Parts">All Parts</button>
      ${parts.map((part) => `<button type="button" class="filter-chip ${activePart === part ? 'active' : ''}" data-part="${part}">${part}</button>`).join('')}
    `;
  }

  function renderResults(matches) {
    const container = $('#results');
    const count = $('#matchCount');
    if (!container) return;
    count && (count.textContent = matches.length);
    if (!matches.length) {
      container.innerHTML = '<div class="no-results">No articles found matching your search.</div>';
      return;
    }
    container.innerHTML = matches.map((article) => `
      <article class="article-card">
        <div class="card-meta">
          <span class="part-tag">${article.part}</span>
          <span class="article-id">Article ${article.number}</span>
        </div>
        <h3>${article.title}</h3>
        <p>${article.summary}</p>
        <button type="button" class="ask-article" data-ask-article="${article.number}">✧ Ask about this article</button>
      </article>
    `).join('');
  }

  function search(query, limit = 0) {
    let filtered = articles;
    if (activePart !== 'All Parts') {
      filtered = filtered.filter((a) => a.part === activePart);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter((a) =>
        String(a.number) === q ||
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q)
      );
    }
    return limit > 0 ? filtered.slice(0, limit) : filtered;
  }

  function formatAnswer(text) {
    if (!text) return '';
    return text.trim().split('\n\n')
      .map(line => `<p>${line}</p>`)
      .join('');
  }



  function renderStreamStart(question, isStatic = false, isProxy = false) {
    const answerBox = $('#answer');
    if (!answerBox) return;
    answerBox.innerHTML = `
      <div class="message">
        <div class="question-bubble">${escapeHtml(question)}</div>
        <div class="answer-card">
          <span>${isStatic ? 'Static AI mode' : (isProxy ? 'LexByte AI · Securing' : 'LexByte AI · Streaming')}</span>
          <div class="answer-body" id="streamBody">
            ${isStatic ? '' : '<span class="cursor-blink">▍</span>'}
          </div>
        </div>
      </div>`;
  }

  async function askQuestion(question) {
    if (!question) return;
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    // YOUR CLOUDFLARE WORKER URL
    const PROXY_URL = 'https://bold-wave-210a.ayushkunkulol5.workers.dev';

    // 1. Try Local API ONLY if on localhost
    if (isLocal) {
      renderStreamStart(question);
      try {
        const response = await fetch('api/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });
        if (response.ok) return handleStreamResponse(response);
      } catch (e) {
        console.log('Local backend not available.');
      }
    }

    // 2. Try Cloudflare Proxy (Standard for production)
    if (PROXY_URL) {
      renderStreamStart(question, false, true);

      const fallbackModels = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen3-coder:free",
        "google/gemma-4-31b-it:free",
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "google/gemini-2.0-pro-exp-02-05:free"
      ];

      let streamHandled = false;

      for (const model of fallbackModels) {
        try {
          console.log(`Trying AI Model: ${model}`);
          const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, model: model })
          });

          if (response.ok) {
            await handleStreamResponse(response);
            streamHandled = true;
            break; // Stop loop if successfully streamed
          } else {
            console.warn(`Model ${model} failed with status ${response.status}`);
          }
        } catch (e) {
          console.error(`Cloudflare Proxy error for ${model}:`, e);
        }
      }

      if (streamHandled) return;
    }

    // 3. Fallback Error State
    renderStreamStart(question, false, false);
    const body = document.getElementById('streamBody');
    if (body) {
      body.innerHTML = formatAnswer('The AI is temporarily unavailable or rate-limited. Please try again in a few minutes.');
    }
  }

  async function handleStreamResponse(response) {
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
    const body = document.getElementById('streamBody');
    if (body) body.innerHTML = formatAnswer(fullText);
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
    $('#search')?.addEventListener('input', (event) => {
      currentQuery = event.target.value;
      renderResults(search(currentQuery));
    });

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
    // Read data AFTER all scripts have loaded
    articles = window.CONSTITUTION_ARTICLES || window.constitutionData || [];
    parts = [...new Set(articles.map((item) => item.part))];

    const total = $('#articleTotal');
    if (total) total.textContent = articles.length;
    renderFilters();
    renderResults(articles);
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();