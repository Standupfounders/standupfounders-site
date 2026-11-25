/* Stand Up Founders: the public page script. Home, Courses (courses.js), Videos, About and the Coming soon page.
   Plain JS, text is written with textContent. Progress stays in this browser (courses.js). Used only by the public build. */
(function () {
  'use strict';
  var BASE = 'data/placeholder/';
  var D = { site: null };
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function getJSON(p) { return fetch(BASE + p).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }); }

  var SOON = {
    'stories': ['Stories', 'Short stories from the calls, grouped by topic. Not open yet.'],
    'daily-call': ['Daily call', 'A short call to get going. Not open yet.'],
    'community': ['Community', 'A place to talk it through with other people who are building. Not open yet.']
  };
  var VIEWS = ['home', 'about-jose', 'videos'];

  function setTitle() {
    var h = document.querySelector('[data-view].on h1'), t = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    document.title = t && t !== 'Get up.Make the call.Decide on purpose.' ? t + ' · Stand Up Founders' : 'Stand Up Founders';
  }
  window.addEventListener('su-progress', function () { setTimeout(setTitle, 30); });
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('a.skip');
    if (s) { e.preventDefault(); var m = $('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } }
  });
  function focusHeading() {
    var h1 = document.querySelector('[data-view].on h1'); if (!h1) return;
    var ae = document.activeElement; if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(ae.tagName) >= 0) return;
    h1.setAttribute('tabindex', '-1'); try { h1.focus({ preventScroll: true }); } catch (e) {}
  }
  var routedOnce = false;
  function route() {
    var h = (location.hash || '#home').slice(1), view = h;
    var soonKey = h.indexOf('community') === 0 ? 'community' : h;
    if (SOON[soonKey]) {
      view = 'soon';
      $('h-soon').textContent = SOON[soonKey][0] + ': coming soon'; $('soon-text').textContent = SOON[soonKey][1];
    } else if (h === 'courses' || h === 'progress' || /^(course|module|lesson|done)-/.test(h)) {
      view = 'courses'; if (window.SUCourses) window.SUCourses.show(h);
    } else if (VIEWS.indexOf(h) < 0) { view = 'home'; }
    var CR = { videos: 'Videos', 'about-jose': 'About Jose', soon: null };
    if (view === 'videos' || view === 'about-jose' || view === 'soon') {
      var sec = document.querySelector('[data-view="' + view + '"]'), cr = sec.querySelector('nav.crumb');
      if (!cr) { cr = document.createElement('nav'); cr.className = 'crumb eyebrow'; cr.setAttribute('aria-label', 'Breadcrumb'); sec.insertBefore(cr, sec.firstChild); }
      clear(cr); var l = el('span', 'label'); var ha = el('a', null, 'Home'); ha.href = '#home'; l.appendChild(ha);
      l.appendChild(document.createTextNode(' / ' + (view === 'soon' ? SOON[soonKey][0] : CR[view]))); cr.appendChild(l);
    }
    document.querySelectorAll('[data-view]').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-view') === view); });
    setTimeout(setTitle, 60);
    if (routedOnce) setTimeout(focusHeading, 150);
    routedOnce = true;
    var navKey = view === 'soon' ? soonKey : (view === 'courses' && h === 'progress' ? 'progress' : view);
    document.querySelectorAll('nav.main a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }

  function card(href, img, alt, label, title, text) {
    var a = el('a', 'card'); a.href = href;
    if (img) { var i = el('img'); i.src = img; i.alt = alt || ''; i.loading = 'lazy'; a.appendChild(i); }
    var b = el('div', 'body'); b.appendChild(el('span', 'label', label)); b.appendChild(el('h2', null, title));
    if (text) b.appendChild(el('p', null, text));
    a.appendChild(b); return a;
  }
  function renderWatch(wid, lid) {
    var w = $(wid); if (!w) return;
    var vids = (D.site && D.site.videos) || [];
    var list = $(lid); clear(list);
    if (!vids.length) { w.hidden = true; return; }
    w.hidden = false;
    var lastGroup = null;
    vids.forEach(function (v) {
      if (v.group && v.group !== lastGroup) { var gh = el('h2', 'h2', v.group); gh.style.cssText = 'font-size:1.5rem;margin:30px 0 12px'; list.appendChild(gh); lastGroup = v.group; }
      if (v.soon) {
        var sb = el('div', 'box'); sb.style.cssText = 'margin-bottom:22px;border-style:dashed'; sb.setAttribute('aria-disabled', 'true');
        sb.appendChild(el('h3', null, v.title)); sb.appendChild(el('p', null, 'Coming soon'));
        var sl = (v.lesson || v.item) && window.SUCourses && window.SUCourses.locate ? window.SUCourses.locate(v.lesson || v.item, !!v.lesson) : null;
        if (sl) { var sp = el('p', 'small'); sp.appendChild(document.createTextNode('The words are open now: ')); var sa = el('a', null, sl.title); sa.href = sl.href; sp.appendChild(sa); sb.appendChild(sp); }
        list.appendChild(sb); return;
      }
      var b = el('div', 'box'); b.style.marginBottom = '22px';
      b.appendChild(el('h3', null, v.title));
      var vid = document.createElement('video'); vid.controls = true; vid.preload = 'none'; vid.playsInline = true;
      vid.setAttribute('aria-label', v.title); vid.src = v.src; vid.style.width = '100%'; vid.style.maxWidth = '720px'; vid.style.marginTop = '10px';
      if (v.captions) { var tk = document.createElement('track'); tk.kind = 'captions'; tk.srclang = 'en'; tk.label = 'English'; tk.src = v.captions; vid.appendChild(tk); }
      b.appendChild(vid);
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
  var storageOK = (function () { try { localStorage.setItem('su.t', '1'); localStorage.removeItem('su.t'); return true; } catch (e) { return false; } })();
  function renderHome() {
    var sm = window.SUCourses && window.SUCourses.summary ? window.SUCourses.summary() : [];
    var rs = window.SUCourses && window.SUCourses.resume ? window.SUCourses.resume() : null;
    var cta = $('hero-cta'), note = $('hero-note');
    if (cta) {
      var cont = rs && sm.some(function (x) { return x.started && !x.finished; });
      if (cont) { cta.textContent = 'Continue: ' + (rs.title || 'where you left off'); cta.href = rs.href; } else { cta.textContent = 'Start with lesson 1'; cta.href = '#lesson-book-1-m-a1-i-a1-1'; }
      if (note) note.textContent = cont ? 'Your place is saved in this browser.' : 'One idea, about nine minutes, then your own writing.';
    }
    if (!storageOK && !$('storage-warn')) { var w = el('div', 'note', 'Your browser is blocking storage, so your progress, notes and answers will not be kept when you close this page.'); w.id = 'storage-warn'; w.style.margin = '0 0 24px'; var hc = $('course-cards'); if (hc && hc.parentNode) hc.parentNode.insertBefore(w, hc); }
    var box = $('course-cards'); if (!box) return; clear(box);
    sm.forEach(function (x) {
      var cd = el('div', 'card wide'), bd = el('div', 'body'); bd.appendChild(el('span', 'label', x.label));
      var h = el('h2'); var ha = el('a', null, x.title); ha.href = x.courseHref; h.appendChild(ha); bd.appendChild(h);
      bd.appendChild(el('p', null, x.outcome));
      var bar = el('div', 'prog'); var bb = el('b'); bb.style.width = Math.round(100 * x.done / Math.max(1, x.n)) + '%'; bar.appendChild(bb); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', x.label + ': ' + x.done + ' of ' + x.n + ' items done'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(x.n)); bar.setAttribute('aria-valuenow', String(x.done)); bd.appendChild(bar);
      var f = el('div', 'foot'); f.appendChild(el('span', 'ph', x.done + ' of ' + x.n + ' done'));
      var go = el('a', x.started && !x.finished ? 'btn' : 'btn ghost', x.finished ? 'Finished: see summary' : (x.started ? 'Continue' : 'Start the course')); go.href = x.href; f.appendChild(go); bd.appendChild(f);
      cd.appendChild(bd); box.appendChild(cd);
    });
    renderStrip();
  }
  function renderStrip() {
    var w = $('watch'), list = $('watch-list'); if (!w || !list) return; clear(list);
    var vids = ((D.site && D.site.videos) || []).filter(function (v) { return !v.soon; }).slice(0, 4);
    if (!vids.length) { w.hidden = true; return; }
    w.hidden = false;
    var g = el('div', 'cards4');
    vids.forEach(function (v) { var c = el('a', 'card'); c.href = '#videos'; var b = el('div', 'body'); b.appendChild(el('span', 'label', v.group || 'Video')); b.appendChild(el('h3', null, v.title)); b.appendChild(el('p', null, 'Watch, with a written transcript.')); c.appendChild(b); g.appendChild(c); });
    list.appendChild(g);
  }

  function boot() {
    getJSON('site.json').then(function (site) {
      D.site = site;
      renderWatch('videos-wrap', 'videos-list'); renderHome();
      window.addEventListener('hashchange', route);
      window.addEventListener('su-courses-ready', function () { renderHome(); renderWatch('videos-wrap', 'videos-list'); });
      window.addEventListener('su-progress', renderHome);
      route();
    }).catch(function () {
      var m = $('main'); clear(m);
      var n = el('div', 'note'); n.appendChild(el('p', null, 'We could not load Stand Up Founders. Check your connection and reload this page.')); m.appendChild(n);
    });
  }
  boot();
})();

