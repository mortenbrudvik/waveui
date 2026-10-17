import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, within } from '@testing-library/react';
import { MessageBar, MessageBarActions, MessageBarTitle } from '../MessageBar';
import type { MessageBarActionsProps, MessageBarTitleProps } from '../MessageBar';
import { Button } from '../../button/Button';
import {
  messageBarActionsClassNames,
  messageBarClassNames,
  messageBarTitleClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  findDanglingIdRefsInHtml,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';

const TITLE_UNSCANNED =
  '[WaveUI] MessageBar.Title is not a direct child of MessageBar, so it is not placed first in the text. Make it a direct child.';
const ACTIONS_UNSCANNED =
  '[WaveUI] MessageBar.Actions is not a direct child of MessageBar, so it is not placed in the action area. Make it a direct child.';
const TITLE_MULTIPLE =
  '[WaveUI] MessageBar.Title: this MessageBar already has a title (its first MessageBar.Title among its direct children), so this one renders as body text. Give a bar one title.';

const REGION_NAME =
  '[WaveUI] MessageBar: a bar with role="region" is a landmark only when it has a name. Add a MessageBar.Title, or pass aria-label or aria-labelledby.';

/** Records `console.warn` for one test (restored after each test); assert what it recorded. */
const spyOnWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

/** Renders a part as a direct child of a MessageBar (the wrapper of `testSystemProps`). */
function InBar({ children }: { children: React.ReactNode }) {
  return <MessageBar>{children}</MessageBar>;
}

/** A title inside the app's own component: the bar's scan cannot see it. */
function WrappedTitle() {
  return <MessageBar.Title id="own-title">Wrapped</MessageBar.Title>;
}

/** Actions inside the app's own component. */
function WrappedActions() {
  return (
    <MessageBar.Actions>
      <Button>Wrapped action</Button>
    </MessageBar.Actions>
  );
}

/** A title the app renders inside another part. */
function NestedTitle() {
  return <MessageBar.Title>Nested</MessageBar.Title>;
}

/** The bar's text column: the element with the stable `body` class. */
function textColumn(bar: HTMLElement): HTMLElement {
  const column = bar.querySelector<HTMLElement>(`.${messageBarClassNames.body}`);
  if (!column) throw new Error('the bar has no text column');
  return column;
}

/** The `MessageBar.Actions` element around `node`. */
function actionsOf(node: HTMLElement): HTMLElement {
  const actions = node.closest<HTMLElement>(`.${messageBarActionsClassNames.root}`);
  if (!actions) throw new Error('not inside MessageBar.Actions');
  return actions;
}

describe('MessageBar parts (P3-04)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testCompoundExposure(MessageBar, ['Title', 'Actions']);

  it('exports each part under its flat name (C-COMPOUND)', () => {
    expect(MessageBarTitle).toBe(MessageBar.Title);
    expect(MessageBarActions).toBe(MessageBar.Actions);
  });

  describe('MessageBar.Title', () => {
    testSystemProps(MessageBarTitle, {
      expectedTag: 'span',
      displayName: 'MessageBarTitle',
      defaultProps: { children: 'Update available' },
      conflictingClass: { className: 'font-normal', overrides: 'font-semibold' },
      wrapper: InBar,
    });

    it('declares ref in the props interface (C-REF)', () => {
      expectTypeOf<MessageBarTitleProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLSpanElement> | undefined
      >();
    });
  });

  describe('MessageBar.Actions', () => {
    testSystemProps(MessageBarActions, {
      expectedTag: 'div',
      displayName: 'MessageBarActions',
      defaultProps: { children: <Button>Retry</Button> },
      conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
      wrapper: InBar,
    });

    it('declares ref in the props interface (C-REF)', () => {
      expectTypeOf<MessageBarActionsProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLDivElement> | undefined
      >();
    });

    it('has no role of its own (the bar is the grouping)', () => {
      render(
        <MessageBar>
          Body
          <MessageBar.Actions>
            <Button>Retry</Button>
          </MessageBar.Actions>
        </MessageBar>,
      );
      expect(actionsOf(screen.getByRole('button', { name: 'Retry' }))).not.toHaveAttribute('role');
    });
  });

  describe('partition of the children (D15)', () => {
    it('reads the title first after the severity text and places the actions after the text', () => {
      render(
        <MessageBar status="warning">
          <MessageBar.Actions>
            <Button>Update now</Button>
          </MessageBar.Actions>
          A new version is ready to install.
          <MessageBar.Title>Update available</MessageBar.Title>
        </MessageBar>,
      );
      const bar = screen.getByRole('alert');
      const text = textColumn(bar);
      expect(text).toHaveTextContent(
        /^Warning:\s*Update available A new version is ready to install\.$/,
      );
      const action = screen.getByRole('button', { name: 'Update now' });
      const actions = actionsOf(action);
      expect(actions).toHaveClass(messageBarActionsClassNames.root);
      expect(text).not.toContainElement(action);
      expect(text.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('finds parts inside Fragments', () => {
      render(
        <MessageBar status="success">
          <>
            <MessageBar.Title>Saved</MessageBar.Title>
            <>
              <MessageBar.Actions>
                <Button>Undo</Button>
              </MessageBar.Actions>
            </>
          </>
          Your changes are live.
        </MessageBar>,
      );
      const text = textColumn(screen.getByRole('status'));
      expect(text).toHaveTextContent(/^Success:\s*Saved Your changes are live\.$/);
      expect(text).not.toContainElement(screen.getByRole('button', { name: 'Undo' }));
    });

    it('keeps the rest of the body in its order', () => {
      render(
        <MessageBar>
          {'Before '}
          <strong>bold</strong>
          <MessageBar.Title>Heads up</MessageBar.Title>
          {' after'}
        </MessageBar>,
      );
      expect(textColumn(screen.getByRole('status'))).toHaveTextContent(
        /^Info:\s*Heads up Before bold after$/,
      );
    });

    it('finds parts written in a Server Component (lazy references): same server HTML and placement', () => {
      const Title = asClientReference(MessageBar.Title);
      const Actions = asClientReference(MessageBar.Actions);
      const plain = (
        <MessageBar status="warning">
          Install it tonight.
          <MessageBar.Title>Update available</MessageBar.Title>
          <MessageBar.Actions>
            <Button>Update now</Button>
          </MessageBar.Actions>
        </MessageBar>
      );
      const lazy = (
        <MessageBar status="warning">
          Install it tonight.
          <Title>Update available</Title>
          <Actions>
            <Button>Update now</Button>
          </Actions>
        </MessageBar>
      );
      expect(renderToString(lazy)).toBe(renderToString(plain));

      render(lazy);
      const text = textColumn(screen.getByRole('alert'));
      expect(text).toHaveTextContent(/^Warning:\s*Update available Install it tonight\.$/);
      expect(text).not.toContainElement(screen.getByRole('button', { name: 'Update now' }));
    });

    it('renders the placed title with its stable class and a generated id, or the consumer id', () => {
      const { rerender } = render(
        <MessageBar>
          <MessageBar.Title>Heads up</MessageBar.Title>
          Body
        </MessageBar>,
      );
      const title = screen.getByText('Heads up');
      expect(title.tagName).toBe('SPAN');
      expect(title).toHaveClass(messageBarTitleClassNames.root, 'font-semibold');
      expect(title.id).toMatch(/^wave-message-bar-title-/);

      rerender(
        <MessageBar>
          <MessageBar.Title id="release-title">Heads up</MessageBar.Title>
          Body
        </MessageBar>,
      );
      expect(screen.getByText('Heads up')).toHaveAttribute('id', 'release-title');
    });

    it('leaves out a title or actions whose children render nothing (the bar keeps its look)', () => {
      const { container, rerender } = render(<MessageBar onDismiss={() => {}}>Body</MessageBar>);
      const withoutParts = container.innerHTML;
      rerender(
        <MessageBar onDismiss={() => {}}>
          <MessageBar.Title>{''}</MessageBar.Title>
          Body
          <MessageBar.Actions>{false}</MessageBar.Actions>
        </MessageBar>,
      );
      expect(container.innerHTML).toBe(withoutParts);
      expect(container.getElementsByClassName(messageBarActionsClassNames.root)).toHaveLength(0);
      expect(container.getElementsByClassName(messageBarTitleClassNames.root)).toHaveLength(0);
    });

    it('renders actions given as a generator (read once)', () => {
      function* buttons() {
        yield <Button key="retry">Retry</Button>;
        yield <Button key="details">Details</Button>;
      }
      render(
        <MessageBar>
          Body
          <MessageBar.Actions>{buttons()}</MessageBar.Actions>
        </MessageBar>,
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    });
  });

  describe('misplaced parts', () => {
    it('a title the scan cannot see renders where it is, keeps only its own id and warns', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          {'Before '}
          <WrappedTitle />
          {' after'}
        </MessageBar>,
      );
      expect(textColumn(screen.getByRole('status'))).toHaveTextContent(
        /^Info:\s*Before Wrapped after$/,
      );
      expect(screen.getByText('Wrapped')).toHaveAttribute('id', 'own-title');
      expect(warn.mock.calls).toEqual([[TITLE_UNSCANNED]]);
    });

    it('actions the scan cannot see render where they are and warn', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          Body
          <WrappedActions />
        </MessageBar>,
      );
      const action = screen.getByRole('button', { name: 'Wrapped action' });
      expect(textColumn(screen.getByRole('status'))).toContainElement(action);
      expect(warn.mock.calls).toEqual([[ACTIONS_UNSCANNED]]);
    });

    it('a title inside another part is not placed', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          Body
          <MessageBar.Actions>
            <Button>Retry</Button>
            <NestedTitle />
          </MessageBar.Actions>
        </MessageBar>,
      );
      expect(screen.getByText('Nested')).not.toHaveAttribute('id');
      expect(warn.mock.calls).toEqual([[TITLE_UNSCANNED]]);
    });

    it('a second title renders as body text, with no generated id, and warns once', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar>
          <MessageBar.Title>First</MessageBar.Title>
          {'Body '}
          <MessageBar.Title>Second</MessageBar.Title>
        </MessageBar>,
      );
      expect(textColumn(screen.getByRole('status'))).toHaveTextContent(
        /^Info:\s*First Body Second$/,
      );
      expect(screen.getByText('First').id).toMatch(/^wave-message-bar-title-/);
      expect(screen.getByText('Second')).not.toHaveAttribute('id');
      expect(screen.getByText('Second')).toHaveClass(messageBarTitleClassNames.root);
      expect(warn.mock.calls).toEqual([[TITLE_MULTIPLE]]);
    });

    it('throws outside a MessageBar (C-CONTEXT)', () => {
      expectThrows(
        <MessageBar.Title>Heads up</MessageBar.Title>,
        '[WaveUI] MessageBar.Title must be used within <MessageBar>',
      );
      expectThrows(
        <MessageBar.Actions>
          <Button>Retry</Button>
        </MessageBar.Actions>,
        '[WaveUI] MessageBar.Actions must be used within <MessageBar>',
      );
    });
  });

  describe('labelling (D16)', () => {
    it('a live bar is not named by its title; the severity and the title are read first in its content', () => {
      render(
        <MessageBar status="warning">
          <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
        </MessageBar>,
      );
      const bar = screen.getByRole('alert');
      expect(bar).not.toHaveAttribute('aria-labelledby');
      expect(bar).toHaveAccessibleName('');
      expect(textColumn(bar)).toHaveTextContent(
        /^Warning:\s*Update available A new version is ready to install\.$/,
      );
      expect(within(bar).getByText('Warning:')).not.toHaveAttribute('id');
    });

    it.each(['region', 'group'] as const)(
      'a bar with role="%s" is named by the severity and the title',
      (role) => {
        render(
          <MessageBar status="warning" role={role}>
            <MessageBar.Title>Update available</MessageBar.Title>
            Install it tonight.
          </MessageBar>,
        );
        expect(screen.getByRole(role, { name: 'Warning: Update available' })).toBeInTheDocument();
        expect(findDanglingIdRefs()).toEqual([]);
      },
    );

    it('names the bar through the consumer id of the title', () => {
      render(
        <MessageBar role="region">
          <MessageBar.Title id="release-title">Release 4.2</MessageBar.Title>
          Notes below.
        </MessageBar>,
      );
      const bar = screen.getByRole('region', { name: 'Info: Release 4.2' });
      expect(bar.getAttribute('aria-labelledby')?.split(' ')).toContain('release-title');
    });

    it('leaves the severity out of the name when statusLabel is empty', () => {
      render(
        <MessageBar status="warning" statusLabel="" role="region">
          <MessageBar.Title id="t">Update available</MessageBar.Title>
          Install it tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region', { name: 'Update available' })).toHaveAttribute(
        'aria-labelledby',
        't',
      );
    });

    it('lets a consumer aria-label or aria-labelledby win', () => {
      const { unmount } = render(
        <MessageBar role="region" aria-label="Release notes">
          <MessageBar.Title>Update available</MessageBar.Title>
          Install it tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region', { name: 'Release notes' })).not.toHaveAttribute(
        'aria-labelledby',
      );
      unmount();

      render(
        <>
          <h2 id="notes-heading">Notes</h2>
          <MessageBar role="region" aria-labelledby="notes-heading">
            <MessageBar.Title>Update available</MessageBar.Title>
            Install it tonight.
          </MessageBar>
        </>,
      );
      expect(screen.getByRole('region', { name: 'Notes' })).toHaveAttribute(
        'aria-labelledby',
        'notes-heading',
      );
    });

    it('a forwarded aria-label={undefined} is not a name of the consumer', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar role="region" aria-label={undefined} aria-labelledby={undefined}>
          <MessageBar.Title>Update available</MessageBar.Title>
          Install it tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region', { name: 'Info: Update available' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns once about a region bar without a name', () => {
      const warn = spyOnWarn();
      render(<MessageBar role="region">Maintenance tonight.</MessageBar>);
      expect(warn.mock.calls).toEqual([[REGION_NAME]]);
    });

    it('does not warn about a region bar named by its title or by the consumer', () => {
      const warn = spyOnWarn();
      render(
        <>
          <MessageBar role="region">
            <MessageBar.Title>Maintenance</MessageBar.Title>
            Tonight.
          </MessageBar>
          <MessageBar role="region" aria-label="Maintenance">
            Tonight.
          </MessageBar>
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('an empty title names nothing, so a region bar warns', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar role="region">
          <MessageBar.Title>{''}</MessageBar.Title>
          Tonight.
        </MessageBar>,
      );
      expect(screen.getByRole('region')).not.toHaveAttribute('aria-labelledby');
      expect(warn.mock.calls).toEqual([[REGION_NAME]]);
    });

    it('the server HTML of a titled region bar references only ids it contains', () => {
      const html = renderToString(
        <MessageBar role="region" status="error">
          <MessageBar.Title>Sync paused</MessageBar.Title>
          Reconnect to continue.
        </MessageBar>,
      );
      expect(html).toContain('aria-labelledby=');
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
    });

    it('has no accessibility violations: a region bar with a title and actions', async () => {
      render(
        <MessageBar role="region" status="warning" onDismiss={() => {}}>
          <MessageBar.Title>Maintenance tonight</MessageBar.Title>
          The service is unavailable from 22:00 to 23:00 UTC.
          <MessageBar.Actions>
            <Button>Details</Button>
          </MessageBar.Actions>
        </MessageBar>,
      );
      await expectNoA11yViolations();
    });
  });
});
