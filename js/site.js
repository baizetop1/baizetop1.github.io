(function () {
    'use strict';

    var root = document.documentElement;
    var themeButton = document.querySelector('[data-theme-toggle]');
    var menuButton = document.querySelector('[data-menu-toggle]');
    var siteNav = document.querySelector('[data-site-nav]');
    var dialog = document.querySelector('[data-search-dialog]');
    var input = document.querySelector('[data-search-input]');
    var results = document.querySelector('[data-search-results]');
    var categoryFilter = document.querySelector('[data-search-category]');
    var formatFilter = document.querySelector('[data-search-format]');
    var yearFilter = document.querySelector('[data-search-year]');
    var clearFiltersButton = document.querySelector('[data-search-clear]');
    var resultCount = document.querySelector('[data-search-count]');
    var indexNode = document.getElementById('search-index');
    var searchIndex = [];
    var lastFocusedElement = null;
    var activeResultIndex = -1;

    try { searchIndex = JSON.parse(indexNode ? indexNode.textContent : '[]'); } catch (error) { searchIndex = []; }

    function setTheme(theme) {
        root.dataset.theme = theme;
        try { localStorage.setItem('bz-theme', theme); } catch (error) { /* private mode */ }
        var themeColor = document.getElementById('theme-color');
        if (themeColor) themeColor.setAttribute('content', theme === 'dark' ? '#0b1118' : '#f4f3ee');
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
        activeResultIndex = -1;
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
    }

    function openSearch() {
        if (!dialog) return;
        lastFocusedElement = document.activeElement;
        dialog.hidden = false;
        document.body.style.overflow = 'hidden';
        window.setTimeout(function () { if (input) input.focus(); }, 30);
        renderResults(input ? input.value : '');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; });
    }

    function populateFilter(select, values, descending) {
        if (!select) return;
        var sorted = values.filter(Boolean).filter(function (value, index, list) { return list.indexOf(value) === index; });
        sorted.sort(function (left, right) { return descending ? String(right).localeCompare(String(left), 'zh-CN') : String(left).localeCompare(String(right), 'zh-CN'); });
        sorted.forEach(function (value) {
            var option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    populateFilter(categoryFilter, searchIndex.map(function (post) { return post.category || '知识'; }), false);
    populateFilter(formatFilter, searchIndex.map(function (post) { return post.format || '笔记'; }), false);
    populateFilter(yearFilter, searchIndex.map(function (post) { return post.year; }), true);

    function renderResults(query) {
        if (!results) return;
        var normalized = String(query || '').trim().toLowerCase();
        var selectedCategory = categoryFilter ? categoryFilter.value : '';
        var selectedFormat = formatFilter ? formatFilter.value : '';
        var selectedYear = yearFilter ? yearFilter.value : '';
        var filtered = searchIndex.filter(function (post) {
            var haystack = [post.title, post.subtitle, post.category, post.format, post.excerpt, (post.tags || []).join(' ')].join(' ').toLowerCase();
            var queryMatches = !normalized || haystack.indexOf(normalized) !== -1;
            return queryMatches &&
                (!selectedCategory || (post.category || '知识') === selectedCategory) &&
                (!selectedFormat || (post.format || '笔记') === selectedFormat) &&
                (!selectedYear || post.year === selectedYear);
        });
        var hasFilters = selectedCategory || selectedFormat || selectedYear;
        var matches = filtered.slice(0, normalized || hasFilters ? 12 : 5);
        activeResultIndex = -1;
        if (resultCount) resultCount.textContent = filtered.length + ' 个结果';
        if (!matches.length) { results.innerHTML = '<div class="search-empty">没有找到匹配内容，试试其他关键词或清除筛选。</div>'; return; }
        results.innerHTML = matches.map(function (post) {
            var statusLabels = { archived: '历史资料', review: '待复核', verified: '已验证', draft: '草稿', published: '已发布' };
            var status = statusLabels[post.status] || '已发布';
            return '<a class="search-result" href="' + escapeHtml(post.url) + '"><strong>' + escapeHtml(post.title) + '</strong><p>' + escapeHtml(post.subtitle || post.excerpt) + '</p><small>' + escapeHtml(post.date || '') + ' · ' + escapeHtml(post.category || '知识') + ' · ' + escapeHtml(post.format || '笔记') + ' · ' + escapeHtml(status) + ' · ' + escapeHtml((post.tags || []).join(' · ')) + '</small></a>';
        }).join('');
    }

    function focusResult(direction) {
        if (!results) return;
        var links = Array.prototype.slice.call(results.querySelectorAll('.search-result'));
        if (!links.length) return;
        activeResultIndex = (activeResultIndex + direction + links.length) % links.length;
        links[activeResultIndex].focus();
    }

    function refreshSearch() { renderResults(input ? input.value : ''); }

    document.querySelectorAll('[data-search-open]').forEach(function (button) { button.addEventListener('click', openSearch); });
    document.querySelectorAll('[data-search-close]').forEach(function (button) { button.addEventListener('click', closeSearch); });
    if (input) {
        input.addEventListener('input', refreshSearch);
        input.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowDown') { event.preventDefault(); focusResult(1); }
            if (event.key === 'Enter') {
                var firstResult = results ? results.querySelector('.search-result') : null;
                if (firstResult) { event.preventDefault(); firstResult.click(); }
            }
        });
    }
    [categoryFilter, formatFilter, yearFilter].forEach(function (filter) { if (filter) filter.addEventListener('change', refreshSearch); });
    if (clearFiltersButton) clearFiltersButton.addEventListener('click', function () {
        [categoryFilter, formatFilter, yearFilter].forEach(function (filter) { if (filter) filter.value = ''; });
        refreshSearch();
        if (input) input.focus();
    });
    if (results) results.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') { event.preventDefault(); focusResult(1); }
        if (event.key === 'ArrowUp') { event.preventDefault(); focusResult(-1); }
    });
    if (dialog) dialog.addEventListener('keydown', function (event) {
        if (event.key !== 'Tab') return;
        var focusable = Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])')).filter(function (element) { return element.offsetParent !== null; });
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
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

    document.querySelectorAll('.post-container pre').forEach(function (block) {
        block.classList.add('has-copy');
        var copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'code-copy';
        copyButton.textContent = '复制';
        copyButton.addEventListener('click', function () {
            var code = block.querySelector('code');
            var text = code ? code.textContent : block.textContent;
            if (!navigator.clipboard) return;
            navigator.clipboard.writeText(text).then(function () {
                copyButton.textContent = '已复制';
                window.setTimeout(function () { copyButton.textContent = '复制'; }, 1400);
            }).catch(function () { copyButton.textContent = '复制失败'; });
        });
        block.appendChild(copyButton);
    });

    var progress = document.querySelector('[data-reading-progress]');
    if (progress && article) {
        var updateProgress = function () {
            var start = article.getBoundingClientRect().top + window.scrollY - 110;
            var total = Math.max(article.scrollHeight - window.innerHeight, 1);
            var percent = Math.min(100, Math.max(0, ((window.scrollY - start) / total) * 100));
            progress.style.width = percent + '%';
        };
        window.addEventListener('scroll', updateProgress, { passive: true });
        window.addEventListener('resize', updateProgress);
        updateProgress();
    }
}());
