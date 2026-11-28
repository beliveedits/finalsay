/**
 * Finalsay: Store.gs. The storage adapter.
 *
 * Everything else in the project reads and writes data through `Store`, never through
 * SpreadsheetApp directly. A bigger deployment can replace this one file with a database-backed
 * object that has the same methods (see ARCHITECTURE.md, "Storage adapter").
 *
 * The interface every adapter must provide:
 *   init()                              create whatever is missing; safe to run twice
 *   listLeads() -> Lead[]               every lead, in sheet order
 *   getLead(id) -> Lead|null
 *   addLead(fields) -> Lead             assigns the ID
 *   fillMissingIds() -> number          gives an ID to rows typed by hand
 *   updateLead(id, changes) -> boolean  writes only the fields given
 *   logActivity(entry)                  append-only
 *   seenIds() -> {id: true}             message ids already processed
 *   listApprovals() -> Approval[]
 *   addApproval(proposal, leadName, description)
 *   setApproval(id, fields)             status, applied, description
 *   replaceToday(items)
 *   getSettings() -> object             with defaults filled in
 *   setSetting(label, value)
 *   timeZone() -> string                IANA name used for all day arithmetic
 *
 * Rules this adapter keeps:
 *   - Columns are found by header text, so users can add, hide and reorder columns.
 *   - A lead update writes single cells, never a whole row, so formulas in other columns survive.
 *   - Every string from outside goes through CRM.safeCell so it can never become a formula.
 */
var SHEETS = { leads: 'Leads', today: 'Today', approvals: 'Approvals', activity: 'Activity', settings: 'Settings' };
/** Made the first time the self-check runs. It holds the latest report only. */
var SELF_CHECK_TAB = 'Self-check';
var SELF_CHECK_HEADERS = ['Check', 'Result', 'Detail', 'When'];

var LEAD_COLUMNS = [
  ['ID', 'id'], ['Name', 'name'], ['Email', 'email'], ['Company', 'company'], ['Source', 'source'],
  ['Stage', 'stage'], ['Value', 'value'], ['Next Step', 'nextStep'], ['Next Date', 'nextDate'],
  ['Last Contact', 'lastContact'], ['Last Direction', 'lastDirection'], ['Wants', 'wants'],
  ['Budget', 'budget'], ['Deadline', 'deadline'], ['Thread ID', 'threadId'], ['Notes', 'notes'], ['Created', 'created']
];
// Optional columns. If a header with this text exists, the field is read and written. Setup does not add them.
var LEAD_OPTIONAL = [['Phone', 'phone'], ['Pipeline', 'pipeline']];
var SIMPLE_VISIBLE = ['Name', 'Email', 'Stage', 'Next Step', 'Next Date'];

var APPROVAL_HEADERS = ['ID', 'Created', 'Lead ID', 'Lead', 'Type', 'What it will do', 'Payload', 'Status', 'Applied'];
var APPROVAL_STATUSES = ['Pending', 'Approve', 'Reject', 'Applied', 'Rejected', 'Error'];
var ACTIVITY_HEADERS = ['When', 'Lead ID', 'Lead', 'Kind', 'Detail', 'Message ID', 'By'];
var TODAY_HEADERS = ['Priority', 'Lead', 'Stage', 'Why', 'Next step', 'Lead ID'];

// label, key used in code, default, help text shown in the Settings tab
var SETTINGS = [
  ['Mode', 'mode', 'Simple', 'Simple shows five columns in Leads. Pro shows all of them. Change with CRM > Switch Simple / Pro.'],
  ['Your name', 'myName', '', 'Used when the AI drafts a reply and in proposal docs.'],
  ['Gmail label', 'gmailLabel', 'CRM', 'Threads with this label are captured. Nothing else in your mailbox is read.'],
  ['Threads per run', 'maxThreads', 30, 'How many labelled threads one capture run looks at.'],
  ['AI on', 'aiOn', false, 'TRUE sends the text of captured emails to the provider below. Read their data terms first.'],
  ['AI provider', 'aiProvider', 'gemini', 'gemini or openai-compatible.'],
  ['AI model', 'aiModel', 'gemini-3.5-flash-lite', 'Model names change. Check the provider\'s current list before relying on this default.'],
  ['AI base URL', 'aiBaseUrl', 'https://api.openai.com/v1', 'Only for openai-compatible. Must start with https://'],
  ['AI calls per run', 'aiCallsPerRun', 20, 'Stops one capture run from using up your daily quota.'],
  ['Reply days', 'replyDays', 1, 'They wrote and you have not answered for this many days: show on Today.'],
  ['Quiet days (Talking)', 'quietTalkingDays', 5, 'You wrote last, stage Talking, no answer for this many days: show on Today.'],
  ['Quiet days (Quote sent)', 'quietQuoteDays', 4, 'Quote sent, no answer for this many days: show on Today.'],
  ['Daily run hour', 'dailyHour', 8, 'Hour of the day (0 to 23, spreadsheet time zone) for the daily capture.'],
  ['Proposal template', 'proposalTemplate', '', 'Link to a Google Doc with {{placeholders}}. Leave empty and a starter template is made for you.'],
  ['Proposal copy method', 'proposalCopy', 'docs-only', 'docs-only needs no Drive permission. drive-copy keeps headers and page setup but needs the Drive scope (see SETUP.md).'],
  ['Calendar capture', 'calendarOn', false, 'TRUE proposes a next step when a lead is a guest on an upcoming event. Needs the calendar scope (see SETUP.md).'],
  ['Intake per minute', 'intakePerMinute', 10, 'Most form posts accepted in one minute.'],
  ['Intake per day', 'intakePerDay', 300, 'Most form posts accepted in one day.'],
  ['Approvers', 'approvers', '', 'Team use: comma-separated emails allowed to change the Status column after CRM > Lock down for a team.']
];

var SheetStore = (function () {
  function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
  function sheet_(name) {
    var sh = ss_().getSheetByName(name);
    if (!sh) throw new Error('The "' + name + '" tab is missing. Run CRM > Set up.');
    return sh;
  }
  function headers_(sh) {
    var n = sh.getLastColumn();
    if (n < 1) return [];
    return sh.getRange(1, 1, 1, n).getValues()[0].map(function (h) { return String(h).trim(); });
  }
  function rows_(sh) {
    var last = sh.getLastRow(), n = sh.getLastColumn();
    if (last < 2 || n < 1) return [];
    return sh.getRange(2, 1, last - 1, n).getValues();
  }
  function safeRow_(row) { return row.map(function (v) { return CRM.safeCell(v); }); }

  // ---------- setup ----------
  function ensureSheet_(name, headers) {
    var ss = ss_(), sh = ss.getSheetByName(name), created = false;
    if (!sh) {
      try { sh = ss.insertSheet(name); created = true; }
      catch (e) {
        // Two runs at once (Set up pressed twice) can both find no such tab and both try to make it. Google then tells the
        // slower one that the name is taken. The tab is there, so use it. Any other error is real and is passed on.
        sh = ss.getSheetByName(name);
        if (!sh) throw e;
      }
    }
    var have = headers_(sh);
    headers.forEach(function (h) {
      if (have.indexOf(h) < 0) { have.push(h); sh.getRange(1, have.length).setValue(h); }
    });
    sh.setFrozenRows(1);
    try { sh.getRange(1, 1, 1, have.length).setFontWeight('bold'); } catch (e) { /* cosmetic */ }
    return { sheet: sh, created: created };
  }

  function listValidation_(sh, header, values) {
    var col = headers_(sh).indexOf(header) + 1;
    if (col < 1) return;
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true).build();
    sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  }

  function init() {
    var made = [];
    var leads = ensureSheet_(SHEETS.leads, LEAD_COLUMNS.map(function (c) { return c[0]; }));
    if (leads.created) made.push(SHEETS.leads);
    listValidation_(leads.sheet, 'Stage', CRM.STAGES);
    var h = headers_(leads.sheet);
    // Next Date is kept as text (YYYY-MM-DD) so no time zone can move it to another day.
    var nd = h.indexOf('Next Date') + 1;
    if (nd > 0) leads.sheet.getRange(2, nd, Math.max(leads.sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');

    if (ensureSheet_(SHEETS.today, TODAY_HEADERS).created) made.push(SHEETS.today);
    var ap = ensureSheet_(SHEETS.approvals, APPROVAL_HEADERS);
    if (ap.created) made.push(SHEETS.approvals);
    listValidation_(ap.sheet, 'Status', APPROVAL_STATUSES);
    approvalColours_(ap.sheet);
    if (ensureSheet_(SHEETS.activity, ACTIVITY_HEADERS).created) made.push(SHEETS.activity);

    var st = ensureSheet_(SHEETS.settings, ['Setting', 'Value', 'What it does']);
    if (st.created) made.push(SHEETS.settings);
    var have = rows_(st.sheet).map(function (r) { return String(r[0]).trim(); });
    SETTINGS.forEach(function (s) {
      if (have.indexOf(s[0]) < 0) st.sheet.appendRow([s[0], s[2], s[3]]);
    });
    return { created: made };
  }

  // Pencil and ink in the Approvals tab: waiting rows are tinted, applied rows are bold ink, rejected rows are struck out.
  function approvalColours_(sh) {
    try {
      var col = headers_(sh).indexOf('Status') + 1;
      var range = sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1);
      var mk = function (text) { return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setRanges([range]); };
      sh.setConditionalFormatRules([
        mk('Pending').setBackground('#E9ECFB').build(),
        mk('Applied').setFontColor('#2438C8').setBold(true).build(),
        mk('Rejected').setFontColor('#5A6070').setStrikethrough(true).build(),
        mk('Error').setFontColor('#B4311A').setBold(true).build()
      ]);
    } catch (e) { /* cosmetic only */ }
  }

  // ---------- leads ----------
  function leadKeyMap_(headers) {
    var map = {};
    LEAD_COLUMNS.concat(LEAD_OPTIONAL).forEach(function (c) {
      var i = headers.indexOf(c[0]);
      if (i >= 0) map[c[1]] = i;
    });
    return map;
  }

  function listLeads() {
    var sh = sheet_(SHEETS.leads), map = leadKeyMap_(headers_(sh));
    return rows_(sh).map(function (r, i) {
      var lead = { _row: i + 2 };
      for (var k in map) lead[k] = r[map[k]];
      return lead;
    }).filter(function (l) { return String(l.id || '').trim() !== '' || String(l.email || '').trim() !== '' || String(l.name || '').trim() !== ''; });
  }

  function getLead(id) {
    var want = String(id || '').trim();
    if (!want) return null;
    var all = listLeads();
    for (var i = 0; i < all.length; i++) if (String(all[i].id).trim() === want) return all[i];
    return null;
  }

  function nextLeadId_(leads) {
    var max = 0;
    leads.forEach(function (l) {
      var m = String(l.id || '').match(/^L-(\d+)$/);
      if (m) max = Math.max(max, +m[1]);
    });
    var n = String(max + 1);
    while (n.length < 4) n = '0' + n;
    return 'L-' + n;
  }

  /** Rows people typed by hand have no ID yet. Give them one, a Created date and a stage. */
  function fillMissingIds() {
    var all = listLeads(), n = 0;
    var sh = sheet_(SHEETS.leads), map = leadKeyMap_(headers_(sh));
    if (map.id === undefined) return 0;
    all.forEach(function (l) {
      if (String(l.id || '').trim()) return;
      l.id = nextLeadId_(all);
      sh.getRange(l._row, map.id + 1).setValue(l.id);
      if (map.created !== undefined && !l.created) sh.getRange(l._row, map.created + 1).setValue(new Date());
      if (map.stage !== undefined && !String(l.stage || '').trim()) sh.getRange(l._row, map.stage + 1).setValue('New');
      n++;
    });
    return n;
  }

  function addLead(fields) {
    var sh = sheet_(SHEETS.leads), headers = headers_(sh), map = leadKeyMap_(headers);
    var lead = {};
    for (var k in fields) lead[k] = fields[k];
    lead.id = nextLeadId_(listLeads());
    if (!lead.stage) lead.stage = 'New';
    var row = headers.map(function () { return ''; });
    for (var key in map) if (lead[key] !== undefined && lead[key] !== null) row[map[key]] = lead[key];
    sh.appendRow(safeRow_(row));
    lead._row = sh.getLastRow();
    return lead;
  }

  function updateLead(id, changes) {
    var lead = getLead(id);
    if (!lead) return false;
    var sh = sheet_(SHEETS.leads), map = leadKeyMap_(headers_(sh));
    for (var k in changes) {
      if (map[k] === undefined) continue; // the column was removed by the user: skip, never guess
      sh.getRange(lead._row, map[k] + 1).setValue(CRM.safeCell(changes[k]));
    }
    return true;
  }

  // ---------- activity (append-only) ----------
  function logActivity(e) {
    var by = '';
    try { by = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail(); } catch (err) { by = ''; }
    sheet_(SHEETS.activity).appendRow(safeRow_([
      new Date(), e.leadId || '', CRM.oneLine(e.lead, 120), CRM.oneLine(e.kind, 40),
      CRM.clean(e.detail, 500), e.messageId || '', by
    ]));
  }

  function seenIds() {
    var sh = sheet_(SHEETS.activity), col = headers_(sh).indexOf('Message ID');
    var seen = {};
    if (col < 0) return seen;
    rows_(sh).forEach(function (r) { var id = String(r[col] || '').trim(); if (id) seen[id] = true; });
    return seen;
  }

  // ---------- approvals ----------
  function listApprovals() {
    var sh = sheet_(SHEETS.approvals), h = headers_(sh);
    var ix = function (name) { return h.indexOf(name); };
    return rows_(sh).map(function (r, i) {
      return {
        _row: i + 2, id: String(r[ix('ID')] || '').trim(), created: r[ix('Created')], leadId: String(r[ix('Lead ID')] || '').trim(),
        lead: r[ix('Lead')], type: String(r[ix('Type')] || '').trim(), description: String(r[ix('What it will do')] || ''),
        payloadText: String(r[ix('Payload')] || ''), status: String(r[ix('Status')] || '').trim(), applied: r[ix('Applied')]
      };
    }).filter(function (a) { return a.id; });
  }

  function addApproval(p, leadName, description) {
    var sh = sheet_(SHEETS.approvals), h = headers_(sh);
    var row = h.map(function () { return ''; });
    var put = function (name, v) { var i = h.indexOf(name); if (i >= 0) row[i] = v; };
    put('ID', p.id); put('Created', new Date()); put('Lead ID', p.leadId); put('Lead', CRM.oneLine(leadName, 120));
    put('Type', p.type); put('What it will do', description); put('Payload', JSON.stringify(p.payload || {}));
    put('Status', 'Pending'); put('Applied', '');
    sh.appendRow(safeRow_(row));
  }

  function setApproval(id, fields) {
    var all = listApprovals(), sh = sheet_(SHEETS.approvals), h = headers_(sh);
    for (var i = 0; i < all.length; i++) {
      if (all[i].id !== id) continue;
      var names = { status: 'Status', applied: 'Applied', description: 'What it will do' };
      for (var k in fields) {
        var col = h.indexOf(names[k]);
        if (col >= 0) sh.getRange(all[i]._row, col + 1).setValue(CRM.safeCell(fields[k]));
      }
      return true;
    }
    return false;
  }

  // ---------- today (generated) ----------
  function replaceToday(items) {
    var sh = sheet_(SHEETS.today);
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), TODAY_HEADERS.length)).clearContent();
    if (!items.length) return;
    var rows = items.map(function (it) {
      return safeRow_([it.priority, CRM.oneLine(it.name, 120), it.stage, it.reason, it.nextStep || '', it.id]);
    });
    sh.getRange(2, 1, rows.length, TODAY_HEADERS.length).setValues(rows);
  }

  // ---------- settings ----------
  function coerce_(value, def) {
    if (typeof def === 'boolean') return value === true || String(value).trim().toLowerCase() === 'true';
    if (typeof def === 'number') { var n = Number(value); return isFinite(n) && String(value).trim() !== '' ? n : def; }
    return String(value === null || value === undefined ? '' : value).trim();
  }
  function getSettings() {
    var out = {}, byLabel = {};
    SETTINGS.forEach(function (s) { out[s[1]] = s[2]; byLabel[s[0]] = s; });
    var sh = ss_().getSheetByName(SHEETS.settings);
    if (!sh) return out;
    rows_(sh).forEach(function (r) {
      var s = byLabel[String(r[0]).trim()];
      if (s) out[s[1]] = coerce_(r[1], s[2]);
    });
    return out;
  }
  function setSetting(label, value) {
    var sh = sheet_(SHEETS.settings), rows = rows_(sh);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === label) { sh.getRange(i + 2, 2).setValue(CRM.safeCell(value)); return; }
    }
    sh.appendRow(safeRow_([label, value, '']));
  }

  function timeZone() { return ss_().getSpreadsheetTimeZone(); }

  /** Adds an optional Leads column (such as Phone) at the end if it is not there yet. */
  function ensureLeadColumn(header) {
    var sh = sheet_(SHEETS.leads), h = headers_(sh);
    if (h.indexOf(header) >= 0) return false;
    sh.getRange(1, h.length + 1).setValue(header);
    return true;
  }

  // ---------- view helpers used by Code.gs (Sheets only; another adapter may make these no-ops) ----------
  function applyMode(mode) {
    var sh = sheet_(SHEETS.leads), h = headers_(sh);
    h.forEach(function (name, i) {
      var hide = mode === 'Simple' && SIMPLE_VISIBLE.indexOf(name) < 0;
      if (hide) sh.hideColumns(i + 1); else sh.showColumns(i + 1);
    });
  }

  /** Team use. Soft protection on generated and log tabs, hard protection on Settings and the Status column. */
  function lockDown(approvers) {
    var me = Session.getEffectiveUser().getEmail();
    var done = [];
    [SHEETS.activity, SHEETS.today].forEach(function (name) {
      sheet_(name).protect().setDescription('Finalsay: written by the script. Edit only if you know why.').setWarningOnly(true);
      done.push(name + ' (warning)');
    });
    var hard = function (protection, who) {
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
      protection.addEditors([me].concat(who));
    };
    hard(sheet_(SHEETS.settings).protect().setDescription('Finalsay: settings. Owner only.'), []);
    done.push(SHEETS.settings + ' (owner only)');
    var ap = sheet_(SHEETS.approvals), col = headers_(ap).indexOf('Status') + 1;
    hard(ap.getRange(2, col, Math.max(ap.getMaxRows() - 1, 1), 1).protect().setDescription('Finalsay: only approvers decide.'), approvers);
    done.push('Approvals Status column (' + [me].concat(approvers).join(', ') + ')');
    return done;
  }

  function activeLead() {
    var ss = ss_(), sh = ss.getActiveSheet();
    if (!sh || sh.getName() !== SHEETS.leads) return null;
    var row = sh.getActiveRange().getRow();
    var all = listLeads();
    for (var i = 0; i < all.length; i++) if (all[i]._row === row) return all[i];
    return null;
  }

  // ---------- self-check ----------
  /** Writes text that looks like a formula through the usual guard, then reads back what the Sheet really kept. */
  function probeFormulaGuard() {
    var sh = ensureSheet_(SELF_CHECK_TAB, SELF_CHECK_HEADERS).sheet, probe = '=1+1';
    var cell = sh.getRange(2, 3);
    cell.setValue(CRM.safeCell(probe));
    var formula = String(cell.getFormula() || ''), value = String(cell.getValue());
    cell.clearContent();
    return { ok: !formula && value === probe, formula: formula, value: value };
  }
  /** Replaces the report in the Self-check tab. rows: [{ check, result, detail }] */
  function replaceSelfCheck(rows) {
    var sh = ensureSheet_(SELF_CHECK_TAB, SELF_CHECK_HEADERS).sheet, last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), SELF_CHECK_HEADERS.length)).clearContent();
    if (!rows.length) return;
    // The time is written as text, so it shows the hour as well as the day whatever the cell format is.
    var now = Utilities.formatDate(new Date(), timeZone(), 'yyyy-MM-dd HH:mm');
    sh.getRange(2, 1, rows.length, SELF_CHECK_HEADERS.length).setValues(rows.map(function (r) {
      return safeRow_([CRM.oneLine(r.check, 120), CRM.oneLine(r.result, 20), CRM.clean(r.detail, 500), now]);
    }));
  }

  return {
    probeFormulaGuard: probeFormulaGuard, replaceSelfCheck: replaceSelfCheck,
    init: init, listLeads: listLeads, getLead: getLead, addLead: addLead, fillMissingIds: fillMissingIds, updateLead: updateLead,
    logActivity: logActivity, seenIds: seenIds, listApprovals: listApprovals, addApproval: addApproval,
    setApproval: setApproval, replaceToday: replaceToday, getSettings: getSettings, setSetting: setSetting,
    timeZone: timeZone, ensureLeadColumn: ensureLeadColumn, applyMode: applyMode, lockDown: lockDown, activeLead: activeLead
  };
})();

/** The adapter in use. To move to a database later, point this at another object with the same methods. */
var Store = SheetStore;
