// Media page: every photo and video of Tori's work, grouped by season, filterable by what it shows.
// Items live in data/media.json; videos she adds from her plan (YouTube) join them.
(async function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FILTERS = [
    { id: 'all', label: 'Everything', test: () => true },
    { id: 'choreo', label: 'Her choreography', test: i => i.tag === 'choreo' },
    { id: 'teach', label: 'Teaching', test: i => i.tag === 'teach' },
    { id: 'dance', label: 'Dancing', test: i => i.tag === 'dance' },
    { id: 'videos', label: 'Videos', test: i => i.type === 'video' },
    { id: 'portrait', label: 'Portraits', test: i => i.tag === 'portrait' }
  ];
  const seasonOf = d => { if (!d) return null; const [y, m] = d.split('-').map(Number); const s = m >= 8 ? y : y - 1; return s; };
  const base = (await (await fetch('data/media.json', { cache: 'no-cache' })).json()).items || [];
  const extra = (await PlanStore.publicVideos()).map(v => ({ type: 'video', youtube: v.yt, title: v.title, kind: v.kind, year: v.year, tag: 'choreo', poster: `https://i.ytimg.com/vi/${v.yt}/hqdefault.jpg`, date: /^\d{4}$/.test(v.year || '') ? v.year + '-09-01' : null }));
  const items = [...extra, ...base].map(i => Object.assign(i, { sn: seasonOf(i.date), season: seasonOf(i.date) ? `${seasonOf(i.date)}-${String(seasonOf(i.date) + 1).slice(2)}` : '' }))
    .sort((a, b) => (b.sn || 0) - (a.sn || 0) || (a.type === b.type ? String(b.date || '').localeCompare(String(a.date || '')) : a.type === 'video' ? -1 : 1));

  let current = 'all';
  try { current = new URLSearchParams(location.search).get('f') || 'all'; } catch (e) {}

  function draw() {
    const photos = items.filter(i => i.type === 'photo').length, vids = items.filter(i => i.type === 'video').length;
    $('#summary').textContent = `${photos} photos and ${vids} videos.`;
    $('#chips').innerHTML = FILTERS.filter(f => f.id === 'all' || items.some(f.test))
      .map(f => `<button class="chip" data-f="${f.id}" aria-pressed="${f.id === current}">${f.label}</button>`).join('');
    const f = FILTERS.find(x => x.id === current) || FILTERS[0];
    const list = items.filter(f.test);
    const out = $('#grid'); out.innerHTML = '';
    let season = undefined, grid = null;
    list.forEach((it, idx) => {
      if (it.sn !== season) {
        season = it.sn;
        const h = document.createElement('div'); h.className = 'season';
        h.innerHTML = `<h2>${season ? `${season} to ${season + 1}` : 'From the archive'}</h2>`;
        out.appendChild(h);
        grid = document.createElement('div'); grid.className = 'grid'; out.appendChild(grid);
      }
      const b = document.createElement('button');
      const thumb = it.type === 'photo' ? it.src : (it.poster || it.thumb);
      b.innerHTML = `<img src="${esc(thumb)}" alt="${esc(it.title || '')}" loading="lazy"${it.w ? ` width="${it.w}" height="${it.h}"` : ''}>${it.type === 'video' ? '<span class="play" aria-hidden="true"></span>' : ''}<span class="cap">${esc([it.title, it.kind].filter(Boolean).join(' · '))}</span>`;
      b.setAttribute('aria-label', (it.type === 'video' ? 'Play ' : 'Open ') + (it.title || 'photo'));
      b.addEventListener('click', () => Viewer.open(list, idx));
      grid.appendChild(b);
    });
  }
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    current = b.dataset.f; draw();
    history.replaceState(null, '', current === 'all' ? 'media.html' : '?f=' + current);
  });
  draw();
})();
