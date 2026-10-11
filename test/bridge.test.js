import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, handleLine } from '../src/bridge.js';

/** Minimal fetch stand-in: records the call, answers with status + body. */
function fakeFetch(status, body = '') {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, text: async () => body };
  };
  return { impl, calls };
}

const endpoint = 'https://example.test/mcp';

test('forwards a request with the bearer key and returns the JSON answer', async () => {
  const answer = { jsonrpc: '2.0', id: 1, result: { tools: [] } };
  const f = fakeFetch(200, JSON.stringify(answer));
  const out = await forward({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { endpoint, key: 'k1', fetchImpl: f.impl });
  assert.deepEqual(out, answer);
  assert.equal(f.calls[0].url, endpoint);
  assert.equal(f.calls[0].init.headers.authorization, 'Bearer k1');
});

test('sends no Authorization header when there is no key', async () => {
  const f = fakeFetch(200, '{"jsonrpc":"2.0","id":1,"result":{}}');
  await forward({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { endpoint, key: '', fetchImpl: f.impl });
  assert.equal('authorization' in f.calls[0].init.headers, false);
});

test('notifications and 202 produce no output', async () => {
  const f = fakeFetch(202);
  assert.equal(await forward({ jsonrpc: '2.0', method: 'notifications/initialized' }, { endpoint, key: 'k', fetchImpl: f.impl }), null);
  assert.equal(await forward({ jsonrpc: '2.0', id: 2, method: 'ping' }, { endpoint, key: 'k', fetchImpl: f.impl }), null);
});

test('401 becomes a JSON-RPC error that tells the user what to do', async () => {
  const f = fakeFetch(401, '{"error":"unauthorized"}');
  const out = await forward({ jsonrpc: '2.0', id: 3, method: 'tools/call' }, { endpoint, key: '', fetchImpl: f.impl });
  assert.equal(out.id, 3);
  assert.equal(out.error.code, -32001);
  assert.match(out.error.message, /WEBSITE_FEEDBACK_KEY/);
});

test('429 and network failures become JSON-RPC errors, not crashes', async () => {
  const limited = await forward({ jsonrpc: '2.0', id: 4, method: 'tools/list' }, { endpoint, key: 'k', fetchImpl: fakeFetch(429).impl });
  assert.equal(limited.error.code, -32002);
  const down = await forward({ jsonrpc: '2.0', id: 5, method: 'tools/list' }, {
    endpoint, key: 'k', fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  assert.equal(down.error.code, -32603);
  assert.match(down.error.message, /ECONNREFUSED/);
});

test('bad JSON on stdin is a parse error; blank lines are ignored', async () => {
  const f = fakeFetch(200, '{}');
  assert.equal((await handleLine('{nope', { endpoint, key: 'k', fetchImpl: f.impl })).error.code, -32700);
  assert.equal(await handleLine('   ', { endpoint, key: 'k', fetchImpl: f.impl }), null);
  assert.equal(f.calls.length, 0);
});

test('a batch is split into single messages and answered as an array', async () => {
  const f = fakeFetch(200, '{"jsonrpc":"2.0","id":1,"result":{}}');
  const out = await handleLine(JSON.stringify([
    { jsonrpc: '2.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
  ]), { endpoint, key: 'k', fetchImpl: f.impl });
  assert.equal(f.calls.length, 2);
  assert.equal(out.length, 1);
});
