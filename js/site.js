(function () {
    'use strict';

    var root = document.documentElement;
    var themeButton = document.querySelector('[data-theme-toggle]');
    var menuButton = document.querySelector('[data-menu-toggle]');
    var siteNav = document.querySelector('[data-site-nav]');
    var dialog = document.querySelector('[data-search-dialog]');
    var input = document.querySelector('[data-search-input]');
    var results = document.querySelector('[data-search-results]');
    var indexNode = document.getElementById('search-index');
    var searchIndex = [];

    try { searchIndex = JSON.parse(indexNode ? indexNode.textContent : '[]'); } catch (error) { searchIndex = []; }

    function setTheme(theme) {
        root.dataset.theme = theme;
        try { localStorage.setItem('bz-theme', theme); } catch (error) { /* private mode */ }
        if (themeButton) themeButton.querySelector('[data-theme-icon]').textContent = theme === 'dark' ? '☀' : '◐';
    }

    if (themeButton) {
        setTheme(root.dataset.theme || 'light');
        themeButton.addEventListener('click', function () { setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'); });
    }

    if (menuButton && siteNav) {
        menuButton.addEventListener('click', function () {
            var open = siteNav.classList.toggle('is-open');
            menuButton.setAttribute('aria-expanded', String(open));
        });
        siteNav.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', function () { siteNav.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); }); });
    }

    function closeSearch() {
        if (!dialog) return;
        dialog.hidden = true;
        document.body.style.overflow = '';
    }

    function openSearch() {
        if (!dialog) return;
        dialog.hidden = false;
        document.body.style.overflow = 'hidden';
        window.setTimeout(function () { if (input) input.focus(); }, 30);
        renderResults(input ? input.value : '');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; });
    }

    function renderResults(query) {
        if (!results) return;
        var normalized = String(query || '').trim().toLowerCase();
        var matches = normalized ? searchIndex.filter(function (post) {
            var haystack = [post.title, post.subtitle, post.excerpt, (post.tags || []).join(' ')].join(' ').toLowerCase();
            return haystack.indexOf(normalized) !== -1;
        }).slice(0, 8) : searchIndex.slice(0, 5);
        if (!matches.length) { results.innerHTML = '<div class="search-empty">没有找到匹配内容，试试另一个关键词。</div>'; return; }
        results.innerHTML = matches.map(function (post) {
            return '<a class="search-result" href="' + escapeHtml(post.url) + '"><strong>' + escapeHtml(post.title) + '</strong><p>' + escapeHtml(post.subtitle || post.excerpt) + '</p><small>' + escapeHtml((post.tags || []).join(' · ')) + '</small></a>';
        }).join('');
    }

    document.querySelectorAll('[data-search-open]').forEach(function (button) { button.addEventListener('click', openSearch); });
    document.querySelectorAll('[data-search-close]').forEach(function (button) { button.addEventListener('click', closeSearch); });
    if (input) input.addEventListener('input', function () { renderResults(input.value); });
    document.addEventListener('keydown', function (event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
        if (event.key === 'Escape' && dialog && !dialog.hidden) closeSearch();
    });

    var toc = document.querySelector('[data-toc]');
    var article = document.querySelector('.post-container');
    if (toc && article) {
        article.querySelectorAll('h2, h3').forEach(function (heading, index) {
            if (!heading.id) heading.id = 'section-' + (index + 1);
            var link = document.createElement('a');
            link.href = '#' + heading.id;
            link.textContent = heading.textContent;
            if (heading.tagName.toLowerCase() === 'h3') link.className = 'toc-h3';
            toc.appendChild(link);
        });
    }
}());
