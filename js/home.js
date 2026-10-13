// Home page. Every word and piece comes from SiteContent (Tori's own edits, or the starting copy);
// photos for the on-stage strip come from data/media.json.
(async function () {
  const $ = s => document.querySelector(s);
  const { esc, ok, workMedia } = SiteContent;
  setTimeout(() => document.body.classList.remove('loading'), 6000); // never leave the page blank

  // Shows on September 20 only, and counts up on its own each year.
  const now = new Date();
  if (now.getMonth() === 8 && now.getDate() === 20) {
    const n = now.getFullYear() - 2004;
    const sfx = (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    $('#bday').textContent = 'Happy ' + n + sfx + ' birthday, Tori';
    $('#bday').hidden = false;
  }

  const [c, m] = await Promise.all([
    SiteContent.load(),
    fetch('data/media.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}))
  ]);
  const T = c.text;

  // Plain text slots. An empty one hides itself.
  document.querySelectorAll('[data-t]').forEach(el => {
    const v = T[el.dataset.t] || '';
    el.textContent = v;
    el.hidden = !v;
  });

  // Choreography cards: only pieces with a working video, not hidden.
  const works = c.works.filter(w => !w.hidden).map(w => { const media = workMedia(w); return media ? { w, media } : null; }).filter(Boolean);
  const list = works.map(x => x.media);
  $('#works').innerHTML = '';
  works.forEach(({ w, media }, idx) => {
    const b = document.createElement('button');
    b.className = 'work-card';
    const credits = [['Choreography', 'Tori Ugalde'], ['Style', w.style], ['Studio', w.studio], ['Costumes', w.costumes], ['Award', w.award]]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    b.innerHTML = `<div class="thumb">${media.thumb ? `<img src="${esc(media.thumb)}" alt="" loading="lazy">` : ''}<span class="play" aria-hidden="true"></span></div>
      <h3>${esc(w.title)}</h3><div class="stamp"></div><dl class="credits">${credits}</dl>`;
    b.setAttribute('aria-label', 'Play ' + (w.title || 'video'));
    b.addEventListener('click', () => Viewer.open(list, idx));
    $('#works').appendChild(b);
  });

  $('#teach-rows').innerHTML = c.teach.filter(r => r.name).map(r =>
    `<li><strong>${esc(r.name)}</strong><span>${esc(r.ages || '')}</span>${r.detail ? `<small>${esc(r.detail)}</small>` : ''}</li>`).join('');
  $('#looking').innerHTML = c.looking.filter(r => r.title || r.text).map(r =>
    `<li>${r.title ? `<strong>${esc(r.title)}</strong> ` : ''}${esc(r.text || '')}</li>`).join('');
  $('#quotes').innerHTML = c.quotes.filter(q => q.quote).map(q =>
    `<blockquote><p>"${esc(q.quote)}"</p>${q.who ? `<cite>${esc(q.who)}</cite>` : ''}</blockquote>`).join('');

  // Sections whose list ended up empty step aside.
  const counts = { works: works.length, looking: c.looking.filter(r => r.title || r.text).length, quotes: c.quotes.filter(q => q.quote).length };
  document.querySelectorAll('[data-list]').forEach(s => { s.hidden = !counts[s.dataset.list]; });

  const ig = String(T.instagram || '').replace(/^@/, '');
  $('#contact-lines').innerHTML = [
    ok.email(T.email) ? `<a class="btn" href="mailto:${esc(T.email)}?subject=Working%20together">${esc(T.email)}</a>` : '',
    ok.ig(ig) ? `<a class="link" href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener">Instagram @${esc(ig)}</a>` : '',
    `<a class="link" href="resume.html">Resume</a>`
  ].join('');

  const teach = (m.items || []).filter(i => i.type === 'video' && i.tag === 'teach');
  const wt = $('#watch-teach');
  if (teach.length) wt.addEventListener('click', () => Viewer.open(teach, 0)); else wt.hidden = true;

  const photos = (m.items || []).filter(i => i.type === 'photo' && i.home).sort((a, b) => a.home - b.home).slice(0, 8);
  $('#strip').innerHTML = '';
  photos.forEach((it, idx) => {
    const b = document.createElement('button');
    b.innerHTML = `<img src="${esc(it.src)}" alt="${esc(it.title || 'Tori on stage')}">`;
    b.addEventListener('click', () => Viewer.open(photos, idx));
    $('#strip').appendChild(b);
  });

  document.body.classList.remove('loading');
})();
