/**
 * The list-child check of Nav (spec P6-09 D114): every child of the Nav's list, and of an open
 * category's list, is an `<li>`; a development warning (once per owner, from an effect) names the
 * first element that is not, or text. Every `console.warn` spy asserts the exact call list.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Nav } from '../Nav';
import { Tooltip } from '../../overlays/Tooltip';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const NAV_ADVICE =
  'Use the Nav parts (Nav.Item, Nav.Category, Nav.SectionHeader, Nav.Divider, Nav.AppItem, Nav.AppItemStatic) as its children, or wrap your own content in an <li>.';
const CATEGORY_ADVICE =
  'Use Nav.SubItem, Nav.SectionHeader and Nav.Divider as its children, or wrap your own content in an <li>.';

const navMessage = (what: string) =>
  `[WaveUI] Nav: its list holds ${what}, but a list can hold only <li> elements. ${NAV_ADVICE}`;
const categoryMessage = (what: string) =>
  `[WaveUI] Nav.Category: its list holds ${what}, but a list can hold only <li> elements. ${CATEGORY_ADVICE}`;

/** A consumer component that renders its own list item. */
function CustomEntry() {
  return (
    <li>
      <a href="#custom">Custom</a>
    </li>
  );
}

describe('Nav list children (D114)', () => {
  describe('warns', () => {
    it('once, at a <div> in the Nav list, also across re-renders', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const tree = (label: string) => (
        <Nav>
          <Nav.Item value="home">{label}</Nav.Item>
          <div>Stray</div>
          <section>Second stray</section>
        </Nav>
      );
      const { rerender } = render(tree('Home'));
      rerender(tree('Start'));
      expect(warn.mock.calls).toEqual([[navMessage('a <div> element')]]);
    });

    it('at text in the Nav list', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Nav>
          <Nav.Item value="home">Home</Nav.Item>
          Text
        </Nav>,
      );
      expect(warn.mock.calls).toEqual([[navMessage('text')]]);
    });

    it("at a <div> in an open category's list, with the category's advice", () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Nav defaultOpenCategories={['docs']}>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            <div>Stray</div>
          </Nav.Category>
        </Nav>,
      );
      expect(warn.mock.calls).toEqual([[categoryMessage('a <div> element')]]);
    });

    it('when a category holding a stray child opens, not while it is closed', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Nav>
          <Nav.Category value="docs" label="Docs">
            <p>Stray</p>
          </Nav.Category>
        </Nav>,
      );
      expect(warn).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Docs' }));
      expect(warn.mock.calls).toEqual([[categoryMessage('a <p> element')]]);
    });

    it('once per owner: the Nav and a category each warn once, a second Nav not again', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Nav aria-label="Main">
            <span>Stray</span>
            <Nav.Category value="docs" label="Docs" />
          </Nav>
          <Nav aria-label="Footer" defaultOpenCategories={['help']}>
            <div>Stray</div>
            <Nav.Category value="help" label="Help">
              <div>Stray</div>
            </Nav.Category>
          </Nav>
        </>,
      );
      // The first Nav warns for its list; the second Nav's category for its own list, and the
      // second Nav's list stays silent (its owner, `Nav`, already warned).
      expect(warn.mock.calls).toEqual([
        [navMessage('a <span> element')],
        [categoryMessage('a <div> element')],
      ]);
    });

    it('at a Tooltip wrapped around a Nav.Item (its wrapper <span> sits in the list)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Nav>
          <Tooltip content="Your start page" relationship="description">
            <Nav.Item value="home">Home</Nav.Item>
          </Tooltip>
        </Nav>,
      );
      expect(warn.mock.calls).toEqual([[navMessage('a <span> element')]]);
    });

    it('exactly once in StrictMode', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const tree = (label: string) => (
        <React.StrictMode>
          <Nav defaultOpenCategories={['docs']}>
            <div>{label}</div>
            <Nav.Category value="docs" label="Docs">
              <div>{label}</div>
            </Nav.Category>
          </Nav>
        </React.StrictMode>
      );
      const { rerender } = render(tree('Stray'));
      rerender(tree('Still stray'));
      expect(warn.mock.calls).toEqual([
        [categoryMessage('a <div> element')],
        [navMessage('a <div> element')],
      ]);
    });
  });

  describe('does not warn', () => {
    it('for the parts, a consumer <li>, Fragments, a component that renders an <li>, a Profiler, a <template> and whitespace', () => {
      const warn = vi.spyOn(console, 'warn');
      const tree = (tick: number) => (
        <Nav defaultOpenCategories={['docs']} data-tick={tick}>
          <Nav.Item value="home">Home</Nav.Item> <Nav.SectionHeader>Library</Nav.SectionHeader>
          {'\n  '}
          <>
            <Nav.Item value="files" href="#files">
              Files
            </Nav.Item>
            <></>
          </>
          <li>
            <a href="#own">Own entry</a>
          </li>
          <CustomEntry />
          <React.Profiler id="items" onRender={() => {}}>
            <Nav.Item value="recent">Recent</Nav.Item>
          </React.Profiler>
          {null}
          {false}
          <template />
          <Nav.Divider />
          <Nav.Category value="docs" label="Docs">
            <Nav.SectionHeader>Guides</Nav.SectionHeader>{' '}
            <>
              <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            </>
            <Nav.Divider />
            <li>Own sub-entry</li>
            <CustomEntry />
          </Nav.Category>
          <Nav.Category value="closed" label="Closed">
            <div>Not rendered while closed</div>
          </Nav.Category>
        </Nav>
      );
      const { rerender } = render(tree(0));
      rerender(tree(1));
      expect(warn).not.toHaveBeenCalled();
    });

    it('for React.Suspense with fallback={null}, pending and resolved', async () => {
      const warn = vi.spyOn(console, 'warn');
      let resolve: (module: { default: React.ComponentType }) => void = () => {};
      const LazyEntry = React.lazy(
        () =>
          new Promise<{ default: React.ComponentType }>((done) => {
            resolve = done;
          }),
      );
      render(
        <Nav defaultOpenCategories={['docs']}>
          <Nav.Item value="home">Home</Nav.Item>
          <React.Suspense fallback={null}>
            <LazyEntry />
          </React.Suspense>
          <Nav.Category value="docs" label="Docs">
            <React.Suspense fallback={null}>
              <LazyEntry />
            </React.Suspense>
          </Nav.Category>
        </Nav>,
      );
      expect(screen.queryByRole('link', { name: 'Later' })).toBeNull();
      await act(async () => {
        resolve({
          default: () => (
            <li>
              <a href="#later">Later</a>
            </li>
          ),
        });
      });
      expect(screen.getAllByRole('link', { name: 'Later' })).toHaveLength(2);
      expect(warn).not.toHaveBeenCalled();
    });

    it('for the comment markers of a server-rendered Suspense boundary that stay in the list after hydration', async () => {
      const element = (
        <Nav>
          <React.Suspense fallback={null}>
            <Nav.Item value="home">Home</Nav.Item>
          </React.Suspense>
        </Nav>
      );
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        const list = container.querySelector('ul');
        expect(
          Array.from(list?.childNodes ?? []).some((node) => node.nodeType === Node.COMMENT_NODE),
        ).toBe(true);
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const warn = vi.spyOn(console, 'warn');
      render(
        <Nav defaultOpenCategories={['docs']}>
          <div>Stray</div>
          Text
          <Nav.Category value="docs" label="Docs">
            <div>Stray</div>
          </Nav.Category>
        </Nav>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
