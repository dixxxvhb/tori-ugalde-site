// Shared lightbox for photos, self-hosted video and YouTube.
// Viewer.open(list, index). Each item: {type, src|youtube, title, kind, season}.
(function () {
  const el = document.createElement('div');
  el.className = 'lb';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Media viewer');
  el.innerHTML = `
    <div class="lb-bar"><div class="t"></div><button class="lb-btn" data-x aria-label="Close">&times;</button></div>
    <div class="lb-stage"></div>
    <div class="lb-nav">
      <button class="lb-btn" data-prev aria-label="Previous">&#8249;</button>
      <button class="lb-btn" data-next aria-label="Next">&#8250;</button>
    </div>`;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));

  let list = [], i = 0, lastFocus = null;
  const stage = () => el.querySelector('.lb-stage');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render() {
    const it = list[i];
    const meta = [it.kind, it.season].filter(Boolean).join(' · ');
    el.querySelector('.t').innerHTML = `<b>${esc(it.title)}</b>${esc(meta)}`;
    let html;
    if (it.type === 'photo') html = `<img src="${esc(it.src)}" alt="${esc(it.title)}">`;
    else if (it.youtube) html = `<iframe class="yt" src="https://www.youtube-nocookie.com/embed/${esc(it.youtube)}?autoplay=1&rel=0" title="${esc(it.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    else html = `<video src="${esc(it.src)}" poster="${esc(it.poster || '')}" controls autoplay playsinline></video>`;
    stage().innerHTML = html;
    const multi = list.length > 1;
    el.querySelector('.lb-nav').style.visibility = multi ? 'visible' : 'hidden';
  }
  function open(l, idx) {
    list = l; i = idx; lastFocus = document.activeElement;
    render(); el.classList.add('open'); document.body.style.overflow = 'hidden';
    el.querySelector('[data-x]').focus();
  }
  function close() {
    stage().innerHTML = ''; // stops any playing video or embed
    el.classList.remove('open'); document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function step(d) { i = (i + d + list.length) % list.length; render(); }

  el.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) close();
    else if (e.target.closest('[data-prev]')) step(-1);
    else if (e.target.closest('[data-next]')) step(1);
    else if (e.target === el || e.target.classList.contains('lb-stage')) close();
  });
  document.addEventListener('keydown', e => {
    if (!el.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 === null || list[i].type !== 'photo') return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  window.Viewer = { open, close };
})();
