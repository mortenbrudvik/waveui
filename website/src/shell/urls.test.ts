import { describe, expect, it } from 'vitest';
import { CANONICAL_ORIGIN as GATE_ORIGIN } from '../../scripts/check-budget.mjs';
import { canonicalUrl, CANONICAL_ORIGIN, DOCS_BASE } from './urls';

describe('canonicalUrl', () => {
  it('names the homepage’s host, which serves the docs through its rewrite', () => {
    expect(CANONICAL_ORIGIN).toBe('https://brudvik.com');
  });

  it('is the origin the base-path gate lets a canonical link name', () => {
    expect(GATE_ORIGIN).toBe(CANONICAL_ORIGIN);
  });

  it('is the origin and the path of the page', () => {
    expect(canonicalUrl(`${DOCS_BASE}/components/button`)).toBe(
      'https://brudvik.com/waveui/docs/components/button',
    );
    expect(canonicalUrl(`${DOCS_BASE}/getting-started`)).toBe(
      'https://brudvik.com/waveui/docs/getting-started',
    );
  });

  it('has no trailing slash, as the site redirects one away', () => {
    expect(canonicalUrl(`${DOCS_BASE}/`)).toBe('https://brudvik.com/waveui/docs');
    expect(canonicalUrl(DOCS_BASE)).toBe('https://brudvik.com/waveui/docs');
    expect(canonicalUrl(`${DOCS_BASE}/components/`)).toBe(
      'https://brudvik.com/waveui/docs/components',
    );
  });

  it('drops a file extension, as clean URLs serve the page without one', () => {
    expect(canonicalUrl(`${DOCS_BASE}/components/button.html`)).toBe(
      'https://brudvik.com/waveui/docs/components/button',
    );
    expect(canonicalUrl(`${DOCS_BASE}/index.html`)).toBe('https://brudvik.com/waveui/docs');
  });
});
