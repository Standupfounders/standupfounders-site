/* Stand Up concept site, Stage 1: data-driven pages. Plain JS, no framework.
   Data comes from data/<set>/*.json (set = meta su-data-set). All text is written with textContent. */
(function () {
  'use strict';
  var META = function (n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute('content') : ''; };
  var SET = META('su-data-set') || 'placeholder';
  var PUB = META('su-public') === '1';   // public site: real courses first, no placeholder wording
  var MODE = META('su-mode') || 'preview';   /* preview shows unready items with a reason; public applies the gate */
  var BASE = 'data/' + SET + '/';
  var KEY = 'stepup.v1.progress';

  var D = { site: null, classes: {}, stories: [], about: null };
  var VIEWS = ['home', 'classes', 'stories', 'about-jose', 'daily-call', 'join', 'sign-in', 'videos'];

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function getJSON(p) { if (window.SU_EMBED && window.SU_EMBED[BASE + p]) return Promise.resolve(JSON.parse(JSON.stringify(window.SU_EMBED[BASE + p]))); return fetch(BASE + p).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }); }
  var tt;
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 2800); }

  /* ---------- progress, browser only ---------- */
  function loadP() {
    try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && r.schema === 1) return r; } catch (e) {}
    return { schema: 1, lessons_done: [], quiz: {}, notes: {} };
  }
  function saveP(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  var P = loadP();

  /* ---------- consent gate ---------- */
  function hiddenReason(s) {
    if (s.status === 'placeholder') return 'Placeholder: no story chosen yet.';
    if (s.consent_state === 'withdrawn' || s.consent_state === 'declined') return 'Removed: consent ' + s.consent_state + '.';
    if (s.sensitive) return 'Held back: marked sensitive.';
    if (s.under_18_possible) return 'Held back: possible under 18, waiting for review.';
    if (s.consent_state !== 'on_record') {
      return s.speaker && s.speaker.is_learner ? 'Held back: no consent on record for this learner.' : 'Held back: Jose\'s written agreement is not on file yet.';
    }
    if (s.basis !== 'individual_yes' && s.basis !== 'terms_notice') return 'Held back: consent basis missing.';
    if (s.basis === 'terms_notice' && !s.notice_version) return 'Held back: notice version missing.';
    if (s.status !== 'ready') return 'Not ready: status is ' + s.status + '.';
    return '';
  }

  /* ---------- router ---------- */
  var currentClass = null;
  function setTitle() {
    if (!PUB) return;
    var h = document.querySelector('[data-view].on h1'), t = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    document.title = t && t !== 'Get up.Make the call.Decide on purpose.' ? t + ' \u00b7 Stand Up Founders' : 'Stand Up Founders';
  }
  window.addEventListener('su-progress', function () { setTimeout(setTitle, 30); });
  var routedOnce = false;
  document.addEventListener('click', function (e) { var s = e.target.closest && e.target.closest('a.skip'); if (s) { e.preventDefault(); var m = $('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } } });
  function focusHeading() {
    var h1 = document.querySelector('[data-view].on h1'); if (!h1) return;
    var ae = document.activeElement; if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(ae.tagName) >= 0) return;
    h1.setAttribute('tabindex', '-1'); try { h1.focus({ preventScroll: true }); } catch (e) {}
  }
  function route() {
    var h = (location.hash || '#home').slice(1);
    var view = h, cls = null;
    var HIDDEN = ['join', 'sign-in', 'classes', 'rules'];   // concept pages: not on the public site
    var SOON = { 'stories': ['Stories', 'Short stories from the calls, grouped by topic. Not open yet.'], 'daily-call': ['Daily call', 'A short call to get going. Not open yet.'], 'community': ['Community', 'A place to talk it through with other people who are building. Not open yet.'] };
    var soonKey = h.indexOf('community') === 0 ? 'community' : h;
    if (PUB && SOON[soonKey]) { view = 'soon'; $('h-soon').textContent = SOON[soonKey][0] + ': coming soon'; $('soon-label').textContent = 'Coming soon'; $('soon-text').textContent = SOON[soonKey][1]; }
    else if (PUB && (HIDDEN.indexOf(h) >= 0 || h.indexOf('class-') === 0 || h.indexOf('community') === 0)) { h = 'home'; view = 'home'; }
    else if (h.indexOf('class-') === 0) { view = 'class'; cls = h.slice(6); }
    else if (h === 'courses' || /^(course|module|lesson|review|done)-/.test(h)) { view = 'courses'; if (window.SUCourses) window.SUCourses.show(h); }
    else if (h.indexOf('community') === 0 || h === 'rules') { view = 'community'; if (window.SUCommunity) window.SUCommunity.show(h); }
    else if (VIEWS.indexOf(h) < 0) view = 'home';
    document.querySelectorAll('[data-view]').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-view') === view); });
    setTimeout(setTitle, 60);
    if (routedOnce) setTimeout(focusHeading, 150); routedOnce = true;
    var navKey = view === 'class' ? 'classes' : (view === 'soon' ? soonKey : view);
    document.querySelectorAll('nav.main a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var v = $('player-video'); if (v && !v.paused && view !== 'class') { try { v.pause(); } catch (e) {} }
    if (view === 'class') openClass(cls);
    window.scrollTo(0, 0);
  }

  /* ---------- home ---------- */
  function card(href, img, alt, label, title, text, chips, wide) {
    var a = el('a', 'card' + (wide ? ' wide' : '')); a.href = href;
    if (img) { var i = el('img'); i.src = img; i.alt = alt || ''; i.loading = 'lazy'; a.appendChild(i); }
    var b = el('div', 'body'); b.appendChild(el('span', 'label', label)); b.appendChild(el('h3', null, title));
    if (text) b.appendChild(el('p', null, text));
    if (chips && chips.length) { var f = el('div', 'foot'); chips.forEach(function (c) { f.appendChild(el('span', 'ph', c)); }); b.appendChild(f); }
    a.appendChild(b); return a;
  }
  function renderWatch(wid, lid) {
    var w = $(wid || 'watch'); if (!w) return;
    var vids = (D.site && D.site.videos) || [];
    var list = $(lid || 'watch-list'); clear(list);
    if (!vids.length) { w.hidden = true; return; }
    w.hidden = false;
    var lastGroup = null;
    vids.forEach(function (v) {
      if (v.group && v.group !== lastGroup) { var gh = el('h2', 'h2', v.group); gh.style.cssText = 'font-size:1.5rem;margin:30px 0 12px'; list.appendChild(gh); lastGroup = v.group; }
      if (v.soon) {
        var sb = el('div', 'box'); sb.style.cssText = 'margin-bottom:22px;opacity:.6'; sb.setAttribute('aria-disabled', 'true');
        sb.appendChild(el('h3', null, v.title)); sb.appendChild(el('p', 'muted', 'Coming soon'));
        var sl = (v.lesson || v.item) && window.SUCourses && window.SUCourses.locate ? window.SUCourses.locate(v.lesson || v.item, !!v.lesson) : null;
        if (sl) { var sp2 = el('p', 'small'); sp2.appendChild(document.createTextNode('The words are open now: ')); var sa = el('a', null, sl.title); sa.href = sl.href; sp2.appendChild(sa); sb.appendChild(sp2); }
        list.appendChild(sb); return;
      }
      var b = el('div', 'box'); b.style.marginBottom = '22px';
      b.appendChild(el('h3', null, v.title));
      var vid = document.createElement('video'); vid.controls = true; vid.preload = 'none'; vid.playsInline = true;
      vid.setAttribute('aria-label', v.title); vid.src = v.src; vid.style.width = '100%'; vid.style.maxWidth = '720px'; vid.style.marginTop = '10px';
      if (v.captions) { var tk = document.createElement('track'); tk.kind = 'captions'; tk.srclang = 'en'; tk.label = 'English'; tk.src = v.captions; vid.appendChild(tk); }
      b.appendChild(vid);
      if (v.caption) b.appendChild(el('p', 'muted small', v.caption));
      var loc = (v.lesson || v.item) && window.SUCourses && window.SUCourses.locate ? window.SUCourses.locate(v.lesson || v.item, !!v.lesson) : null;
      if (loc) { var lp = el('p', 'small'); lp.style.marginTop = '8px'; lp.appendChild(document.createTextNode('From ' + loc.course + ': ')); var la = el('a', null, loc.title); la.href = loc.href; lp.appendChild(la); b.appendChild(lp); }
      if (v.transcript) {
        var dt = document.createElement('details'); dt.style.marginTop = '8px';
        var sm = document.createElement('summary'); sm.textContent = 'Transcript'; dt.appendChild(sm);
        dt.appendChild(el('p', 'muted small', v.transcript)); b.appendChild(dt);
      }
      list.appendChild(b);
    });
  }
  function renderHome() {
    renderWatch('watch', 'watch-list');
    renderResume();
    var box = $('home-cards'); clear(box);
    if (PUB) {
      box.appendChild(card('#course-book-1', 'img/shot1.jpg', 'Impasto painting: a small figure under a thin amber horizon.', 'Course 1', 'Open Course 1', 'My reading of one book, module by module, in the book\u2019s order.'));
      box.appendChild(card('#lesson-book-1-m-a1-i-a1-1', 'img/shot2.jpg', 'Painting: one dark boulder under a thin amber horizon.', 'Lesson 1', 'Start with lesson 1', 'One idea, about nine minutes, then your own five minutes of writing.'));
      box.appendChild(card('#courses', 'img/shot7.jpg', 'Painting: a straight row of small dark marks across a navy ground, one of them amber.', 'Courses', 'All courses', 'Six courses, one per book, with every lesson open.'));
      return;
    }
    var c = D.classes[D.site.home.featured_class];
    if (c) box.appendChild(card('#class-' + c.slug, c.cover_image, 'Impasto painting for the class.', 'Class \u00b7 tester', c.title,
      'A small first class on one idea Jose teaches. Lessons are placeholders; the preview is real.', ['Mock class'], true));
    var s = D.stories.filter(function (x) { return x.id === D.site.home.featured_story; })[0];
    if (s) {
      var a = card('#stories', s.image, 'Impasto painting for the story.', 'Story', s.title, s.excerpt ? '\u201c' + s.excerpt + '\u201d' : s.summary);
      box.appendChild(a);
    }
    box.appendChild(card('#daily-call', 'img/shot2.jpg', 'Painting: one dark boulder under a thin amber horizon.', 'Daily call', 'Every day, a decision', 'Show up. Make the call. Get going.'));
  }

  /* ---------- classes ---------- */
  function renderClasses() {
    var box = $('class-cards'); clear(box);
    D.site.classes.forEach(function (id, n) {
      var c = D.classes[id]; if (!c) return;
      var a = card('#class-' + c.slug, c.cover_image, 'Impasto painting for the class.', 'Class ' + (n + 1) + ' \u00b7 tester', c.title, c.outcome, ['Mock class', (c.lessons.filter(function (l) { return l.counts !== false; }).length) + ' placeholder lessons']);
      a.setAttribute('data-kind', 'mock'); box.appendChild(a);
    });
    for (var k = 0; k < (D.site.class_slots || 0); k++) {
      var d = el('div', 'card dash'); d.setAttribute('data-kind', 'slot');
      d.appendChild(el('div', 'nopic', 'Image placeholder'));
      var b = el('div', 'body'); b.appendChild(el('span', 'label', 'Class ' + (D.site.classes.length + k + 1)));
      var h = el('h3'); h.appendChild(document.createTextNode('Class title ')); h.appendChild(el('em', null, '(placeholder)')); b.appendChild(h);
      b.appendChild(el('p', null, 'Description placeholder. Real classes are coming.'));
      var f = el('div', 'foot'); f.appendChild(el('span', 'ph', 'Placeholder')); b.appendChild(f); d.appendChild(b); box.appendChild(d);
    }
  }

  /* ---------- class page ---------- */
  var cur = 0, CL = null;
  function countable() { return CL.lessons.filter(function (l) { return l.counts !== false; }); }
  function renderLessons() {
    var ol = $('lessons'); clear(ol);
    CL.lessons.forEach(function (l, i) {
      var li = el('li', (i === cur ? 'cur ' : '') + (P.lessons_done.indexOf(l.id) >= 0 ? 'done' : ''));
      var b = el('button'); b.type = 'button';
      var n = l.counts === false ? 'P' : (l.format === 'reflection' ? 'R' : String(l.order));
      b.appendChild(el('span', 'label', n)); b.appendChild(el('span', 't', l.title));
      b.appendChild(el('span', 'label', l.media ? Math.round(l.duration_s || 0) + ' s' : 'placeholder'));
      b.addEventListener('click', function () { selectLesson(i); });
      li.appendChild(b); ol.appendChild(li);
    });
    var cs = countable(), n = cs.filter(function (l) { return P.lessons_done.indexOf(l.id) >= 0; }).length;
    $('prog-text').textContent = n + ' of ' + cs.length + ' lessons marked done';
    $('prog-bar').style.width = Math.round(100 * n / cs.length) + '%';
  }
  function renderQuiz(l) {
    var q = $('quiz'); clear(q);
    if (!l.quiz || !l.quiz.questions || !l.quiz.questions.length) return;
    q.appendChild(el('span', 'label', 'Quick check \u00b7 a study aid, not a test'));
    var form = el('form'); form.noValidate = true;
    l.quiz.questions.forEach(function (qq, qi) {
      var fs = el('fieldset'); fs.appendChild(el('legend', null, qq.text));
      qq.choices.forEach(function (c, ci) {
        var lab = el('label', 'opt'); var r = el('input'); r.type = 'radio'; r.name = 'q' + qi; r.value = String(ci); r.id = 'q' + qi + '-' + ci;
        lab.setAttribute('for', r.id); lab.appendChild(r); lab.appendChild(el('span', null, c)); fs.appendChild(lab);
      });
      fs.appendChild(el('p', 'res')); form.appendChild(fs);
    });
    var btn = el('button', 'btn ghost', 'Check my answers'); btn.type = 'submit'; form.appendChild(btn);
    var out = el('p', 'res'); out.setAttribute('role', 'status'); form.appendChild(out);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var score = 0;
      var sets = form.querySelectorAll('fieldset');
      l.quiz.questions.forEach(function (qq, qi) {
        var chosen = form.querySelector('input[name="q' + qi + '"]:checked'); var res = sets[qi].querySelector('.res');
        var ok = chosen && Number(chosen.value) === qq.answer; if (ok) score++;
        res.textContent = chosen ? ((ok ? 'Right. ' : 'Not quite. ') + qq.why) : 'Choose an answer.';
      });
      out.textContent = 'You got ' + score + ' of ' + l.quiz.questions.length + '.';
      P.quiz[l.id] = { score: score, of: l.quiz.questions.length }; saveP(P);
    });
    q.appendChild(form);
  }
  function selectLesson(i) {
    cur = i; var l = CL.lessons[i], v = $('player-video');
    try { v.pause(); } catch (e) {}
    v.hidden = true; $('player-poster').hidden = false; $('player-ovl').hidden = false;
    $('player-poster').src = l.poster || CL.cover_image;
    $('player-msg').textContent = l.media ? 'Preview: ' + l.title.replace(/^Preview: /, '') + ' (' + Math.round(l.duration_s || 0) + ' seconds, Jose\'s recorded voice).'
      : 'Placeholder lesson. The video for \u201c' + l.title.replace(/ \(working title\)/, '') + '\u201d is not available yet.';
    $('mark-done').hidden = (l.counts === false);
    $('done-note').hidden = (l.counts !== false);
    $('notes').value = (P.notes && P.notes[l.id]) || '';
    if (!P.last || P.last.lesson !== l.id) { P.last = { class: CL.slug, lesson: l.id, t: 0, ts: Date.now() }; saveP(P); }
    renderLessons(); renderQuiz(l); renderResume();
  }
  function fmt(s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function renderResume() {
    var box = $('resume'); if (!box) return; clear(box);
    var L = P.last, c = null, l = null, best = null;
    if (L) Object.keys(D.classes).forEach(function (k) { if (D.classes[k].slug === L.class) { c = D.classes[k]; c.lessons.forEach(function (x) { if (x.id === L.lesson) l = x; }); } });
    if (c && l) best = { ts: L.ts || 0, text: c.title + ' \u00b7 ' + l.title.replace(/ \(working title\)/, '') + (L.t > 2 ? ' (at ' + fmt(L.t) + ')' : ''), href: '#class-' + c.slug };
    var cr = window.SUCourses && window.SUCourses.resume ? window.SUCourses.resume() : null;
    if (cr && (!best || cr.ts >= best.ts)) best = cr;
    if (!best) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(el('span', 'label', 'Continue where you left off'));
    var p = el('p', null, best.text); p.style.margin = '6px 0 10px'; box.appendChild(p);
    var a1 = el('a', 'btn ghost', 'Continue'); a1.href = best.href; box.appendChild(a1);
    box.appendChild(el('p', 'muted small', 'Saved only in this browser.'));
  }
  function openClass(slug) {
    var id = Object.keys(D.classes).filter(function (k) { return D.classes[k].slug === slug; })[0];
    if (!id) { location.hash = '#classes'; return; }
    if (CL && CL.id === id) return;
    CL = D.classes[id]; cur = 0;
    $('h-class').textContent = CL.title; $('c-outcome').textContent = CL.outcome; $('c-num').textContent = 'Class 1';
    $('c-status').textContent = MODE === 'preview' ? 'Status: ' + CL.status : '';
    var start = 0;
    if (P.last && P.last.class === slug) CL.lessons.forEach(function (x, ix) { if (x.id === P.last.lesson) start = ix; });
    selectLesson(start);
  }
  function wirePlayer() {
    var v = $('player-video');
    $('player-play').addEventListener('click', function () {
      var l = CL.lessons[cur];
      if (!l.media && cur !== 0) { toast('Placeholder lesson. No video yet.'); return; }
      function noVideo(why) {
        v.hidden = true; $('player-poster').hidden = false; $('player-ovl').hidden = false;
        $('player-msg').textContent = why === 'none' ? 'There is no preview video in this copy.' : 'The preview video could not load. Try again.';
      }
      if (!l.media) { noVideo('none'); return; }
      v.hidden = false; $('player-poster').hidden = true; $('player-ovl').hidden = true;
      if (v.getAttribute('data-src') !== l.media) {
        while (v.firstChild) v.removeChild(v.firstChild);
        v.setAttribute('data-src', l.media);
        var s = document.createElement('source'); s.src = l.media; s.type = 'video/mp4';
        s.addEventListener('error', function () { v.removeAttribute('data-src'); noVideo(); });
        v.appendChild(s); v.load();
      }
      var at = (P.last && P.last.lesson === l.id) ? P.last.t : 0;
      if (at > 2) { pendingSeek = true; var seek = function () { try { v.currentTime = at; } catch (e) {} pendingSeek = false; v.removeEventListener('loadedmetadata', seek); }; if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek); }
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
    var lastSave = 0, pendingSeek = false;
    v.addEventListener('timeupdate', function () {
      if (!CL || !P.last || pendingSeek || v.paused && v.currentTime < 1) return;
      var now = Date.now(); if (now - lastSave < 3000) return; lastSave = now;
      if (P.last.lesson === CL.lessons[cur].id) { P.last.t = v.currentTime; P.last.ts = Date.now(); saveP(P); }
    });
    v.addEventListener('pause', function () { if (CL && P.last && P.last.lesson === CL.lessons[cur].id && v.currentTime > 0) { P.last.t = v.currentTime; saveP(P); renderResume(); } });
    v.addEventListener('ended', function () { if (CL && P.last && P.last.lesson === CL.lessons[cur].id) { P.last.t = 0; saveP(P); renderResume(); } });
    $('mark-done').addEventListener('click', function () {
      var l = CL.lessons[cur], i = P.lessons_done.indexOf(l.id);
      if (i >= 0) P.lessons_done.splice(i, 1); else P.lessons_done.push(l.id);
      saveP(P); renderLessons(); toast(i >= 0 ? 'Mark removed.' : 'Marked done (demo only).');
    });
    $('notes').addEventListener('input', function () { if (!CL) return; P.notes = P.notes || {}; P.notes[CL.lessons[cur].id] = $('notes').value; saveP(P); });
  }

  /* ---------- stories ---------- */
  var sFilter = 'all';
  function renderStoryChips() {
    var box = $('story-chips'); clear(box);
    ['all'].concat(D.site.topics).forEach(function (t) {
      var b = el('button', 'chip', t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)); b.type = 'button'; b.setAttribute('aria-pressed', t === sFilter ? 'true' : 'false');
      b.addEventListener('click', function () { sFilter = t; renderStoryChips(); renderStories(); }); box.appendChild(b);
    });
    var o = el('button', 'chip', 'Open items'); o.type = 'button'; o.setAttribute('aria-pressed', sFilter === 'open' ? 'true' : 'false');
    o.addEventListener('click', function () { sFilter = 'open'; renderStoryChips(); renderStories(); }); box.appendChild(o);
  }
  function renderStories() {
    var box = $('story-list'); clear(box);
    D.stories.forEach(function (s) {
      var reason = hiddenReason(s);
      if (MODE !== 'preview' && reason) return;
      var open = !s.topic;   /* unchosen or no topic yet */
      if (sFilter === 'open' && !open) return;
      if (sFilter !== 'all' && sFilter !== 'open' && s.topic !== sFilter) return;
      var d = el('details', 'story');
      var sm = el('summary'); sm.appendChild(el('h3', null, s.title)); sm.appendChild(el('span', 'ph', open ? 'Open item' : s.topic.charAt(0).toUpperCase() + s.topic.slice(1))); d.appendChild(sm);
      var inn = el('div', 'in');
      if (s.image) { var im = el('img'); im.src = s.image; im.alt = 'Impasto painting, concept art'; im.loading = 'lazy'; inn.appendChild(im); }
      else { var ph = el('div', 'card dash'); ph.style.minHeight = '120px'; var np = el('div', 'nopic', 'Image placeholder'); np.style.border = '0'; np.style.height = '100%'; ph.appendChild(np); inn.appendChild(ph); }
      var rt = el('div'); rt.appendChild(el('p', 'muted', s.summary));
      var pull = el('div', 'pull'); pull.style.margin = '16px 0';
      if (s.excerpt) { pull.appendChild(el('p', 'q', '\u201c' + s.excerpt + '\u201d')); if (s.source && s.source.file_ref) pull.appendChild(el('span', 'src', s.source.file_ref)); }
      else pull.appendChild(el('p', 'muted', 'No excerpt chosen.'));
      rt.appendChild(pull);
      rt.appendChild(el('p', 'label', 'Status: ' + s.status + (s.speaker && s.speaker.is_learner ? ' \u00b7 learner story' : '')));
      if (reason) rt.appendChild(el('p', 'hiddenreason', reason));
      inn.appendChild(rt); d.appendChild(inn); box.appendChild(d);
    });
  }

  /* ---------- about, daily, join ---------- */
  function renderAbout() {
    if (PUB) return;
    var a = D.about, ul = $('about-quotes'); clear(ul);
    a.quotes.forEach(function (q) { var li = el('li'); li.appendChild(el('p', 'q', q.text)); if (q.source) li.appendChild(el('span', 'src', q.source)); ul.appendChild(li); });
    var sp = $('about-sounds'); clear(sp); sp.appendChild(document.createTextNode(a.sounds.text + ' '));
    sp.appendChild(el('em', null, '\u201c' + a.sounds.check_line + '\u201d'));
    if (a.sounds.check_source) sp.appendChild(document.createTextNode(' (' + a.sounds.check_source + ')'));
    $('about-told').textContent = a.told.statement; $('about-told-note').textContent = a.told.note;
    $('about-panama-note').textContent = a.panama.note; $('about-panama-q').textContent = a.panama.quote; $('about-panama-src').textContent = a.panama.source || '';
  }
  function renderStatic() {
    $('daily-time').textContent = D.site.daily_call.time_label + ' \u00b7 nothing connects from here.';
    $('daily-digest').textContent = D.site.daily_call.digest;
    $('join-notice').textContent = '\u201c' + D.site.legal.recorded_notice.replace(/^Placeholder: /, '').replace(/^./, function (c) { return c.toUpperCase(); }) + '\u201d';
    var b = $('banner');
    if (PUB) { b.hidden = true; b.textContent = ''; return; }
    b.textContent = SET === 'real' ? 'Local build with real excerpts. Do not upload. Stand Up Founders is an early preview. Most content here is placeholder. Nothing here sends, saves or sells.'
                                  : 'Stand Up Founders is an early preview. Most content here is placeholder. Nothing here sends, saves or sells.';
  }
  function wireMisc() {
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-toast]'); if (b) toast(b.getAttribute('data-toast')); });
    document.querySelectorAll('[data-filter]').forEach(function (c) {
      c.addEventListener('click', function () {
        var f = c.getAttribute('data-filter');
        document.querySelectorAll('[data-filter]').forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        document.querySelectorAll('#class-cards .card').forEach(function (k) { k.hidden = !(f === 'all' || k.getAttribute('data-kind') === f); });
      });
    });
    $('join-form').addEventListener('submit', function (e) { e.preventDefault(); if (!$('j-18').checked) { $('join-msg').textContent = 'Tick the box to say you are 18 or older. Members must be 18 or over.'; $('j-18').focus(); return; } $('join-msg').textContent = 'Nothing was sent or saved. This is a dummy form.'; toast('Dummy form. Nothing sent.'); });
    $('si-form').addEventListener('submit', function (e) { e.preventDefault(); toast('Visual shell only. No sign-in exists yet.'); });
  }

  /* ---------- boot ---------- */
  function boot() {
    getJSON('site.json').then(function (site) {
      D.site = site;
      var jobs = [];
      site.classes.forEach(function (id) { jobs.push(getJSON('classes/' + id + '.json').then(function (c) { D.classes[id] = c; })); });
      var st = new Array(site.stories.length);
      site.stories.forEach(function (id, i) { jobs.push(getJSON('stories/' + id + '.json').then(function (s) { st[i] = s; })); });
      jobs.push(getJSON('about.json').then(function (a) { D.about = a; }));
      return Promise.all(jobs).then(function () { D.stories = st; });
    }).then(function () {
      renderStatic(); renderWatch('videos-wrap', 'videos-list'); renderHome(); renderClasses(); renderStoryChips(); renderStories(); renderAbout(); wirePlayer(); wireMisc();
      window.addEventListener('hashchange', route); window.addEventListener('su-courses-ready', function () { renderResume(); renderWatch('videos-wrap', 'videos-list'); renderWatch('watch', 'watch-list'); }); window.addEventListener('su-progress', renderResume); route();
    }).catch(function (err) {
      var m = $('main'); clear(m); m.appendChild(el('p', 'note', 'The page data did not load (' + err.message + '). If you opened this file directly, run a small local server instead: python3 -m http.server'));
    });
  }
  boot();
})();

