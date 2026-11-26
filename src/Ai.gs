/**
 * Finalsay: Ai.gs. The only file that calls an AI provider.
 *
 * The key lives in Script Properties (AI_KEY), never in the Sheet, and is never logged.
 * Whatever comes back is treated as untrusted text: CRM.parseExtraction and CRM.parseSuggestion
 * decide what, if anything, is kept.
 *
 * When "AI on" is TRUE in Settings, the text of captured emails is sent to the provider chosen there.
 */
var Ai = (function () {
  function key_() {
    var key = PropertiesService.getScriptProperties().getProperty('AI_KEY');
    if (!key) throw new Error('No AI key saved. Use CRM > Set AI key.');
    return key;
  }
  function post_(url, headers, body) {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', headers: headers,
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code !== 200) throw new Error('The AI provider answered with HTTP ' + code + '.');
    try { return JSON.parse(res.getContentText()); } catch (e) { throw new Error('The AI provider sent something that is not JSON.'); }
  }

  function gemini_(prompt, s) {
    var model = String(s.aiModel || '').replace(/[^A-Za-z0-9._\-]/g, '');
    if (!model) throw new Error('Settings > AI model is empty.');
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
    var data = post_(url, { 'x-goog-api-key': key_() }, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    });
    var cand = data && data.candidates && data.candidates[0];
    var parts = (cand && cand.content && cand.content.parts) || [];
    var text = parts.map(function (p) { return p.text || ''; }).join('');
    if (!text) throw new Error('The AI returned no text.');
    return text;
  }

  function openai_(prompt, s) {
    var base = String(s.aiBaseUrl || '').trim().replace(/\/+$/, '');
    if (!/^https:\/\//i.test(base)) throw new Error('Settings > AI base URL must start with https://');
    var data = post_(base + '/chat/completions', { Authorization: 'Bearer ' + key_() }, {
      model: String(s.aiModel || ''), temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });
    var msg = data && data.choices && data.choices[0] && data.choices[0].message;
    var text = msg && typeof msg.content === 'string' ? msg.content : '';
    if (!text) throw new Error('The AI returned no text.');
    return text;
  }

  /** Sends one prompt, returns the raw text. Throws a plain-language Error on any failure. */
  function complete(prompt, settings) {
    var s = settings || Store.getSettings();
    if (!s.aiOn) throw new Error('AI is switched off in Settings.');
    return s.aiProvider === 'openai-compatible' ? openai_(prompt, s) : gemini_(prompt, s);
  }

  return { complete: complete };
})();
