/* Mail.gs against stand-ins for GmailApp and the Gmail advanced service. Real Gmail was run once (STATUS.md); most of what is tested here was not. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./mocks/gas.js');

const d = (n) => new Date(Date.UTC(2026, 10, n, 9, 0));

function gmailApp(state) {
  const msg = (m) => ({
    getId: () => m.id, getFrom: () => m.from, getTo: () => m.to || '', getDate: () => m.date, getSubject: () => m.subject || 'Hello',
    getPlainBody: () => m.body || '', isDraft: () => !!m.draft,
    createDraftReply: (body) => { state.drafts.push({ kind: 'reply', toMessage: m.id, body }); return { getId: () => 'dr' + state.drafts.length }; }
  });
  const thr = (t) => ({ getId: () => t.id, getFirstMessageSubject: () => t.messages[0].subject || 'Hello', getMessages: () => t.messages.map(msg) });
  return {
    getUserLabelByName: (n) => (state.labels[n] ? { getThreads: (start, max) => state.labels[n].slice(start, start + max).map((id) => thr(state.threads[id])) } : null),
    getThreadById: (id) => (state.threads[id] ? thr(state.threads[id]) : null),
    getAliases: () => state.aliases,
    createDraft: (to, subject, body) => {
      const dr = { kind: 'new', to, subject, body };
      // id and updates are hidden fields, so tests that compare a whole draft still see only what Gmail was given
      Object.defineProperty(dr, 'id', { value: 'dr' + (state.drafts.length + 1) }); Object.defineProperty(dr, 'updates', { value: 0, writable: true });
      state.drafts.push(dr); return { getId: () => dr.id };
    },
    createLabel: (n) => { state.labels[n] = []; state.labelsMade = (state.labelsMade || 0) + 1; return {}; },
    getDraft: (id) => { const dr = state.drafts.find((x) => x.id === id); if (!dr) throw new Error('Invalid draft id'); return { getId: () => dr.id, update: (to, subject, body) => { Object.assign(dr, { to, subject, body }); dr.updates++; } }; }
  };
}
function setup() {
  const h = createHarness().load();
  h.effectiveUser = 'Me@Studio.example';
  const state = {
    aliases: ['hello@studio.example', 'ME@studio.example'], drafts: [], labels: { CRM: ['t1', 't2'] },
    threads: {
      t1: { id: 't1', messages: [
        { id: 'm1', from: 'Meera <meera@joshi-studio.example>', to: 'me@studio.example', date: d(20), subject: 'Launch film?', body: 'Hi' },
        { id: 'm2', from: 'me@studio.example', to: 'meera@joshi-studio.example', date: d(21), body: 'Sure' },
        { id: 'm3', from: 'me@studio.example', to: 'meera@joshi-studio.example', date: d(22), body: 'unsent', draft: true }
      ] },
      t2: { id: 't2', messages: [{ id: 'm9', from: 'hello@studio.example', to: 'aiko@tanabe-tea.example', date: d(23), subject: 'Quote' }] }
    }
  };
  globalThis.GmailApp = gmailApp(state);
  return { h, state };
}

test('GmailApp backend: labelled threads come back as plain data, drafts left out', () => {
  setup();
  const list = Mail.listLabelThreads('CRM', 30);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0].messages.map((m) => m.id), ['m1', 'm2']);
  assert.deepEqual(Object.keys(list[0].messages[0]).sort(), ['body', 'date', 'from', 'id', 'subject', 'to']);
  assert.equal(list[0].subject, 'Launch film?');
  assert.equal(Mail.listLabelThreads('Nope', 30), null, 'a missing label is null, not an empty list');
  assert.equal(Mail.listLabelThreads('CRM', 1).length, 1);
  assert.equal(Mail.getThread('t2').messages[0].id, 'm9');
  assert.equal(Mail.getThread('missing'), null);
  assert.equal(Mail.getThread(''), null);
});

test('myAddresses: your address and aliases, lower case, no duplicates', () => {
  setup();
  assert.deepEqual(Mail.myAddresses(), ['me@studio.example', 'hello@studio.example']);
});

test('a draft in a thread replies to the last message THEY wrote, not to your own last message', () => {
  const { state } = setup();
  const res = Mail.createDraft({ threadId: 't1', to: 'meera@joshi-studio.example', subject: 'x', body: 'Here is the quote.' });
  assert.equal(res.inThread, true);
  assert.deepEqual(state.drafts, [{ kind: 'reply', toMessage: 'm1', body: 'Here is the quote.' }]);
});

test('with no inbound message in the thread, a new draft is made; the subject cannot carry a header', () => {
  const { state } = setup();
  const res = Mail.createDraft({ threadId: 't2', to: 'aiko@tanabe-tea.example', subject: 'Checking in\r\nBcc: evil@x.example', body: 'Hello' });
  assert.equal(res.inThread, false);
  assert.deepEqual(state.drafts, [{ kind: 'new', to: 'aiko@tanabe-tea.example', subject: 'Checking in Bcc: evil@x.example', body: 'Hello' }]);
});

test('a draft needs one valid recipient and a body', () => {
  const { state } = setup();
  assert.throws(() => Mail.createDraft({ to: 'a@b.example, evil@x.example', subject: 's', body: 'b' }), /valid recipient/);
  assert.throws(() => Mail.createDraft({ to: 'a@b.example\nBcc: evil@x.example', subject: 's', body: 'b' }), /valid recipient/);
  assert.throws(() => Mail.createDraft({ to: 'a@b.example', subject: 's', body: '   ' }), /empty/);
  assert.equal(state.drafts.length, 0);
  Mail.createDraft({ to: 'a@b.example', subject: '', body: 'b' });
  assert.equal(state.drafts[0].subject, '(no subject)');
});

// ---------- the narrower Gmail API backend ----------
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
function setupApi() {
  const h = createHarness().load();
  h.effectiveUser = 'me@studio.example';
  h.props.set('MAIL_BACKEND', 'gmailapi');
  const created = [];
  const hdr = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
  const threads = {
    t1: { id: 't1', messages: [
      { id: 'a1', internalDate: String(d(20).getTime()), labelIds: ['INBOX', 'Label_7'],
        payload: { mimeType: 'multipart/alternative', headers: hdr({ From: 'Meera <meera@joshi-studio.example>', To: 'me@studio.example', Subject: 'Launch film?', 'Message-ID': '<abc@mail.example>' }),
          parts: [{ mimeType: 'text/plain', body: { data: b64url('Hello, namaste નમસ્તે') } }, { mimeType: 'text/html', body: { data: b64url('<p>Hello</p>') } }] } },
      { id: 'a2', internalDate: String(d(21).getTime()), labelIds: ['SENT'],
        payload: { mimeType: 'text/html', headers: hdr({ From: 'me@studio.example', To: 'meera@joshi-studio.example', Subject: 'Re: Launch film?', 'Message-ID': '<def@mail.example>' }),
          body: { data: b64url('<style>p{color:red}</style><p>Sure, <b>happy</b> to help</p>') } } },
      { id: 'a3', internalDate: String(d(22).getTime()), labelIds: ['DRAFT'], payload: { mimeType: 'text/plain', headers: hdr({ From: 'me@studio.example' }), body: { data: b64url('draft') } } }
    ] }
  };
  globalThis.Gmail = { Users: {
    Labels: { list: () => ({ labels: [{ id: 'Label_1', name: 'Other' }, { id: 'Label_7', name: 'CRM' }] }) },
    Threads: { list: (me, o) => { assert.deepEqual(o.labelIds, ['Label_7']); return { threads: [{ id: 't1' }] }; }, get: (me, id, o) => { assert.equal(o.format, 'full'); return threads[id]; } },
    Drafts: { create: (res, me) => { created.push(res); return { id: 'r' + created.length }; }, get: (me, id) => { if (!created.some((x, i) => 'r' + (i + 1) === id)) throw new Error('Not Found'); return { id }; } },
    Settings: { SendAs: { list: () => ({ sendAs: [{ sendAsEmail: 'Me@studio.example' }, { sendAsEmail: 'hello@studio.example' }] }) } }
  } };
  return { h, created };
}

test('Gmail API backend: reads the label, decodes plain text, falls back to stripped HTML, skips drafts', () => {
  setupApi();
  const [t] = Mail.listLabelThreads('CRM', 10);
  assert.deepEqual(t.messages.map((m) => m.id), ['a1', 'a2']);
  assert.equal(t.messages[0].body, 'Hello, namaste નમસ્તે');
  assert.equal(t.messages[1].body, 'Sure, happy to help');
  assert.equal(t.messages[0].from, 'Meera <meera@joshi-studio.example>');
  assert.equal(t.messages[0].date.getTime(), d(20).getTime());
  assert.equal(t.subject, 'Launch film?');
  assert.equal(Mail.listLabelThreads('Missing', 10), null);
  assert.deepEqual(Mail.myAddresses(), ['me@studio.example', 'hello@studio.example']);
});

test('Gmail API backend: a draft is one Drafts.create call with a clean, threaded message', () => {
  const { created } = setupApi();
  const res = Mail.createDraft({ threadId: 't1', to: 'meera@joshi-studio.example', subject: 'Quote ₹48,000\r\nBcc: evil@x.example', body: 'Hi Meera,\nthe quote is attached.' });
  assert.equal(res.inThread, true);
  assert.equal(created.length, 1);
  assert.equal(created[0].message.threadId, 't1');
  const raw = Buffer.from(created[0].message.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const [head, body] = raw.split('\r\n\r\n');
  const lines = head.split('\r\n');
  assert.equal(lines[0], 'To: meera@joshi-studio.example');
  assert.ok(lines.includes('In-Reply-To: <abc@mail.example>'), 'threads onto the last message they wrote');
  assert.ok(!lines.some((l) => /^(Bcc|Cc):/i.test(l)), 'no extra recipient header can be injected');
  const subject = lines.find((l) => l.startsWith('Subject: ')).slice(9);
  assert.match(subject, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  assert.equal(Buffer.from(subject.slice(10, -2), 'base64').toString('utf8'), 'Quote ₹48,000 Bcc: evil@x.example');
  assert.equal(Buffer.from(body, 'base64').toString('utf8'), 'Hi Meera,\nthe quote is attached.');
});

test('a stale Thread ID is not an error: reading returns null and a draft falls back to a new message', () => {
  const { state } = setup();
  globalThis.GmailApp.getThreadById = () => { throw new Error('Invalid thread id'); };
  assert.equal(Mail.getThread('gone'), null);
  const res = Mail.createDraft({ threadId: 'gone', to: 'meera@joshi-studio.example', subject: 'Following up', body: 'Hello' });
  assert.equal(res.inThread, false);
  assert.equal(state.drafts[0].kind, 'new');
});

test('the label is made only when it is missing; the narrow backend never makes one and only reports', () => {
  const { state } = setup();
  assert.deepEqual(Mail.ensureLabel('CRM'), { exists: true, created: false });
  assert.equal(state.labelsMade || 0, 0);
  assert.deepEqual(Mail.ensureLabel('Clients\r\nX'), { exists: true, created: true });
  assert.ok(state.labels['Clients X'], 'the label name is one clean line');
  assert.throws(() => Mail.ensureLabel('  '), /Gmail label is empty/);
  setupApi();
  assert.deepEqual(Mail.ensureLabel('CRM'), { exists: true, created: false });
  assert.deepEqual(Mail.ensureLabel('Missing'), { exists: false, created: false });
});

test('self-check draft: one draft to yourself, rewritten on the next run, and a new one only if it is gone', () => {
  const { state } = setup();
  const first = Mail.probeDraft('');
  assert.equal(first.reused, false);
  assert.equal(state.drafts.length, 1);
  assert.equal(state.drafts[0].to, 'me@studio.example', 'addressed to yourself, nobody else');
  assert.match(state.drafts[0].subject, /self-check \(safe to delete\)/);
  const second = Mail.probeDraft(first.id);
  assert.deepEqual(second, { id: first.id, reused: true });
  assert.equal(state.drafts.length, 1, 'no second draft');
  assert.equal(state.drafts[0].updates, 1);
  assert.equal(Mail.probeDraft('gone').reused, false);
  assert.equal(state.drafts.length, 2);
  const api = setupApi();
  const a = Mail.probeDraft('');
  assert.equal(api.created.length, 1);
  assert.deepEqual(Mail.probeDraft(a.id), { id: a.id, reused: true });
  assert.equal(api.created.length, 1);
});
