/* Checks on the files themselves: syntax, the "never sends" rule, permissions, nothing loaded from other sites, no secrets. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const list = (dir, exts) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => exts.some((e) => f.endsWith(e))).map((f) => path.join(dir, f));
function walk(dir, out = []) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (['node_modules', '.git', 'png'].includes(f)) continue;
    const rel = path.join(dir, f);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out); else out.push(rel);
  }
  return out;
}

test('every .gs file passes node --check', () => {
  const files = list('src', ['.gs']);
  assert.ok(files.length >= 7);
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', '-'], { input: read(f), encoding: 'utf8' });
    assert.equal(r.status, 0, f + '\n' + r.stderr);
  }
  assert.equal(spawnSync(process.execPath, ['--check', path.join(ROOT, 'src/Core.js')]).status, 0);
});

test('no file in src/ can send, forward or delete mail', () => {
  const banned = [/sendEmail/, /\.send\s*\(/, /Drafts\.send/, /Messages\.send/, /MailApp/, /\.reply\s*\(/, /\.replyAll\s*\(/, /\.forward\s*\(/, /moveToTrash/, /\.trash\s*\(/, /Messages\.(delete|trash|batchDelete)/];
  for (const f of list('src', ['.gs', '.js', '.html']).concat(['dist/Finalsay.gs'])) {
    const text = read(f);
    for (const re of banned) assert.ok(!re.test(text), f + ' contains ' + re);
  }
});

test('only Mail.gs touches Gmail, only Ai.gs calls out, only Cal.gs reads the calendar, only Store.gs touches the Sheet data', () => {
  for (const f of list('src', ['.gs', '.js'])) {
    const text = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const name = path.basename(f);
    if (name !== 'Mail.gs') assert.ok(!/GmailApp\.|Gmail\.Users/.test(text), name + ' must not call Gmail directly');
    if (name !== 'Ai.gs') assert.ok(!/UrlFetchApp/.test(text), name + ' must not make web requests');
    if (name !== 'Cal.gs') assert.ok(!/CalendarApp/.test(text), name + ' must not read the calendar');
    if (name !== 'Docs.gs') assert.ok(!/DriveApp/.test(text), name + ' must not use Drive');
    if (name === 'Core.js') assert.ok(!/SpreadsheetApp|PropertiesService|Utilities\./.test(text), 'Core.js stays free of Google services');
  }
});

test('the default manifest asks for no Drive and no Calendar access', () => {
  const m = JSON.parse(read('src/appsscript.json'));
  assert.ok(!m.oauthScopes.some((s) => /drive|calendar/.test(s)));
  assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.currentonly'), 'only the current spreadsheet');
  assert.ok(!m.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert.equal(m.webapp.access, 'MYSELF', 'the web app is private until the owner changes it');
  assert.equal(m.runtimeVersion, 'V8');
});

test('the narrow Gmail manifest swaps the broad scope for read-only plus compose', () => {
  const m = JSON.parse(read('src/appsscript.narrow-gmail.json'));
  assert.ok(!m.oauthScopes.includes('https://mail.google.com/'));
  assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/gmail.readonly'));
  assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/gmail.compose'));
  assert.ok(!m.oauthScopes.some((s) => /gmail\.(send|modify)/.test(s)));
  assert.equal(m.dependencies.enabledAdvancedServices[0].serviceId, 'gmail');
});

test('HTML files load nothing from another site', () => {
  const html = walk('.').filter((f) => f.endsWith('.html') && !f.includes('template'));
  assert.ok(html.length >= 2);
  for (const f of html) {
    const text = read(f);
    const loads = (text.match(/<(script|link|img|iframe|source|video|audio)\b[^>]*\b(src|href)\s*=\s*["']https?:\/\/[^"']+/gi) || [])
      .filter((tag) => !/^<link\s+rel="canonical"/i.test(tag)); // a canonical link names the page, it loads nothing
    assert.deepEqual(loads, [], f + ' loads an outside resource');
    assert.ok(!/@import\s+(url\()?["']?https?:/i.test(text), f + ' imports outside CSS');
    assert.ok(!/url\(\s*["']?https?:/i.test(text), f + ' uses an outside url() in CSS');
  }
});

test('the board and the phone app never write lead data as HTML', () => {
  for (const f of ['src/Board.html', 'src/App.html']) assert.ok(!/innerHTML|insertAdjacentHTML|document\.write|outerHTML/.test(read(f)), f);
});

test('no secrets are committed', () => {
  const patterns = [/AIza[0-9A-Za-z_\-]{30,}/, /sk-[A-Za-z0-9]{20,}/, /ghp_[A-Za-z0-9]{30,}/, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, /xox[baprs]-[A-Za-z0-9-]{10,}/];
  for (const f of walk('.')) {
    if (/\.(png|zip|woff2?)$/.test(f)) continue;
    const text = read(f);
    for (const re of patterns) assert.ok(!re.test(text), f + ' looks like it holds a secret: ' + re);
  }
});

test('sample data uses made-up people on reserved example domains only', () => {
  const emails = (read('src/Code.gs').match(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/gi) || []).concat(read('src/Board.html').match(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/gi) || []).concat(read('src/App.html').match(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+/gi) || []);
  for (const e of emails) assert.match(e, /\.example$/, e);
});

test('the one-file build is exactly the source files joined in load order, and it runs', () => {
  const { build, ORDER } = require('../tools/bundle.js');
  assert.equal(read('dist/Finalsay.gs'), build(), 'dist/Finalsay.gs is out of date: run "npm run build"');
  assert.deepEqual(ORDER.slice().sort(), list('src', ['.gs', '.js']).map((f) => path.basename(f)).sort(), 'every script file is in the build');
  const r = spawnSync(process.execPath, ['--check', '-'], { input: read('dist/Finalsay.gs'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  // Loaded as one file against the stand-ins, setup still works from start to finish.
  const { createHarness } = require('./mocks/gas.js');
  const h = createHarness();
  Object.keys(h.G).forEach((k) => { globalThis[k] = h.G[k]; });
  require('node:vm').runInThisContext(read('dist/Finalsay.gs'), { filename: 'dist/Finalsay.gs' });
  h.fakeMail();
  const res = setUp();
  assert.equal(res.created.length, 5);
  assert.equal(res.selfCheck.failed, 0);
});
