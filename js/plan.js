// Tori's outreach plan. Private: it only opens from her secret link (?plan=TOKEN).
// Studios come from data/studios.json (public business contacts); statuses, notes, templates,
// studios she adds and the videos she publishes live in her plan (PlanStore).
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SITE = 'https://dixxxvhb.github.io/tori-ugalde-site/';
  const STATUSES = ['Emailed', 'Followed up', 'Replied', 'Meeting', 'Working with', 'Not now'];
  const cls = s => (s || '').split(' ')[0].replace(/[^A-Za-z]/g, '') || 'none';
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  // Only web links become hrefs; anything else (javascript:, data:) is dropped.
  const safeUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^[a-z]+:/i.test(u)) u = 'https://' + u; return /^https?:\/\//i.test(u) ? u : ''; };
  const nice = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

  let studios = [], pitch = { templates: [] }, goals = [], top = [];
  const S = () => PlanStore.data;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1800);
  }

  // Every studio, including ones Tori added herself.
  function all() {
    const mine = Object.entries(S().custom || {}).filter(([, c]) => c && typeof c === 'object' && typeof c.name === 'string' && c.name)
      .map(([id, c]) => ({ ...c, id, mine: true, kind: 'studio', styles: [], comp_team: 'unknown' }));
    return studios.concat(mine);
  }
  const track = id => (S().track || {})[id] || {};

  /* ---------- Today ---------- */
  function renderToday() {
    const list = all();
    const t = id => track(id).status;
    const n = s => list.filter(x => t(x.id) === s).length;
    const reached = list.filter(x => t(x.id)).length;
    $('#stats').innerHTML = [
      ['Reached out', reached], ['Replied', n('Replied')], ['Meetings', n('Meeting')], ['Working with', n('Working with')]
    ].map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');

    const due = list.filter(x => { const tr = track(x.id); return tr.next && tr.next <= today() && !['Replied', 'Meeting', 'Working with', 'Not now'].includes(tr.status); })
      .sort((a, b) => track(a.id).next.localeCompare(track(b.id).next));
    $('#due').innerHTML = due.length
      ? due.map(rowHtml).join('')
      : `<li class="empty">Nobody to follow up with today.</li>`;

    const starts = top.map(id => list.find(x => x.id === id)).filter(x => x && !t(x.id)).slice(0, 8);
    $('#starts').innerHTML = starts.length ? starts.map(rowHtml).join('') : `<li class="empty">You have written to every studio on the starter list. Look at you.</li>`;
    $('#note').hidden = !!(S().goals || {})['note-closed'];
  }

  function rowHtml(x) {
    const tr = track(x.id);
    const status = tr.status
      ? `<span class="pill ${cls(tr.status)}">${esc(tr.status)}${tr.next && !['Replied', 'Meeting', 'Working with', 'Not now'].includes(tr.status) ? ' · ' + nice(tr.next) : ''}</span>`
      : (x.warm ? `<span class="pill warm">Warm</span>` : '');
    const bits = [x.city, x.angle].filter(Boolean).join(' · ');
    return `<li><button class="row" data-id="${esc(x.id)}"><span class="nm">${esc(x.name)}</span><span class="st">${status}</span><span class="sm">${esc(bits)}</span></button></li>`;
  }

  /* ---------- Studios ---------- */
  function renderStudios() {
    const q = $('#q').value.trim().toLowerCase();
    const city = $('#f-city').value, kind = $('#f-kind').value, st = $('#f-status').value;
    let list = all().filter(x => {
      if (city && x.city !== city) return false;
      if (kind === 'comp' && x.comp_team !== 'yes') return false;
      if (kind === 'email' && !x.email) return false;
      if (kind && !['comp', 'email'].includes(kind) && x.kind !== kind) return false;
      const s = track(x.id).status || '';
      if (st === 'none' && s) return false;
      if (st && st !== 'none' && s !== st) return false;
      if (q && ![x.name, x.city, x.angle, (x.styles || []).join(' '), x.notes].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    const rank = x => (x.warm ? 0 : 1) * 10 + (x.kind === 'studio' ? 0 : 1) * 5 + (x.comp_team === 'yes' ? 0 : 1) * 2 + (x.email ? 0 : 1);
    list.sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
    $('#count').textContent = list.length + (list.length === 1 ? ' place' : ' places');
    $('#studios').innerHTML = list.length ? list.map(rowHtml).join('') : `<li class="empty">Nothing matches. Try fewer filters.</li>`;
  }

  function fillFilters() {
    const cities = [...new Set(all().map(x => x.city).filter(Boolean))].sort();
    $('#f-city').innerHTML = `<option value="">Every city</option>` + cities.map(c => `<option>${esc(c)}</option>`).join('');
  }

  /* ---------- Sheet ---------- */
  function openSheet(html) {
    $('#sheet').innerHTML = `<div class="grab"></div>` + html;
    $('#sheet').classList.add('open'); $('#scrim').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open');
    document.body.style.overflow = '';
    refreshAll();
  }

  function openStudio(id) {
    const x = all().find(s => s.id === id); if (!x) return;
    const tr = track(id);
    const link = (u, label) => (u = safeUrl(u)) ? `<a class="link" href="${esc(u)}" target="_blank" rel="noopener">${esc(label || u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : '';
    const ig = x.instagram ? x.instagram.replace(/^@/, '') : '';
    const kv = [
      ['Email', x.email ? `<a class="link" href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : (x.contact_form ? link(x.contact_form, 'Contact form') : 'Not published')],
      ['Website', link(x.website)],
      ['Phone', x.phone ? `<a class="link" href="tel:${esc(x.phone.replace(/[^0-9+]/g, ''))}">${esc(x.phone)}</a>` : ''],
      ['Instagram', ig ? link('https://www.instagram.com/' + ig + '/', '@' + ig) : ''],
      ['Styles', esc((x.styles || []).join(', '))],
      ['Comp team', esc(x.comp_team === 'yes' ? 'Yes' : x.comp_team === 'no' ? 'No' : '')],
      ['Hiring', x.hiring ? link(x.hiring, 'Open positions') : ''],
      ['Where', esc([x.address, x.city].filter(Boolean).join(', '))]
    ].filter(r => r[1]);
    openSheet(`
      <h2>${esc(x.name)}</h2>
      <p class="sub">${esc([x.city, x.angle].filter(Boolean).join(' · '))}${x.warm ? `<br><span class="pill warm" style="margin-top:8px">${esc(x.warm)}</span>` : ''}</p>
      <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${x.notes ? `<p class="sub">${esc(x.notes)}</p>` : ''}
      <div class="field"><span>Where things stand</span>
        <div class="statuses">${STATUSES.map(s => `<button type="button" data-status="${esc(s)}" aria-pressed="${tr.status === s}">${esc(s)}</button>`).join('')}</div>
      </div>
      <label class="field"><span>Follow up on</span><input type="date" id="s-next" value="${esc(tr.next || '')}"></label>
      <label class="field"><span>Notes</span><textarea id="s-note" placeholder="Who you talked to, what they need, what you sent">${esc(tr.note || '')}</textarea></label>
      <div class="actions">
        ${x.email || x.contact_form ? `<button class="btn" data-write="${esc(id)}">Write to them</button>` : ''}
        <button class="btn ghost" data-close>Done</button>
      </div>
      ${x.mine ? `<p style="margin-top:16px"><button class="txt-btn" data-remove="${esc(id)}">Remove this studio</button></p>` : ''}
    `);
    const sh = $('#sheet');
    sh.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => {
      const s = b.dataset.status, was = track(id).status;
      const next = was === s ? null : s;
      PlanStore.set(['track', id, 'status'], next);
      if (next === 'Emailed' || next === 'Followed up') {
        PlanStore.set(['track', id, 'sent'], today());
        PlanStore.set(['track', id, 'next'], addDays(today(), 7));
        $('#s-next').value = addDays(today(), 7);
      }
      sh.querySelectorAll('[data-status]').forEach(o => o.setAttribute('aria-pressed', String(o.dataset.status === next)));
    }));
    $('#s-next').addEventListener('change', e => PlanStore.set(['track', id, 'next'], e.target.value || null));
    let h; $('#s-note').addEventListener('input', e => { clearTimeout(h); h = setTimeout(() => PlanStore.set(['track', id, 'note'], e.target.value.slice(0, 3900)), 400); });
    const w = sh.querySelector('[data-write]'); if (w) w.addEventListener('click', () => openWriter(id));
    const r = sh.querySelector('[data-remove]'); if (r) r.addEventListener('click', () => {
      if (!confirm('Remove ' + x.name + ' from your list?')) return;
      PlanStore.set(['custom', id], null);
      PlanStore.set(['track', id], null);
      closeSheet();
    });
    sh.querySelector('[data-close]').addEventListener('click', closeSheet);
  }

  /* ---------- Writing an email ---------- */
  function templates() {
    const mine = S().tpl || {};
    return pitch.templates.map(t => ({ ...t, subject: (mine[t.id] || {}).subject || t.subject, body: (mine[t.id] || {}).body || t.body }));
  }
  function signature() { return ((S().tpl || {}).sig || {}).text || pitch.signature || 'Tori Ugalde'; }
  function fill(str, x) {
    return String(str)
      .replace(/\{studio\}/g, x.name).replace(/\{city\}/g, x.city || 'Central Florida')
      .replace(/\{site\}/g, SITE).replace(/\{resume\}/g, SITE + 'resume.html')
      .replace(/\{signature\}/g, signature());
  }
  function openWriter(id, tplId) {
    const x = all().find(s => s.id === id);
    const ts = templates();
    const t = ts.find(z => z.id === tplId) || ts.find(z => z.id === pickTemplate(x)) || ts[0];
    const subject = fill(t.subject, x), body = fill(t.body, x);
    const to = x.email || '';
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    openSheet(`
      <h2>Write to ${esc(x.name)}</h2>
      <label class="field"><span>Which note</span><select id="w-t">${ts.map(z => `<option value="${esc(z.id)}" ${z.id === t.id ? 'selected' : ''}>${esc(z.label)}</option>`).join('')}</select></label>
      <div class="field"><span>To</span>${to ? esc(to) : `No email published. ${safeUrl(x.contact_form) ? `Use their <a class="link" href="${esc(safeUrl(x.contact_form))}" target="_blank" rel="noopener">contact form</a> and paste this in.` : 'Find a way to reach them on their website, and paste this in.'}`}</div>
      <div class="field"><span>Subject</span><div class="preview">${esc(subject)}</div></div>
      <div class="field"><span>Message</span><div class="preview">${esc(body)}</div></div>
      <p class="sub">Read it once and make it yours. Nothing sends until you press send in your own email.</p>
      <div class="actions">
        ${to ? `<a class="btn" id="w-mail" href="${esc(mailto)}">Open in Mail</a><a class="btn ghost" id="w-gmail" href="${esc(gmail)}" target="_blank" rel="noopener">Open in Gmail</a>` : ''}
        <button class="btn ghost" id="w-copy">Copy</button>
      </div>
      <p style="margin-top:14px"><button class="txt-btn" id="w-sent">I sent it</button> &nbsp; <button class="txt-btn" data-back>Back</button></p>
    `);
    $('#w-t').addEventListener('change', e => openWriter(id, e.target.value));
    $('#w-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('Subject: ' + subject + '\n\n' + body); toast('Copied'); } catch (e) { toast('Copy did not work here'); }
    });
    $('#w-sent').addEventListener('click', () => {
      const was = track(id).status;
      PlanStore.set(['track', id, 'status'], was === 'Emailed' ? 'Followed up' : (was && !['Emailed', 'Followed up'].includes(was) ? was : 'Emailed'));
      PlanStore.set(['track', id, 'sent'], today());
      PlanStore.set(['track', id, 'next'], addDays(today(), 7));
      PlanStore.set(['sent', id.replace(/[^A-Za-z0-9:_.-]/g, '').slice(0, 100) || 'x'], today());
      toast('Marked sent. Follow up ' + nice(addDays(today(), 7)));
      openStudio(id);
    });
    $('#sheet [data-back]').addEventListener('click', () => openStudio(id));
  }
  function pickTemplate(x) {
    if (!x) return null;
    if (x.kind === 'school' || x.kind === 'rec' || x.kind === 'gym') return 'teach';
    if (x.kind === 'convention' || x.kind === 'company' || x.kind === 'theme-park' || x.kind === 'job-board') return 'general';
    return x.comp_team === 'yes' ? 'choreo' : 'teach';
  }

  /* ---------- Pitch (templates, signature, add a studio, videos) ---------- */
  function renderPitch() {
    const ts = templates();
    $('#tpls').innerHTML = ts.map(t => `
      <div class="card">
        <h2>${esc(t.label)}</h2>
        <p class="sub" style="margin-bottom:8px">${esc(t.when || '')}</p>
        <label class="field"><span>Subject</span><input data-tpl="${esc(t.id)}" data-f="subject" value="${esc(t.subject)}"></label>
        <label class="field"><span>Message</span><textarea data-tpl="${esc(t.id)}" data-f="body" rows="12">${esc(t.body)}</textarea></label>
        <button class="txt-btn" data-reset="${esc(t.id)}">Put back the original</button>
      </div>`).join('');
    $('#sig').value = signature();
    document.querySelectorAll('[data-tpl]').forEach(el => {
      let h; el.addEventListener('input', () => { clearTimeout(h); h = setTimeout(() => PlanStore.set(['tpl', el.dataset.tpl, el.dataset.f], el.value.slice(0, 3900)), 400); });
    });
    document.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => {
      PlanStore.set(['tpl', b.dataset.reset, 'subject'], null); PlanStore.set(['tpl', b.dataset.reset, 'body'], null); renderPitch(); toast('Original is back');
    }));
    renderVideos();
  }

  function renderVideos() {
    const v = ((S().pub || {}).videos) || {};
    const rows = Object.entries(v).filter(([, x]) => x && typeof x === 'object' && x.yt).sort((a, b) => String(a[1].order || '').localeCompare(String(b[1].order || '')));
    $('#vids').innerHTML = rows.length ? rows.map(([id, x]) => `<li><span><b style="font-weight:500">${esc(x.title || 'Untitled')}</b><br><small style="color:var(--ink-2)">${esc([x.kind, x.year].filter(Boolean).join(' · '))}${x.hidden ? ' · hidden' : ''}</small></span>
      <span><button class="txt-btn" data-hide="${esc(id)}">${x.hidden ? 'Show' : 'Hide'}</button> &nbsp; <button class="txt-btn" data-del="${esc(id)}">Remove</button></span></li>`).join('')
      : `<li class="empty" style="display:block">No videos added yet. The ones Dixon put on the site stay there either way.</li>`;
    document.querySelectorAll('[data-hide]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.hide; PlanStore.set(['pub', 'videos', id, 'hidden'], v[id].hidden ? null : 'yes'); renderVideos(); }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('Remove this video from your site?')) return;
      PlanStore.set(['pub', 'videos', b.dataset.del], null); renderVideos();
    }));
  }

  function ytId(u) {
    const m = String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(u.trim()) ? u.trim() : null);
  }

  function wirePitch() {
    let h; $('#sig').addEventListener('input', e => { clearTimeout(h); h = setTimeout(() => PlanStore.set(['tpl', 'sig', 'text'], e.target.value.slice(0, 600)), 400); });
    $('#add-studio').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const name = String(f.get('name') || '').trim(); if (!name) return;
      const id = 'mine-' + Date.now().toString(36);
      ['name', 'email', 'city', 'website', 'instagram', 'angle'].forEach(k => { const v = String(f.get(k) || '').trim(); if (v) PlanStore.set(['custom', id, k], v.slice(0, 300)); });
      e.target.reset(); fillFilters(); toast(name + ' added');
    });
    $('#add-video').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const yt = ytId(String(f.get('url') || ''));
      if (!yt) { toast('That does not look like a YouTube link'); return; }
      const id = 'v' + Date.now().toString(36);
      PlanStore.set(['pub', 'videos', id, 'yt'], yt);
      PlanStore.set(['pub', 'videos', id, 'title'], String(f.get('title') || '').trim().slice(0, 120) || 'New work');
      const kind = String(f.get('kind') || '').trim(); if (kind) PlanStore.set(['pub', 'videos', id, 'kind'], kind.slice(0, 120));
      const year = String(f.get('year') || '').trim(); if (year) PlanStore.set(['pub', 'videos', id, 'year'], year.slice(0, 20));
      PlanStore.set(['pub', 'videos', id, 'order'], String(Date.now()));
      e.target.reset(); renderVideos(); toast('On your site now');
    });
  }

  /* ---------- Goals ---------- */
  function renderGoals() {
    const g = S().goals || {};
    const mine = Object.entries(g).filter(([, v]) => v && typeof v === 'object' && typeof v.text === 'string' && v.text)
      .map(([id, v]) => ({ id, text: v.text, done: !!v.done, mine: true }));
    const starters = goals.map(x => ({ ...x, done: !!g[x.id] && typeof g[x.id] !== 'object' }));
    $('#goals').innerHTML = starters.concat(mine).map(x => `<label class="goal"><input type="checkbox" data-goal="${esc(x.id)}" ${x.mine ? 'data-mine="1"' : ''} ${x.done ? 'checked' : ''}><span>${esc(x.text)}${x.how ? `<small>${esc(x.how)}</small>` : ''}${x.mine ? `<small><button type="button" class="txt-btn" data-goal-del="${esc(x.id)}">Remove</button></small>` : ''}</span></label>`).join('');
    document.querySelectorAll('[data-goal]').forEach(c => c.addEventListener('change', () => {
      if (c.dataset.mine) PlanStore.set(['goals', c.dataset.goal, 'done'], c.checked ? today() : null);
      else PlanStore.set(['goals', c.dataset.goal], c.checked ? today() : null);
    }));
    document.querySelectorAll('[data-goal-del]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); PlanStore.set(['goals', b.dataset.goalDel], null); renderGoals(); }));
  }

  /* ---------- Shell ---------- */
  function show(tab) {
    document.querySelectorAll('.navtab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'v-' + tab; });
    try { localStorage.setItem('tu-tab', tab); } catch (e) {}
    window.scrollTo(0, 0);
    refreshAll();
  }
  function refreshAll() {
    const tab = (document.querySelector('.navtab[aria-selected="true"]') || {}).dataset?.tab || 'today';
    if (tab === 'today') renderToday();
    if (tab === 'studios') renderStudios();
    if (tab === 'goals') renderGoals();
    syncLine();
  }
  function syncLine() {
    const s = $('#sync'); if (!s) return;
    s.className = 'sync ' + (PlanStore.status === 'plan' ? '' : PlanStore.status);
    s.textContent = PlanStore.pending ? 'Saving' : PlanStore.status === 'offline' ? 'Offline, will save' : 'Saved';
  }

  async function start() {
    await PlanStore.init();
    if (!PlanStore.shared) {
      document.body.innerHTML = `<div class="gate"><a class="wordmark" href="./">tori ugalde</a><p>This page is private. Open it from the link Dixon sent you.</p><p style="margin-top:20px"><a class="link" href="./">Go to the site</a></p></div>`;
      return;
    }
    document.body.classList.remove('locked');
    const get = u => fetch(u, { cache: 'no-cache' }).then(r => r.json());
    const [s, p, g] = await Promise.all([get('data/studios.json'), get('data/pitch.json'), get('data/goals.json')]);
    studios = (s.studios || []).filter(x => x && x.id && x.name);
    top = s.top || [];
    pitch = p; goals = g.goals || [];
    fillFilters(); wirePitch(); renderPitch();
    $('#add-goal').addEventListener('submit', e => {
      e.preventDefault();
      const v = String(new FormData(e.target).get('text') || '').trim(); if (!v) return;
      PlanStore.set(['goals', 'mine-' + Date.now().toString(36), 'text'], v.slice(0, 300));
      e.target.reset(); renderGoals();
    });

    document.querySelectorAll('.navtab').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    ['#q', '#f-city', '#f-kind', '#f-status'].forEach(sel => $(sel).addEventListener('input', renderStudios));
    document.addEventListener('click', e => { const r = e.target.closest('.row[data-id]'); if (r) openStudio(r.dataset.id); });
    $('#scrim').addEventListener('click', closeSheet);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sheet').classList.contains('open')) closeSheet(); });
    $('#note .x').addEventListener('click', () => { PlanStore.set(['goals', 'note-closed'], today()); $('#note').hidden = true; });
    PlanStore.onChange(() => { if (!$('#sheet').classList.contains('open')) refreshAll(); else syncLine(); });
    let tab = 'today'; try { tab = localStorage.getItem('tu-tab') || 'today'; } catch (e) {}
    show(['today', 'studios', 'pitch', 'goals'].includes(tab) ? tab : 'today');
    setInterval(syncLine, 1500);
  }
  start();
})();
