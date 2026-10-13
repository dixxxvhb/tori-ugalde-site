// Home page: birthday line, the choreography cards (data/works.json plus videos Tori adds
// from her plan), and the on-stage photo strip (data/media.json, tag "dance").
(async function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Shows on September 20 only, and counts up on its own each year.
  const now = new Date();
  if (now.getMonth() === 8 && now.getDate() === 20) {
    const n = now.getFullYear() - 2004;
    const sfx = (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    $('#bday').textContent = 'Happy ' + n + sfx + ' birthday, Tori';
    $('#bday').hidden = false;
  }

  const get = u => fetch(u, { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}));
  const [w, m, extra] = await Promise.all([get('data/works.json'), get('data/media.json'), PlanStore.publicVideos()]);

  const works = extra.map(v => ({
    type: 'video', youtube: v.yt, thumb: `https://i.ytimg.com/vi/${v.yt}/hqdefault.jpg`, title: v.title, kind: v.kind, season: v.year, credits: []
  })).concat(w.works || []);
  const grid = $('#works');
  works.forEach((it, idx) => {
    const b = document.createElement('button');
    b.className = 'work-card';
    const credits = (it.credits || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    b.innerHTML = `<div class="thumb"><img src="${esc(it.thumb || it.poster)}" alt="" loading="lazy"><span class="play" aria-hidden="true"></span></div>
      <h3>${esc(it.title)}</h3><div class="stamp"></div>
      <dl class="credits">${credits || `<dt>Piece</dt><dd>${esc([it.kind, it.season].filter(Boolean).join(' · '))}</dd>`}</dl>`;
    b.setAttribute('aria-label', 'Play ' + it.title);
    b.addEventListener('click', () => Viewer.open(works, idx));
    grid.appendChild(b);
  });

  const teach = (m.items || []).filter(i => i.type === 'video' && i.tag === 'teach');
  const wt = $('#watch-teach');
  if (wt) { if (teach.length) wt.addEventListener('click', () => Viewer.open(teach, 0)); else wt.hidden = true; }

  const photos = (m.items || []).filter(i => i.type === 'photo' && i.home).sort((a, b) => a.home - b.home).slice(0, 8);
  const strip = $('#strip');
  photos.forEach((it, idx) => {
    const b = document.createElement('button');
    b.innerHTML = `<img src="${esc(it.src)}" alt="${esc(it.title || "Tori on stage")}">`;
    b.addEventListener('click', () => Viewer.open(photos, idx));
    strip.appendChild(b);
  });
})();
