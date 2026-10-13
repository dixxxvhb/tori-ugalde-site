// "My site" tab: Tori edits every word and piece on her public pages. Everything lives under
// plan data "pub" (pub.text.<key>, pub.<list>.<id>.<field>) and reaches the site through
// tu_public_get(). The first time it opens, the starting copy (data/site.json) is written in.
window.SiteEditor = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = () => (PlanStore.data.pub || {});
  let root, toast, seedCache = null;
  const openRows = new Set();

  const TEXT = [
    { title: 'Top of the page', fields: [
      ['roles', 'Line under your name', 'input'], ['lede', 'Your intro', 'textarea']] },
    { title: 'Choreographer, teacher, dancer', fields: [
      ['hat1_h', 'Choreographer: headline', 'input'], ['hat1_p', 'Choreographer: text', 'textarea'],
      ['hat2_h', 'Teacher: headline', 'input'], ['hat2_p', 'Teacher: text', 'textarea'],
      ['hat3_h', 'Dancer: headline', 'input'], ['hat3_p', 'Dancer: text', 'textarea']] }
  ];
  const LISTS = {
    works: { title: 'Your pieces', note: 'Each piece needs a video to show on the site. Paste a YouTube link (unlisted is fine).', add: 'Add a piece',
      head: [['work_h', 'Section headline', 'input'], ['work_p', 'Section intro', 'textarea']],
      fields: [['title', 'Piece', 'input'], ['style', 'Style', 'input', 'Contemporary solo'], ['studio', 'Studio and season', 'input', 'Celebration Arts Academy, 2025-26'],
        ['award', 'Award', 'input'], ['costumes', 'Costumes by', 'input'], ['video', 'Video', 'video'], ['hidden', 'Hide from the site', 'check'], ['resume', 'Show on my resume', 'check']] },
    teach: { title: 'Classes you teach', add: 'Add a class',
      head: [['teach_h', 'Section headline', 'input'], ['teach_p', 'Section intro', 'textarea']],
      fields: [['name', 'Class', 'input'], ['ages', 'Ages or level', 'input'], ['detail', 'Where or when', 'input']] },
    looking: { title: "What you're looking for", add: 'Add a line',
      head: [['looking_h', 'Section headline', 'input']],
      fields: [['title', 'Bold start', 'input', 'Competition choreography.'], ['text', 'The rest', 'textarea']] },
    quotes: { title: 'Quotes', note: 'Ask a parent or a studio owner. Their words go further than any bio.', add: 'Add a quote',
      fields: [['quote', 'Quote', 'textarea'], ['who', 'Who said it', 'input']] }
  };
  const TEXT2 = [
    { title: 'On stage and costumes', fields: [['stage_h', 'On stage: headline', 'input'], ['stage_p', 'On stage: text', 'textarea'],
      ['costume_h', 'Costumes: headline', 'input'], ['costume_p', 'Costumes: text', 'textarea']] },
    { title: 'Contact', fields: [['contact_h', 'Headline', 'input'], ['email', 'Email', 'input'], ['instagram', 'Instagram handle', 'input'], ['city', 'City', 'input']] }
  ];
  const RESUME = {
    jobs: { title: 'Resume: experience', add: 'Add a job', head: [['resume_who', 'Line under your name', 'input']],
      fields: [['org', 'Where', 'input'], ['dates', 'When', 'input', '2024 to now'], ['role', 'Your title', 'input'], ['bullets', 'What you did (one per line)', 'textarea']] },
    training: { title: 'Resume: training and performance', add: 'Add a line', fields: [['text', 'Line', 'input']] },
    skills: { title: 'Resume: skills', add: 'Add a skill', fields: [['text', 'Skill', 'input']], tail: [['references', 'References', 'textarea']] }
  };

  function ytId(u) {
    const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(String(u || '').trim()) ? String(u).trim() : null);
  }
  const rows = name => Object.entries(P()[name] || {}).filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]) => ({ id, ...v })).sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0) || a.id.localeCompare(b.id));
  const text = k => ((P().text || {})[k]) || '';

  function field(path, label, kind, value, ph) {
    const id = 'e-' + path.join('-');
    if (kind === 'textarea') return `<label class="field"><span>${esc(label)}</span><textarea id="${esc(id)}" data-path="${esc(path.join('|'))}" rows="4" placeholder="${esc(ph || '')}">${esc(value)}</textarea></label>`;
    if (kind === 'check') return `<label class="goal" style="padding:8px 0;border:0"><input type="checkbox" data-path="${esc(path.join('|'))}" ${value ? 'checked' : ''}><span>${esc(label)}</span></label>`;
    return `<label class="field"><span>${esc(label)}</span><input id="${esc(id)}" data-path="${esc(path.join('|'))}" value="${esc(value)}" placeholder="${esc(ph || '')}"></label>`;
  }

  function textCard(group) {
    return `<div class="card"><h2>${esc(group.title)}</h2>${group.fields.map(([k, l, kind]) => field(['pub', 'text', k], l, kind, text(k))).join('')}</div>`;
  }

  function videoField(r) {
    const has = r.yt ? 'YouTube video' : r.src ? 'Video file Dixon added' : '';
    return `<div class="field"><span>Video</span>${has ? `<p class="sub" style="margin:0 0 8px">${esc(has)}${r.yt ? ` · <a class="link" href="https://youtu.be/${esc(r.yt)}" target="_blank" rel="noopener">watch</a>` : ''}</p>` : ''}
      <input data-yt="${esc(r.id)}" placeholder="${has ? 'Paste a YouTube link to replace it' : 'Paste a YouTube link'}" inputmode="url"></div>`;
  }

  function listCard(name, spec) {
    const list = rows(name);
    const head = (spec.head || []).map(([k, l, kind]) => field(['pub', 'text', k], l, kind, text(k))).join('');
    const tail = (spec.tail || []).map(([k, l, kind]) => field(['pub', 'text', k], l, kind, text(k))).join('');
    const items = list.map((r, i) => {
      const flags = name === 'works' ? [r.hidden ? 'Hidden' : '', !r.yt && !r.src ? 'No video' : ''].filter(Boolean).join(' · ') : '';
      return `
      <details class="ed-row" data-row="${esc(r.id)}" ${openRows.has(r.id) ? 'open' : ''}>
        <summary><b>${esc(r[spec.fields[0][0]] || 'New')}</b>${flags ? `<small>${esc(flags)}</small>` : ''}</summary>
        ${spec.fields.map(([f, l, kind, ph]) => kind === 'video' ? videoField(r) : field(['pub', name, r.id, f], l, kind, r[f] || '', ph)).join('')}
        <div class="ed-actions">
          <button class="txt-btn" data-move="${esc(name)}|${esc(r.id)}|-1" ${i === 0 ? 'disabled' : ''}>Move up</button>
          <button class="txt-btn" data-move="${esc(name)}|${esc(r.id)}|1" ${i === list.length - 1 ? 'disabled' : ''}>Move down</button>
          <button class="txt-btn" data-del="${esc(name)}|${esc(r.id)}">Remove</button>
        </div>
      </details>`;
    }).join('');
    return `<div class="card" data-list-card="${esc(name)}"><h2>${esc(spec.title)}</h2>${spec.note ? `<p class="sub" style="margin-bottom:6px">${esc(spec.note)}</p>` : ''}
      ${head}${items || '<p class="sub">Nothing here yet.</p>'}
      <button class="btn ghost" data-add="${esc(name)}" style="margin-top:8px">${esc(spec.add)}</button>${tail}</div>`;
  }

  const pending = new Map();
  function flushPending() {
    pending.forEach(({ t, path, value }) => { clearTimeout(t); PlanStore.set(path, value); });
    pending.clear();
  }

  function render() {
    flushPending();
    if (!P().v) { root.innerHTML = `<div class="card"><p>Setting up your site editor...</p></div>`; return; }
    root.innerHTML = `
      <div class="card note-card" style="padding:22px">
        <p style="margin:0">Everything on your public site lives here. Change a word and it shows on the site within a few seconds. <a class="link" href="./" target="_blank" rel="noopener">See my site</a></p>
      </div>
      ${TEXT.map(textCard).join('')}
      ${['works', 'teach', 'looking', 'quotes'].map(n => listCard(n, LISTS[n])).join('')}
      ${TEXT2.map(textCard).join('')}
      ${Object.entries(RESUME).map(([n, s]) => listCard(n, s)).join('')}
      <p class="sub" style="margin-top:20px">Photos and the videos of your dancing are picked by Dixon for now. Send him anything you want added.</p>`;
  }

  function wire() {
    root.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.path && el.type !== 'checkbox') {
        const key = el.dataset.path, path = key.split('|'), value = el.value.slice(0, 3900);
        const prev = pending.get(key); if (prev) clearTimeout(prev.t);
        pending.set(key, { path, value, t: setTimeout(() => { pending.delete(key); PlanStore.set(path, value); }, 450) });
        const row = el.closest('.ed-row'); const first = row && row.querySelector('[data-path]');
        if (first === el) row.querySelector('summary b').textContent = el.value || 'New';
      }
    });
    root.addEventListener('change', e => {
      const el = e.target;
      if (el.type === 'checkbox' && el.dataset.path) { PlanStore.set(el.dataset.path.split('|'), el.checked ? 'yes' : null); render(); }
      if (el.dataset.yt) {
        const v = el.value.trim(); if (!v) return;
        const id = ytId(v);
        if (!id) { toast('That does not look like a YouTube link'); return; }
        PlanStore.set(['pub', 'works', el.dataset.yt, 'yt'], id);
        PlanStore.set(['pub', 'works', el.dataset.yt, 'src'], null);
        PlanStore.set(['pub', 'works', el.dataset.yt, 'poster'], null);
        openRows.add(el.dataset.yt); toast('Video saved'); render();
      }
    });
    root.addEventListener('toggle', e => {
      const d = e.target; if (!d.dataset || !d.dataset.row) return;
      if (d.open) openRows.add(d.dataset.row); else openRows.delete(d.dataset.row);
    }, true);
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.add) {
        const name = b.dataset.add, list = rows(name);
        const id = name[0] + Date.now().toString(36);
        openRows.add(id);
        PlanStore.set(['pub', name, id, 'order'], String((parseFloat((list[list.length - 1] || {}).order) || list.length) + 1));
        render();
        const card = root.querySelector(`[data-row="${id}"] [data-path]`); if (card) { card.focus(); card.select && card.select(); }
      }
      if (b.dataset.del) {
        const [name, id] = b.dataset.del.split('|');
        if (!confirm('Remove this from your site?')) return;
        PlanStore.set(['pub', name, id], null); render();
      }
      if (b.dataset.move) {
        const [name, id, d] = b.dataset.move.split('|');
        const list = rows(name), i = list.findIndex(r => r.id === id), j = i + Number(d);
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        openRows.add(id);
        list.forEach((r, k) => { if (String(r.order) !== String(k + 1)) PlanStore.set(['pub', name, r.id, 'order'], String(k + 1)); });
        render();
      }
    });
  }

  // First open: copy the starting site into the plan, field by field.
  async function seed() {
    if (!seedCache) seedCache = await (await fetch('data/site.json', { cache: 'no-cache' })).json();
    const s = seedCache;
    Object.entries(s.text || {}).forEach(([k, v]) => PlanStore.set(['pub', 'text', k], v));
    ['works', 'teach', 'looking', 'quotes', 'jobs', 'training', 'skills'].forEach(n =>
      Object.entries(s[n] || {}).forEach(([id, row]) => Object.entries(row).forEach(([f, v]) => PlanStore.set(['pub', n, id, f], v))));
    PlanStore.set(['pub', 'v'], '1');
  }

  async function open(el, toastFn) {
    root = el; toast = toastFn;
    if (!root.dataset.wired) { wire(); root.dataset.wired = '1'; }
    if (!P().v) {
      render();
      // Only ever seed against the server's current copy, never an offline device copy.
      await PlanStore.refresh(true);
      if (PlanStore.status !== 'plan') { root.innerHTML = `<div class="card"><p>You're offline. Your site editor opens once you're back online.</p></div>`; return; }
      if (!P().v) await seed();
    }
    render();
  }

  return { open };
})();
