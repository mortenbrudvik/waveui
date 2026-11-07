/**
 * The client-mount sweep: every story the build classifies as an inline example is mounted in
 * jsdom the way the example island mounts it (default args, the site's WaveProvider decorator,
 * light and left to right), and must leave the page alone: focus stays on the body, nothing outside
 * its container is made `inert` or `aria-hidden`, no scroll lock, no dialog or `aria-modal` element
 * outside its container. A story that fails opens a surface on mount that the build-time detection
 * (`opensModal` in src/examples/analysis.tsx) missed: give it a hint there.
 *
 * Runs in the `shell` project (jsdom with the SSR transform) beside the hydration tests.
 */
import { act } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { getCatalog } from '../catalog/catalog';
import { analyzeExample } from '../examples/analysis';
import { loadStory, SiteChoiceContext } from '../stories/runtime';

let consoleError: MockInstance<typeof console.error>;
let consoleWarn: MockInstance<typeof console.warn>;

beforeEach(() => {
  // Silenced while stories mount (jsdom lacks layout and some APIs); every message is collected
  // and the test asserts which stories logged what.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // jsdom has no `matchMedia`; a browser has one. A wide screen with default preferences: no
  // query matches.
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** What a mounted story did to the page outside its own container. */
function pageEffects(container: HTMLElement): string[] {
  const problems: string[] = [];
  const active = document.activeElement;
  if (active && active !== document.body) {
    problems.push(`moved focus to <${active.tagName.toLowerCase()}>`);
  }
  for (const child of document.body.children) {
    if (child === container) continue;
    if (child.hasAttribute('inert')) problems.push('made a body child inert');
    if (child.getAttribute('aria-hidden') === 'true') problems.push('hid a body child');
  }
  if (container.closest('[inert]')) problems.push('made its own container inert');
  for (const element of [document.documentElement, document.body]) {
    const { overflow, overflowX, overflowY } = element.style;
    if ([overflow, overflowX, overflowY].includes('hidden')) {
      problems.push(`locked scroll on <${element.tagName.toLowerCase()}>`);
    }
  }
  for (const modal of document.body.querySelectorAll(
    '[aria-modal="true"], [role="dialog"], [role="alertdialog"]',
  )) {
    // A surface kept mounted while closed (`keepMounted`) is hidden: no offence.
    if (!container.contains(modal) && !modal.closest('[hidden]')) {
      problems.push(`opened ${modal.getAttribute('role') ?? 'a modal'} outside its container`);
    }
  }
  return problems;
}

describe('client-mount sweep', () => {
  it('no inline story moves focus, locks the page or opens a dialog outside its container on mount', async () => {
    const offenders: string[] = [];
    const leaks: string[] = [];
    const renderErrors: string[] = [];
    let swept = 0;
    for (const entry of getCatalog()) {
      for (const storyName of entry.storyNames) {
        const analysis = await analyzeExample(entry.slug, storyName);
        if (analysis.mode !== 'inline' || analysis.serverError) continue;
        const story = await loadStory(entry, storyName);
        const id = `${entry.slug}#${storyName}`;

        const container = document.createElement('div');
        document.body.append(container);
        const root = createRoot(container);
        try {
          await act(async () => {
            root.render(
              <SiteChoiceContext value={{ theme: 'light', dir: 'ltr' }}>
                <story.Component />
              </SiteChoiceContext>,
            );
          });
          // Effects, microtasks and one macrotask (a focus moved from a timer or a rAF fallback).
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
          });
          const problems = pageEffects(container);
          if (problems.length > 0) offenders.push(`${id}: ${problems.join(', ')}`);
        } catch (error) {
          renderErrors.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
        }

        act(() => root.unmount());
        container.remove();
        (document.activeElement as HTMLElement | null)?.blur?.();
        const left = [...document.body.children].length;
        const locked = [document.documentElement, document.body].some(
          (element) => element.style.overflow === 'hidden',
        );
        if (left > 0 || locked || document.querySelector('[inert]')) {
          leaks.push(`${id}: ${left} body children, scroll lock ${locked}`);
        }
        document.body.innerHTML = '';
        swept += 1;
      }
    }

    expect(swept).toBeGreaterThan(700);
    expect(renderErrors).toEqual([]);
    expect(offenders).toEqual([]);
    expect(leaks).toEqual([]);
    // The stories' own diagnostics are the library's business; the sweep records only that none
    // of them is a React error about the page (a hydration or act problem of the sweep itself).
    const reactErrors = consoleError.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => /not wrapped in act|hydrat/i.test(message));
    expect(reactErrors).toEqual([]);
    consoleWarn.mockClear();
  }, 600_000);
});
