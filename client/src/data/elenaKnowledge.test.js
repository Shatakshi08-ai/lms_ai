import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const kb = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'elenaKnowledgeBase.json'), 'utf8'),
);

describe('Elena knowledge base file', () => {
  it('contains at least 2000 Q&A rows', () => {
    expect(kb.length).toBeGreaterThanOrEqual(2000);
  });
});
