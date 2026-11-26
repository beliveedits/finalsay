/**
 * Renders the README pictures from SAMPLE DATA. Nothing here is a screenshot of Google Sheets.
 * It runs the real src/ code against the test stand-ins, takes what the code wrote into the
 * Today and Approvals tabs, and draws those rows as plain tables.
 *
 * usage: node tools/screens-build.js            writes docs/screenshots/*.html
 *        then render them to PNG with any headless browser (see CONTRIBUTING.md)
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../test/mocks/gas.js');

const h = createHarness({ tz: 'Asia/Kolkata' }).load();
h.fakeMail();
setUp();
addSampleLeads();
const now = new Date();
const add = (id, type, payload) => { const lead = Store.getLead(id); addProposal_(CRM.makeProposal(type, lead.id, payload, now, type + id), lead); };
add('L-0002', 'stage_change', { stage: 'Talking', reason: 'You replied to them' });
add('L-0001', 'reply_draft', { text: 'Hi Meera, the quote is attached. Happy to walk you through it on a call this week.' });
add('L-0003', 'next_step', { nextStep: 'Check in about the quote', nextDate: CRM.addDaysISO(now, 2) });
add('L-0004', 'note', { text: 'Prefers calls after 4pm' });
h.sheet('Approvals').getRange(2, 8).setValue('Approve');
h.sheet('Approvals').getRange(5, 8).setValue('Reject');
processApprovals();

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => (v instanceof Date ? Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd HH:mm') : v);
const css = `*{box-sizing:border-box}body{margin:0;padding:28px;background:#F6F7F9;color:#121628;font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1{font-size:20px;margin:0 0 4px;font-weight:800}p{margin:0 0 16px;color:#5A6070;font-size:14px}
table{border-collapse:collapse;background:#fff;width:100%}th,td{border:1.5px solid #DADDE4;padding:9px 12px;text-align:left;vertical-align:top}
th{font-size:14px;color:#5A6070;background:#fff}td.n{text-align:right;font-variant-numeric:tabular-nums}
.pending{border:1.5px dashed #7A8090;padding:3px 9px;display:inline-block}.applied{background:#2438C8;color:#fff;font-weight:700;padding:4px 10px;display:inline-block}
.rejected{color:#5A6070;text-decoration:line-through}.error{color:#B4311A;font-weight:700}.tabs{display:flex;gap:4px;margin-top:14px;font-size:14px}
.tabs span{padding:6px 12px;border:1.5px solid #DADDE4;background:#fff;color:#5A6070}.tabs .on{color:#121628;font-weight:800;border-bottom:3px solid #2438C8}`;
const tabs = (on) => '<div class="tabs">' + ['Leads', 'Today', 'Approvals', 'Activity', 'Settings'].map((t) => `<span class="${t === on ? 'on' : ''}">${t}</span>`).join('') + '</div>';
const page = (title, note, table, on) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body><h1>${title}</h1><p>${note}</p>${table}${tabs(on)}</body></html>`;

const today = h.sheet('Today').rows();
const todayTable = '<table><thead><tr><th>Priority</th><th>Lead</th><th>Stage</th><th>Why</th><th>Next step</th></tr></thead><tbody>' +
  today.map((r) => `<tr><td class="n">${esc(r.Priority)}</td><td><strong>${esc(r.Lead)}</strong></td><td>${esc(r.Stage)}</td><td>${esc(r.Why)}</td><td>${esc(r['Next step'])}</td></tr>`).join('') + '</tbody></table>';
const ap = h.sheet('Approvals').rows();
const cls = { Pending: 'pending', Applied: 'applied', Rejected: 'rejected', Error: 'error' };
const apTable = '<table><thead><tr><th>Lead</th><th>Type</th><th>What it will do</th><th>Status</th><th>Applied</th></tr></thead><tbody>' +
  ap.map((r) => `<tr><td><strong>${esc(r.Lead)}</strong></td><td>${esc(r.Type)}</td><td>${esc(r['What it will do'])}</td><td><span class="${cls[r.Status] || ''}">${esc(r.Status)}</span></td><td>${esc(fmt(r.Applied))}</td></tr>`).join('') + '</tbody></table>';

const out = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const note = 'Drawn from sample data written by the Finalsay code in a test run. Made-up people. Not a screenshot of Google Sheets.';
fs.writeFileSync(path.join(out, 'today.html'), page('Today: who needs you, and why', note, todayTable, 'Today'));
fs.writeFileSync(path.join(out, 'approvals.html'), page('Approvals: the AI proposes, you decide', note, apTable, 'Approvals'));
console.log('today rows', today.length, '| approvals', ap.map((r) => r.Status).join(', '));
