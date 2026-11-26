/**
 * Finalsay: Mail.gs. The only file that talks to Gmail.
 *
 * NOTHING IN THIS FILE SENDS MAIL. It can read threads that carry your label, make that label if it
 * is missing, and save a draft. A test fails the build if a send call is ever added to any file in src/.
 *
 * Two backends:
 *   'gmailapp' (default)  uses GmailApp. Simple and well known, but Google only offers it with the
 *                         broad scope https://mail.google.com/ whose consent text mentions sending
 *                         and deleting. Finalsay does neither.
 *   'gmailapi'            uses the Gmail advanced service with two narrower scopes
 *                         (gmail.readonly and gmail.compose). Experimental: NOT VERIFIED LIVE.
 *                         To switch, follow "Narrower Gmail permission" in SETUP.md.
 *
 * Every function returns plain objects, so the rest of the code never touches a Gmail class:
 *   Thread  { id, subject, messages: Message[] }      messages oldest first, drafts left out
 *   Message { id, from, to, date: Date, subject, body, rfcId? }
 */
var Mail = (function () {
  function backend_() {
    return PropertiesService.getScriptProperties().getProperty('MAIL_BACKEND') === 'gmailapi' ? 'gmailapi' : 'gmailapp';
  }
  function myAddresses() {
    var out = [];
    try { out.push(Session.getEffectiveUser().getEmail()); } catch (e) { /* no identity in this context */ }
    try {
      if (backend_() === 'gmailapi') {
        (Gmail.Users.Settings.SendAs.list('me').sendAs || []).forEach(function (s) { out.push(s.sendAsEmail); });
      } else {
        GmailApp.getAliases().forEach(function (a) { out.push(a); });
      }
    } catch (e) { /* aliases are optional */ }
    var seen = {};
    return out.map(function (a) { return String(a || '').toLowerCase(); })
      .filter(function (a) { return a && !seen[a] && (seen[a] = true); });
  }

  // ---------- GmailApp backend ----------
  function appMessage_(m) {
    return { id: m.getId(), from: m.getFrom(), to: m.getTo(), date: m.getDate(), subject: m.getSubject(), body: m.getPlainBody() };
  }
  function appThread_(t) {
    var msgs = t.getMessages().filter(function (m) { return !m.isDraft(); }).map(appMessage_);
    return { id: t.getId(), subject: t.getFirstMessageSubject(), messages: msgs };
  }
  function appList_(labelName, max) {
    var label = GmailApp.getUserLabelByName(labelName);
    if (!label) return null;
    return label.getThreads(0, max).map(appThread_);
  }
  function appThreadOrNull_(id) {
    try { return GmailApp.getThreadById(id) || null; } catch (e) { return null; } // a stale or mistyped Thread ID is not an error
  }
  function appGet_(id) {
    var t = appThreadOrNull_(id);
    return t ? appThread_(t) : null;
  }
  function appDraft_(d, me) {
    if (d.threadId) {
      var t = appThreadOrNull_(d.threadId);
      if (t) {
        var msgs = t.getMessages();
        for (var i = msgs.length - 1; i >= 0; i--) {
          var from = CRM.parseSender(msgs[i].getFrom()).email;
          if (!msgs[i].isDraft() && me.indexOf(from) < 0) {
            // reply to the last message THEY wrote, so the draft is addressed to them and not to yourself
            return { id: msgs[i].createDraftReply(d.body).getId(), inThread: true };
          }
        }
      }
    }
    return { id: GmailApp.createDraft(d.to, d.subject, d.body).getId(), inThread: false };
  }

  // ---------- Gmail API backend (advanced service "Gmail", v1) ----------
  function header_(m, name) {
    var hs = (m.payload && m.payload.headers) || [];
    for (var i = 0; i < hs.length; i++) if (String(hs[i].name).toLowerCase() === name.toLowerCase()) return hs[i].value;
    return '';
  }
  function decode_(data) {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
  }
  function plainBody_(part) {
    if (!part) return '';
    if (part.mimeType === 'text/plain' && part.body && part.body.data) return decode_(part.body.data);
    var kids = part.parts || [];
    for (var i = 0; i < kids.length; i++) { var s = plainBody_(kids[i]); if (s) return s; }
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      return decode_(part.body.data).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return '';
  }
  function apiMessage_(m) {
    return {
      id: m.id, from: header_(m, 'From'), to: header_(m, 'To'), date: new Date(Number(m.internalDate)),
      subject: header_(m, 'Subject'), body: plainBody_(m.payload), rfcId: header_(m, 'Message-ID')
    };
  }
  function apiGet_(id) {
    var t;
    try { t = Gmail.Users.Threads.get('me', id, { format: 'full' }); } catch (e) { return null; }
    if (!t) return null;
    var msgs = (t.messages || []).filter(function (m) { return (m.labelIds || []).indexOf('DRAFT') < 0; }).map(apiMessage_);
    return { id: t.id, subject: msgs.length ? msgs[0].subject : '', messages: msgs };
  }
  function apiList_(labelName, max) {
    var labels = Gmail.Users.Labels.list('me').labels || [], id = null;
    labels.forEach(function (l) { if (l.name === labelName) id = l.id; });
    if (!id) return null;
    var res = Gmail.Users.Threads.list('me', { labelIds: [id], maxResults: max });
    return (res.threads || []).map(function (t) { return apiGet_(t.id); }).filter(function (t) { return t; });
  }
  function apiDraft_(d, me) {
    var inReplyTo = '', threadId = '';
    if (d.threadId) {
      var t = apiGet_(d.threadId);
      if (t) {
        for (var i = t.messages.length - 1; i >= 0; i--) {
          if (me.indexOf(CRM.parseSender(t.messages[i].from).email) < 0) { inReplyTo = t.messages[i].rfcId; threadId = t.id; break; }
        }
      }
    }
    var subject = '=?UTF-8?B?' + Utilities.base64Encode(d.subject, Utilities.Charset.UTF_8) + '?=';
    var lines = ['To: ' + d.to, 'Subject: ' + subject, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64'];
    if (inReplyTo) { lines.push('In-Reply-To: ' + CRM.oneLine(inReplyTo, 300)); lines.push('References: ' + CRM.oneLine(inReplyTo, 300)); }
    var raw = lines.join('\r\n') + '\r\n\r\n' + Utilities.base64Encode(d.body, Utilities.Charset.UTF_8);
    var message = { raw: Utilities.base64EncodeWebSafe(raw, Utilities.Charset.UTF_8) };
    if (threadId) message.threadId = threadId;
    var res = Gmail.Users.Drafts.create({ message: message }, 'me');
    return { id: res.id, inThread: !!threadId };
  }

  // ---------- the adapter the rest of the code uses ----------
  /** Threads carrying the label, newest first. Returns null when the label does not exist. */
  function listLabelThreads(labelName, max) {
    var n = Math.max(1, Math.min(100, Number(max) || 30));
    return backend_() === 'gmailapi' ? apiList_(labelName, n) : appList_(labelName, n);
  }
  function getThread(id) {
    if (!id) return null;
    return backend_() === 'gmailapi' ? apiGet_(String(id)) : appGet_(String(id));
  }
  /**
   * Makes the label if it is missing, so nobody has to create it by hand.
   * The narrow-permission backend may not create labels, so there it only reports.
   */
  function ensureLabel(labelName) {
    var name = CRM.oneLine(labelName, 100);
    if (!name) throw new Error('Settings > Gmail label is empty.');
    if (backend_() === 'gmailapi') {
      var found = (Gmail.Users.Labels.list('me').labels || []).some(function (l) { return l.name === name; });
      return { exists: found, created: false };
    }
    if (GmailApp.getUserLabelByName(name)) return { exists: true, created: false };
    GmailApp.createLabel(name);
    return { exists: true, created: true };
  }
  /**
   * Self-check: saves one draft addressed to yourself, or rewrites the one from the last check,
   * so at most one such draft exists. Nothing is sent.
   */
  function probeDraft(previousId) {
    var me = myAddresses()[0];
    if (!me) throw new Error('could not read your own email address');
    var subject = 'Finalsay self-check (safe to delete)';
    var body = 'Finalsay saved this draft to check that it can write drafts in your Gmail. It was not sent. You can delete it.\n\nChecked: ' + new Date().toISOString();
    if (backend_() === 'gmailapi') {
      if (previousId) {
        try { if (Gmail.Users.Drafts.get('me', String(previousId))) return { id: String(previousId), reused: true }; } catch (e) { /* the old draft is gone */ }
      }
      return { id: apiDraft_({ threadId: '', to: me, subject: subject, body: body }, [me]).id, reused: false };
    }
    if (previousId) {
      try {
        var old = GmailApp.getDraft(String(previousId));
        if (old) { old.update(me, subject, body); return { id: old.getId(), reused: true }; }
      } catch (e) { /* the old draft is gone, so a new one is saved */ }
    }
    return { id: GmailApp.createDraft(me, subject, body).getId(), reused: false };
  }
  /**
   * Saves a DRAFT. d: { threadId?, to, subject, body }.
   * `to` and `subject` are forced onto one line so text from an email or the AI can never add a header such as Bcc.
   */
  function createDraft(d) {
    var clean = {
      threadId: d.threadId ? String(d.threadId) : '',
      to: CRM.oneLine(d.to, 200),
      subject: CRM.oneLine(d.subject, 200) || '(no subject)',
      body: CRM.clean(d.body, 5000)
    };
    if (!CRM.isEmail(clean.to)) throw new Error('draft needs a valid recipient');
    if (!clean.body) throw new Error('draft is empty');
    var me = myAddresses();
    return backend_() === 'gmailapi' ? apiDraft_(clean, me) : appDraft_(clean, me);
  }

  return {
    listLabelThreads: listLabelThreads, getThread: getThread, createDraft: createDraft, myAddresses: myAddresses, backend: backend_,
    ensureLabel: ensureLabel, probeDraft: probeDraft
  };
})();
