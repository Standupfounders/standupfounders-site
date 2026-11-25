/* Stand Up community PROTOTYPE. Placeholder data only. Nothing is sent anywhere; anything you do here is kept only in this browser.
   Plain JS. All text is written with textContent. Rules shown here are a draft. */
(function () {
  'use strict';
  var META = function (n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.getAttribute('content') : ''; };
  var BASE = 'data/' + (META('su-data-set') || 'placeholder') + '/';
  var KEY = 'stepup.v1.community';
  var C = null, S = null, root = null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function link(href, text, cls) { var a = el('a', cls, text); a.href = href; return a; }
  function btn(text, cls, fn) { var b = el('button', 'btn ' + (cls || ''), text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function toast(m) { var t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); }

  /* ---------- state (browser only) ---------- */
  function fresh() { return { schema: 1, role: 'member', votes: {}, decided: {}, sent: {}, blocked: [], posts: [], comments: [], held: [], reports: [], resolved: {}, removed: {}, msgs: {}, log: [], settings: { who: 'anyone', muted: '' } }; }
  function load() { try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && r.schema === 1) return r; } catch (e) {} return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var uid = 0; function nid(p) { uid += 1; return p + 'L' + Date.now().toString(36) + uid; }

  /* ---------- lookups ---------- */
  function mem(id) { for (var i = 0; i < C.members.length; i++) if (C.members[i].id === id) return C.members[i]; return { id: id, name: 'Unknown', line: '', interests: [], role: 'member' }; }
  function board(id) { for (var i = 0; i < C.boards.length; i++) if (C.boards[i].id === id) return C.boards[i]; return null; }
  function allPosts() { return C.posts.concat(S.posts).filter(function (p) { return !S.removed[p.id] && S.blocked.indexOf(p.author) < 0 && !muted(p.title + ' ' + p.body); }); }
  function post(id) { var a = C.posts.concat(S.posts); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function commentsOf(pid) { return C.comments.concat(S.comments).filter(function (c) { return c.post === pid && !S.removed[c.id] && S.blocked.indexOf(c.author) < 0 && !muted(c.body); }); }
  function muted(text) {
    var words = (S.settings.muted || '').toLowerCase().split(',').map(function (w) { return w.trim(); }).filter(Boolean);
    var t = text.toLowerCase();
    for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) >= 0) return true;
    return false;
  }
  function votes(id, base) { return base + (S.votes[id] ? 1 : 0); }
  function pendingRequests() { return C.requests.filter(function (r) { return !S.decided[r.id] && S.blocked.indexOf(r.from) < 0; }); }
  function acceptedThreads() {
    var t = C.threads.slice();
    C.requests.forEach(function (r) { if (S.decided[r.id] === 'accepted' && !t.some(function (x) { return x.with === r.from; })) t.push({ id: 'ta-' + r.id, with: r.from, messages: [] }); });
    return t.filter(function (x) { return S.blocked.indexOf(x.with) < 0; });
  }
  var BAD = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|(https?:\/\/)|(www\.)|(\b[a-z0-9-]+\.(com|net|org|io|co|app|me)\b)|(\+?\d[\d\s().-]{7,}\d)/i;
  function looksPrivate(text) { return BAD.test(text); }

  /* ---------- shared pieces ---------- */
  function avatar(m) { var a = el('span', 'avatar', m.name.replace(/^Sample /, '').charAt(0)); a.setAttribute('aria-hidden', 'true'); return a; }
  function who(id) { var m = mem(id); var a = link('#community-member-' + id, m.name, 'who'); return a; }
  function voteButton(id, base) {
    var b = el('button', 'vote'); b.type = 'button';
    var on = !!S.votes[id];
    b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('data-fk', 'v-' + id);
    b.setAttribute('aria-label', 'Upvote. ' + votes(id, base) + ' votes so far.');
    b.appendChild(el('span', 'tri', '\u25b2')); b.appendChild(el('span', 'n', String(votes(id, base))));
    b.addEventListener('click', function () { if (S.votes[id]) delete S.votes[id]; else S.votes[id] = 1; save(); render(); });
    return b;
  }
  function reportControl(kind, id, excerpt) {
    var d = el('details', 'report'); var s = el('summary', null, 'Report');
    d.appendChild(s);
    var lab = el('label', null, 'Why are you reporting this?'); lab.setAttribute('for', 'rep-' + id); d.appendChild(lab);
    var sel = el('select'); sel.id = 'rep-' + id;
    ['Harassment or a threat', 'Someone\u2019s private details', 'Hate or sexual content', 'Spam or selling', 'Copyright or someone else\u2019s work', 'Other'].forEach(function (t) { var o = el('option', null, t); sel.appendChild(o); });
    d.appendChild(sel);
    var lt = el('label', null, 'Anything to add? (optional)'); lt.setAttribute('for', 'rept-' + id); d.appendChild(lt);
    var tx = el('textarea'); tx.id = 'rept-' + id; tx.maxLength = 300; d.appendChild(tx);
    d.appendChild(btn('Send report', 'ghost', function () {
      S.reports.push({ id: nid('x'), target_kind: kind, target_id: id, reason: sel.value + (tx.value.trim() ? ' - ' + tx.value.trim() : ''), state: 'open', excerpt: excerpt || '' });
      save(); toast('Placeholder: report added to the moderator queue in this browser only.'); render();
    }));
    d.appendChild(el('p', 'muted small', 'In a real version a person reads reports. Nothing leaves your browser in this prototype. We are not an emergency service. If someone is in danger, contact your local emergency number.'));
    return d;
  }
  function notice() {
    var n = el('div', 'note comm-note');
    n.appendChild(el('span', 'ph', 'Prototype'));
    n.appendChild(document.createTextNode(' ' + C.notice + ' Nobody is moderating yet. 18 and over only (self-declared). The rules are a draft (' + C.rules_version + ').'));
    return n;
  }
  function subnav(route) {
    var n = el('nav', 'subnav'); n.setAttribute('aria-label', 'Community');
    var items = [['community', 'Boards'], ['community-messages', 'Messages (' + pendingRequests().length + ' new)'], ['community-rules', 'Rules and safety'], ['community-settings', 'Settings'], ['community-mod', 'Moderator view']];
    items.forEach(function (it) { var a = link('#' + it[0], it[1]); if (route === it[0] || (it[0] === 'community' && /^community-(board|post)/.test(route))) a.setAttribute('aria-current', 'page'); n.appendChild(a); });
    var vs = el('div', 'viewas'); vs.appendChild(el('span', 'label', 'View as'));
    ['member', 'moderator'].forEach(function (r) {
      var b = el('button', 'chip', r === 'member' ? 'Member' : 'Moderator'); b.type = 'button';
      b.setAttribute('aria-pressed', S.role === r ? 'true' : 'false');
      b.addEventListener('click', function () { S.role = r; save(); render(); });
      vs.appendChild(b);
    });
    n.appendChild(vs);
    return n;
  }
  function head(route, label, title, lede) {
    var e = el('div', 'eyebrow'); e.appendChild(el('span', 'label', label)); e.appendChild(el('span', 'ph', 'Prototype \u00b7 placeholder data'));
    root.appendChild(e);
    root.appendChild(el('h1', 'h1', title));
    if (lede) { var p = el('p', 'lede small', lede); p.style.marginTop = '14px'; root.appendChild(p); }
    var sn = subnav(route); sn.style.marginTop = '22px'; root.appendChild(sn);
    var nt = notice(); nt.style.marginTop = '18px'; root.appendChild(nt);
  }
  function postRow(p) {
    var r = el('article', 'prow');
    r.appendChild(voteButton(p.id, p.votes || 0));
    var b = el('div', 'pbody');
    var m = el('div', 'pmeta'); var bd = board(p.board);
    if (bd) m.appendChild(link('#community-board-' + bd.id, bd.name, 'label')); m.appendChild(document.createTextNode(' '));
    m.appendChild(el('span', 'muted small', 'by ')); m.appendChild(who(p.author)); m.appendChild(el('span', 'muted small', ' \u00b7 ' + p.when));
    b.appendChild(m);
    var h = el('h3', null); h.appendChild(link('#community-post-' + p.id, p.title)); b.appendChild(h);
    var n = commentsOf(p.id).length;
    b.appendChild(el('p', 'muted small', n + (n === 1 ? ' comment' : ' comments')));
    r.appendChild(b); return r;
  }
  function newPostForm(boardId) {
    var f = el('form', 'form newpost'); f.setAttribute('novalidate', '');
    f.appendChild(el('h3', null, 'Start a post (placeholder)'));
    var l1 = el('label', null, 'Title'); l1.setAttribute('for', 'np-t'); f.appendChild(l1);
    var t = el('input'); t.type = 'text'; t.id = 'np-t'; t.autocomplete = 'off'; t.maxLength = 120; f.appendChild(t);
    var l2 = el('label', null, 'What do you want to say?'); l2.setAttribute('for', 'np-b'); f.appendChild(l2);
    var b = el('textarea'); b.id = 'np-b'; b.maxLength = 1000; f.appendChild(b);
    var l3 = el('label', null, 'Board'); l3.setAttribute('for', 'np-s'); f.appendChild(l3);
    var s = el('select'); s.id = 'np-s'; C.boards.forEach(function (x) { var o = el('option', null, x.name); o.value = x.id; if (x.id === boardId) o.selected = true; s.appendChild(o); }); f.appendChild(s);
    f.appendChild(el('p', 'muted small', 'Text only. No links, emails or phone numbers: a post that has one is held for a person to check. Make up anything; do not type real private details.'));
    var msg = el('p', 'muted', ''); msg.setAttribute('role', 'status');
    var sub = el('button', 'btn', 'Post (stays in this browser)'); sub.type = 'submit';
    f.appendChild(sub); f.appendChild(msg);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = t.value.trim(), body = b.value.trim();
      if (!title || !body) { msg.textContent = 'Please add a title and some text.'; return; }
      if (looksPrivate(title + ' ' + body)) {
        S.held.push({ id: nid('h'), author: C.you, board: s.value, text: title + ' / ' + body, why: 'Looks like a link or contact detail' });
        save(); msg.textContent = 'Held: this looks like it has a link or contact detail, so a person checks it first. (Placeholder.)'; t.value = ''; b.value = ''; return;
      }
      S.posts.push({ id: nid('p'), board: s.value, author: C.you, title: title, body: body, when: 'just now', votes: 0 });
      save(); toast('Placeholder: post added in this browser only.'); render();
    });
    return f;
  }

  /* ---------- pages ---------- */
  function pageHome() {
    head('community', 'Community', 'Talk it through. With people who are building.', 'Boards that follow the class themes: deciding, believing, getting up and daily habits. Reddit-style: posts, replies and upvotes. For members aged 18 and over. This is a picture of the idea, not a live place.');
    var g = el('div', 'cards4'); g.style.marginTop = '28px';
    C.boards.forEach(function (b) {
      var a = el('a', 'card'); a.href = '#community-board-' + b.id;
      var bd = el('div', 'body'); bd.appendChild(el('span', 'label', 'Board')); bd.appendChild(el('h3', null, b.name)); bd.appendChild(el('p', null, b.blurb));
      var n = allPosts().filter(function (p) { return p.board === b.id; }).length;
      var ft = el('div', 'foot'); ft.appendChild(el('span', 'ph', n + (n === 1 ? ' post' : ' posts'))); bd.appendChild(ft);
      a.appendChild(bd); g.appendChild(a);
    });
    root.appendChild(g);
    var h = el('h2', 'h2', 'Latest posts'); h.style.cssText = 'font-size:1.6rem;margin:36px 0 6px'; root.appendChild(h);
    var list = el('div', 'plist');
    allPosts().slice().reverse().forEach(function (p) { list.appendChild(postRow(p)); });
    root.appendChild(list);
    root.appendChild(newPostForm(null));
  }
  function pageBoard(id) {
    var b = board(id); if (!b) { location.hash = '#community'; return; }
    head('community-board-' + id, 'Board', b.name, b.blurb);
    var list = el('div', 'plist'); list.style.marginTop = '24px';
    var ps = allPosts().filter(function (p) { return p.board === id; });
    ps.sort(function (a, c) { return votes(c.id, c.votes || 0) - votes(a.id, a.votes || 0); });
    if (!ps.length) list.appendChild(el('p', 'muted', 'No posts yet on this board.'));
    ps.forEach(function (p) { list.appendChild(postRow(p)); });
    root.appendChild(list);
    root.appendChild(newPostForm(id));
  }
  function commentNode(c, depth, pid) {
    var li = el('li', 'cmt d' + depth);
    var top = el('div', 'pmeta'); top.appendChild(who(c.author)); top.appendChild(el('span', 'muted small', ' \u00b7 placeholder'));
    li.appendChild(top); li.appendChild(el('p', null, c.body));
    var row = el('div', 'crow'); row.appendChild(voteButton(c.id, c.votes || 0));
    if (depth < 1) {
      var rb = el('button', 'linkbtn', 'Reply'); rb.type = 'button';
      var f = el('form', 'replyform'); f.hidden = true; f.setAttribute('novalidate', '');
      var l = el('label', null, 'Your reply'); l.setAttribute('for', 'rp-' + c.id); f.appendChild(l);
      var ta = el('textarea'); ta.id = 'rp-' + c.id; ta.maxLength = 600; f.appendChild(ta);
      var sb = el('button', 'btn ghost', 'Reply (stays in this browser)'); sb.type = 'submit'; f.appendChild(sb);
      var m = el('p', 'muted small', ''); m.setAttribute('role', 'status'); f.appendChild(m);
      rb.addEventListener('click', function () { f.hidden = !f.hidden; if (!f.hidden) ta.focus(); });
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var v = ta.value.trim(); if (!v) return;
        if (looksPrivate(v)) { m.textContent = 'Held: this looks like it has a link or contact detail. (Placeholder.)'; S.held.push({ id: nid('h'), author: C.you, board: '', text: v, why: 'Looks like a link or contact detail' }); save(); ta.value = ''; return; }
        S.comments.push({ id: nid('c'), post: pid, parent: c.id, author: C.you, body: v, votes: 0 }); save(); render();
      });
      row.appendChild(rb); li.appendChild(row); li.appendChild(f);
    } else li.appendChild(row);
    row.appendChild(reportControl('comment', c.id, c.body));
    return li;
  }
  function pagePost(id) {
    var p = post(id); if (!p || S.removed[id]) { location.hash = '#community'; return; }
    var bd = board(p.board);
    head('community-post-' + id, bd ? bd.name : 'Post', p.title, null);
    var art = el('article', 'ppost'); art.style.marginTop = '24px';
    var m = el('div', 'pmeta'); m.appendChild(el('span', 'muted small', 'by ')); m.appendChild(who(p.author)); m.appendChild(el('span', 'muted small', ' \u00b7 ' + p.when));
    art.appendChild(m); art.appendChild(el('p', null, p.body));
    var row = el('div', 'crow'); row.appendChild(voteButton(p.id, p.votes || 0)); row.appendChild(reportControl('post', p.id, p.title));
    if (p.author === C.you) row.appendChild(btn('Delete my post', 'ghost', function () { S.removed[p.id] = 1; save(); toast('Deleted. A member can delete their own post at any time.'); location.hash = '#community'; }));
    art.appendChild(row);
    root.appendChild(art);
    var h = el('h2', 'h2', 'Comments'); h.style.cssText = 'font-size:1.5rem;margin:30px 0 8px'; root.appendChild(h);
    var cs = commentsOf(id); var ol = el('ul', 'cmts');
    cs.filter(function (c) { return !c.parent; }).forEach(function (c) {
      ol.appendChild(commentNode(c, 0, id));
      cs.filter(function (r) { return r.parent === c.id; }).forEach(function (r) { ol.appendChild(commentNode(r, 1, id)); });
    });
    if (!cs.length) ol.appendChild(el('p', 'muted', 'No comments yet.'));
    root.appendChild(ol);
    var f = el('form', 'form'); f.setAttribute('novalidate', '');
    var l = el('label', null, 'Add a comment'); l.setAttribute('for', 'cm-t'); f.appendChild(l);
    var ta = el('textarea'); ta.id = 'cm-t'; ta.maxLength = 600; f.appendChild(ta);
    var sb = el('button', 'btn', 'Comment (stays in this browser)'); sb.type = 'submit'; f.appendChild(sb);
    var ms = el('p', 'muted small', ''); ms.setAttribute('role', 'status'); f.appendChild(ms);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var v = ta.value.trim(); if (!v) return;
      if (looksPrivate(v)) { ms.textContent = 'Held: this looks like it has a link or contact detail. (Placeholder.)'; S.held.push({ id: nid('h'), author: C.you, board: p.board, text: v, why: 'Looks like a link or contact detail' }); save(); ta.value = ''; return; }
      S.comments.push({ id: nid('c'), post: id, parent: null, author: C.you, body: v, votes: 0 }); save(); render();
    });
    root.appendChild(f);
  }
  function pageMember(id) {
    var m = mem(id);
    head('community-member-' + id, 'Member profile', m.name, null);
    var card = el('div', 'box profile'); card.style.marginTop = '24px';
    var top = el('div', 'ptop'); top.appendChild(avatar(m)); var tt = el('div'); tt.appendChild(el('h3', null, m.name)); tt.appendChild(el('span', 'ph', 'Placeholder person')); top.appendChild(tt); card.appendChild(top);
    card.appendChild(el('p', null, m.line));
    var dl = el('p', 'muted small', 'Interests: ' + (m.interests.length ? m.interests.join(', ') : 'none listed') + '. Member since: ' + m.since + '. Role: ' + m.role + '.');
    card.appendChild(dl);
    card.appendChild(el('p', 'muted small', 'Members tick a box to say they are 18 or over. That is self-declared, not checked. No age, phone, email or address is shown on a profile.'));
    var acts = el('div', 'ctas'); acts.style.marginTop = '14px';
    if (id === C.you) { card.appendChild(el('p', 'muted', 'This is how other members see you.')); }
    else {
      if (S.blocked.indexOf(id) >= 0) { acts.appendChild(btn('Unblock', 'ghost', function () { S.blocked = S.blocked.filter(function (x) { return x !== id; }); save(); render(); })); }
      else {
        var sent = S.sent[id];
        if ((C.declined_you || []).indexOf(id) >= 0) acts.appendChild(el('span', 'ph', 'Message requests to this member are not available.'));
        else if (sent) { var sp = el('span', 'ph', 'Request sent. Waiting for them to accept.'); sp.setAttribute('role', 'status'); sp.setAttribute('data-fk', 'sent'); sp.setAttribute('tabindex', '-1'); acts.appendChild(sp); }
        else if (C.requests.some(function (r) { return r.from === id && !S.decided[r.id]; })) acts.appendChild(link('#community-messages', 'They sent you a request. Open Messages', 'btn'));
        else if (acceptedThreads().some(function (t) { return t.with === id; })) acts.appendChild(link('#community-messages', 'Open your conversation', 'btn'));
        else acts.appendChild(btn('Send a message request', '', function () { form.hidden = !form.hidden; }));
        acts.appendChild(btn('Block', 'ghost', function () { S.blocked.push(id); save(); toast('Placeholder: blocked in this browser. You will no longer see their posts or requests.'); render(); }));
      }
      card.appendChild(acts);
      var form = el('form', 'form'); form.hidden = true; form.setAttribute('novalidate', '');
      var l = el('label', null, 'A short note to say why (up to 200 characters, text only, no attachments). They see your name and this note before they decide.'); l.setAttribute('for', 'rq-n'); form.appendChild(l);
      var ta = el('textarea'); ta.id = 'rq-n'; ta.maxLength = 200; form.appendChild(ta);
      var sb = el('button', 'btn', 'Send request'); sb.type = 'submit'; form.appendChild(sb);
      var ms = el('p', 'muted small', ''); ms.setAttribute('role', 'status'); form.appendChild(ms);
      form.addEventListener('submit', function (e) { e.preventDefault(); var v = ta.value.trim(); if (!v) { ms.textContent = 'Please add a short note.'; return; } if (v.length > 200) { ms.textContent = 'Please keep the note to 200 characters.'; return; } if (looksPrivate(v)) { S.held.push({ id: nid('h'), author: C.you, board: '', text: 'Message request note to ' + mem(id).name + ': ' + v, why: 'Request note looks like a link or contact detail' }); save(); ms.textContent = 'Held: this looks like it has a link or contact detail, so a person checks it first. Nothing was sent. (Placeholder.)'; ta.value = ''; return; } S.sent[id] = v; save(); toast('Placeholder: request kept in this browser only. Nothing was sent.'); forceFk = 'sent'; render(); });
      card.appendChild(form);
      card.appendChild(reportControl('member', id, m.name));
    }
    root.appendChild(card);
  }
  function pageMessages() {
    head('community-messages', 'Messages', 'Messages, with permission first.', 'Nobody can write to you until you accept their request. You can decline or block, and report a single message.');
    var pr = pendingRequests();
    var h1 = el('h2', 'h2', 'Message requests (' + pr.length + ')'); h1.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h1);
    if (!pr.length) root.appendChild(el('p', 'muted', 'No requests waiting.'));
    pr.forEach(function (r) {
      var b = el('div', 'box req'); var m = mem(r.from);
      var top = el('div', 'ptop'); top.appendChild(avatar(m)); var tt = el('div'); tt.appendChild(el('strong', null, m.name)); tt.appendChild(el('p', 'muted small', 'Nothing else about this person is shown until you accept.')); top.appendChild(tt); b.appendChild(top);
      b.appendChild(el('p', null, r.note));
      var acts = el('div', 'ctas'); acts.style.marginTop = '12px';
      acts.appendChild(btn('Accept', '', function () { S.decided[r.id] = 'accepted'; save(); render(); }));
      acts.appendChild(btn('Decline', 'ghost', function () { S.decided[r.id] = 'declined'; save(); toast('Placeholder: declined. They are not told.'); render(); }));
      acts.appendChild(btn('Block', 'ghost', function () { S.decided[r.id] = 'blocked'; if (S.blocked.indexOf(r.from) < 0) S.blocked.push(r.from); save(); render(); }));
      b.appendChild(acts); b.appendChild(reportControl('request', r.id, r.note)); root.appendChild(b);
    });
    var h2 = el('h2', 'h2', 'Conversations'); h2.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h2);
    var ts = acceptedThreads();
    if (!ts.length) root.appendChild(el('p', 'muted', 'No conversations yet. A conversation appears here after someone accepts a request.'));
    ts.forEach(function (t) {
      var b = el('div', 'box thread'); var m = mem(t.with);
      var top = el('div', 'ptop'); top.appendChild(avatar(m)); top.appendChild(who(t.with)); b.appendChild(top);
      var all = t.messages.concat(S.msgs[t.id] || []);
      if (!all.length) b.appendChild(el('p', 'muted', 'Accepted. Say hello.'));
      all.forEach(function (x, i) {
        var line = el('div', 'msg ' + (x.from === C.you ? 'me' : 'them'));
        line.appendChild(el('p', null, x.text));
        if (x.from !== C.you) line.appendChild(reportControl('message', t.id + '-' + i, x.text));
        b.appendChild(line);
      });
      var f = el('form', 'replyform'); f.setAttribute('novalidate', '');
      var l = el('label', null, 'Write a message to ' + m.name); l.setAttribute('for', 'ms-' + t.id); f.appendChild(l);
      var ta = el('textarea'); ta.id = 'ms-' + t.id; ta.maxLength = 500; f.appendChild(ta);
      var sb = el('button', 'btn ghost', 'Send (stays in this browser)'); sb.type = 'submit'; f.appendChild(sb);
      f.addEventListener('submit', function (e) { e.preventDefault(); var v = ta.value.trim(); if (!v) return; (S.msgs[t.id] = S.msgs[t.id] || []).push({ from: C.you, text: v }); save(); render(); });
      b.appendChild(f); root.appendChild(b);
    });
    var sent = Object.keys(S.sent);
    if (sent.length) {
      var h3 = el('h2', 'h2', 'Requests you sent'); h3.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h3);
      sent.forEach(function (id) { var b = el('div', 'box'); b.appendChild(who(id)); b.appendChild(el('p', 'muted small', 'Request sent. Waiting for them to accept. You cannot send more until they do.')); root.appendChild(b); });
    }
    var pv = el('p', 'muted small', 'Messages are between you and the other person. We don\u2019t read them. A moderator can see a message only if someone reports it, or if the law requires us to share it. Blocking is silent: the other person is not told. (Draft wording, not yet final.)'); pv.style.marginTop = '24px'; root.appendChild(pv);
  }
  function pageRules() {
    head('community-rules', 'Rules and safety', 'One page of rules.', 'A draft for Stand Up. It is not legal advice, it is not final, and nothing here is live. Items marked NOT RULED are undecided: no number or name is shown for them on purpose.');
    function section(title, items) {
      var h = el('h2', 'h2', title); h.style.cssText = 'font-size:1.5rem;margin:34px 0 8px'; root.appendChild(h);
      var ul = el('ul', 'list rules');
      items.forEach(function (it) { var li = el('li'); li.appendChild(el('strong', null, it[0])); li.appendChild(document.createTextNode(' ')); li.appendChild(el('span', 'ph', it[1])); if (it[2]) li.appendChild(el('p', 'muted', it[2])); ul.appendChild(li); });
      root.appendChild(ul);
    }
    section('Who can join', [
      ['18 or older, no upper age', 'RULED (DRAFT)', 'The sign-up box is unticked: \u201cI am 18 or older.\u201d The wording version and time of the tick are kept. This is self-declared and not checked, so we never say \u201cverified adults\u201d. No ID or birth date is asked. If a member turns out to be under 18, the account is closed, their posts and messages are deleted, and the team is told the same day.']
    ]);
    section('What a member agrees to', [
      ['Be respectful', 'RULED (DRAFT)', ''],
      ['No one\u2019s private details', 'RULED (DRAFT)', 'Posts that look like they hold an email, phone number or link are held for a person to check.'],
      ['No one else\u2019s words, photo, voice or recording without their yes', 'RULED (DRAFT)', 'No class recordings or transcripts.'],
      ['No ads, selling or referral links', 'RULED (DRAFT)', ''],
      ['No promises of results, and no buy, sell or hold tips', 'RULED (DRAFT)', ''],
      ['Post only what you wrote or may share', 'RULED (DRAFT)', ''],
      ['No impersonation of a real person', 'RULED (DRAFT)', ''],
      ['Nothing illegal', 'RULED (DRAFT)', ''],
      ['Moderators may remove content or close an account', 'RULED (DRAFT)', 'A member can appeal once. Who hears appeals: NOT RULED.']
    ]);
    section('Your posts are yours', [
      ['Members keep what they write', 'RULED (DRAFT)', 'You let us show it in the community and nothing more. No post, comment or message is used in videos, ads, social media or AI without that member\u2019s separate written yes for that item. Any wider licence: NOT RULED.']
    ]);
    section('Messages, reports and blocking', [
      ['Messages need permission', 'DESIGN', 'A first message is a request with a short note. You can accept, decline or block. Nothing else can be sent until you accept.'],
      ['Messages are between you and the other person', 'RULED (DRAFT)', 'We don\u2019t read them. A moderator can see a message only if someone reports it, or if the law requires us to share it. We do not say \u201csecure\u201d or \u201cencrypted\u201d until someone has confirmed it for the real build.'],
      ['Blocking is silent', 'RULED (DRAFT)', 'The other person is not told.'],
      ['A report button on every post, comment, profile and message', 'RULED (DRAFT)', 'The report goes to the moderator queue. Every moderator action is logged with a reason. A member can delete their own post at any time.'],
      ['Threats, self-harm, or anything about a child', 'RULED (DRAFT)', 'A moderator escalates it the same hour. We are not an emergency service. If someone is in danger, contact your local emergency number.']
    ]);
    section('What a moderator may and may not see', [
      ['May see', 'RULED (DRAFT)', 'The reported item and a few messages around it, display name and member ID, report history, the moderator log, public posts, and a held post\u2019s text. Every moderator view of a message is logged.'],
      ['May not see', 'RULED (DRAFT)', 'Email, sign-in details, IP address, unreported messages, or anyone\u2019s block list.'],
      ['A moderator is a person', 'RULED (DRAFT)', 'Not an AI agent. Who the moderators are and what they sign: NOT RULED.']
    ]);
    section('What we may hold about you', [
      ['Only what the community needs', 'RULED (DRAFT)', 'Display name; sign-in email once there are accounts; a password hash; the 18+ tick with its wording version and time; posts, comments, votes, messages and requests; reports, blocks and the moderator log.'],
      ['What we do not hold', 'RULED (DRAFT)', 'No real name, phone, address, location, birth date, ID, photos, financial or student data, no ad cookie, and no identifying analytics.']
    ]);
    section('Not ruled yet', [
      ['Who hears appeals', 'NOT RULED', ''],
      ['How fast reports are answered', 'NOT RULED', 'No promised time is shown until a named person owns it.'],
      ['The copyright takedown route (agent and form)', 'NOT RULED', 'Needs a lawyer\u2019s read.'],
      ['Whether child-safety material must be reported outside the site', 'NOT RULED', ''],
      ['How long messages are kept', 'NOT RULED', ''],
      ['Delete and backup days', 'NOT RULED', ''],
      ['Provider and where data is stored', 'NOT RULED', ''],
      ['Which countries\u2019 rules apply', 'NOT RULED', ''],
      ['Who the moderators are, hours and escalation to Jose', 'NOT DECIDED', 'To be decided.']
    ]);
    var fin = el('p', 'muted small', 'Before any real launch: draft Terms, a lawyer\u2019s read (18+, the message sentence and the copyright route first), a privacy page with a community section, and a final decision.'); fin.style.marginTop = '24px'; root.appendChild(fin);
  }
  function pageSettings() {
    head('community-settings', 'Settings', 'Your settings (placeholder).', 'These only change this browser.');
    var f = el('form', 'form'); f.setAttribute('novalidate', '');
    var l1 = el('label', null, 'Who can send you message requests'); l1.setAttribute('for', 'st-w'); f.appendChild(l1);
    var sel = el('select'); sel.id = 'st-w';
    [['anyone', 'Any member'], ['shared', 'Only members who share a board with me'], ['nobody', 'Nobody']].forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; if (S.settings.who === o[0]) x.selected = true; sel.appendChild(x); });
    f.appendChild(sel);
    var l2 = el('label', null, 'Words to hide (separated by commas)'); l2.setAttribute('for', 'st-m'); f.appendChild(l2);
    var mi = el('input'); mi.type = 'text'; mi.id = 'st-m'; mi.value = S.settings.muted || ''; mi.autocomplete = 'off'; f.appendChild(mi);
    var sb = el('button', 'btn', 'Save settings'); sb.type = 'submit'; f.appendChild(sb);
    f.addEventListener('submit', function (e) { e.preventDefault(); S.settings.who = sel.value; S.settings.muted = mi.value; save(); toast('Saved in this browser.'); render(); });
    root.appendChild(f);
    var h = el('h2', 'h2', 'Blocked'); h.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h);
    if (!S.blocked.length) root.appendChild(el('p', 'muted', 'You have not blocked anyone.'));
    S.blocked.forEach(function (id) { var b = el('div', 'box'); b.appendChild(who(id)); var a = el('div', 'ctas'); a.style.marginTop = '8px'; a.appendChild(btn('Unblock', 'ghost', function () { S.blocked = S.blocked.filter(function (x) { return x !== id; }); save(); render(); })); b.appendChild(a); root.appendChild(b); });
    var h2 = el('h2', 'h2', 'Delete my data'); h2.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h2);
    root.appendChild(el('p', 'muted', 'Clears everything this prototype saved in your browser: votes, posts, requests, settings. Press twice to confirm.'));
    var d = el('button', 'btn ghost', 'Delete my data'); d.type = 'button'; var armed = false;
    d.addEventListener('click', function () { if (!armed) { armed = true; d.textContent = 'Press again to delete'; return; } try { localStorage.removeItem(KEY); } catch (e) {} S = fresh(); toast('Deleted.'); render(); });
    d.style.marginTop = '12px'; root.appendChild(d);
  }
  function target(r) {
    if (r.target_kind === 'post') { var p = post(r.target_id); return p ? p.title : '(post removed)'; }
    if (r.target_kind === 'comment') { var all = C.comments.concat(S.comments); for (var i = 0; i < all.length; i++) if (all[i].id === r.target_id) return all[i].body; return '(comment removed)'; }
    if (r.target_kind === 'member') return 'Profile: ' + mem(r.target_id).name;
    return r.excerpt || '(reported item)';
  }
  function pageMod() {
    head('community-mod', 'Moderator view', 'The moderator queue.', 'Reports and held posts wait here for a person. In this prototype nobody is in this role.');
    if (S.role !== 'moderator') {
      var b = el('div', 'box dash'); b.style.marginTop = '24px'; b.appendChild(el('span', 'ph', 'Locked for members'));
      b.appendChild(el('p', null, 'This view is for moderators. Use "View as" above to look at it as one. That switch exists only in the prototype.'));
      root.appendChild(b); return;
    }
    var reps = C.reports.concat(S.reports).filter(function (r) { return !S.resolved[r.id]; });
    var h = el('h2', 'h2', 'Reports (' + reps.length + ')'); h.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h);
    if (!reps.length) root.appendChild(el('p', 'muted', 'No open reports.'));
    reps.forEach(function (r) {
      var b = el('div', 'box'); b.appendChild(el('span', 'label', r.target_kind + ' \u00b7 ' + r.reason)); b.appendChild(el('p', null, target(r)));
      var a = el('div', 'ctas'); a.style.marginTop = '10px';
      var rl = el('label', null, 'Reason (kept in the log)'); rl.setAttribute('for', 'mr-' + r.id); b.appendChild(rl);
      var ri = el('input'); ri.type = 'text'; ri.id = 'mr-' + r.id; ri.maxLength = 160; ri.autocomplete = 'off'; b.appendChild(ri);
      var warn = el('p', 'muted small', ''); warn.setAttribute('role', 'status');
      function act(name, remove) { return btn(name, 'ghost', function () { if (!ri.value.trim()) { warn.textContent = 'A reason is needed before any action.'; ri.focus(); return; } S.resolved[r.id] = name; if (remove && r.target_kind !== 'member' && r.target_kind !== 'message') S.removed[r.target_id] = 1; S.log.push(name + ' (' + r.target_kind + '). Reason: ' + ri.value.trim()); save(); render(); }); }
      a.appendChild(act('Dismiss', false)); a.appendChild(act('Remove', true)); a.appendChild(act('Warn', false)); a.appendChild(act('Hold', false)); a.appendChild(act('Close account', false));
      b.appendChild(warn);
      b.appendChild(a); root.appendChild(b);
    });
    var held = C.held.concat(S.held).filter(function (x) { return !S.resolved[x.id]; });
    var h2 = el('h2', 'h2', 'Held for a check (' + held.length + ')'); h2.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h2);
    if (!held.length) root.appendChild(el('p', 'muted', 'Nothing held.'));
    held.forEach(function (x) {
      var b = el('div', 'box'); b.appendChild(el('span', 'label', 'Held: ' + x.why)); b.appendChild(el('p', null, x.text));
      var a = el('div', 'ctas'); a.style.marginTop = '10px';
      a.appendChild(btn('Approve', 'ghost', function () { S.resolved[x.id] = 'Approved'; S.log.push('Approved held item'); save(); render(); }));
      a.appendChild(btn('Reject', 'ghost', function () { S.resolved[x.id] = 'Rejected'; S.log.push('Rejected held item'); save(); render(); }));
      b.appendChild(a); root.appendChild(b);
    });
    var h3 = el('h2', 'h2', 'Action log'); h3.style.cssText = 'font-size:1.5rem;margin:30px 0 10px'; root.appendChild(h3);
    if (!S.log.length) root.appendChild(el('p', 'muted', 'No actions yet.'));
    var ul = el('ul', 'list'); S.log.forEach(function (t) { ul.appendChild(el('li', null, t + ' (placeholder, this browser only)')); }); root.appendChild(ul);
    var seen = el('p', 'muted small', 'A moderator may see: the reported item and a few messages around it, display name and member ID, report history, this log, public posts. A moderator may not see: email, sign-in details, IP, unreported messages, or block lists. Every view of a message is logged. A moderator is a person, not an AI agent. Threats, self-harm or anything about a child are escalated the same hour. (Draft.)'); seen.style.marginTop = '20px'; root.appendChild(seen);
  }

  /* ---------- route ---------- */
  var current = 'community';
  var forceFk = null;
  function render() {
    if (!C || !root) return;
    var ae = document.activeElement, fk = ae && ae.getAttribute ? ae.getAttribute('data-fk') : null, hadFocus = ae && root.contains(ae);
    if (forceFk) { fk = forceFk; hadFocus = true; forceFk = null; }
    clear(root);
    var h = current;
    if (h === 'rules') h = 'community-rules';
    var m;
    if (h === 'community') pageHome();
    else if ((m = /^community-board-(.+)$/.exec(h))) pageBoard(m[1]);
    else if ((m = /^community-post-(.+)$/.exec(h))) pagePost(m[1]);
    else if ((m = /^community-member-(.+)$/.exec(h))) pageMember(m[1]);
    else if (h === 'community-messages') pageMessages();
    else if (h === 'community-rules') pageRules();
    else if (h === 'community-settings') pageSettings();
    else if (h === 'community-mod') pageMod();
    else pageHome();
    if (hadFocus) {
      var t = fk ? root.querySelector('[data-fk="' + fk + '"]') : null;
      if (!t) { t = root.querySelector('h1'); if (t) t.setAttribute('tabindex', '-1'); }
      if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  var ready = null;
  window.SUCommunity = {
    show: function (h) {
      current = h; root = document.getElementById('community-root');
      if (!ready) ready = (window.SU_EMBED && window.SU_EMBED[BASE + 'community.json'] ? Promise.resolve({ ok: true, json: function () { return JSON.parse(JSON.stringify(window.SU_EMBED[BASE + 'community.json'])); } }) : fetch(BASE + 'community.json')).then(function (r) { if (!r.ok) throw new Error('community ' + r.status); return r.json(); }).then(function (d) { C = d; S = load(); });
      ready.then(render).catch(function (e) { if (root) { clear(root); root.appendChild(el('p', 'note', 'The community data did not load (' + e.message + ').')); } });
    }
  };
})();

