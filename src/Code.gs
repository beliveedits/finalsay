/**
 * Finalsay: Code.gs. Menu, setup, capture, Today, approvals, board and triggers.
 *
 * What runs without a click: capture (new lead rows, last-contact dates, AI filling EMPTY fields)
 * and the Today list. What never runs without a click: stage changes, next steps, notes and reply
 * drafts. Those wait in the Approvals tab. Nothing in this project sends an email.
 */
var APP = 'Finalsay';
var RUN_BUDGET_MS = 4.5 * 60 * 1000; // Apps Script stops a run at 6 minutes; stop early and finish next time

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('CRM')
    .addItem('Set up', 'setUp')
    .addSeparator()
    .addItem('Capture emails now', 'menuCapture')
    .addItem('Refresh Today', 'menuRefreshToday')
    .addItem('Apply approvals now', 'menuApplyApprovals')
    .addItem('Open board', 'showBoard')
    .addSeparator()
    .addItem('Suggest next move (selected lead)', 'suggestNextMove')
    .addItem('Create proposal doc (selected lead)', 'createProposalDoc')
    .addSeparator()
    .addItem('Set AI key', 'setAiKey')
    .addItem('Turn on daily automation', 'turnOnAutomation')
    .addItem('Turn off automation', 'turnOffAutomation')
    .addSeparator()
    .addSubMenu(ui.createMenu('More')
      .addItem('Switch Simple / Pro', 'switchMode')
      .addItem('Open phone app view', 'showApp')
      .addItem('Run self-check', 'selfCheck')
      .addItem('Add sample leads (made-up people)', 'addSampleLeads')
      .addItem('New intake token (website forms)', 'newIntakeToken')
      .addItem('New API token (local AI page, MCP)', 'newApiToken')
      .addItem('Lock down for a team', 'lockDownForTeam'))
    .addToUi();
}

// ---------- small helpers ----------
/** The same instant, re-expressed so that its local fields are the wall clock in time zone `tz`. */
function sheetLocal_(d, tz) {
  var p = Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ss").split(/[-T:]/);
  return new Date(+p[0], +p[1] - 1, +p[2], +p[3], +p[4], +p[5]);
}
function ctx_() {
  var tz = Store.timeZone(), now = new Date();
  return { tz: tz, now: now, nowLocal: sheetLocal_(now, tz), settings: Store.getSettings() };
}
function isDate_(v) { return v instanceof Date && !isNaN(v); }
/** Next Date is text (YYYY-MM-DD). If someone formatted the cell as a date, read that too. */
function readDay_(v, tz) {
  if (isDate_(v)) { var d = sheetLocal_(v, tz); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  return CRM.isoToLocalDate(String(v === null || v === undefined ? '' : v).trim());
}
function coreLead_(l, tz) {
  return {
    id: l.id, name: l.name, stage: l.stage, nextStep: l.nextStep,
    nextDate: readDay_(l.nextDate, tz),
    lastContact: isDate_(l.lastContact) ? sheetLocal_(l.lastContact, tz) : null,
    lastDirection: String(l.lastDirection || '').trim().toLowerCase()
  };
}
function toast_(msg) { try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, APP, 8); } catch (e) { /* no UI here */ } }
function alert_(msg) {
  try { var ui = SpreadsheetApp.getUi(); ui.alert(APP, msg, ui.ButtonSet.OK); } catch (e) { toast_(msg); }
}
/** A Yes / No question. Where there is no window to ask in, the answer is No. */
function confirm_(msg) {
  try { var ui = SpreadsheetApp.getUi(); return ui.alert(APP, msg, ui.ButtonSet.YES_NO) === ui.Button.YES; } catch (e) { return false; }
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Finalsay is busy with another run. Try again in a minute.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function sameText_(a, b) {
  var n = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
  return n(a) === n(b);
}

// ---------- setup ----------
/**
 * One click. Set up does everything it is allowed to do by itself (tabs, the Gmail label, automation if you
 * say yes), then tests its own work against your Google account and tells you the result.
 */
function setUp() {
  requireAllPermissions_();
  var res = withLock_(function () { return Store.init(); });
  var s = Store.getSettings(), props = PropertiesService.getScriptProperties();
  Store.applyMode(s.mode === 'Pro' ? 'Pro' : 'Simple');
  var lines = [res.created.length ? 'Made these tabs: ' + res.created.join(', ') + '.' : 'The tabs were already in place.'];
  try {
    var lab = Mail.ensureLabel(s.gmailLabel);
    res.labelCreated = lab.created;
    lines.push(lab.created ? 'Made the Gmail label "' + s.gmailLabel + '".'
      : lab.exists ? 'The Gmail label "' + s.gmailLabel + '" is there.'
        : 'The Gmail label "' + s.gmailLabel + '" is missing. Create it in Gmail.');
  } catch (e) { lines.push('Could not check the Gmail label: ' + CRM.oneLine(e && e.message, 200)); }
  res.automation = false;
  if (!props.getProperty('SETUP_DONE')) {
    // Asked until it is settled: a No is remembered, and so is a Yes that worked. A Yes that failed is asked again
    // next time (seen live: the first run had no permission to make triggers, and the question never came back).
    if (confirm_('Turn on daily automation? (Recommended)\n\nOnce a day Finalsay reads the emails that carry your label. A row in Approvals is applied as soon as you set it to Approve. Nothing is ever sent. You can turn this off in the CRM menu.')) {
      try { automationOn_(); res.automation = true; props.setProperty('SETUP_DONE', '1'); lines.push('Daily automation is on.'); }
      catch (e) { lines.push('Automation could not be turned on: ' + CRM.oneLine(e && e.message, 200) + ' Run CRM > Set up again.'); }
    } else {
      props.setProperty('SETUP_DONE', '1');
    }
  }
  if (!res.automation) {
    try { lines.push(automationIsOn_() ? 'Daily automation is on.' : 'Daily automation is off. You can turn it on in the CRM menu.'); } catch (e) { /* said by the self-check */ }
  }
  var chk = selfCheck_(false);
  res.selfCheck = chk;
  lines.push('Self-check: ' + chk.passed + ' passed, ' + (chk.failed ? chk.failed + ' FAILED. Open the Self-check tab to see which.' : 'none failed.'));
  alert_(lines.join('\n') + '\n\nNext: in Gmail, add the label "' + s.gmailLabel + '" to a client email, then use CRM > Capture emails now' +
    (res.automation ? ', or wait for the daily run.' : '.'));
  return res;
}

// ---------- permissions ----------
/**
 * Google's permission screen has a tick box per permission, and none is ticked to begin with. A person can press
 * Continue with only some ticked, and the script then half works. Set up needs all of them, so when one is
 * missing this stops the run and Google shows its permission screen again. Seen live on 26 Nov 2026.
 */
function requireAllPermissions_() {
  if (typeof ScriptApp.requireAllScopes === 'function') ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
}
/** True when every permission in the manifest has been granted. Asks Google, shows nothing. */
function allPermissionsGranted_() {
  var info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  return String(info.getAuthorizationStatus()) === String(ScriptApp.AuthorizationStatus.NOT_REQUIRED);
}

// ---------- self-check ----------
/** Does nothing. The self-check makes a trigger for it and removes it again, to see whether triggers are allowed. */
function selfCheckPing() {}

/**
 * Tests this copy against the real Google services and writes the report to the Self-check tab.
 * full = false (run by Set up): nothing new is made in Gmail or Docs.
 * full = true  (CRM > More > Run self-check): also saves one draft to yourself and one small document, both
 *              named "Finalsay self-check (safe to delete)". Later runs reuse them instead of making more.
 * It never sends, never deletes, and never touches a lead.
 */
function selfCheck_(full) {
  var out = [], s = {}, tz = '', props = PropertiesService.getScriptProperties();
  function check(name, fn) {
    try {
      var r = fn() || {};
      out.push({ check: name, result: r.skip ? 'Skipped' : 'Pass', detail: CRM.oneLine(r.detail || '', 300) });
    } catch (e) {
      out.push({ check: name, result: 'Fail', detail: CRM.oneLine((e && e.message) || String(e), 300) });
    }
  }
  check('Permissions', function () {
    if (!allPermissionsGranted_()) {
      throw new Error('some permissions were not ticked on Google\'s screen. Run CRM > Set up again, tick "Select all", then press Continue.');
    }
    return { detail: 'all granted' };
  });
  check('Tabs and settings', function () {
    s = Store.getSettings();
    return { detail: Store.listLeads().length + ' lead(s) in the Leads tab' };
  });
  check('Time zone', function () {
    tz = Store.timeZone();
    if (!tz) throw new Error('the Sheet has no time zone');
    return { detail: tz + ', now ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') };
  });
  check('Text that looks like a formula stays text', function () {
    var r = Store.probeFormulaGuard();
    if (!r.ok) throw new Error('the Sheet kept "' + (r.formula || r.value) + '" instead of plain text');
    return { detail: 'kept as text' };
  });
  check('Private storage for the key and tokens', function () {
    props.setProperty('SELF_CHECK', 'x');
    var back = props.getProperty('SELF_CHECK');
    props.deleteProperty('SELF_CHECK');
    if (back !== 'x') throw new Error('a saved value could not be read back');
    return { detail: 'works' };
  });
  check('Short-term memory for rate limits', function () {
    var c = CacheService.getScriptCache();
    c.put('self_check', '1', 60);
    if (c.get('self_check') !== '1') throw new Error('a saved value could not be read back');
    return { detail: 'works' };
  });
  check('One run at a time', function () { withLock_(function () {}); return { detail: 'works' }; });
  check('Who you are', function () {
    var me = Mail.myAddresses();
    if (!me.length) throw new Error('could not read your own email address');
    if (!boardAllowed_()) throw new Error('Google did not tell the script who is using it, so the board and the phone app would refuse you');
    return { detail: me[0] };
  });
  check('Gmail label', function () {
    var r = Mail.ensureLabel(s.gmailLabel);
    if (!r.exists) throw new Error('the label "' + s.gmailLabel + '" does not exist. Create it in Gmail.');
    return { detail: '"' + s.gmailLabel + '" ' + (r.created ? 'was made just now' : 'exists') };
  });
  check('Triggers', function () {
    removeTriggers_(['selfCheckPing']);
    ScriptApp.newTrigger('selfCheckPing').timeBased().everyDays(1).atHour(3).inTimezone(tz || 'Etc/UTC').create();
    if (!removeTriggers_(['selfCheckPing'])) throw new Error('a test trigger was made but could not be found again');
    return { detail: 'allowed. Daily automation is ' + (automationIsOn_() ? 'on' : 'off') };
  });
  check('Phone app address', function () {
    var url = '';
    try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
    return url ? { detail: 'Google reports ' + url + ' (it opens only after the web app is deployed)' }
      : { skip: true, detail: 'not deployed yet. See SETUP.md step 8.' };
  });
  check('AI', function () {
    if (!s.aiOn) return { skip: true, detail: 'AI is off in Settings' };
    if (!CRM.clean(Ai.complete('Answer with the single word OK.', s), 50)) throw new Error('the provider sent an empty answer');
    return { detail: s.aiProvider + ', model ' + s.aiModel + ', answered' };
  });
  check('Calendar', function () {
    if (!s.calendarOn) return { skip: true, detail: 'calendar capture is off in Settings' };
    return { detail: Cal.upcoming(1).length + ' event(s) in the next day could be read' };
  });
  check('Gmail draft (saved, never sent)', function () {
    if (!full) return { skip: true, detail: 'use CRM > More > Run self-check to test this' };
    var r = Mail.probeDraft(props.getProperty('SELF_CHECK_DRAFT') || '');
    props.setProperty('SELF_CHECK_DRAFT', r.id);
    return { detail: (r.reused ? 'rewrote' : 'saved') + ' one draft to yourself named "Finalsay self-check (safe to delete)"' };
  });
  check('Google Docs', function () {
    if (!full) return { skip: true, detail: 'use CRM > More > Run self-check to test this' };
    var r = Docs.probe(props.getProperty('SELF_CHECK_DOC') || '');
    props.setProperty('SELF_CHECK_DOC', r.id);
    return { detail: (r.reused ? 'wrote to' : 'made') + ' one document named "Finalsay self-check (safe to delete)": ' + r.url };
  });
  var count = function (k) { return out.filter(function (r) { return r.result === k; }).length; };
  var res = { results: out, passed: count('Pass'), failed: count('Fail'), skipped: count('Skipped'), reportSaved: true };
  try { Store.replaceSelfCheck(out); } catch (e) { res.reportSaved = false; }
  return res;
}
/** CRM > More > Run self-check */
function selfCheck() {
  var r = selfCheck_(true);
  alert_('Self-check: ' + r.passed + ' passed, ' + r.failed + ' failed, ' + r.skipped + ' skipped.\n\n' +
    r.results.map(function (x) { return x.result.toUpperCase() + '  ' + x.check + (x.detail ? ': ' + x.detail : ''); }).join('\n') +
    (r.reportSaved ? '\n\nThe same list is in the Self-check tab.' : '\n\nThe report could not be saved to the Sheet. Run CRM > Set up first.') +
    (r.failed ? '\nIf you report a problem, copy this list into the report.' : ''));
  return r;
}

function switchMode() {
  var next = Store.getSettings().mode === 'Pro' ? 'Simple' : 'Pro';
  Store.setSetting('Mode', next);
  Store.applyMode(next);
  toast_(next === 'Simple' ? 'Simple mode: five columns. Nothing was deleted.' : 'Pro mode: every column is shown.');
  return next;
}

// ---------- proposals (the approval queue) ----------
/** Validates, then queues. Anything unsafe throws here and never reaches the Approvals tab. */
function addProposal_(p, lead) {
  CRM.proposalChanges(p);
  Store.addApproval(p, lead.name, CRM.describeProposal(p));
}
/** Queues a proposal unless the same kind is already waiting for this lead. */
function proposeOnce_(lead, type, payload, c) {
  var waiting = Store.listApprovals().some(function (a) { return a.leadId === lead.id && a.type === type && a.status === 'Pending'; });
  if (waiting) return false;
  addProposal_(CRM.makeProposal(type, lead.id, payload, c.nowLocal, uid_()), lead);
  return true;
}

// ---------- capture ----------
function captureEmails() { return withLock_(capture_); }

function capture_() {
  var c = ctx_(), s = c.settings, started = Date.now();
  var sum = { threads: 0, newLeads: 0, updated: 0, skipped: 0, aiFilled: 0, aiErrors: 0, aiCalls: 0, proposals: 0, labelMissing: false, stoppedEarly: false };
  Store.fillMissingIds();
  var threads = Mail.listLabelThreads(s.gmailLabel, s.maxThreads);
  if (threads === null) { sum.labelMissing = true; return sum; }
  var me = Mail.myAddresses(), seen = Store.seenIds(), leads = Store.listLeads();

  for (var ti = 0; ti < threads.length && !sum.stoppedEarly; ti++) {
    var t = threads[ti];
    sum.threads++;
    for (var mi = 0; mi < t.messages.length; mi++) {
      if (Date.now() - started > RUN_BUDGET_MS) { sum.stoppedEarly = true; break; }
      var m = t.messages[mi];
      if (!m || !m.id || seen[m.id]) continue;
      seen[m.id] = true;
      captureMessage_(t, m, me, leads, c, sum);
    }
  }
  if (s.calendarOn) captureCalendar_(c, leads, seen, sum);
  refreshToday_(c);
  return sum;
}

function captureMessage_(t, m, me, leads, c, sum) {
  var from = CRM.parseSender(m.from);
  var isOut = me.indexOf(from.email) >= 0;
  var other = from;
  if (isOut) {
    other = { name: '', email: '' };
    var to = CRM.parseAddressList(m.to);
    for (var i = 0; i < to.length; i++) if (me.indexOf(to[i].email) < 0) { other = to[i]; break; }
  }
  if (!other.email || CRM.isAutomated(other.email)) {
    Store.logActivity({ kind: 'skipped', detail: 'Automated or unreadable address: ' + CRM.oneLine(isOut ? m.to : m.from, 200), messageId: m.id });
    sum.skipped++;
    return;
  }
  var dir = isOut ? 'out' : 'in';
  var when = isDate_(m.date) ? m.date : c.now;
  var idx = CRM.findLeadByEmail(leads, other.email), lead, prevDir = '';
  if (idx < 0) {
    lead = Store.addLead({
      name: other.name, email: other.email, source: 'Gmail', stage: 'New', threadId: t.id,
      lastContact: when, lastDirection: dir, created: c.now
    });
    leads.push(lead);
    sum.newLeads++;
  } else {
    lead = leads[idx];
    prevDir = String(lead.lastDirection || '').trim().toLowerCase();
    var ch = {};
    if (!isDate_(lead.lastContact) || when.getTime() > lead.lastContact.getTime()) { ch.lastContact = when; ch.lastDirection = dir; }
    if (!String(lead.threadId || '').trim()) ch.threadId = t.id;
    if (Object.keys(ch).length) {
      Store.updateLead(lead.id, ch);
      for (var k in ch) lead[k] = ch[k];
      sum.updated++;
    }
  }
  Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'email ' + dir, detail: CRM.oneLine(m.subject, 200), messageId: m.id });

  if (!isOut && c.settings.aiOn && sum.aiCalls < c.settings.aiCallsPerRun) aiFill_(lead, m, c, sum);

  // A plain rule, no AI: they wrote, you answered, the lead is still "New". Offer to move it to "Talking".
  if (isOut && prevDir === 'in' && CRM.normalizeStage(lead.stage) === 'New') {
    if (proposeOnce_(lead, 'stage_change', { stage: 'Talking', reason: 'You replied to them' }, c)) sum.proposals++;
  }
}

/** AI extraction for one inbound email. Fills empty fields only. A failure is logged and capture carries on. */
function aiFill_(lead, m, c, sum) {
  sum.aiCalls++;
  try {
    var text = Ai.complete(CRM.buildExtractionPrompt({ from: m.from, subject: m.subject, body: m.body }), c.settings);
    var r = CRM.parseExtraction(text);
    if (!r.ok) throw new Error('unusable answer: ' + r.error);
    if (!r.data.isLead) {
      Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'ai note', detail: 'The AI thinks this email is not from a lead. Nothing was changed.' });
      return;
    }
    var ch = CRM.fillBlanks(lead, r.data);
    var keys = Object.keys(ch);
    if (!keys.length) return;
    Store.updateLead(lead.id, ch);
    keys.forEach(function (k) { lead[k] = ch[k]; });
    sum.aiFilled++;
    Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'ai filled', detail: 'Filled empty fields: ' + keys.join(', ') });
  } catch (e) {
    sum.aiErrors++;
    Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'ai error', detail: CRM.oneLine(e && e.message, 200) + ' The lead was still captured.' });
  }
}

/** Optional. A lead is a guest on an upcoming event: propose it as the next step. Never applied directly. */
function captureCalendar_(c, leads, seen, sum) {
  var events;
  try { events = Cal.upcoming(14); } catch (e) {
    Store.logActivity({ kind: 'calendar error', detail: 'Calendar capture is on but the calendar could not be read: ' + CRM.oneLine(e && e.message, 160) + ' See SETUP.md.' });
    return;
  }
  events.forEach(function (ev) {
    (ev.guests || []).forEach(function (g) {
      var i = CRM.findLeadByEmail(leads, g);
      if (i < 0 || !isDate_(ev.start)) return;
      var lead = leads[i], key = 'cal:' + ev.id + ':' + lead.id;
      if (seen[key]) return;
      seen[key] = true;
      var iso = Utilities.formatDate(ev.start, c.tz, 'yyyy-MM-dd');
      var made = proposeOnce_(lead, 'next_step', { nextStep: 'Meeting: ' + CRM.oneLine(ev.title, 150), nextDate: iso, reason: 'From your calendar' }, c);
      Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'calendar', detail: CRM.oneLine(ev.title, 150) + ' on ' + iso, messageId: key });
      if (made) sum.proposals++;
    });
  });
}

function menuCapture() {
  var r;
  try { r = captureEmails(); } catch (e) { return alert_(e.message); }
  if (r.labelMissing) {
    return alert_('Gmail label "' + Store.getSettings().gmailLabel + '" not found. Create the label in Gmail, add it to a thread, then run Capture emails again.');
  }
  var msg = r.newLeads + ' new, ' + r.updated + ' updated, ' + r.skipped + ' skipped.';
  if (r.aiErrors) msg += ' The AI failed ' + r.aiErrors + ' time(s); those leads were still captured.';
  if (r.proposals) msg += ' ' + r.proposals + ' suggestion(s) are waiting in Approvals.';
  if (r.stoppedEarly) msg += ' Stopped early to stay inside the time limit. Run it again for the rest.';
  toast_(msg);
  return r;
}

/** Called by the daily trigger. No dialogs here: there is nobody to click them. */
function dailyRun() {
  try { captureEmails(); processApprovals(); } catch (e) { console.error(APP + ' daily run: ' + (e && e.message)); }
}

// ---------- Today ----------
function refreshToday_(c) {
  c = c || ctx_();
  var s = c.settings;
  var leads = Store.listLeads().map(function (l) { return coreLead_(l, c.tz); });
  var items = CRM.todayList(leads, c.nowLocal, { replyDays: s.replyDays, quietTalkingDays: s.quietTalkingDays, quietQuoteDays: s.quietQuoteDays });
  Store.replaceToday(items);
  return items;
}
function refreshToday() {
  return withLock_(function () { Store.fillMissingIds(); return refreshToday_().length; });
}
function menuRefreshToday() {
  var n = refreshToday();
  toast_(n ? n + ' lead(s) need you today. See the Today tab.' : 'Nobody needs you today.');
  return n;
}

// ---------- approvals ----------
function processApprovals() { return withLock_(processApprovals_); }

function processApprovals_() {
  var c = ctx_(), out = { applied: 0, rejected: 0, errors: 0 };
  Store.listApprovals().forEach(function (a) {
    var wasApplied = isDate_(a.applied), wasRejected = /^rejected/i.test(String(a.applied));
    if (wasApplied || wasRejected) {
      // A finished row is on the record. If someone edits its status, put it back.
      var should = wasApplied ? 'Applied' : 'Rejected';
      if (a.status !== should) Store.setApproval(a.id, { status: should });
      return;
    }
    if (a.status === 'Applied' || a.status === 'Rejected') {
      // Only the script writes these two. Typed by hand, they mean nothing: back to Pending.
      Store.setApproval(a.id, { status: 'Pending' });
      return;
    }
    if (a.status === 'Reject') {
      Store.setApproval(a.id, { status: 'Rejected', applied: 'rejected ' + Utilities.formatDate(c.now, c.tz, 'yyyy-MM-dd HH:mm') });
      Store.logActivity({ leadId: a.leadId, lead: a.lead, kind: 'approval rejected', detail: a.id + ': ' + a.description });
      out.rejected++;
      return;
    }
    if (a.status !== 'Approve') return;
    try {
      applyApproval_(a, c);
      Store.setApproval(a.id, { status: 'Applied', applied: new Date() });
      Store.logActivity({ leadId: a.leadId, lead: a.lead, kind: 'approval applied', detail: a.id + ': ' + a.description });
      out.applied++;
    } catch (e) {
      var why = CRM.oneLine(e && e.message, 200);
      Store.setApproval(a.id, { status: 'Error', applied: 'error: ' + why });
      Store.logActivity({ leadId: a.leadId, lead: a.lead, kind: 'approval error', detail: a.id + ': ' + why });
      out.errors++;
    }
  });
  if (out.applied) refreshToday_(c);
  return out;
}

/** Applies ONE approved row. Everything in the row is treated as hostile until CRM.proposalChanges accepts it. */
function applyApproval_(a, c) {
  var payload;
  try { payload = JSON.parse(a.payloadText); } catch (e) { throw new Error('The payload is not valid JSON.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('The payload must be an object.');
  if (CRM.PROPOSAL_TYPES.indexOf(a.type) < 0) throw new Error('Unknown type "' + CRM.oneLine(a.type, 30) + '".');
  var p = { id: a.id, leadId: a.leadId, type: a.type, payload: payload };
  var changes = CRM.proposalChanges(p);
  if (!sameText_(CRM.describeProposal(p), a.description)) {
    throw new Error('"What it will do" no longer matches the payload. Reject this row and ask for a new suggestion.');
  }
  var lead = Store.getLead(a.leadId);
  if (!lead) throw new Error('Lead ' + CRM.oneLine(a.leadId, 20) + ' was not found.');

  if (a.type === 'stage_change') {
    Store.updateLead(lead.id, { stage: changes.stage });
  } else if (a.type === 'next_step') {
    var ch = { nextStep: changes.nextStep };
    if (changes.nextDateISO) ch.nextDate = changes.nextDateISO;
    Store.updateLead(lead.id, ch);
  } else if (a.type === 'note') {
    var old = String(lead.notes || '');
    Store.updateLead(lead.id, { notes: (old ? old + '\n' : '') + Utilities.formatDate(c.now, c.tz, 'yyyy-MM-dd') + ': ' + changes.noteAppend });
  } else if (a.type === 'reply_draft') {
    var to = String(lead.email || '').trim().toLowerCase();
    if (!CRM.isEmail(to)) throw new Error('The lead has no valid email address.');
    // The recipient always comes from the Leads row, never from the AI or the payload.
    Mail.createDraft({ threadId: lead.threadId, to: to, subject: changes.subject || 'Following up', body: changes.draftText });
    Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'draft saved', detail: 'Saved as a Gmail draft. Nothing was sent.' });
  }
}

/** Installable trigger: runs when a cell is edited. Only the Approvals tab matters. */
function onApprovalEdit(e) {
  try {
    if (e && e.range && e.range.getSheet().getName() !== SHEETS.approvals) return;
    processApprovals();
  } catch (err) { console.error(APP + ' approvals: ' + (err && err.message)); }
}
function menuApplyApprovals() {
  var r;
  try { r = processApprovals(); } catch (e) { return alert_(e.message); }
  toast_(r.applied + ' applied, ' + r.rejected + ' rejected' + (r.errors ? ', ' + r.errors + ' with an error (see the Applied column).' : '.'));
  return r;
}

// ---------- AI: suggest next move ----------
function suggestFor_(lead, c) {
  var me = Mail.myAddresses(), messages = [];
  var t = String(lead.threadId || '').trim() ? Mail.getThread(lead.threadId) : null;
  if (t) {
    messages = t.messages.map(function (m) {
      return {
        dir: me.indexOf(CRM.parseSender(m.from).email) >= 0 ? 'out' : 'in',
        date: isDate_(m.date) ? Utilities.formatDate(m.date, c.tz, 'yyyy-MM-dd') : '',
        text: m.body
      };
    });
  }
  var text = Ai.complete(CRM.buildSuggestionPrompt({ myName: c.settings.myName, leadName: lead.name, stage: lead.stage, messages: messages }), c.settings);
  var r = CRM.parseSuggestion(text);
  if (!r.ok) throw new Error('unusable answer: ' + r.error);
  var props = CRM.suggestionToProposals(r.data, lead, c.nowLocal, uid_() + '-');
  props.forEach(function (p) { addProposal_(p, lead); });
  Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'ai suggestion', detail: props.length + ' suggestion(s) queued for approval' });
  return props.length;
}
function suggestNextMove() {
  var lead = Store.activeLead();
  if (!lead || !String(lead.id || '').trim()) return alert_('Select a lead row in the Leads tab first. (New rows get an ID when you run Refresh Today.)');
  var c = ctx_();
  if (!c.settings.aiOn) return alert_('AI is off. Set "AI on" to TRUE in the Settings tab and save a key with CRM > Set AI key.');
  var n;
  try { n = withLock_(function () { return suggestFor_(lead, c); }); }
  catch (e) { return alert_('The AI did not give a usable answer (' + e.message + '). Nothing was changed.'); }
  alert_(n ? n + ' suggestion(s) for ' + lead.name + ' are waiting in the Approvals tab. Nothing changes until you approve.'
    : 'The AI had nothing to suggest for ' + lead.name + '.');
  return n;
}

// ---------- proposal docs ----------
function proposalFields_(lead, c) {
  var name = CRM.oneLine(lead.name, 120);
  var nd = readDay_(lead.nextDate, c.tz);
  return {
    name: name, first_name: name.split(' ')[0], email: CRM.oneLine(lead.email, 200), company: CRM.oneLine(lead.company, 120),
    wants: CRM.clean(lead.wants, 300), budget: CRM.oneLine(lead.budget, 80), deadline: CRM.oneLine(lead.deadline, 80),
    value: CRM.oneLine(lead.value, 40), stage: CRM.normalizeStage(lead.stage), next_step: CRM.oneLine(lead.nextStep, 200),
    next_date: nd ? CRM.toISODate(nd) : '', today: Utilities.formatDate(c.now, c.tz, 'd MMM yyyy'), my_name: c.settings.myName
  };
}
function createProposalDoc() {
  var lead = Store.activeLead();
  if (!lead) return alert_('Select a lead row in the Leads tab first.');
  var c = ctx_(), s = c.settings;
  var templateId = Docs.idFromLink(s.proposalTemplate);
  if (!templateId) {
    var t;
    try { t = Docs.starterTemplate(); } catch (e) { return alert_('The starter template could not be made: ' + e.message); }
    Store.setSetting('Proposal template', t.getUrl());
    return alert_('There was no template yet, so a starter one was made:\n' + t.getUrl() + '\n\nEdit it to look like your proposals, then run this again.');
  }
  var fields = proposalFields_(lead, c);
  var res;
  try { res = Docs.create(templateId, 'Proposal - ' + fields.name + ' - ' + fields.today, fields, s.proposalCopy); }
  catch (e) { return alert_('The proposal could not be made: ' + e.message); }
  Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'proposal doc', detail: res.url });
  alert_('Proposal made:\n' + res.url +
    (res.missing.length ? '\n\nLeft unfilled because the lead has no value for them: ' + res.missing.map(function (k) { return '{{' + k + '}}'; }).join(', ') : ''));
  return res;
}

// ---------- keys and tokens (Script Properties, never the Sheet) ----------
function setAiKey() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(APP, 'Paste your AI API key. It is stored in Script Properties, not in the Sheet. Leave empty and press OK to delete the saved key.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var key = String(r.getResponseText() || '').trim();
  var props = PropertiesService.getScriptProperties();
  if (!key) { props.deleteProperty('AI_KEY'); return alert_('The saved key was deleted.'); }
  props.setProperty('AI_KEY', key);
  var s = Store.getSettings();
  if (!confirm_('Key saved.\n\nTurn AI on now? When AI is on, the text of captured emails is sent to the provider you chose (' + s.aiProvider + '). Read their data terms first.')) {
    return alert_('The key is saved and AI stays ' + (s.aiOn ? 'as it was' : 'off') + '. To change it, set "AI on" in the Settings tab.');
  }
  Store.setSetting('AI on', true);
  // One tiny call, so a wrong key or model name shows up now and not during the next capture.
  try {
    Ai.complete('Answer with the single word OK.', Store.getSettings());
    alert_('AI is on, and ' + s.aiProvider + ' answered a test question. From now on the text of captured emails is sent to that provider.');
  } catch (e) {
    alert_('AI is on, but the test question failed: ' + CRM.oneLine(e && e.message, 200) + '\n\nCheck the key, the provider and the model name ("' + s.aiModel + '") in the Settings tab.');
  }
}
function newToken_(prop, what) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(prop, token);
  alert_('New ' + what + ' token. Copy it now. It is shown once and replaces the old one:\n\n' + token);
  return token;
}
function newIntakeToken() { return newToken_('INTAKE_TOKEN', 'intake'); }
function newApiToken() { return newToken_('API_TOKEN', 'API'); }

// ---------- triggers ----------
function removeTriggers_(names) {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (names.indexOf(t.getHandlerFunction()) >= 0) { ScriptApp.deleteTrigger(t); n++; }
  });
  return n;
}
function automationIsOn_() {
  return ScriptApp.getProjectTriggers().filter(function (t) { return ['dailyRun', 'onApprovalEdit'].indexOf(t.getHandlerFunction()) >= 0; }).length >= 2;
}
function automationOn_() {
  removeTriggers_(['dailyRun', 'onApprovalEdit']);
  var hour = Math.max(0, Math.min(23, Math.floor(Store.getSettings().dailyHour)));
  ScriptApp.newTrigger('dailyRun').timeBased().everyDays(1).atHour(hour).inTimezone(Store.timeZone()).create();
  ScriptApp.newTrigger('onApprovalEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  return hour;
}
function turnOnAutomation() {
  var hour = automationOn_();
  alert_('Automation is on.\n\n1. Capture runs once a day, around ' + hour + ':00.\n2. A row in Approvals is applied as soon as you set its Status to Approve.\n\nBoth run as you. Turn them off with CRM > Turn off automation.');
}
function turnOffAutomation() {
  var n = removeTriggers_(['dailyRun', 'onApprovalEdit']);
  alert_(n ? 'Automation is off. ' + n + ' trigger(s) removed.' : 'Automation was already off.');
}

// ---------- team ----------
function lockDownForTeam() {
  var s = Store.getSettings();
  var approvers = String(s.approvers || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return CRM.isEmail(x); });
  var done;
  try { done = Store.lockDown(approvers); } catch (e) { return alert_('Could not set protections: ' + e.message); }
  alert_('Protected:\n- ' + done.join('\n- ') + '\n\nAnyone with edit access can still change other cells. Give edit access only to people you trust.');
  return done;
}

// ---------- sample data (made-up people) ----------
function addSampleLeads() {
  var c = ctx_();
  var day = function (n) { return new Date(c.now.getTime() - n * 24 * 60 * 60 * 1000); };
  var iso = function (n) { return CRM.addDaysISO(c.nowLocal, n); };
  var rows = [
    { name: 'Meera Joshi', email: 'meera@joshi-studio.example', company: 'Joshi Studio', stage: 'Talking', value: 48000, nextStep: 'Send the quote', nextDate: iso(-2), lastContact: day(1), lastDirection: 'out', wants: '30 second launch film', budget: 'around 50,000', deadline: 'mid December' },
    { name: 'Tobias Lindqvist', email: 'tobias@nordlys-apps.example', company: 'Nordlys Apps', stage: 'New', lastContact: day(2), lastDirection: 'in', wants: 'App store preview video' },
    { name: 'Aiko Tanabe', email: 'aiko@tanabe-tea.example', company: 'Tanabe Tea', stage: 'Quote sent', value: 22000, lastContact: day(6), lastDirection: 'out', wants: 'Six short reels' },
    { name: 'Carlos Mendes', email: 'carlos@mendes-fit.example', company: 'Mendes Fit', stage: 'Talking', nextStep: 'Call about the script', nextDate: iso(0), lastContact: day(1), lastDirection: 'in' },
    { name: 'Farah Siddiqui', email: 'farah@lumen-clinic.example', company: 'Lumen Clinic', stage: 'Won', value: 65000, lastContact: day(9), lastDirection: 'in' },
    { name: 'Daniel Okafor', email: 'daniel@okafor-design.example', company: 'Okafor Design', stage: 'New' }
  ];
  var have = Store.listLeads(), n = 0;
  rows.forEach(function (r) {
    if (CRM.findLeadByEmail(have, r.email) >= 0) return;
    r.source = 'Sample'; r.created = c.now;
    Store.addLead(r); n++;
  });
  refreshToday_(c);
  toast_(n ? n + ' sample leads added. They are made-up people. Delete the rows when you are done.' : 'The sample leads are already there.');
  return n;
}

// ---------- board ----------
function boardData_() {
  var c = ctx_();
  var today = {};
  CRM.todayList(Store.listLeads().map(function (l) { return coreLead_(l, c.tz); }), c.nowLocal, {
    replyDays: c.settings.replyDays, quietTalkingDays: c.settings.quietTalkingDays, quietQuoteDays: c.settings.quietQuoteDays
  }).forEach(function (t) { today[t.id] = t; });
  var leads = Store.listLeads().filter(function (l) { return String(l.id || '').trim(); }).map(function (l) {
    var nd = readDay_(l.nextDate, c.tz);
    return {
      id: String(l.id), name: CRM.oneLine(l.name, 120), company: CRM.oneLine(l.company, 120), stage: CRM.normalizeStage(l.stage),
      nextStep: CRM.oneLine(l.nextStep, 200), nextDate: nd ? CRM.toISODate(nd) : '', value: CRM.oneLine(l.value, 40),
      pipeline: CRM.oneLine(l.pipeline, 60), why: today[l.id] ? today[l.id].reason : '',
      priority: today[l.id] ? String(today[l.id].priority) : ''
    };
  });
  var approvals = Store.listApprovals().filter(function (a) { return a.status === 'Pending'; }).map(function (a) {
    return { id: a.id, lead: CRM.oneLine(a.lead, 120), type: a.type, description: CRM.clean(a.description, 300) };
  });
  return { app: APP, stages: CRM.STAGES, leads: leads, approvals: approvals, generated: Utilities.formatDate(c.now, c.tz, 'yyyy-MM-dd HH:mm') };
}
function boardData() { requirePageUser_(); return boardData_(); }

/** A person moved a card. That is a click, so it is applied directly, and logged. */
function boardMove(leadId, stage) {
  requirePageUser_();
  var want = String(stage || '');
  if (CRM.STAGES.indexOf(want) < 0) throw new Error('Unknown stage.');
  return withLock_(function () {
    var lead = Store.getLead(leadId);
    if (!lead) throw new Error('Lead not found.');
    if (CRM.normalizeStage(lead.stage) !== want) {
      Store.updateLead(lead.id, { stage: want });
      Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'stage set on board', detail: CRM.normalizeStage(lead.stage) + ' to ' + want });
      refreshToday_();
    }
    return boardData_();
  });
}
function boardDecide(approvalId, decision) {
  requirePageUser_();
  if (decision !== 'Approve' && decision !== 'Reject') throw new Error('Unknown decision.');
  if (!Store.setApproval(String(approvalId), { status: decision })) throw new Error('That suggestion was not found.');
  var r = processApprovals();
  var data = boardData_();
  data.result = r;
  return data;
}

function showBoard() {
  var html = HtmlService.createHtmlOutputFromFile('Board').setWidth(1100).setHeight(680);
  SpreadsheetApp.getUi().showModelessDialog(html, APP + ' board');
}

/** True only for a signed-in person who is the account the script runs as, or an editor of this Sheet. */
function boardAllowed_() {
  var active = '', effective = '';
  try { active = String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { active = ''; }
  try { effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { effective = ''; }
  if (!active) return false;
  if (active === effective) return true;
  try {
    return SpreadsheetApp.getActiveSpreadsheet().getEditors().some(function (u) { return String(u.getEmail()).toLowerCase() === active; });
  } catch (e) { return false; }
}
/** Every function a page can call checks the same rule as the page itself, in case a page is ever served by mistake. */
function requirePageUser_() {
  if (!boardAllowed_()) throw new Error('Not allowed.');
}

/**
 * Web app entry for the phone app and the board (on a phone the Sheets app has no script menus).
 * Anyone who is not allowed gets plain text, never a page. See SECURITY.md.
 */
function doGet(e) {
  if (!boardAllowed_()) {
    return ContentService.createTextOutput('Finalsay. Nothing to see here.').setMimeType(ContentService.MimeType.TEXT);
  }
  // The phone app is the default. Add ?view=board to the address for the wide board.
  var file = e && e.parameter && e.parameter.view === 'board' ? 'Board' : 'App';
  return HtmlService.createHtmlOutputFromFile(file).setTitle(APP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes');
}

// ---------- phone app (App.html): for iPhone and Android browsers ----------
function appData_() {
  var c = ctx_(), d = boardData_(), byId = {};
  Store.listLeads().forEach(function (l) { byId[String(l.id)] = l; });
  d.leads.forEach(function (x) {
    var l = byId[x.id] || {};
    x.email = CRM.oneLine(l.email, 200); x.phone = CRM.oneLine(l.phone, 40);
    x.wants = CRM.clean(l.wants, 300); x.budget = CRM.oneLine(l.budget, 80); x.deadline = CRM.oneLine(l.deadline, 80);
    x.notes = CRM.clean(l.notes, 2000);
    x.lastContact = isDate_(l.lastContact) ? Utilities.formatDate(l.lastContact, c.tz, 'yyyy-MM-dd') : '';
    x.lastDirection = String(l.lastDirection || '');
  });
  d.aiOn = !!c.settings.aiOn;
  return d;
}
function appData() { requirePageUser_(); return appData_(); }

/** A person typed a new lead on their phone. Validated like any other outside text. */
function appAddLead(f) {
  requirePageUser_();
  f = f || {};
  var name = CRM.oneLine(f.name, 120), email = CRM.oneLine(f.email, 200).toLowerCase();
  var phone = CRM.oneLine(f.phone, 40).replace(/[^0-9+() .\-]/g, ''), nd = CRM.oneLine(f.nextDate, 10);
  if (!name && !email) throw new Error('Type a name or an email.');
  if (email && !CRM.isEmail(email)) throw new Error('That email address does not look right.');
  if (nd && !CRM.isoToLocalDate(nd)) throw new Error('The date must be a real date.');
  return withLock_(function () {
    var c = ctx_();
    if (email && CRM.findLeadByEmail(Store.listLeads(), email) >= 0) throw new Error('A lead with that email already exists.');
    if (phone) Store.ensureLeadColumn('Phone');
    var lead = Store.addLead({
      name: name || CRM.parseSender(email).name, email: email, phone: phone, company: CRM.oneLine(f.company, 120),
      source: 'Phone app', stage: 'New', wants: CRM.oneLine(f.wants, 300), nextStep: CRM.oneLine(f.nextStep, 200), nextDate: nd, created: c.now
    });
    Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'lead added in app', detail: CRM.oneLine(f.wants, 200) });
    refreshToday_(c);
    return appData_();
  });
}

/** A person edited a lead on their phone. That is a click, so it is applied directly, validated and logged. */
function appUpdateLead(id, ch) {
  requirePageUser_();
  ch = ch || {};
  var out = {};
  if (ch.stage !== undefined) {
    if (CRM.STAGES.indexOf(String(ch.stage)) < 0) throw new Error('Unknown stage.');
    out.stage = String(ch.stage);
  }
  if (ch.nextStep !== undefined) out.nextStep = CRM.oneLine(ch.nextStep, 200);
  if (ch.nextDate !== undefined) {
    var nd = CRM.oneLine(ch.nextDate, 10);
    if (nd && !CRM.isoToLocalDate(nd)) throw new Error('The date must be a real date.');
    out.nextDate = nd;
  }
  var note = CRM.clean(ch.note, 1000);
  return withLock_(function () {
    var c = ctx_(), lead = Store.getLead(id);
    if (!lead) throw new Error('Lead not found.');
    // Only what really changed is written and logged.
    if (out.stage !== undefined && out.stage === CRM.normalizeStage(lead.stage)) delete out.stage;
    if (out.nextStep !== undefined && out.nextStep === CRM.oneLine(lead.nextStep, 200)) delete out.nextStep;
    if (out.nextDate !== undefined) {
      var cur = readDay_(lead.nextDate, c.tz);
      if (out.nextDate === (cur ? CRM.toISODate(cur) : '')) delete out.nextDate;
    }
    if (note) out.notes = (lead.notes ? lead.notes + '\n' : '') + Utilities.formatDate(c.now, c.tz, 'yyyy-MM-dd') + ': ' + note;
    var keys = Object.keys(out);
    if (keys.length) {
      Store.updateLead(lead.id, out);
      Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'edited in app', detail: keys.join(', ') });
      refreshToday_(c);
    }
    return appData_();
  });
}

/** Asks the AI for a next move. The answer is queued for approval, exactly as from the Sheet menu. */
function appSuggest(id) {
  requirePageUser_();
  var lead = Store.getLead(id);
  if (!lead) throw new Error('Lead not found.');
  var c = ctx_();
  if (!c.settings.aiOn) throw new Error('AI is off. Set "AI on" to TRUE in the Settings tab of the Sheet.');
  var n = withLock_(function () { return suggestFor_(lead, c); });
  var d = appData_();
  d.queued = n;
  return d;
}
function appCapture() {
  requirePageUser_();
  var r = captureEmails();
  var d = appData_();
  d.capture = r;
  return d;
}
function showApp() {
  SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutputFromFile('App').setWidth(420).setHeight(760), APP + ' phone app');
}
