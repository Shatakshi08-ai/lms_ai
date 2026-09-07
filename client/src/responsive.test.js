import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.css'), 'utf8');

describe('responsive CSS (layout cannot be measured in jsdom)', () => {
  it('keeps the app shell sticky and the sider independently scrollable', () => {
    expect(css).toMatch(/\.ql-app-shell[\s\S]*overflow:\s*hidden/);
    expect(css).toMatch(/\.app-sider[\s\S]*position:\s*sticky/);
    expect(css).toMatch(/\.app-sider-menu-wrap[\s\S]*overflow:\s*auto/);
    expect(css).toMatch(/\.app-content[\s\S]*overflow:\s*auto/);
  });

  it('sizes Elena and auth for mobile', () => {
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.elena-panel/);
    expect(css).toMatch(/\.auth-page[\s\S]*overflow:\s*hidden/);
  });

  it('uses a fluid cart grid', () => {
    expect(css).toMatch(/\.ql-cart-grid[\s\S]*auto-fill/);
  });
});
