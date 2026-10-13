// Tori's outreach plan storage. Two modes:
//  - local: saved on this device only (localStorage), the default.
//  - plan: a shared plan reached by a secret link (?plan=TOKEN). Every change is sent to
//    Supabase as a small op, and other phones pick it up within about 30 seconds.
// Shape: { saved: {id: true}, track: {id: {status, note, next, sent}}, custom: {id: {name, email, city, ...}},
//          pub: {videos: {id: {yt, title, kind, year, order, hidden}}}, goals: {id: true}, sent: {id: date} }
window.PlanStore = (function () {
  const API = 'https://swjqlfcqvcrnydpyjyog.supabase.co';
  const KEY = 'sb_publishable_agYvnH3Bs77pPvNwaZLzjg_DjUsbeMW';
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const blank = () => ({ saved: {}, track: {}, custom: {}, pub: {}, goals: {}, sent: {}, tpl: {} });
  const norm = d => { const b = blank(); Object.keys(b).forEach(k => { if (d && d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) b[k] = d[k]; }); return b; };
  const KEY_RE = /^[A-Za-z0-9:_.-]{1,120}$/;
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  let token = null, data = blank(), rev = null, status = 'local', name = '', lastSync = null;
  let queue = [], timer = null, inFlight = false;
  const listeners = [];
  const notify = () => listeners.forEach(fn => { try { fn(); } catch (e) {} });

  function loadLocal() { return norm(ls.get('tu-local', null)); }

  async function rpc(fn, body) {
    const r = await fetch(`${API}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(fn + ' ' + r.status);
    return r.json();
  }

  function setPath(obj, path, value) {
    if (path.some(p => BAD_KEYS.has(p))) return;
    let o = obj;
    for (let i = 0; i < path.length - 1; i++) { if (!o[path[i]] || typeof o[path[i]] !== 'object') o[path[i]] = {}; o = o[path[i]]; }
    if (value === null || value === undefined || value === false || value === '') delete o[path[path.length - 1]];
    else o[path[path.length - 1]] = value;
  }

  async function flush() {
    if (status !== 'plan' && status !== 'offline') return;
    if (inFlight || !queue.length) return;
    inFlight = true;
    // Keep only the last op per path.
    const byPath = new Map(); queue.splice(0).forEach(op => byPath.set(op.path.join('\u0001'), op));
    const ops = [...byPath.values()];
    try {
      let res = null;
      for (let i = 0; i < ops.length; i += 50) res = await rpc('tu_plan_apply', { p_token: token, p_ops: ops.slice(i, i + 50) });
      if (res) {
        // The server's copy now includes everyone's changes; replay anything typed since.
        rev = res.rev; data = norm(res.data);
        queue.forEach(op => setPath(data, op.path, op.value));
      }
      status = 'plan'; lastSync = new Date();
    } catch (e) {
      queue.unshift(...ops); status = 'offline';
      clearTimeout(timer); timer = setTimeout(flush, 5000);
    }
    inFlight = false;
    notify();
    if (queue.length) { clearTimeout(timer); timer = setTimeout(flush, 300); }
  }

  function set(path, value) {
    if (!Array.isArray(path) || path.length < 2 || !path.every(p => KEY_RE.test(String(p)) && !BAD_KEYS.has(String(p)))) return;
    path = path.map(String);
    setPath(data, path, value);
    if (token) {
      const v = (value === false || value === '' || value === undefined) ? null : value;
      queue.push({ path, value: v });
      clearTimeout(timer); timer = setTimeout(flush, 350);
    } else {
      ls.set('tu-local', data);
    }
  }

  async function refresh(force) {
    if (!token || inFlight && !force || queue.length) return;
    try {
      const res = await rpc('tu_plan_get', { p_token: token });
      if (!res) { status = 'bad'; notify(); return; }
      const changed = res.rev !== rev;
      rev = res.rev; name = res.name; lastSync = new Date(); status = 'plan';
      if (changed) { data = norm(res.data); notify(); }
    } catch (e) { status = 'offline'; notify(); }
  }

  async function init() {
    let fromUrl = null;
    try { fromUrl = new URLSearchParams(location.search).get('plan'); } catch (e) {}
    token = (fromUrl && fromUrl.length >= 32) ? fromUrl : ls.get('tu-plan', null);
    const local = loadLocal();
    if (!token) { data = local; status = 'local'; return; }
    try {
      const res = await rpc('tu_plan_get', { p_token: token });
      if (!res) { status = 'bad'; data = local; token = null; return; }
      ls.set('tu-plan', token);
      data = norm(res.data); rev = res.rev; name = res.name; status = 'plan'; lastSync = new Date();
      // First time this device joins the plan, bring its local stars and notes along.
      const mergedKey = 'tu-merged-' + token.slice(0, 8);
      if (!ls.get(mergedKey, false)) {
        Object.keys(local.saved).forEach(k => { if (!data.saved[k]) set(['saved', k], true); });
        Object.entries(local.track).forEach(([k, t]) => {
          if (t.status && !(data.track[k] || {}).status) set(['track', k, 'status'], t.status);
          if (t.note && !(data.track[k] || {}).note) set(['track', k, 'note'], t.note);
        });
        Object.entries(local.custom).forEach(([k, c]) => { if (!data.custom[k] && c && typeof c === 'object') Object.entries(c).forEach(([f, v]) => set(['custom', k, f], v)); });
        ls.set(mergedKey, true);
      }
      setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
      window.addEventListener('online', () => { flush(); refresh(); });
    } catch (e) {
      // Offline on first load: work from what this device has and retry later.
      status = 'offline'; data = local;
      setTimeout(() => location.reload(), 60000);
    }
  }

  // Public read of the videos Tori published from her plan. No token involved.
  async function publicVideos() {
    try { const r = await rpc('tu_public_get', {}); return Array.isArray(r) ? r : []; } catch (e) { return []; }
  }

  return {
    init,
    publicVideos,
    set,
    refresh,
    onChange(fn) { listeners.push(fn); },
    get data() { return data; },
    get status() { return status; },
    get name() { return name; },
    get lastSync() { return lastSync; },
    get pending() { return queue.length > 0 || inFlight; },
    get shared() { return !!token && status !== 'bad'; },
    planUrl() { return token ? location.origin + location.pathname + '?plan=' + encodeURIComponent(token) : null; }
  };
})();
