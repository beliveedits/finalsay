/* The reference MCP server, talking to a local stand-in for the web app. A real MCP client and a real Sheet are NOT VERIFIED LIVE. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

function fakeSheet(answer) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const j = JSON.parse(body); seen.push({ headers: req.headers, body: j });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(answer(j)));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, url: 'http://127.0.0.1:' + server.address().port + '/exec' })));
}
function startMcp(env) {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'mcp', 'server.js')], { env: Object.assign({}, process.env, env), stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const waiting = [];
  child.stdout.on('data', (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) { const w = waiting.shift(); if (w) w(JSON.parse(line)); } }
  });
  let id = 0;
  const rpc = (method, params) => new Promise((resolve) => { waiting.push(resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) + '\n'); });
  const raw = (line) => new Promise((resolve) => { waiting.push(resolve); child.stdin.write(line + '\n'); });
  const note = (method) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  const stop = () => new Promise((resolve) => { child.on('exit', resolve); child.stdin.end(); });
  return { rpc, raw, note, stop };
}

test('MCP: handshake, tool list, and every write tool is a proposal', async () => {
  const sheet = await fakeSheet((j) => (j.token === 'tok' ? { ok: true, echo: j.action, id: 'P1', status: 'Pending' } : { ok: false, error: 'unauthorised' }));
  const mcp = startMcp({ FINALSAY_URL: sheet.url, FINALSAY_API_TOKEN: 'tok', FINALSAY_TEST_ANY_URL: '1', FINALSAY_ALLOW_THREADS: '' });
  try {
    const init = await mcp.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } });
    assert.equal(init.result.protocolVersion, '2025-03-26');
    assert.equal(init.result.serverInfo.name, 'finalsay');
    assert.deepEqual(init.result.capabilities, { tools: {} });
    mcp.note('notifications/initialized');
    assert.deepEqual((await mcp.rpc('ping')).result, {});

    const tools = (await mcp.rpc('tools/list')).result.tools;
    const names = tools.map((t) => t.name);
    assert.deepEqual(names, ['finalsay_today', 'finalsay_leads', 'finalsay_approvals', 'finalsay_propose_stage_change', 'finalsay_propose_next_step', 'finalsay_propose_note', 'finalsay_propose_reply_draft']);
    assert.ok(!names.includes('finalsay_lead_context'), 'email text is not offered unless the owner turns it on');
    tools.filter((t) => t.name.includes('propose')).forEach((t) => assert.match(t.description, /QUEUES a suggestion.*person must approve/));
    assert.ok(!names.some((n) => /apply|update|delete|send|set_/.test(n)), 'no tool applies, deletes or sends');

    const res = await mcp.rpc('tools/call', { name: 'finalsay_propose_stage_change', arguments: { lead_id: 'L-0001', stage: 'Talking', reason: 'They replied' } });
    assert.equal(res.result.isError, false);
    assert.equal(JSON.parse(res.result.content[0].text).status, 'Pending');
    const sent = sheet.seen.at(-1).body;
    assert.deepEqual(sent, { action: 'propose', type: 'stage_change', leadId: 'L-0001', payload: { stage: 'Talking', reason: 'They replied' }, token: 'tok' });
    assert.match(sheet.seen.at(-1).headers['content-type'], /^text\/plain/);

    await mcp.rpc('tools/call', { name: 'finalsay_propose_reply_draft', arguments: { lead_id: 'L-0001', text: 'Hi', to: 'evil@x.example' } });
    assert.deepEqual(sheet.seen.at(-1).body.payload, { text: 'Hi' }, 'extra arguments such as a recipient are not passed on');

    assert.equal(JSON.parse((await mcp.rpc('tools/call', { name: 'finalsay_today', arguments: {} })).result.content[0].text).echo, 'today');

    const bad = await mcp.rpc('tools/call', { name: 'finalsay_propose_note', arguments: { lead_id: 'L-0001' } });
    assert.equal(bad.result.isError, true);
    assert.match(bad.result.content[0].text, /"text" is required/);
    const off = await mcp.rpc('tools/call', { name: 'finalsay_lead_context', arguments: { lead_id: 'L-0001' } });
    assert.equal(off.result.isError, true);
    assert.equal((await mcp.rpc('tools/call', { name: 'nope', arguments: {} })).result.isError, true);
    assert.equal((await mcp.rpc('does/not/exist')).error.code, -32601);
    assert.equal((await mcp.raw('this is not json')).error.code, -32700);
  } finally { await mcp.stop(); sheet.server.close(); }
});

test('MCP: refuses a web app address that is not a Google Apps Script URL, and reports a refused token', async () => {
  const sheet = await fakeSheet(() => ({ ok: false, error: 'unauthorised' }));
  const strict = startMcp({ FINALSAY_URL: sheet.url, FINALSAY_API_TOKEN: 'tok', FINALSAY_TEST_ANY_URL: '' });
  const loose = startMcp({ FINALSAY_URL: sheet.url, FINALSAY_API_TOKEN: 'wrong', FINALSAY_TEST_ANY_URL: '1' });
  const none = startMcp({ FINALSAY_URL: sheet.url, FINALSAY_API_TOKEN: '', FINALSAY_TEST_ANY_URL: '1' });
  try {
    const a = await strict.rpc('tools/call', { name: 'finalsay_leads', arguments: {} });
    assert.match(a.result.content[0].text, /FINALSAY_URL must look like https:\/\/script\.google\.com/);
    assert.equal(sheet.seen.length, 0, 'the token was not sent to a non-Google address');
    const b = await loose.rpc('tools/call', { name: 'finalsay_leads', arguments: {} });
    assert.match(b.result.content[0].text, /Finalsay refused: unauthorised/);
    const c = await none.rpc('tools/call', { name: 'finalsay_leads', arguments: {} });
    assert.match(c.result.content[0].text, /FINALSAY_API_TOKEN is not set/);
  } finally { await strict.stop(); await loose.stop(); await none.stop(); sheet.server.close(); }
});

test('MCP: the thread tool appears only when FINALSAY_ALLOW_THREADS=1', async () => {
  const sheet = await fakeSheet((j) => ({ ok: true, action: j.action }));
  const mcp = startMcp({ FINALSAY_URL: sheet.url, FINALSAY_API_TOKEN: 'tok', FINALSAY_TEST_ANY_URL: '1', FINALSAY_ALLOW_THREADS: '1' });
  try {
    const names = (await mcp.rpc('tools/list')).result.tools.map((t) => t.name);
    assert.ok(names.includes('finalsay_lead_context'));
    const r = await mcp.rpc('tools/call', { name: 'finalsay_lead_context', arguments: { lead_id: 'L-0001' } });
    assert.equal(JSON.parse(r.result.content[0].text).action, 'context');
  } finally { await mcp.stop(); sheet.server.close(); }
});
