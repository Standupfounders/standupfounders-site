/* Stand Up courses area, Stage 1 framework. Each book is a course; a course has modules; a module has sections.
   Plain JS. All text is written with textContent. Progress is kept only in this browser (key stepup.v1.courses).
   Data: data/<set>/courses/*.json and data/<set>/lessons/*.json. Real lesson lines exist only in the real data set (local). */
(function () {
  'use strict';
  var META = function (n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute('content') : ''; };
  var SET = META('su-data-set') || 'placeholder';
  var PUB = META('su-public') === '1';   // public site: no placeholder wording
  var MODE = META('su-mode') || 'preview';
  var BASE = 'data/' + SET + '/';
  var KEY = 'stepup.v1.courses';
  var courses = [], lessons = {}, root = null, ready = null, current = 'courses', forceFk = null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function link(href, text, cls) { var a = el('a', cls, text); a.href = href; return a; }
  function btn(text, cls, fn) { var b = el('button', 'btn ' + (cls || ''), text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function getData(p) {
    if (window.SU_EMBED && window.SU_EMBED[BASE + p]) return Promise.resolve(JSON.parse(JSON.stringify(window.SU_EMBED[BASE + p])));
    return fetch(BASE + p).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
  }
  function toast(m) { var t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); }

  /* ---------- state, browser only ---------- */
  function fresh() { return { schema: 1, start: null, items: {}, ex: {}, check: {}, lc: {}, last: null }; }
  function load() { try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && r.schema === 1) return r; } catch (e) {} return fresh(); }
  var S = load();
  var storageOK = (function () { try { localStorage.setItem('su.t', '1'); localStorage.removeItem('su.t'); return true; } catch (e) { return false; } })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var APPKEY = 'stepup.v1.progress';   // the class-page progress key used by app.js
  // Public site: an item is READY when it has a lesson file (or a video). Others show as "Coming soon", greyed, not clickable.
  // Items with no lesson file show "Coming soon" when unbuilt. Level checks and workshops have content but no lesson file;
  // set SOON_INTERACTIVE = false to show them as ready again (one-line switch).
  var SOON_INTERACTIVE = false;
  function isReady(i) { if (!PUB) return true; if (i.lesson || i.video || i.video_soon) return true; if (!SOON_INTERACTIVE && (i.kind === 'level_check' || i.kind === 'workshop')) return true; return false; }
  function readyItems(m) { return m.items.filter(isReady); }
  function seq(c) { var a = []; c.modules.forEach(function (m) { m.items.forEach(function (i) { if (isReady(i)) a.push({ m: m, i: i }); }); }); return a; }
  function soonCount(c) { var n = 0; c.modules.forEach(function (m) { m.items.forEach(function (i) { if (!isReady(i)) n++; }); }); return n; }
  function around(c, i) { var s = seq(c), k = -1; for (var x = 0; x < s.length; x++) if (s[x].i === i) { k = x; break; } return { prev: s[k - 1] || null, next: s[k + 1] || null }; }
  function courseCounts(c) { var n = 0, d = 0, k = 0; seq(c).forEach(function (x) { n++; var st = state(x.i); if (st === 'done') d++; else if (st === 'skipped') k++; }); return { n: n, done: d, skipped: k, left: n - d - k }; }
  function firstOpen(c) { var s = seq(c); for (var x = 0; x < s.length; x++) { var st = state(s[x].i); if (st !== 'done' && st !== 'skipped') return s[x]; } return s[0] || null; }
  function lessonItems(c) { return seq(c).filter(function (x) { return x.i.lesson; }); }
  function saveNote() { var p = el('p', 'muted small', storageOK ? 'Your progress is saved on this device, in this browser. Nothing is sent anywhere.' : 'Your browser is blocking storage, so your progress, notes and answers will not be kept when you close this page.'); if (!storageOK) p.className = 'note'; return p; }
  function exportProgress() {
    var o = { app: 'Stand Up Founders', exported: new Date().toISOString(), data: {} };
    [KEY, APPKEY].forEach(function (k) { try { var v = localStorage.getItem(k); if (v) o.data[k] = JSON.parse(v); } catch (e) {} });
    var blob = new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'stand-up-progress.json'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importProgress(file, msg) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var o = JSON.parse(r.result); if (!o || o.app !== 'Stand Up Founders' || !o.data) throw new Error('not a Stand Up progress file');
        var n = 0;
        [KEY, APPKEY].forEach(function (k) {
          var d = o.data[k]; if (!d || d.schema !== 1 || typeof d !== 'object') return;
          if (k === KEY) {   // keep only plain data of the right shape; links must be in-page routes
            var okRoute = /^#[a-z0-9-]+$/;
            var clean = fresh();
            if (typeof d.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.start)) clean.start = d.start;
            ['items', 'ex', 'check', 'lc'].forEach(function (f) { if (d[f] && typeof d[f] === 'object' && !Array.isArray(d[f])) clean[f] = d[f]; });
            Object.keys(clean.items).forEach(function (id) { if (['open', 'done', 'skipped'].indexOf(clean.items[id]) < 0 || !/^[A-Za-z0-9_-]+$/.test(id)) delete clean.items[id]; });
            Object.keys(clean.ex).forEach(function (id) { if (typeof clean.ex[id] !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) delete clean.ex[id]; });
            Object.keys(clean.lc).forEach(function (id) { var v = clean.lc[id]; if (!v || typeof v.text !== 'string' || typeof v.href !== 'string' || !okRoute.test(v.href)) delete clean.lc[id]; });
            if (d.last && typeof d.last === 'object' && okRoute.test('#lesson-' + String(d.last.course) + '-' + String(d.last.module) + '-' + String(d.last.item))) clean.last = { course: String(d.last.course), module: String(d.last.module), item: String(d.last.item), ts: +d.last.ts || 0 };
            d = clean;
          }
          localStorage.setItem(k, JSON.stringify(d)); n++;
        });
        if (!n) throw new Error('no progress found in that file');
        S = load(); toast('Progress imported. It replaced what this browser had.'); render();
      } catch (e) { msg.textContent = 'That file could not be imported (' + e.message + '). Nothing was changed.'; toast('That file could not be imported. Nothing was changed.'); }
    };
    r.onerror = function () { msg.textContent = 'That file could not be read. Nothing was changed.'; };
    r.readAsText(file);
  }
  function movePanel() {
    var b = el('div', 'box'); b.style.marginTop = '36px'; b.appendChild(el('span', 'label', 'Your progress'));
    b.appendChild(el('p', null, 'There are no accounts. Your progress, notes and answers stay in this browser on this device. To move to another device, export them here and import them there.'));
    var row = el('div', 'ctas'); row.style.marginTop = '12px';
    row.appendChild(btn('Export my progress', 'ghost', exportProgress));
    var lb = el('label', 'btn ghost', 'Import my progress'); lb.setAttribute('for', 'imp-file'); lb.style.cursor = 'pointer';
    var inp = el('input'); inp.type = 'file'; inp.id = 'imp-file'; inp.accept = 'application/json,.json'; inp.style.cssText = 'position:absolute;left:-9999px';
    var msg = el('p', 'muted small', ''); msg.setAttribute('role', 'status'); msg.style.marginTop = '10px';
    inp.addEventListener('change', function () { if (inp.files && inp.files[0]) importProgress(inp.files[0], msg); });
    var del = el('button', 'btn ghost', 'Delete all my data on this device'); del.type = 'button'; var armed = false;
    del.addEventListener('click', function () {
      if (!armed) { armed = true; del.textContent = 'Press again to delete everything'; return; }
      try { [KEY, APPKEY, 'stepup.v1.community'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
      S = fresh(); toast('All your progress, notes and answers on this device were deleted.'); render();
    });
    row.appendChild(inp); row.appendChild(lb); row.appendChild(del); b.appendChild(row); b.appendChild(msg); return b;
  }

  /* ---------- lookups ---------- */
  function allItems(c) { var a = []; c.modules.forEach(function (m) { m.items.forEach(function (i) { a.push({ c: c, m: m, i: i }); }); }); return a; }
  function find(h) {
    for (var a = 0; a < courses.length; a++) {
      var c = courses[a];
      if (h === 'course-' + c.slug) return { kind: 'course', c: c };
      for (var b = 0; b < c.modules.length; b++) {
        var m = c.modules[b];
        if (h === 'module-' + c.slug + '-' + m.id) return { kind: 'module', c: c, m: m };
        for (var d = 0; d < m.items.length; d++) {
          if (h === 'lesson-' + c.slug + '-' + m.id + '-' + m.items[d].id) return { kind: 'item', c: c, m: m, i: m.items[d] };
        }
      }
    }
    return null;
  }
  function itemHref(c, m, i) { return '#lesson-' + c.slug + '-' + m.id + '-' + i.id; }
  function state(i) { return S.items[i.id] || ''; }
  function stateLabel(s) { return s === 'done' ? 'Done' : s === 'skipped' ? 'Skipped' : s === 'open' ? 'In progress' : 'Not started'; }
  function moduleCounts(m) {
    var its = readyItems(m), n = its.length, d = 0, k = 0, o = 0;
    its.forEach(function (i) { var s = state(i); if (s === 'done') d++; else if (s === 'skipped') k++; else if (s === 'open') o++; });
    return { n: n, done: d, skipped: k, open: o, complete: d + k === n };
  }

  /* ---------- suggested dates (counted from the student's own start date) ---------- */
  function parseISO(s) { var p = (s || '').split('-'); if (p.length !== 3) return null; var d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? null : d; }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function fmtDate(d) { try { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return d.toDateString(); } }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function moduleDue(m) { var s = parseISO(S.start); return s ? addDays(s, m.week_to * 7 - 1) : null; }
  function pace(c) {
    var s = parseISO(S.start); if (!s) return null;
    if (s.getTime() > parseISO(todayISO()).getTime()) return null;
    var today = parseISO(todayISO()), expected = 0, actual = 0;
    c.modules.forEach(function (m) { var due = moduleDue(m); if (due && due.getTime() <= today.getTime()) expected++; if (moduleCounts(m).complete) actual++; });
    if (actual > expected) return 'ahead';
    if (actual === expected) return 'on track';
    return 'a bit behind';
  }

  /* ---------- shared pieces ---------- */
  function head(label, title, lede, crumbs) {
    var e = el('div', 'eyebrow');
    if (crumbs) { var l = el('span', 'label'); crumbs.forEach(function (c, ix) { if (ix) l.appendChild(document.createTextNode(' / ')); if (c[1]) l.appendChild(link(c[1], c[0])); else l.appendChild(document.createTextNode(c[0])); }); e.appendChild(l); }
    else e.appendChild(el('span', 'label', label));
    if (!PUB) e.appendChild(el('span', 'ph', SET === 'real' ? 'Local copy \u00b7 real lines' : 'Early preview'));
    root.appendChild(e);
    root.appendChild(el('h1', 'h1', title));
    if (lede) { var p = el('p', 'lede small', lede); p.style.marginTop = '14px'; root.appendChild(p); }
  }
  function headerLine(c) { var n = el('div', 'note'); n.style.marginTop = '18px'; if (!PUB) n.appendChild(el('span', 'ph', 'Course header')); n.appendChild(document.createTextNode((PUB ? '' : ' ') + c.header_line)); if (c.page_text) n.appendChild(el('p', 'small muted', c.page_text)); return n; }
  function badge(s) { var b = el('span', 'badge ' + (s || 'none'), stateLabel(s)); return b; }
  function rhythm(c) {
    var wrap = el('div', 'rhythm'); wrap.setAttribute('role', 'list'); wrap.setAttribute('aria-label', PUB ? 'Suggested weekly rhythm' : 'Suggested twelve-week rhythm');
    var s = parseISO(S.start), nowWeek = 0;
    if (s && s.getTime() <= parseISO(todayISO()).getTime()) { var diff = Math.floor((parseISO(todayISO()).getTime() - s.getTime()) / 86400000); nowWeek = Math.floor(diff / 7) + 1; }
    for (var w = 1; w <= (c.weeks || 12); w++) {
      var mods = c.modules.filter(function (m) { return w >= m.week_from && w <= m.week_to; });
      var b = el('div', 'wk' + (mods.length ? ' on' : '') + (w === nowWeek ? ' now' : '')); b.setAttribute('role', 'listitem');
      b.appendChild(el('span', 'label', 'Week ' + w));
      b.appendChild(el('span', 'wkt', mods.length ? mods.map(function (m) { return m.title; }).join(', ') : 'To come'));
      if (s) b.appendChild(el('span', 'wkd muted', 'by ' + fmtDate(addDays(s, w * 7 - 1))));
      wrap.appendChild(b);
    }
    return wrap;
  }

  /* ---------- pages ---------- */
  function pageCourses() {
    head('Courses', 'Courses', 'Each course follows one book I taught, in the book\u2019s order. Each lesson is my reading of it: what I agree with, what I add, my stories and my questions.');
    var g = el('div', 'cards4'); g.style.marginTop = '28px';
    courses.forEach(function (c) {
      if (PUB) {
        var firstL = lessonItems(c)[0] || null, nL = lessonItems(c).length, cc0 = courseCounts(c);
        var pc = el('div', 'card wide');
        var pb = el('div', 'body'); pb.appendChild(el('span', 'label', c.label));
        var ph3 = el('h3'); ph3.appendChild(link('#course-' + c.slug, c.title)); pb.appendChild(ph3);
        pb.appendChild(el('p', null, c.outcome));
        var pf = el('div', 'foot'); pf.appendChild(el('span', 'ph', seq(c).length + ' ready' + (soonCount(c) ? ' \u00b7 ' + soonCount(c) + ' coming soon' : '') + ' \u00b7 ' + c.modules.length + ' modules'));
        var started = cc0.done + cc0.skipped > 0 || (S.last && S.last.course === c.slug);
        if (started) pf.appendChild(el('span', 'ph', cc0.done + cc0.skipped + ' of ' + cc0.n + ' done'));
        if (started && cc0.left > 0) { var fo0 = firstOpen(c), tgt = (S.last && S.last.course === c.slug && resume()) ? resume().href : (fo0 ? itemHref(c, fo0.m, fo0.i) : '#course-' + c.slug); var ca = link(tgt, 'Continue', 'btn'); pf.appendChild(ca); }
        else if (started && cc0.left === 0) pf.appendChild(link('#done-' + c.slug, 'Finished: see summary', 'btn ghost'));
        else if (firstL) { var fa = link(itemHref(c, firstL.m, firstL.i), 'Open first lesson', 'btn ghost'); pf.appendChild(fa); }
        pb.appendChild(pf); pc.appendChild(pb); g.appendChild(pc); return;
      }
      var a = el('a', 'card wide'); a.href = '#course-' + c.slug;
      var b = el('div', 'body'); b.appendChild(el('span', 'label', c.label)); b.appendChild(el('h3', null, c.title));
      b.appendChild(el('p', null, c.outcome));
      var cnt = 0, done = 0; allItems(c).forEach(function (x) { cnt++; var s = state(x.i); if (s === 'done' || s === 'skipped') done++; });
      var f = el('div', 'foot'); f.appendChild(el('span', 'ph', done + ' of ' + cnt + ' items handled')); f.appendChild(el('span', 'ph', c.modules.length + ' modules so far')); b.appendChild(f);
      a.appendChild(b); g.appendChild(a);
    });
    if (!PUB) [1, 2].map(function (k) { return 'Course ' + (courses.length + k) + ' (another book, not built yet)'; }).forEach(function (t) {
      var d = el('div', 'box dash'); d.appendChild(el('span', 'ph', 'Empty slot')); d.appendChild(el('h3', null, t)); d.appendChild(el('p', 'muted', 'Placeholder. Shows where another book would go.')); g.appendChild(d);
    });
    root.appendChild(g);
    var h = el('h2', 'h2', 'A suggested rhythm'); h.style.cssText = 'font-size:1.6rem;margin:36px 0 8px'; root.appendChild(h);
    root.appendChild(el('p', 'muted', (PUB && courses[0] ? 'About ' + (courses[0].weeks || 12) + ' weeks for a first run through Course 1.' : 'About twelve weeks for a first run through.') + ' Suggested dates only: nothing locks, there are no weekly deadlines, and you can stop and pick up where you left off.'));
    if (courses[0]) { var r = rhythm(courses[0]); r.style.marginTop = '16px'; root.appendChild(r); }
    if (PUB) root.appendChild(movePanel());
  }
  function pageCourse(c) {
    head('Course', c.title, c.outcome, [['Courses', '#courses'], [c.label]]);
    root.appendChild(headerLine(c));
    if (PUB) {
      var cc1 = courseCounts(c), ct = el('div', 'ctas'); ct.style.marginTop = '20px';
      var started1 = cc1.done + cc1.skipped > 0 || (S.last && S.last.course === c.slug), fo1 = firstOpen(c), l1 = lessonItems(c)[0];
      if (started1 && cc1.left > 0 && fo1) ct.appendChild(link((S.last && S.last.course === c.slug && resume()) ? resume().href : itemHref(c, fo1.m, fo1.i), 'Continue where you left off', 'btn'));
      else if (started1) ct.appendChild(link('#done-' + c.slug, 'Course summary', 'btn'));
      else if (l1) ct.appendChild(link(itemHref(c, l1.m, l1.i), 'Start with lesson 1', 'btn'));
      root.appendChild(ct); root.appendChild(saveNote());
    }
    // start date and pace
    var box = el('div', 'box'); box.style.marginTop = '24px';
    box.appendChild(el('span', 'label', 'Your pace'));
    var s = parseISO(S.start), p = pace(c);
    var future = s && s.getTime() > parseISO(todayISO()).getTime();
    var pp = el('p', null, s ? (future ? ('You start on ' + fmtDate(s) + '. Suggested dates count from then.') : ('You started on ' + fmtDate(s) + '. ' + (p ? 'Right now you are ' + p + '.' : ''))) : 'Pick a start date to see suggested dates. They count from your own start, not from a calendar.');
    pp.setAttribute('data-fk', 'pace'); pp.setAttribute('tabindex', '-1'); box.appendChild(pp);
    var f = el('form', 'inline'); f.setAttribute('novalidate', '');
    var l = el('label', null, 'Start date'); l.setAttribute('for', 'start-date'); f.appendChild(l);
    var inp = el('input'); inp.type = 'date'; inp.id = 'start-date'; inp.value = S.start || ''; f.appendChild(inp);
    var sv = el('button', 'btn ghost', 'Set start date'); sv.type = 'submit'; f.appendChild(sv);
    var today = el('button', 'btn ghost', 'Start today'); today.type = 'button'; f.appendChild(today);
    f.addEventListener('submit', function (e) { e.preventDefault(); if (!inp.value) return; S.start = inp.value; save(); forceFk = 'pace'; render(); });
    today.addEventListener('click', function () { S.start = todayISO(); save(); forceFk = 'pace'; render(); });
    box.appendChild(f);
    if (S.start) { var cl = el('button', 'linkbtn', 'Clear start date'); cl.type = 'button'; cl.addEventListener('click', function () { S.start = null; save(); forceFk = 'pace'; render(); }); box.appendChild(cl); }
    box.appendChild(el('p', 'muted small', 'Words used: ahead, on track, a bit behind. Saved only in this browser.'));
    root.appendChild(box);
    var h = el('h2', 'h2', PUB ? 'A suggested run of about ' + (c.weeks || 12) + ' weeks' : 'The suggested twelve weeks'); h.style.cssText = 'font-size:1.6rem;margin:34px 0 4px'; root.appendChild(h);
    root.appendChild(el('p', 'muted small', c.season_note));
    var r = rhythm(c); r.style.marginTop = '14px'; root.appendChild(r);
    var h2 = el('h2', 'h2', 'Modules'); h2.style.cssText = 'font-size:1.6rem;margin:34px 0 10px'; root.appendChild(h2);
    var ul = el('ol', 'mods');
    c.modules.forEach(function (m) {
      var li = el('li', 'mod'); var cnt = moduleCounts(m);
      var top = el('div', 'modtop'); var a = link('#module-' + c.slug + '-' + m.id, m.title); a.className = 'modname'; top.appendChild(a);
      top.appendChild(el('span', 'ph', 'about ' + m.minutes + ' min')); li.appendChild(top);
      var due = moduleDue(m);
      li.appendChild(el('p', 'muted small', 'Weeks ' + m.week_from + (m.week_to !== m.week_from ? ' to ' + m.week_to : '') + ' \u00b7 ' + (due ? 'suggested by ' + fmtDate(due) : 'suggested dates appear after you set a start date') + ' \u00b7 ' + cnt.done + ' done, ' + cnt.skipped + ' skipped, ' + cnt.n + (PUB ? ' ready' + (m.items.length > cnt.n ? ', ' + (m.items.length - cnt.n) + ' coming soon' : '') : ' items')));
      var bar = el('div', 'prog'); var bb = el('b'); bb.style.width = Math.round(100 * (cnt.done + cnt.skipped) / Math.max(1, cnt.n)) + '%'; bar.appendChild(bb); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', m.title + ': ' + (cnt.done + cnt.skipped) + ' of ' + cnt.n + ' items handled'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(cnt.n)); bar.setAttribute('aria-valuenow', String(cnt.done + cnt.skipped)); li.appendChild(bar);
      ul.appendChild(li);
    });
    (PUB ? [] : (c.slots || [])).forEach(function (t) { var li = el('li', 'mod dash'); li.appendChild(el('span', 'ph', 'Empty slot')); li.appendChild(el('p', 'muted', t)); ul.appendChild(li); });
    root.appendChild(ul);
  }
  function crumbsFor(c, m) { return [['Courses', '#courses'], [c.label, '#course-' + c.slug], [m.title, '#module-' + c.slug + '-' + m.id]]; }
  function pageModule(c, m) {
    head('Module', m.title, 'About ' + m.minutes + ' minutes in short parts. Do a few, stop, and pick up where you left off. Skip anything you already know.', [['Courses', '#courses'], [c.label, '#course-' + c.slug], [m.title]]);
    var due = moduleDue(m);
    var info = el('p', 'muted small', 'Weeks ' + m.week_from + (m.week_to !== m.week_from ? ' to ' + m.week_to : '') + ' \u00b7 ' + (due ? 'suggested by ' + fmtDate(due) : 'no start date set')); info.style.marginTop = '12px'; root.appendChild(info);
    if (S.lc[m.id]) { var sug = el('div', 'note'); sug.style.marginTop = '14px'; sug.appendChild(document.createTextNode('Your last check suggested: ' + S.lc[m.id].text + ' ')); sug.appendChild(link(S.lc[m.id].href, 'Go there')); root.appendChild(sug); }
    var mc = moduleCounts(m); var pl = el('p', 'muted small', mc.done + ' done, ' + mc.skipped + ' skipped, ' + mc.n + ' ready' + (PUB && m.items.length > mc.n ? ', ' + (m.items.length - mc.n) + ' coming soon' : '') + (PUB ? '' : ' items')); pl.style.marginTop = '6px'; root.appendChild(pl);
    var pb = el('div', 'prog'); var pbb = el('b'); pbb.style.width = Math.round(100 * (mc.done + mc.skipped) / Math.max(1, mc.n)) + '%'; pb.appendChild(pbb); pb.setAttribute('role', 'progressbar'); pb.setAttribute('aria-label', m.title + ': ' + (mc.done + mc.skipped) + ' of ' + mc.n + ' items handled'); pb.setAttribute('aria-valuemin', '0'); pb.setAttribute('aria-valuemax', String(mc.n)); pb.setAttribute('aria-valuenow', String(mc.done + mc.skipped)); root.appendChild(pb);
    var ol = el('ol', 'items'); ol.style.marginTop = '22px';
    m.items.forEach(function (i, ix) {
      if (!isReady(i)) {
        var sli = el('li', 'itemrow soon'); sli.setAttribute('aria-disabled', 'true');
        var stop = el('div', 'modtop'); stop.appendChild(el('span', 'itname', i.title)); stop.appendChild(el('span', 'badge none', 'Coming soon')); sli.appendChild(stop);
        sli.appendChild(el('p', 'muted small', (i.kind === 'level_check' ? 'Check your level' : i.kind === 'workshop' ? 'Workshop' : 'Section') + ' \u00b7 coming soon')); ol.appendChild(sli); return;
      }
      var li = el('li', 'itemrow'); var s = state(i);
      var a = link(itemHref(c, m, i), i.title); a.className = 'itname';
      var top = el('div', 'modtop'); top.appendChild(a); top.appendChild(badge(s)); li.appendChild(top);
      var kind = i.kind === 'level_check' ? 'Check your level' : i.kind === 'journey' ? 'Journey' : i.kind === 'workshop' ? 'Workshop' : 'Section';
      li.appendChild(el('p', 'muted small', kind + ' \u00b7 about ' + i.minutes + ' min' + (PUB ? '' : (i.lesson ? (SET === 'real' ? ' \u00b7 draft lesson' : ' \u00b7 placeholder lesson') : (i.kind === 'section' ? ' \u00b7 outline only' : '')))));
      ol.appendChild(li);
    });
    root.appendChild(ol);
  }
  function controls(c, m, i) {
    var bar = el('div', 'ctrl'); var s = state(i);
    var st = el('span', 'badge ' + (s || 'none'), stateLabel(s)); st.setAttribute('role', 'status'); st.setAttribute('data-fk', 'stat'); st.setAttribute('tabindex', '-1'); bar.appendChild(st);
    if (s === 'done') bar.appendChild(btn('Mark not done', 'ghost', function () { S.items[i.id] = 'open'; save(); forceFk = 'stat'; render(); }));
    else bar.appendChild(btn('Mark done', '', function () { S.items[i.id] = 'done'; save(); if (PUB && courseCounts(c).left === 0) { location.hash = '#done-' + c.slug; return; } forceFk = 'stat'; render(); }));
    if (s === 'skipped') bar.appendChild(btn('Undo skip', 'ghost', function () { S.items[i.id] = 'open'; save(); forceFk = 'stat'; render(); }));
    else if (s !== 'done') bar.appendChild(btn('Skip for now', 'ghost', function () { S.items[i.id] = 'skipped'; save(); toast('Skipped. It stays in your list; you can come back.'); forceFk = 'stat'; render(); }));
    return bar;
  }
  function stepBar(c, m, i) {
    var a = around(c, i), bar = el('nav', 'ctrl stepnav'); bar.setAttribute('aria-label', 'Previous and next');
    if (a.prev) bar.appendChild(link(itemHref(c, a.prev.m, a.prev.i), '\u2190 ' + (a.prev.m !== m ? 'Previous module: ' : 'Previous: ') + a.prev.i.title, 'btn ghost'));
    bar.appendChild(link('#module-' + c.slug + '-' + m.id, 'This module', 'btn ghost'));
    if (a.next) bar.appendChild(link(itemHref(c, a.next.m, a.next.i), (a.next.m !== m ? 'Next module: ' + a.next.m.title : 'Next: ' + a.next.i.title) + ' \u2192', 'btn'));
    else bar.appendChild(link('#done-' + c.slug, 'Finish this course \u2192', 'btn'));
    return bar;
  }
  function areaSave(id, ta) { ta.value = S.ex[id] || ''; ta.addEventListener('input', function () { S.ex[id] = ta.value; save(); }); }
  function lessonBody(c, m, i, L) {
    root.appendChild(headerLine(c));
    if (L.chapter_note) { var cn = el('p', 'muted small', L.chapter_note); cn.style.marginTop = '8px'; root.appendChild(cn); }
    var credit = (L.quote_log && L.quote_log[0] && L.quote_log[0].book) || '[title] by [author]';
    if (PUB) {
      var ob = []; ob.push('Read it, about ' + (i.minutes || 9) + ' minutes'); if (L.exercise) ob.push('write for five minutes'); if (L.check && L.check.length) ob.push('check yourself with ' + L.check.length + ' question' + (L.check.length > 1 ? 's' : ''));
      var op = el('p', 'muted small', 'In this lesson: ' + ob.join(', then ') + '.'); op.style.marginTop = '10px'; root.appendChild(op);
    }
    L.groups.forEach(function (g) {
      var sec = el('section', 'lgroup');
      if (g.heading) sec.appendChild(el('h2', 'h2', g.heading));
      g.lines.forEach(function (ln) {
        if (ln.kind === 'quote') {
          var q = el('blockquote', 'lquote'); q.appendChild(el('p', null, ln.text)); q.appendChild(el('cite', null, 'The author\u2019s words, as I read them in class. From ' + credit + '.')); sec.appendChild(q);
        } else if (ln.kind === 'student') sec.appendChild(el('p', 'lstu', ln.text));
        else sec.appendChild(el('p', 'lp', ln.text));
      });
      root.appendChild(sec);
    });
    if (L.exercise) {
      var ex = el('section', 'lgroup box'); ex.appendChild(el('span', 'label', 'Exercise \u00b7 ' + L.exercise.title));
      var ol = el('ol', 'steps'); L.exercise.steps.forEach(function (t) { ol.appendChild(el('li', null, t)); }); ex.appendChild(ol);
      var lab = el('label', null, 'Write here. It is saved only in this browser.'); lab.setAttribute('for', 'ex-' + L.id); ex.appendChild(lab);
      var ta = el('textarea'); ta.id = 'ex-' + L.id; areaSave('ex-' + L.id, ta); ex.appendChild(ta); root.appendChild(ex);
    }
    if (L.check && L.check.length) {
      var ck = el('form', 'lgroup quiz'); ck.setAttribute('novalidate', ''); ck.appendChild(el('span', 'label', 'Quick check \u00b7 a study aid, not a test'));
      L.check.forEach(function (q, qi) {
        var fs = el('fieldset'); fs.appendChild(el('legend', null, q.q));
        q.choices.forEach(function (ch, ci) { var lb = el('label', 'opt'); var r = el('input'); r.type = 'radio'; r.name = 'ck' + qi; r.value = String(ci); lb.appendChild(r); lb.appendChild(el('span', null, ch)); fs.appendChild(lb); });
        ck.appendChild(fs);
      });
      var res = el('p', 'res', ''); res.setAttribute('role', 'status');
      var prev = S.check[L.id]; if (prev) res.textContent = 'Last time: ' + prev.score + ' of ' + prev.of + '.';
      var sb = el('button', 'btn ghost', 'Check my answers'); sb.type = 'submit'; ck.appendChild(sb); ck.appendChild(res);
      ck.addEventListener('submit', function (e) {
        e.preventDefault(); var score = 0, miss = [];
        L.check.forEach(function (q, qi) { var sel = ck.querySelector('input[name=ck' + qi + ']:checked'); if (sel && +sel.value === q.answer) score++; else miss.push(qi + 1); });
        S.check[L.id] = { score: score, of: L.check.length }; save();
        res.textContent = 'You got ' + score + ' of ' + L.check.length + '.' + (miss.length ? ' Look again at question ' + miss.join(' and ') + '.' : ' Nicely done.');
      });
      root.appendChild(ck);
    }
    if (L.recap) { var rc = el('div', 'note lrecap'); rc.appendChild(el('span', 'label', PUB ? 'Takeaway' : 'In one line')); rc.appendChild(el('p', null, L.recap)); root.appendChild(rc); }
    if (false) {
      var rv = el('p', 'muted small', ''); rv.style.marginTop = '24px'; rv.appendChild(document.createTextNode('For reviewers: ')); rv.appendChild(link('#review-' + L.id, 'open the reviewer view (marks, sources, quote log)')); rv.appendChild(document.createTextNode('. Not for students.')); root.appendChild(rv);
    }
  }
  function levelCheckBody(c, m, i) {
    var f = el('form', 'lgroup quiz'); f.setAttribute('novalidate', '');
    i.questions.forEach(function (q, qi) {
      var fs = el('fieldset'); fs.appendChild(el('legend', null, q.q));
      q.options.forEach(function (o, oi) { var lb = el('label', 'opt'); var r = el('input'); r.type = 'radio'; r.name = 'lc' + qi; r.value = String(oi); lb.appendChild(r); lb.appendChild(el('span', null, o)); fs.appendChild(lb); });
      f.appendChild(fs);
    });
    var out = el('div', 'note'); out.hidden = true; out.setAttribute('role', 'status');
    var sb = el('button', 'btn', 'Show my suggestion'); sb.type = 'submit'; f.appendChild(sb); f.appendChild(out);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var top = 0, weak = null, answered = 0;
      i.questions.forEach(function (q, qi) { var sel = f.querySelector('input[name=lc' + qi + ']:checked'); if (!sel) return; answered++; var v = +sel.value; if (v === q.options.length - 1) top++; else if (v === 0 && weak === null) weak = q; });
      if (!answered) { out.hidden = false; out.textContent = 'Pick an answer for at least one question.'; return; }
      var target, text;
      if (top >= i.questions.length - 1) { target = m.items[m.items.length - 1]; text = 'You do much of this already. Jump to the Workshop, or open any section you want.'; }
      else if (weak) { m.items.forEach(function (x) { if (x.id === weak.item) target = x; }); text = 'Start with \u201c' + (target ? target.title : 'the first section') + '\u201d.'; }
      else { target = m.items[1]; text = 'Start at the first section.'; }
      if (!target) target = m.items[1];
      S.lc[m.id] = { text: text, href: itemHref(c, m, target) }; save();
      out.hidden = false; clear(out); out.appendChild(document.createTextNode(text + ' You can go anywhere: nothing is locked. ')); out.appendChild(link(itemHref(c, m, target), 'Go there')); out.setAttribute('tabindex', '-1'); out.focus();
    });
    root.appendChild(f);
  }
  function workshopBody(c, m, i) {
    var b = el('section', 'lgroup box'); b.appendChild(el('span', 'label', 'Write one line for each'));
    var ol = el('ol', 'steps'); i.steps.forEach(function (t) { ol.appendChild(el('li', null, t)); }); b.appendChild(ol);
    var lab = el('label', null, 'Write here. It is saved only in this browser.'); lab.setAttribute('for', 'ws-' + i.id); b.appendChild(lab);
    var ta = el('textarea'); ta.id = 'ws-' + i.id; areaSave('ws-' + i.id, ta); b.appendChild(ta); root.appendChild(b);
  }
  /* LOCAL STANDALONE ONLY: a narrated video on an item. Data field i.video = {src, label}. The public build never sets it. */
  function videoBlock(v) {
    var box = el('div', 'box'); box.style.marginTop = '20px';
    box.appendChild(el('span', 'label', 'Video'));
    var vid = document.createElement('video');
    vid.controls = true; vid.preload = 'metadata'; vid.setAttribute('playsinline', '');
    vid.style.cssText = 'display:block;width:100%;max-width:720px;margin-top:8px;background:#000';
    vid.setAttribute('aria-label', v.label);
    var s = document.createElement('source'); s.src = v.src; s.type = 'video/mp4'; vid.appendChild(s);
    if (v.captions) { var tk = document.createElement('track'); tk.kind = 'captions'; tk.srclang = 'en'; tk.label = 'English'; tk.src = v.captions; vid.appendChild(tk); }
    box.appendChild(vid);
    if (v.transcript) { var dt = document.createElement('details'); dt.style.marginTop = '8px'; var sm = document.createElement('summary'); sm.textContent = 'Transcript'; dt.appendChild(sm); dt.appendChild(el('p', 'muted small', v.transcript)); box.appendChild(dt); }
    return box;
  }
  function pageItem(c, m, i) {
    if (PUB && !isReady(i)) {
      head('Coming soon', i.title, 'This part is not open yet.', crumbsFor(c, m).concat([[i.title]]));
      root.appendChild(el('p', 'lede small', 'It will appear here when it is ready. Nothing is lost: everything that is open is open now.'));
      var sc = el('div', 'ctas'); sc.style.marginTop = '24px'; sc.appendChild(link('#module-' + c.slug + '-' + m.id, 'Back to this module', 'btn'));
      var fo2 = firstOpen(c); if (fo2) sc.appendChild(link(itemHref(c, fo2.m, fo2.i), 'Continue: ' + fo2.i.title, 'btn ghost')); root.appendChild(sc); return;
    }
    var kind = i.kind === 'level_check' ? 'Check your level' : i.kind === 'journey' ? 'Journey' : i.kind === 'workshop' ? 'Workshop' : 'Section';
    head(kind, i.title, 'About ' + i.minutes + ' minutes.', crumbsFor(c, m).concat([[i.title]]));
    if (!S.items[i.id]) { S.items[i.id] = 'open'; }
    S.last = { course: c.slug, module: m.id, item: i.id, ts: Date.now() }; save();
    var bar = controls(c, m, i); bar.style.marginTop = '20px'; root.appendChild(bar);
    if (!storageOK) root.appendChild(saveNote());
    if (i.video) root.appendChild(videoBlock(i.video));
    if (i.video_soon) {
      var vs = el('div', 'box'); vs.style.marginTop = '20px'; vs.appendChild(el('span', 'label', 'Video'));
      vs.appendChild(el('p', null, 'Video coming soon. The words are below.'));
      if (i.video_soon.transcript) { var vdt = document.createElement('details'); vdt.open = true; vdt.style.marginTop = '8px'; var vsm = document.createElement('summary'); vsm.textContent = 'Transcript'; vdt.appendChild(vsm); vdt.appendChild(el('p', 'muted small', i.video_soon.transcript)); vs.appendChild(vdt); }
      root.appendChild(vs);
    }
    if (i.kind === 'level_check') { root.appendChild(el('p', 'lede small', i.idea)); levelCheckBody(c, m, i); }
    else if (i.lesson) {
      if (lessons[i.lesson]) lessonBody(c, m, i, lessons[i.lesson]);
      else { var w = el('p', 'muted', 'Loading the lesson...'); root.appendChild(w); getData('lessons/' + i.lesson + '.json').then(function (L) { lessons[i.lesson] = L; render(); }).catch(function (e) { w.textContent = 'We could not load this lesson. Check your connection and try again.'; }); }
    } else {
      if (PUB && (i.kind === 'workshop' || i.video || i.video_soon)) { var wl = el('p', 'lede small', i.idea || ''); wl.style.marginTop = '24px'; root.appendChild(wl); }
      else {
      var nt = el('div', 'box dash'); nt.style.marginTop = '24px'; nt.appendChild(el('span', 'ph', 'Outline only'));
      nt.appendChild(el('p', null, i.idea || 'The idea for this part is not written yet.'));
      nt.appendChild(el('p', 'muted small', 'The full lesson text for this part is not written yet.'));
      root.appendChild(nt); }
      if (i.kind === 'workshop') workshopBody(c, m, i);
    }
    var sb = stepBar(c, m, i); sb.style.marginTop = '32px'; root.appendChild(sb);
    var sn = saveNote(); sn.style.marginTop = '14px'; if (storageOK) root.appendChild(sn);
  }
  function pageNotFound() {
    head('Not found', 'We could not find that page', 'The link may be old or mistyped. Nothing is lost: your progress is still saved on this device.', [['Courses', '#courses'], ['Not found']]);
    var r = resume(); var ctas = el('div', 'ctas'); ctas.style.marginTop = '24px';
    if (r) ctas.appendChild(link(r.href, 'Continue where you left off', 'btn'));
    ctas.appendChild(link('#courses', 'All courses', r ? 'btn ghost' : 'btn')); root.appendChild(ctas);
  }
  function pageComplete(c) {
    var cc = courseCounts(c), idx = courses.indexOf(c), nextC = courses[idx + 1] || null, all = cc.left === 0;
    head('Course', all ? 'You finished ' + c.label : c.label + ': ' + cc.left + ' item' + (cc.left === 1 ? '' : 's') + ' to go',
      all ? 'You worked through every item that is open in this course. Well done. Nothing here is graded; what counts is what you do with it.' : 'You have handled ' + (cc.done + cc.skipped) + ' of ' + cc.n + ' items. Pick up where you stopped, or open any item you skipped.',
      [['Courses', '#courses'], [c.label, '#course-' + c.slug], ['Finish']]);
    var box = el('div', 'box'); box.style.marginTop = '24px'; box.appendChild(el('span', 'label', 'Your course'));
    box.appendChild(el('p', null, cc.done + ' done, ' + cc.skipped + ' skipped, ' + cc.left + ' not started, out of ' + cc.n + ' ready items.' + (soonCount(c) ? ' ' + soonCount(c) + ' more are coming soon.' : '')));
    var bar = el('div', 'prog'); var bb = el('b'); bb.style.width = Math.round(100 * (cc.done + cc.skipped) / cc.n) + '%'; bar.appendChild(bb); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', c.label + ': ' + (cc.done + cc.skipped) + ' of ' + cc.n + ' items handled'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(cc.n)); bar.setAttribute('aria-valuenow', String(cc.done + cc.skipped)); box.appendChild(bar);
    root.appendChild(box);
    var skipped = seq(c).filter(function (x) { return state(x.i) === 'skipped'; });
    if (skipped.length) {
      var h2 = el('h2', 'h2', 'Skipped items'); h2.style.cssText = 'font-size:1.4rem;margin:30px 0 8px'; root.appendChild(h2);
      var ul = el('ul', 'list'); skipped.slice(0, 40).forEach(function (x) { var li = el('li'); li.appendChild(link(itemHref(c, x.m, x.i), x.i.title)); li.appendChild(document.createTextNode(' \u00b7 ' + x.m.title)); ul.appendChild(li); }); root.appendChild(ul);
      if (skipped.length > 40) root.appendChild(el('p', 'muted small', 'and ' + (skipped.length - 40) + ' more.'));
    }
    var ctas = el('div', 'ctas'); ctas.style.marginTop = '28px';
    if (!all) { var fo = firstOpen(c); if (fo) ctas.appendChild(link(itemHref(c, fo.m, fo.i), 'Continue: ' + fo.i.title, 'btn')); }
    else if (nextC) { var nl = lessonItems(nextC)[0] || seq(nextC)[0]; ctas.appendChild(link('#course-' + nextC.slug, 'Next course: ' + nextC.label, 'btn')); if (nl) ctas.appendChild(link(itemHref(nextC, nl.m, nl.i), 'Open its first lesson', 'btn ghost')); }
    else { var nb = el('p', 'lede small', 'That was the last course so far. More will be added.'); root.appendChild(nb); }
    ctas.appendChild(link('#course-' + c.slug, 'Back to ' + c.label, 'btn ghost')); ctas.appendChild(link('#courses', 'All courses', 'btn ghost')); root.appendChild(ctas);
    root.appendChild(movePanel());
  }
  function pageReview(id) {
    var L = lessons[id];
    if (!L) { root.appendChild(el('p', 'muted', 'Loading the reviewer view...')); getData('lessons/' + id + '.json').then(function (d) { lessons[id] = d; render(); }).catch(function (e) { clear(root); root.appendChild(el('p', 'note', 'No lesson to review (' + e.message + ').')); }); return; }
    head('Reviewer view', 'Reviewer view: ' + L.title, 'Draft view. Every line has a mark and a source cue.', [['Courses', '#courses'], ['Reviewer view']]);
    var st = el('div', 'note'); st.style.marginTop = '18px'; st.appendChild(el('span', 'ph', 'Status')); st.appendChild(document.createTextNode(' ' + L.status + ' \u00b7 ' + L.source)); root.appendChild(st);
    var lg = el('p', 'muted small'); lg.style.marginTop = '12px'; lg.textContent = 'Marks: ' + Object.keys(L.marks_legend).map(function (k) { return k + ' = ' + L.marks_legend[k]; }).join('; ') + '.'; root.appendChild(lg);
    var count = {}; L.groups.forEach(function (g) { g.lines.forEach(function (ln) { count[ln.mark] = (count[ln.mark] || 0) + 1; }); });
    root.appendChild(el('p', 'muted small', 'Count of lines by mark: ' + Object.keys(count).sort().map(function (k) { return k + ' ' + count[k]; }).join(', ') + '.'));
    L.groups.forEach(function (g) {
      var h = el('h2', 'h2', g.heading || 'Hook'); h.style.cssText = 'font-size:1.4rem;margin:26px 0 8px'; root.appendChild(h);
      var wrap = el('div', 'rv');
      g.lines.forEach(function (ln) { var r = el('div', 'rvrow'); r.appendChild(el('span', 'mk m' + ln.mark, ln.mark)); var t = el('div', 'rvt'); t.appendChild(el('p', null, ln.text)); t.appendChild(el('p', 'muted small', 'Source: ' + ln.cue)); r.appendChild(t); wrap.appendChild(r); });
      root.appendChild(wrap);
    });
    var h2 = el('h2', 'h2', 'Quote log'); h2.style.cssText = 'font-size:1.4rem;margin:30px 0 8px'; root.appendChild(h2);
    (L.quote_log || []).forEach(function (q) { var b = el('div', 'box'); b.appendChild(el('p', null, q.book)); b.appendChild(el('p', 'muted small', q.words + ' words \u00b7 cue ' + q.cue + ' \u00b7 placement: ' + q.placement)); b.appendChild(el('p', 'muted small', 'Audio check: ' + q.audio_check)); root.appendChild(b); });
    root.appendChild(el('p', 'muted small', L.quote_totals));
    var h3 = el('h2', 'h2', 'Checklist'); h3.style.cssText = 'font-size:1.4rem;margin:30px 0 8px'; root.appendChild(h3);
    var ul = el('ul', 'list'); (L.checklist || []).forEach(function (t) { ul.appendChild(el('li', null, t)); }); root.appendChild(ul);
    var h4 = el('h2', 'h2', 'Still pending'); h4.style.cssText = 'font-size:1.4rem;margin:30px 0 8px'; root.appendChild(h4);
    var ul2 = el('ul', 'list'); (L.pending || []).forEach(function (t) { ul2.appendChild(el('li', null, t)); }); root.appendChild(ul2);
    if (L.check_note) root.appendChild(el('p', 'muted small', L.check_note));
    root.appendChild(el('p', 'muted small', 'Placeholder text. Not final.'));
  }

  /* ---------- route ---------- */
  function render() {
    if (!root) return;
    var ae = document.activeElement, fk = ae && ae.getAttribute ? ae.getAttribute('data-fk') : null, had = !!(ae && root.contains(ae));
    if (forceFk) { fk = forceFk; had = true; forceFk = null; }
    clear(root);
    var h = current, f;
    if (h === 'courses') pageCourses();
    else if (/^review-/.test(h)) { if (PUB) pageNotFound(); else pageReview(h.slice(7)); }
    else if (/^done-/.test(h)) { var dc = null; courses.forEach(function (x) { if ('done-' + x.slug === h) dc = x; }); if (dc) pageComplete(dc); else pageNotFound(); }
    else if ((f = find(h))) { if (f.kind === 'course') pageCourse(f.c); else if (f.kind === 'module') pageModule(f.c, f.m); else pageItem(f.c, f.m, f.i); }
    else if (PUB) pageNotFound();
    else pageCourses();
    if (had) { var t = fk ? root.querySelector('[data-fk="' + fk + '"]') : null; if (!t) { t = root.querySelector('h1'); if (t) t.setAttribute('tabindex', '-1'); } if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} } }
    window.dispatchEvent(new Event('su-progress'));
  }
  function resume() {
    var L = S.last; if (!L) return null;
    for (var a = 0; a < courses.length; a++) { var c = courses[a]; if (c.slug !== L.course) continue;
      for (var b = 0; b < c.modules.length; b++) { var m = c.modules[b]; if (m.id !== L.module) continue;
        for (var d = 0; d < m.items.length; d++) if (m.items[d].id === L.item) return { ts: L.ts || 0, text: c.label + ' \u00b7 ' + m.title + ' \u00b7 ' + m.items[d].title, href: itemHref(c, m, m.items[d]) }; } }
    return null;
  }
  function boot() {
    return getData('site.json').then(function (site) {
      return Promise.all((site.courses || []).map(function (id) { return getData('courses/' + id + '.json'); }));
    }).then(function (cs) { courses = cs; window.dispatchEvent(new Event('su-courses-ready')); });
  }
  window.SUCourses = {
    show: function (h) {
      current = h; root = document.getElementById('courses-root');
      if (!ready) ready = boot();
      ready.then(render).catch(function (e) { if (root) { clear(root); root.appendChild(el('p', 'note', (PUB ? 'We could not load the courses. Check your connection and try again.' : 'The courses did not load (' + e.message + ').'))); } });
    },
    resume: resume,
    locate: function (id, isLesson) {
      for (var a = 0; a < courses.length; a++) { var c = courses[a];
        for (var b = 0; b < c.modules.length; b++) { var m = c.modules[b];
          for (var d = 0; d < m.items.length; d++) { var i = m.items[d]; if ((isLesson ? i.lesson : i.id) === id) return { href: itemHref(c, m, i), title: i.title, course: c.label }; } } }
      return null;
    }
  };
  ready = boot(); ready.catch(function () {});
})();

