(() => {
  const params = new URLSearchParams(location.search);
  const form = document.querySelector('form.cmp_form');
  const results = document.querySelector('.search_results');
  const status = document.querySelector('[role="status"]');
  if (!form || !results || !status) return;
  for (const [key, value] of params) {
    const field = form.elements.namedItem(key);
    if (field && 'value' in field) field.value = value;
  }
  const query = (params.get('query') || '').trim().toLocaleLowerCase();
  const author = (params.get('authors') || '').trim().toLocaleLowerCase();
  const bound = prefix => {
    const year = params.get(prefix + 'Year');
    if (!year) return '';
    return [year, (params.get(prefix + 'Month') || (prefix === 'dateFrom' ? '01' : '12')).padStart(2, '0'),
      (params.get(prefix + 'Day') || (prefix === 'dateFrom' ? '01' : '31')).padStart(2, '0')].join('-');
  };
  const from = bound('dateFrom'), to = bound('dateTo');
  status.textContent = '';
  if (!query && !author && !from && !to) {
    status.textContent = 'Masukkan kata kunci atau gunakan filter untuk mencari artikel lokal.';
    return;
  }
  const words = query.split(/\s+/).filter(Boolean);
  const matches = window.JPIP_SEARCH_DATA.filter(item => {
    const text = [item.title, ...item.authors, ...item.keywords].join(' ').toLocaleLowerCase();
    const names = item.authors.join(' ').toLocaleLowerCase();
    return words.every(word => text.includes(word)) && (!author || names.includes(author)) &&
      (!from || (item.dateEnd || item.date) >= from) && (!to || (item.dateStart || item.date) <= to);
  });
  status.textContent = matches.length ? `${matches.length} artikel ditemukan.` : 'Tidak ada artikel yang cocok.';
  for (const item of matches) {
    const li = document.createElement('li');
    if(item.summaryHtml){
      li.innerHTML=item.summaryHtml;
      results.append(li);
      continue;
    }
    li.className = 'obj_article_summary';
    const heading = document.createElement('h3');
    heading.className = 'title';
    const link = document.createElement('a');
    link.href = `articles/${item.id}.html`;
    link.textContent = item.title;
    heading.append(link);
    const detail = document.createElement('div');
    detail.className = 'meta';
    detail.textContent = `${item.authors.join(', ')}${item.displayDate ? ` · ${item.displayDate}` : ''}`;
    li.append(heading, detail);
    results.append(li);
  }
})();
