import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

describe('http app', () => {
  it('health endpoint', async () => {
    const app = createApp();
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    server.close();
  });
});
