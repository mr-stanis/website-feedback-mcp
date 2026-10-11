#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { DEFAULT_ENDPOINT, handleLine } from './bridge.js';

const options = {
  endpoint: process.env.WEBSITE_FEEDBACK_ENDPOINT || DEFAULT_ENDPOINT,
  key: (process.env.WEBSITE_FEEDBACK_KEY || '').trim(),
};

if (!options.key) {
  process.stderr.write(
    'website-feedback-mcp: WEBSITE_FEEDBACK_KEY is not set — the server will list its tools, ' +
      'but every tool call will fail until you add the key from the extension (Connect AI agent).\n',
  );
}

const pending = new Set();
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  const job = handleLine(line, options)
    .then((response) => {
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    })
    .catch((err) => process.stderr.write(`website-feedback-mcp: ${err.stack || err}\n`))
    .finally(() => pending.delete(job));
  pending.add(job);
});

rl.on('close', async () => {
  await Promise.allSettled([...pending]);
  process.exit(0);
});
