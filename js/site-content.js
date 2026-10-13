// The words and pieces on Tori's public pages. Tori edits them from her plan ("My site" tab);
// they reach visitors through tu_public_get(). If that is slow or down, data/site.json (the
// starting copy) is used instead. Everything here is untrusted text: render with esc(), and
// only use links and media that pass the checks below.
window.SiteContent = (function () {
  const API = 'https://swjqlfcqvcrnydpyjyog.supabase.co';
  const KEY = 'sb_publishable_agYvnH3Bs77pPvNwaZLzjg_DjUsbeMW';
  const LISTS = ['works', 'teach', 'looking', 'quotes', 'jobs', 'training', 'skills'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ok = {
    yt: v => /^[A-Za-z0-9_-]{11}$/.test(String(v || '')),
    src: v => /^media\/video\/[a-z0-9-]{1,80}\.mp4$/.test(String(v || '')),
    poster: v => /^media\/posters\/[a-z0-9-]{1,80}\.jpg$/.test(String(v || '')),
    email: v => /^[^\s@<>"'()?&=#]{1,64}@[^\s@<>"'()?&=#]{1,120}\.[A-Za-z]{2,}$/.test(String(v || '')),
    ig: v => /^[A-Za-z0-9._]{1,30}$/.test(String(v || '').replace(/^@/, ''))
  };

  function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms)); }

  async function fetchLive() {
    const get = fetch(`${API}/rest/v1/rpc/tu_public_get`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => { if (!r.ok) throw new Error('rpc ' + r.status); return r.json(); });
    return Promise.race([get, timeout(3500)]);
  }

  // Turn a raw content object into sorted lists. Strings only; anything else is dropped.
  function shape(raw) {
    const out = { text: {} };
    const t = raw && typeof raw.text === 'object' && raw.text ? raw.text : {};
    Object.keys(t).forEach(k => { if (typeof t[k] === 'string') out.text[k] = t[k]; });
    LISTS.forEach(name => {
      const obj = raw && raw[name] && typeof raw[name] === 'object' ? raw[name] : {};
      out[name] = Object.entries(obj)
        .filter(([, v]) => v && typeof v === 'object')
        .map(([id, v]) => {
          const row = { id };
          Object.keys(v).forEach(k => { if (typeof v[k] === 'string') row[k] = v[k]; });
          return row;
        })
        .sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0) || a.id.localeCompare(b.id));
    });
    return out;
  }

  let cached = null;
  async function load() {
    if (cached) return cached;
    let raw = null;
    try { const live = await fetchLive(); if (live && typeof live === 'object' && live.v) raw = live; } catch (e) {}
    if (!raw) { try { raw = await (await fetch('data/site.json', { cache: 'no-cache' })).json(); } catch (e) { raw = {}; } }
    cached = shape(raw);
    return cached;
  }

  // A piece as the media viewer wants it, or null if its video does not check out.
  function workMedia(w) {
    if (ok.yt(w.yt)) return { type: 'video', youtube: w.yt, thumb: `https://i.ytimg.com/vi/${w.yt}/hqdefault.jpg`, poster: `https://i.ytimg.com/vi/${w.yt}/hqdefault.jpg`, title: w.title || '', kind: w.style || '', season: w.studio || '' };
    if (ok.src(w.src)) return { type: 'video', src: w.src, poster: ok.poster(w.poster) ? w.poster : '', thumb: ok.poster(w.poster) ? w.poster : '', title: w.title || '', kind: w.style || '', season: w.studio || '' };
    return null;
  }

  return { load, shape, esc, ok, workMedia };
})();
