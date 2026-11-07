/**
 * The part of jsdom's API the built-page tests use (`tests/pages.test.ts`). jsdom ships no types
 * and the repository has no `@types/jsdom`; the other site tests reach jsdom only through Vitest's
 * environment.
 */
declare module 'jsdom' {
  export interface JSDOMOptions {
    /** `'outside-only'`: the page's own scripts never run; `window.eval` runs ours. */
    runScripts?: 'outside-only' | 'dangerously';
    url?: string;
    pretendToBeVisual?: boolean;
  }

  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis & { eval(code: string): unknown };
  }
}
