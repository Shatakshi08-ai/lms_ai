import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { pipeline } from 'node:stream/promises';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => join(dir, name));

const stream = run({
  files,
  concurrency: 1,
  timeout: 60_000,
});

let failed = 0;
stream.on('test:fail', () => {
  failed += 1;
});

await pipeline(stream, new spec(), process.stdout);
if (failed > 0) process.exitCode = 1;
