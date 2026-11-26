/**
 * Finalsay: Intake.gs. The web endpoint (doPost).
 *
 * Two secrets, both in Script Properties:
 *   INTAKE_TOKEN  may do ONE thing: add a lead (action "lead"). Use it for website forms and for
 *                 Meta Lead Ads arriving through a webhook tool. If you put it in browser JavaScript,
 *                 treat it as public: the worst a stranger can do with it is post leads, and those
 *                 are validated, rate limited and screened for spam.
 *   API_TOKEN     may read leads and QUEUE proposals (actions "today", "leads", "approvals", "context",
 *                 "propose"). "context" returns the last messages of one lead's thread, so whoever holds
 *                 this token can read those emails. It can never apply a change. Keep it private.
 *                 Used by the local AI page and the MCP server.
 * No token saved means that part of the endpoint is off.
 *
 * Honest limits: a web app deployed to "Anyone" is reachable by anyone who has the URL, and the token
 * is the only gate. Apps Script cannot read request headers, so the token travels in the body.
 * Apps Script always answers HTTP 200; read "ok" in the JSON.
 */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Compares in a way that does not stop at the first different character. */
function tokenOk_(given, saved) {
  var a = String(given || ''), b = String(saved || '');
  if (!b || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function intakeBody_(e) {
  var body = {};
  var raw = e && e.postData && e.postData.contents;
  if (raw && raw.length > 20000) return null;
  if (raw) {
    try { var parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed; } catch (err) { body = {}; }
  }
  var params = (e && e.parameter) || {};
  for (var k in params) if (body[k] === undefined) body[k] = params[k];
  return body;
}

/** Counts this request. False when the minute or day limit is used up. */
function rateOk_(group, s) {
  var cache = CacheService.getScriptCache(), now = new Date();
  var minuteKey = 'rl:' + group + ':m:' + Math.floor(now.getTime() / 60000);
  var dayKey = 'rl:' + group + ':d:' + Utilities.formatDate(now, 'UTC', 'yyyy-MM-dd');
  var m = Number(cache.get(minuteKey) || 0), d = Number(cache.get(dayKey) || 0);
  if (m >= s.intakePerMinute || d >= s.intakePerDay) return false;
  cache.put(minuteKey, String(m + 1), 120);
  cache.put(dayKey, String(d + 1), 21600); // 6 hours is the longest a cache entry may live; it is renewed on every hit
  return true;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return json_({ ok: false, error: 'busy, try again' });
  try {
    return json_(intake_(e));
  } catch (err) {
    console.error(APP + ' intake: ' + (err && err.message));
    return json_({ ok: false, error: 'server error' });
  } finally {
    lock.releaseLock();
  }
}

function intake_(e) {
  var body = intakeBody_(e);
  if (body === null) return { ok: false, error: 'too large' };
  var action = String(body.action || 'lead');
  var props = PropertiesService.getScriptProperties();
  var s = Store.getSettings();
  var isLead = action === 'lead';
  var saved = props.getProperty(isLead ? 'INTAKE_TOKEN' : 'API_TOKEN');
  if (!saved) return { ok: false, error: 'this endpoint is off' };
  if (!tokenOk_(body.token, saved)) {
    // Wrong tokens are counted on their own, so a stranger guessing tokens cannot use up the allowance of real forms.
    rateOk_('bad', s);
    return { ok: false, error: 'unauthorised' };
  }
  if (!rateOk_(isLead ? 'lead' : 'api', s)) return { ok: false, error: 'rate limited' };

  if (action === 'lead') return intakeLead_(body);
  if (action === 'propose') return intakePropose_(body);
  if (action === 'today') return { ok: true, today: boardTodayList_() };
  if (action === 'leads') return { ok: true, leads: boardData_().leads.slice(0, 500) };
  if (action === 'approvals') return { ok: true, approvals: boardData_().approvals };
  if (action === 'context') return intakeContext_(body);
  return { ok: false, error: 'unknown action' };
}

function boardTodayList_() {
  return boardData_().leads.filter(function (l) { return l.why; }).map(function (l) {
    return { id: l.id, name: l.name, stage: l.stage, why: l.why, nextStep: l.nextStep };
  });
}

function intakeLead_(body) {
  var v = CRM.validateIntake(body);
  if (!v.ok && v.spam) return { ok: true }; // do not tell a bot it was caught
  if (!v.ok) return { ok: false, error: v.error };
  var c = ctx_(), L = v.lead;

  // the same person sending the same text again within 10 minutes is a double click, not a new lead
  var cache = CacheService.getScriptCache();
  var sig = 'dup:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, L.email + '|' + L.message, Utilities.Charset.UTF_8)).slice(0, 40);
  if (cache.get(sig)) return { ok: true, duplicate: true };
  cache.put(sig, '1', 600);

  var leads = Store.listLeads(), i = CRM.findLeadByEmail(leads, L.email);
  if (i >= 0) {
    var lead = leads[i];
    Store.updateLead(lead.id, { lastContact: c.now, lastDirection: 'in' });
    Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'form again', detail: L.source + ': ' + L.wants });
  } else {
    var fields = { name: L.name, email: L.email, company: L.company, source: L.source, stage: 'New', wants: L.wants, lastContact: c.now, lastDirection: 'in', created: c.now, phone: L.phone };
    var notes = [];
    if (L.phone) { Store.ensureLeadColumn('Phone'); notes.push('Phone: ' + L.phone); }
    if (L.message && L.message !== L.wants) notes.push(L.message);
    if (notes.length) fields.notes = notes.join('\n');
    var made = Store.addLead(fields);
    Store.logActivity({ leadId: made.id, lead: made.name, kind: 'form lead', detail: L.source + ': ' + L.wants });
  }
  refreshToday_(c);
  return { ok: true };
}

/**
 * What a local model needs to suggest a next move for one lead: a few lead fields and the last
 * six messages of the thread. This is the only action that returns email text, so it sits behind
 * the private API token. Whoever holds that token can read these emails.
 */
function intakeContext_(body) {
  var lead = Store.getLead(String(body.leadId || ''));
  if (!lead) return { ok: false, error: 'lead not found' };
  var c = ctx_(), me = Mail.myAddresses(), messages = [];
  var t = String(lead.threadId || '').trim() ? Mail.getThread(lead.threadId) : null;
  if (t) {
    messages = t.messages.slice(-6).map(function (m) {
      return {
        dir: me.indexOf(CRM.parseSender(m.from).email) >= 0 ? 'out' : 'in',
        date: isDate_(m.date) ? Utilities.formatDate(m.date, c.tz, 'yyyy-MM-dd') : '',
        text: CRM.clean(m.body, 1500)
      };
    });
  }
  return {
    ok: true,
    lead: { id: String(lead.id), name: CRM.oneLine(lead.name, 120), stage: CRM.normalizeStage(lead.stage), company: CRM.oneLine(lead.company, 120), wants: CRM.clean(lead.wants, 300), nextStep: CRM.oneLine(lead.nextStep, 200) },
    myName: c.settings.myName, today: CRM.toISODate(c.nowLocal), messages: messages
  };
}

/** A proposal from outside (local AI page, MCP). It is validated and QUEUED. It is never applied here. */
function intakePropose_(body) {
  var type = String(body.type || '');
  if (CRM.PROPOSAL_TYPES.indexOf(type) < 0) return { ok: false, error: 'unknown proposal type' };
  var lead = body.leadId ? Store.getLead(String(body.leadId)) : null;
  if (!lead && body.email) {
    var all = Store.listLeads(), i = CRM.findLeadByEmail(all, String(body.email));
    if (i >= 0) lead = all[i];
  }
  if (!lead || !String(lead.id || '').trim()) return { ok: false, error: 'lead not found' };
  var c = ctx_(), p;
  try {
    p = CRM.makeProposal(type, lead.id, CRM.cleanPayload(type, body.payload), c.nowLocal, uid_());
    addProposal_(p, lead);
  } catch (err) {
    return { ok: false, error: 'invalid proposal: ' + CRM.oneLine(err && err.message, 80) };
  }
  Store.logActivity({ leadId: lead.id, lead: lead.name, kind: 'proposed via API', detail: p.id + ': ' + CRM.describeProposal(p) });
  return { ok: true, id: p.id, status: 'Pending', note: 'Queued for a person to approve. Nothing was changed.' };
}
