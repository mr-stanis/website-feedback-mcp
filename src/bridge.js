/**
 * stdio ⇄ Streamable HTTP bridge for the Website Feedback Tool MCP server.
 *
 * The real server is hosted (https://websitefeedback.tools/developers/). This
 * package only lets clients that speak stdio — or that can't send a custom
 * header to a remote server — reach it: every JSON-RPC message read from stdin
 * is POSTed to the endpoint with your agent key, and the answer is written to
 * stdout. Nothing is stored, nothing is logged except errors to stderr.
 */

export const DEFAULT_ENDPOINT = 'https://dfozgzaflbudvthtlhvn.supabase.co/functions/v1/mcp';

const KEY_HELP =
  'Set WEBSITE_FEEDBACK_KEY to the agent key from the Website Feedback Tool ' +
  'Chrome extension (Connect AI agent), then restart your MCP client.';

/** JSON-RPC error object for a request id (null when the id is unknown). */
export function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/**
 * Forward one JSON-RPC message. Resolves to the response object to write, or
 * null when there is nothing to write (a notification, or a 202 Accepted).
 */
export async function forward(message, { endpoint, key, fetchImpl = fetch }) {
  const isRequest = message && typeof message === 'object' && 'id' in message;
  const id = isRequest ? message.id : null;
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (key) headers.authorization = `Bearer ${key}`;

  let res;
  try {
    res = await fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify(message) });
  } catch (err) {
    return isRequest ? rpcError(id, -32603, `Cannot reach ${endpoint}: ${err.message}`) : null;
  }

  if (res.status === 202 || !isRequest) return null;
  if (res.status === 401) {
    return rpcError(id, -32001, key ? `The agent key was rejected. ${KEY_HELP}` : `No agent key. ${KEY_HELP}`);
  }
  if (res.status === 429) {
    return rpcError(id, -32002, 'Rate limited (600 requests per IP per hour). Try again later.');
  }

  const text = await res.text();
  if (!res.ok) return rpcError(id, -32603, `Server answered HTTP ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return rpcError(id, -32603, 'Server answered with something that is not JSON.');
  }
}

/** Parse one stdin line and forward it (or each element of a batch). */
export async function handleLine(line, options) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }
  if (Array.isArray(message)) {
    const results = await Promise.all(message.map((m) => forward(m, options)));
    const out = results.filter(Boolean);
    return out.length ? out : null;
  }
  return forward(message, options);
}
