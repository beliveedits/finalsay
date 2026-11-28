/**
 * A small stand-in for the Google Apps Script services, enough to run src/*.gs in Node.
 *
 * It is NOT Google. It checks our logic (what gets written where, what is refused), not Google's
 * behaviour. Anything that depends on the real services is listed under "Still not verified" in STATUS.md.
 *
 * The sources are run in THIS global context (not a separate vm context) so that `instanceof Date`
 * behaves the way it does inside Apps Script.
 */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC = path.join(__dirname, '..', '..', 'src');
const FILES = ['Core.js', 'Store.gs', 'Mail.gs', 'Cal.gs', 'Ai.gs', 'Docs.gs', 'Code.gs', 'Intake.gs'];

/** A chainable builder that accepts any method and records the calls. */
function chain(record, terminal) {
  const calls = [];
  const proxy = new Proxy({}, {
    get(_, name) {
      if (name === '_calls') return calls;
      if (typeof name === 'symbol') return undefined;
      return (...args) => {
        calls.push([name, ...args]);
        if (terminal && terminal[name]) return terminal[name](calls);
        return proxy;
      };
    }
  });
  if (record) record.push(calls);
  return proxy;
}

class Protection {
  constructor(target) { this.target = target; this.editors = ['owner@studio.example', 'someone@studio.example']; this.warningOnly = false; this.domainEdit = true; this.description = ''; }
  setDescription(d) { this.description = d; return this; }
  setWarningOnly(b) { this.warningOnly = b; return this; }
  getEditors() { return this.editors.map((e) => ({ getEmail: () => e })); }
  removeEditors(list) { const gone = list.map((u) => (u.getEmail ? u.getEmail() : u)); this.editors = this.editors.filter((e) => !gone.includes(e)); return this; }
  addEditors(list) { list.forEach((e) => { if (!this.editors.includes(e)) this.editors.push(e); }); return this; }
  canDomainEdit() { return this.domainEdit; }
  setDomainEdit(b) { this.domainEdit = b; return this; }
}

class Range {
  constructor(sheet, row, col, nr, nc) { this.sheet = sheet; this.row = row; this.col = col; this.nr = nr || 1; this.nc = nc || 1; }
  getRow() { return this.row; }
  getColumn() { return this.col; }
  getSheet() { return this.sheet; }
  getValues() {
    const out = [];
    for (let r = 0; r < this.nr; r++) {
      const line = [];
      for (let c = 0; c < this.nc; c++) line.push(this.sheet._get(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  getValue() { return this.sheet._get(this.row, this.col); }
  setValues(vals) {
    if (vals.length !== this.nr || vals.some((v) => v.length !== this.nc)) throw new Error('mock: setValues size does not match the range');
    vals.forEach((line, r) => line.forEach((v, c) => this.sheet._set(this.row + r, this.col + c, v)));
    return this;
  }
  setValue(v) { this.sheet._set(this.row, this.col, v); return this; }
  /** Like Sheets: only a cell that was written as a formula has one. */
  getFormula() { const v = this.sheet._get(this.row, this.col); return typeof v === 'string' && v.startsWith('=') && this.sheet.formulas.some((f) => f.row === this.row && f.col === this.col && f.formula === v) ? v : ''; }
  clearContent() {
    for (let r = 0; r < this.nr; r++) for (let c = 0; c < this.nc; c++) this.sheet._set(this.row + r, this.col + c, '');
    return this;
  }
  setNumberFormat(f) { this.sheet.formats.push({ row: this.row, col: this.col, format: f }); return this; }
  setDataValidation(rule) { this.sheet.validations.push({ col: this.col, rule }); return this; }
  setFontWeight() { return this; }
  protect() { const p = new Protection(`${this.sheet.name}!R${this.row}C${this.col}`); this.sheet.protections.push(p); return p; }
}

class Sheet {
  constructor(name, book) {
    this.name = name; this.book = book; this.data = []; this.frozen = 0; this.hidden = new Set();
    this.formulas = []; this.formats = []; this.validations = []; this.protections = []; this.condRules = [];
  }
  // ---- how the mock treats a written value, mirroring Sheets ----
  _set(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    const line = this.data[r - 1];
    while (line.length < c) line.push('');
    if (typeof v === 'string' && v.startsWith('=')) this.formulas.push({ row: r, col: c, formula: v }); // Sheets would run this
    if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1);                                      // leading apostrophe = "this is text"
    line[c - 1] = v === null || v === undefined ? '' : v;
  }
  _get(r, c) { const line = this.data[r - 1]; const v = line ? line[c - 1] : ''; return v === undefined ? '' : v; }
  getName() { return this.name; }
  getMaxRows() { return 1000; }
  getLastRow() {
    for (let r = this.data.length; r >= 1; r--) if (this.data[r - 1].some((v) => v !== '' && v !== null && v !== undefined)) return r;
    return 0;
  }
  getLastColumn() {
    let max = 0;
    this.data.forEach((line) => { for (let c = line.length; c >= 1; c--) if (line[c - 1] !== '' && line[c - 1] !== undefined) { max = Math.max(max, c); break; } });
    return max;
  }
  getRange(row, col, nr, nc) { return new Range(this, row, col, nr, nc); }
  appendRow(row) { const r = this.getLastRow() + 1; row.forEach((v, i) => this._set(r, i + 1, v)); return this; }
  setFrozenRows(n) { this.frozen = n; return this; }
  hideColumns(c) { this.hidden.add(c); }
  showColumns(c) { this.hidden.delete(c); }
  setConditionalFormatRules(rules) { this.condRules = rules; }
  protect() { const p = new Protection(this.name); this.protections.push(p); return p; }
  getActiveRange() { return new Range(this, this.book.activeRow, 1); }
  // ---- helpers for tests ----
  headers() { return (this.data[0] || []).map(String); }
  rows() {
    const h = this.headers();
    return this.data.slice(1).filter((l) => l.some((v) => v !== '')).map((l) => Object.fromEntries(h.map((k, i) => [k, l[i] === undefined ? '' : l[i]])));
  }
  colIndex(header) { return this.headers().indexOf(header) + 1; }
}

function formatDate(date, tz, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const monthShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' }).format(date);
  let out = '', i = 0;
  const take = (tok) => pattern.startsWith(tok, i);
  while (i < pattern.length) {
    if (pattern[i] === "'") { const end = pattern.indexOf("'", i + 1); out += pattern.slice(i + 1, end); i = end + 1; continue; }
    if (take('yyyy')) { out += parts.year; i += 4; }
    else if (take('MMM')) { out += monthShort; i += 3; }
    else if (take('MM')) { out += parts.month; i += 2; }
    else if (take('dd')) { out += parts.day; i += 2; }
    else if (take('d')) { out += String(+parts.day); i += 1; }
    else if (take('HH')) { out += parts.hour; i += 2; }
    else if (take('mm')) { out += parts.minute; i += 2; }
    else if (take('ss')) { out += parts.second; i += 2; }
    else { out += pattern[i]; i += 1; }
  }
  return out;
}

// ---------- Docs ----------
const ElementType = { PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM', TABLE: 'TABLE', TABLE_OF_CONTENTS: 'TABLE_OF_CONTENTS' };
class DocEl {
  constructor(type, text) { this.type = type; this.text = text; }
  getType() { return this.type; }
  copy() { return new DocEl(this.type, this.text); }
  asText() { return this; }
  getText() { return this.text; }
  deleteText(start, endInclusive) { this.text = this.text.slice(0, start) + this.text.slice(endInclusive + 1); return this; }
  insertText(offset, s) { this.text = this.text.slice(0, offset) + s + this.text.slice(offset); return this; }
}
class DocSection {
  constructor(children) { this.children = children || []; }
  getNumChildren() { return this.children.length; }
  getChild(i) { return this.children[i]; }
  removeChild(el) { this.children = this.children.filter((c) => c !== el); return this; }
  _append(type, x) { const el = x instanceof DocEl ? x : new DocEl(type, String(x)); el.type = type; this.children.push(el); return el; }
  appendParagraph(x) { return this._append(ElementType.PARAGRAPH, x); }
  appendListItem(x) { return this._append(ElementType.LIST_ITEM, x); }
  appendTable(x) { return this._append(ElementType.TABLE, x); }
  findText(pattern, from) {
    let ei = 0, off = 0;
    if (from) { ei = this.children.indexOf(from._el); off = from._end + 1; }
    for (; ei < this.children.length; ei++, off = 0) {
      const re = new RegExp(pattern, 'g');
      re.lastIndex = off;
      const m = re.exec(this.children[ei].text);
      if (m) {
        const el = this.children[ei], start = m.index, end = m.index + m[0].length - 1;
        return { _el: el, _end: end, getElement: () => el, getStartOffset: () => start, getEndOffsetInclusive: () => end };
      }
    }
    return null;
  }
  text() { return this.children.map((c) => c.text).join('\n'); }
}
class Doc {
  constructor(id, name) { this.id = id; this.name = name; this.body = new DocSection([new DocEl(ElementType.PARAGRAPH, '')]); this.header = null; this.footer = null; this.saved = false; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/document/d/' + this.id + '/edit'; }
  getName() { return this.name; }
  getBody() { return this.body; }
  getHeader() { return this.header; }
  getFooter() { return this.footer; }
  saveAndClose() { this.saved = true; }
}

function createHarness(opts = {}) {
  const h = {
    tz: opts.tz || 'Asia/Kolkata',
    activeUser: 'owner@studio.example',
    effectiveUser: 'owner@studio.example',
    lockFree: true,
    staleLookups: new Map(), insertSheetError: '',
    sheets: [], activeSheetName: 'Leads', activeRow: 2,
    toasts: [], alerts: [], alertAnswers: [], prompts: [], dialogs: [], menus: [], webAppUrl: null,
    allScopesGranted: true, authPrompts: 0,
    props: new Map(), cache: new Map(), triggers: [],
    fetches: [], fetchHandler: () => ({ code: 500, body: 'no handler' }),
    docs: new Map(), driveCopies: 0,
    editors: ['owner@studio.example'],
    calendarEvents: [], calendarError: null
  };
  let docSeq = 0;
  const newDocId = () => 'doc' + String(++docSeq).padStart(4, '0') + 'ABCDEFGHIJKLMNOPQRSTUVWX';

  const book = {
    get activeRow() { return h.activeRow; },
    getSheetByName: (n) => {
      // h.staleLookups: { 'Tab name': times } makes the next lookups answer "no such tab" although it exists, which is
      // what a second run sees when the first run makes the tab a moment after the second one looked.
      const stale = h.staleLookups.get(n) || 0;
      if (stale > 0) { h.staleLookups.set(n, stale - 1); return null; }
      return h.sheets.find((s) => s.name === n) || null;
    },
    // Google refuses a second tab with the same name, and says so in these words.
    insertSheet: (n) => {
      if (h.insertSheetError) throw new Error(h.insertSheetError);
      if (h.sheets.some((s) => s.name === n)) throw new Error('A sheet with the name "' + n + '" already exists. Please enter another name.');
      const s = new Sheet(n, book); h.sheets.push(s); return s;
    },
    getActiveSheet: () => h.sheets.find((s) => s.name === h.activeSheetName) || null,
    getSpreadsheetTimeZone: () => h.tz,
    toast: (msg) => { h.toasts.push(msg); },
    getEditors: () => h.editors.map((e) => ({ getEmail: () => e }))
  };
  h.book = book;
  h.sheet = (n) => book.getSheetByName(n);

  const ui = {
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
    Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO' },
    createMenu(name) {
      const menu = { name, items: [] };
      h.menus.push(menu);
      const b = {
        addItem: (label, fn) => { menu.items.push({ label, fn }); return b; },
        addSeparator: () => b,
        addSubMenu: (sub) => { menu.items.push(...sub._menu.items); return b; },
        addToUi: () => {},
        _menu: menu
      };
      return b;
    },
    // A Yes / No question is answered from h.alertAnswers; with nothing queued the answer is No.
    alert: (title, msg, buttons) => { h.alerts.push(msg); return buttons === 'YES_NO' ? (h.alertAnswers.shift() || 'NO') : 'OK'; },
    prompt: (title, msg) => {
      const answer = h.prompts.shift();
      return { getSelectedButton: () => (answer === undefined ? 'CANCEL' : 'OK'), getResponseText: () => answer || '' };
    },
    showModelessDialog: (html, title) => { h.dialogs.push({ html, title }); }
  };

  const G = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => book,
      getUi: () => ui,
      newDataValidation: () => chain(null, { build: (calls) => ({ kind: 'validation', calls }) }),
      newConditionalFormatRule: () => chain(null, { build: (calls) => ({ kind: 'conditional', calls }) })
    },
    Utilities: {
      formatDate,
      getUuid: () => crypto.randomUUID(),
      sleep: () => {},
      Charset: { UTF_8: 'UTF_8' },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (alg, value) => Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (x) => Buffer.from(typeof x === 'string' ? Buffer.from(x, 'utf8') : Uint8Array.from(x.map((b) => (b + 256) % 256))).toString('base64'),
      base64EncodeWebSafe: (x) => G.Utilities.base64Encode(x).replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: (s) => Array.from(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (h.props.has(k) ? h.props.get(k) : null),
        setProperty: (k, v) => { h.props.set(k, String(v)); },
        deleteProperty: (k) => { h.props.delete(k); }
      })
    },
    CacheService: {
      getScriptCache: () => ({ get: (k) => (h.cache.has(k) ? h.cache.get(k) : null), put: (k, v) => { h.cache.set(k, String(v)); } })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => h.lockFree, releaseLock: () => {} }) },
    Session: {
      getActiveUser: () => ({ getEmail: () => h.activeUser }),
      getEffectiveUser: () => ({ getEmail: () => h.effectiveUser })
    },
    ScriptApp: {
      newTrigger: (fn) => {
        const t = { fn, kind: '', hour: null, tz: null, getHandlerFunction: () => fn };
        const b = {
          timeBased: () => { t.kind = 'time'; return b; }, everyDays: () => b, atHour: (x) => { t.hour = x; return b; }, inTimezone: (z) => { t.tz = z; return b; },
          forSpreadsheet: () => { t.kind = 'spreadsheet'; return b; }, onEdit: () => { t.kind = 'edit'; return b; },
          create: () => { h.triggers.push(t); return t; }
        };
        return b;
      },
      getService: () => ({ getUrl: () => h.webAppUrl }),
      AuthMode: { FULL: 'FULL' },
      AuthorizationStatus: { REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED' },
      getAuthorizationInfo: () => ({ getAuthorizationStatus: () => (h.allScopesGranted ? 'NOT_REQUIRED' : 'REQUIRED') }),
      // Like Google: with a permission missing, the run stops here and the person is asked again.
      requireAllScopes: () => { if (!h.allScopesGranted) { h.authPrompts++; throw new Error('mock: authorization required, the run ended'); } },
      getProjectTriggers: () => h.triggers.slice(),
      deleteTrigger: (t) => { h.triggers = h.triggers.filter((x) => x !== t); }
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        h.fetches.push({ url, options });
        const r = h.fetchHandler(url, options);
        if (r instanceof Error) throw r;
        return { getResponseCode: () => r.code, getContentText: () => r.body };
      }
    },
    DocumentApp: {
      ElementType,
      create: (name) => { const d = new Doc(newDocId(), name); h.docs.set(d.id, d); return d; },
      openById: (id) => { const d = h.docs.get(id); if (!d) throw new Error('mock: no such document'); return d; }
    },
    DriveApp: {
      getFileById: (id) => ({
        makeCopy: (name) => {
          const src = h.docs.get(id); if (!src) throw new Error('mock: no such file');
          const d = new Doc(newDocId(), name);
          d.body = new DocSection(src.body.children.map((c) => c.copy()));
          if (src.header) d.header = new DocSection(src.header.children.map((c) => c.copy()));
          if (src.footer) d.footer = new DocSection(src.footer.children.map((c) => c.copy()));
          h.docs.set(d.id, d); h.driveCopies++;
          return { getId: () => d.id };
        }
      })
    },
    HtmlService: { createHtmlOutputFromFile: (file) => { const o = { kind: 'html', file }; ['setWidth', 'setHeight', 'setTitle', 'addMetaTag'].forEach((m) => { o[m] = () => o; }); return o; } },
    ContentService: {
      MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
      createTextOutput: (text) => { const o = { kind: 'text', text, mime: null, setMimeType: (m) => { o.mime = m; return o; }, getContent: () => text }; return o; }
    },
    CalendarApp: {
      getDefaultCalendar: () => ({
        getEvents: () => {
          if (h.calendarError) throw h.calendarError;
          return h.calendarEvents.map((e) => ({
            getId: () => e.id, getTitle: () => e.title, getStartTime: () => e.start,
            getGuestList: () => e.guests.map((g) => ({ getEmail: () => g }))
          }));
        }
      })
    }
  };
  h.G = G;

  /** A helper for building template docs in tests. */
  h.makeDoc = (name, lines, extra = {}) => {
    const d = G.DocumentApp.create(name);
    d.body = new DocSection(lines.map((l) => new DocEl(ElementType.PARAGRAPH, l)));
    if (extra.header) d.header = new DocSection(extra.header.map((l) => new DocEl(ElementType.PARAGRAPH, l)));
    if (extra.footer) d.footer = new DocSection(extra.footer.map((l) => new DocEl(ElementType.PARAGRAPH, l)));
    if (extra.toc) d.body.children.push(new DocEl(ElementType.TABLE_OF_CONTENTS, 'toc'));
    return d;
  };

  /** Installs the mocks as globals and (re)loads every source file. */
  h.load = () => {
    Object.keys(G).forEach((k) => { globalThis[k] = G[k]; });
    FILES.forEach((f) => vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: path.join(SRC, f) }));
    return h;
  };

  /** Replaces the Gmail adapter with a fake that holds canned threads and records drafts. It has no way to send. */
  h.fakeMail = () => {
    const fake = {
      threads: [], drafts: [], me: ['me@studio.example'], labelExists: true, canCreateLabel: true, calls: [],
      listLabelThreads(label, max) { fake.calls.push(['list', label, max]); return fake.labelExists ? fake.threads.slice(0, max) : null; },
      getThread(id) { return fake.threads.find((t) => t.id === id) || null; },
      createDraft(d) { fake.drafts.push(d); return { id: 'draft-' + fake.drafts.length, inThread: !!d.threadId }; },
      ensureLabel(name) { fake.calls.push(['ensureLabel', name]); if (fake.labelExists) return { exists: true, created: false }; if (!fake.canCreateLabel) return { exists: false, created: false }; fake.labelExists = true; return { exists: true, created: true }; },
      probeDraft(prev) { if (prev && fake.drafts.some((d) => d.id === prev)) return { id: prev, reused: true }; const id = 'probe-' + (fake.drafts.length + 1); fake.drafts.push({ id, probe: true }); return { id, reused: false }; },
      myAddresses() { return fake.me.slice(); },
      backend() { return 'fake'; }
    };
    globalThis.Mail = fake;
    h.mail = fake;
    return fake;
  };

  return h;
}

/** Builds one canned thread. messages: [{ id, from, to, daysAgo, subject, body }] */
function thread(id, messages) {
  return {
    id,
    subject: messages[0].subject || '',
    messages: messages.map((m) => ({
      id: m.id, from: m.from, to: m.to || 'me@studio.example',
      date: m.date || new Date(Date.now() - (m.daysAgo || 0) * 86400000),
      subject: m.subject || 'Hello', body: m.body || ''
    }))
  };
}

module.exports = { createHarness, thread, formatDate, SRC, FILES };
