import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
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
  expectThrows,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';

const TITLE_UNSCANNED =
  '[WaveUI] MessageBar.Title is not a direct child of MessageBar, so it is not placed first in the text. Make it a direct child.';
const ACTIONS_UNSCANNED =
  '[WaveUI] MessageBar.Actions is not a direct child of MessageBar, so it is not placed in the action area. Make it a direct child.';
const TITLE_MULTIPLE =
  '[WaveUI] MessageBar.Title: this MessageBar already has a title (its first MessageBar.Title among its direct children), so this one renders as body text. Give a bar one title.';

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
});
