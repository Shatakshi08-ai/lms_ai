import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateBarcode, generateReaderId } from '../src/utils/ids.js';
import { TEMPLATES } from '../src/ai/nlAnalytics.js';
import { listTools } from '../src/ai/toolSandbox.js';

describe('identifiers', () => {
  it('formats reader ids and barcodes', () => {
    assert.equal(generateReaderId(2026, 8942), 'LIB-2026-8942');
    assert.equal(generateBarcode(4921), 'BC-004921');
    assert.equal(generateBarcode(100001), 'BC-100001');
  });
});

describe('ai sandbox allowlists', () => {
  it('exposes only named tools', () => {
    const names = listTools().map((t) => t.name).sort();
    assert.deepEqual(names, [
      'checkAvailability',
      'getLibraryStats',
      'getReadingProgress',
      'getUserCart',
      'getUserFines',
      'getUserLoans',
      'getUserWishlist',
      'listCategories',
      'searchBooks',
    ]);
  });

  it('does not allow arbitrary pipelines', () => {
    assert.ok(!('rawAggregate' in TEMPLATES));
    assert.ok(TEMPLATES.topIssuedByCategoryThisMonth);
  });
});
