#!/usr/bin/env python3
"""Jonah's second-look check on a built Stand Up export folder, before it is handed to a host. Read-only.
Does NOT replace tools/check_data.py. Usage: python3 -I verify_export.py <export_dir> [--allow-video | --allow-five-videos | --allow-ten-videos] [--real-lessons]
Checks: no data/real; only the expected top-level names; no outside http(s) URL in any text file; no Google font calls;
every file type is on a short list; media only the named preview clip (or none); font files match pinned hashes; no file over 25 MB; prints total size."""
import os, re, sys, hashlib
FONTS = {'fonts/newsreader-latin-var.woff2': '01817351be3edfc1714fe6d60ddea6a22a169a5ebd033b50c7f9495e5d9c386a',
         'fonts/newsreader-italic-latin-var.woff2': 'a99fb127682b9af538780d21420037452197b0d37dfd273eb108f8a3665d5501',
         'fonts/sourcesans3-latin-var.woff2': '587435ca9d90732b8c1ce4958222c6ad3ade2b875500188e1d318efbcb61f4c5'}
OFL_SHA = '55df2f1fe83600c2738cd4a27678bccc3531650c0ec4bbdd435f6535e056d939'  # licence text; its links are text, not loads
PREVIEW = ('media/preview-480p.mp4', '31ab8c6c1619ba76ef2db85867e6b9360c74503ad283799f2bba736c755e41fe')
FIVE = {
    'media/standup-video1-how-a-lesson-works-16x9-narrated-v3.mp4': 'e1906b9c411373611713bad16981837df1b32b8c4c617b7ddd71c1e81172f90e',
    'media/standup-video2-pick-up-where-you-left-off-16x9-narrated-v4.mp4': '98ff9d8562ce3798927dbcf252e4845709e24d8d4cab2f3c4e1d86896685bb59',
    'media/standup-video3-your-own-pace-16x9-narrated-v3.mp4': 'a1cd875555cb9f345324693a35ef841651509a08fde4e16f30bdfa107973c3b3',
    'media/standup-video4-failed-nine-16x9-narrated-v2.mp4': '1a55fa9ef26813fbe41b941ef1c21ae97c6fc0a5bf646bebda4ec38790a1b6f2',
    'media/standup-video5-just-a-feeling-16x9-narrated-v2.mp4': 'd79d7bdccf3fbd8d83d011da2996c8f9215f8eb17b65f1b0c4b4fd88bc899a17',
}  # FINAL candidate set (public7); hashes computed by Jonah from the same-named files in ~/ecm-standup/derived/video, independent of check_data.py
OK_EXT = ('CNAME', '.html', '.json', '.css', '.js', '.txt', '.jpg', '.jpeg', '.png', '.webp', '.woff2', '.mp4', '_headers', '_redirects')
TEN = dict(FIVE)
TEN.update({
    'media/standup-v6-pick-one-narrated-v2.mp4': 'f1e8b0dba47c2b65810b1569754d510176c7fd548aae32f7b018bf88ffd7ca1a',
    'media/standup-v7-where-is-the-line-narrated-v2.mp4': 'cee7c93fdd22deca4f3cc7919a5271e805b712b924b5662e1b7f29466dc63355',
    'media/standup-v8-know-your-numbers-narrated-v2.mp4': 'ed71bbefd58c6b1a088955d5bb4f77088c04764f81215a6fe655ade8f67a37d8',
    'media/standup-v9-why-not-narrated-v2.mp4': '62413869249c6cc601c281f8ce1790bcf11c7dfd69a969d42ccd25c461bf6103',
    'media/standup-v10-process-breakdown-narrated-v2.mp4': 'f892a707e9839b26cac0d09ca0a96ea0c85ce8e74f73b743d2836a56bd74fb41',
})  # public10: hashes computed by Jonah from derived/video on 24 Nov, independent of check_data.py

if len(sys.argv) < 2: sys.exit(__doc__)
d = os.path.abspath(sys.argv[1]); allow_video = '--allow-video' in sys.argv; allow_five = '--allow-five-videos' in sys.argv; allow_ten = '--allow-ten-videos' in sys.argv; real_lessons = '--real-lessons' in sys.argv
bad = []; total = 0
STAFF = re.compile(r'\b(Ernie|Harper|Marlow|Knox|Quill|Jonah|Sterling|Vivian|Thea|Hollis|Tilly|Jules|Felix|Reid|Margot|Pip|Avery|Dane|Nova)\b')
BADWORDS = re.compile(r'RISK ACCEPTED|no one else can open|private concept|private prototype|owner-only|claude\.ai|emeads', re.I)
CALLID = re.compile(r'GMT[0-9]{8}|(?<![0-9])[0-9]{8}[-_ ]?[0-9]{6}(?![0-9])')
PLACEHOLDER_LESSONS = {'lesson-first','lesson-journey','lesson-s1','lesson-s2','lesson-s4','lesson-s5'}  # the placeholder set allowed without --real-lessons
LESSON_KEYS = {'schema','id','title','minutes','kind','header_line','chapter_note','groups','exercise','check','recap','quote_log'}
LINE_KEYS = {'text','mark','cue','kind'}

def fail(m): bad.append(m)
if os.path.isdir(os.path.join(d, 'data', 'real')): fail('data/real is in the export')
tops = set(os.listdir(d))
extra = tops - {'index.html', 'data', 'img', 'media', 'fonts', '_headers', '_redirects', 'robots.txt', 'CNAME'}
if extra: fail('unexpected top-level names: ' + ', '.join(sorted(extra)))
for root, _, fs in os.walk(d):
    for fn in fs:
        p = os.path.join(root, fn); rel = os.path.relpath(p, d).replace(os.sep, '/')
        sz = os.path.getsize(p); total += sz
        if sz > 25 * 1024 * 1024: fail(rel + ' is over 25 MB')
        if not (fn.lower().endswith(OK_EXT) or fn in ('_headers', '_redirects', 'CNAME')): fail(rel + ': file type not on the list'); continue
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        if rel.endswith('.woff2') and FONTS.get(rel) != h: fail(rel + ': font not pinned or hash differs')
        if rel.endswith('.mp4') and allow_ten:
            if TEN.get(rel) != h: fail(rel + ': video is not one of the ten named narrated videos (or its hash differs)')
        elif rel.endswith('.mp4') and allow_five:
            if FIVE.get(rel) != h: fail(rel + ': video is not one of the five named narrated videos (or its hash differs)')
        elif rel.endswith('.mp4'):
            if not allow_video: fail(rel + ': video present (preview default is to remove it; pass --allow-video to accept)')
            elif (rel, h) != PREVIEW: fail(rel + ': video is not the named preview clip')
        if rel == 'CNAME':
            if open(p).read().strip() != 'standupfounders.com': fail('CNAME must contain exactly standupfounders.com')
            continue
        if rel == 'fonts/OFL.txt':
            if h != OFL_SHA: fail(rel + ': licence text differs from the pinned file')
            continue
        if fn.lower().endswith(('.html', '.json', '.css', '.js', '.txt')):
            t = open(p, encoding='utf8', errors='replace').read()
            for m in set(re.findall(r'https?://[^\s"\'<>)]+', t)): fail(rel + ': outside URL ' + m[:60])
            if re.search(r'googleapis|gstatic', t): fail(rel + ': Google font call')
            if re.search(r'GMT\d{8}-\d{6}', t): fail(rel + ': recording file name pattern')
            m = STAFF.search(t)
            if m: fail(rel + ': staff or team name "' + m.group(0) + '"')
            m = BADWORDS.search(t)
            if m: fail(rel + ': internal wording "' + m.group(0) + '"')
            m = CALLID.search(t)
            if m: fail(rel + ': call or recording id pattern "' + m.group(0) + '"')
            if re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}', t) and 'example@example.com' not in t: fail(rel + ': email address')
            if rel.startswith('data/placeholder/lessons/') and rel.endswith('.json'):
                import json
                if not real_lessons and os.path.basename(rel)[:-5] not in PLACEHOLDER_LESSONS: fail(rel + ': lesson file is not one of the placeholder lessons and --real-lessons not given')
                elif real_lessons:
                    try: j = json.loads(t)
                    except Exception: fail(rel + ': lesson is not valid JSON'); j = None
                    if j is not None:
                        if set(j) != LESSON_KEYS: fail(rel + ': lesson keys differ: ' + ','.join(sorted(set(j) ^ LESSON_KEYS)))
                        for g in j.get('groups', []):
                            for ln in g.get('lines', []):
                                if set(ln) != LINE_KEYS: fail(rel + ': line keys differ'); break
                                if ln['mark'] != 'N' or ln['cue'] != '': fail(rel + ': a line carries a mark or cue'); break
                        for q in j.get('quote_log', []):
                            if q != {'book': 'the book discussed in class'}: fail(rel + ': quote_log entry is not the neutral credit'); break
_ix = open(os.path.join(d, 'index.html'), encoding='utf-8').read(); _lo = _ix.lower()
if not _lo.lstrip().startswith('<!doctype html'): fail('index.html has no <!doctype html> (quirks mode)')
if 'name="viewport"' not in _lo or 'width=device-width' not in _lo: fail('index.html has no standard viewport meta (phones render at desktop width)')
if '<meta charset' not in _lo: fail('index.html has no <meta charset>')
print('files total %.2f MB' % (total / 1e6))
if bad:
    print('VERIFY FAILED'); [print(' -', b) for b in bad]; sys.exit(1)
print('VERIFY PASSED')
