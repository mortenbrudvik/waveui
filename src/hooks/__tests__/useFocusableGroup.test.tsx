import * as React from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { useFocusableGroup, type UseFocusableGroupOptions } from '../useFocusableGroup';

function Group({
  tabBehavior,
  label = 'Group',
  children,
}: UseFocusableGroupOptions & { label?: string; children?: React.ReactNode }) {
  const { groupProps } = useFocusableGroup({ tabBehavior });
  return (
    <div role="group" aria-label={label} {...groupProps}>
      {children ?? (
        <>
          <button type="button">One</button>
          <button type="button">Two</button>
        </>
      )}
    </div>
  );
}

function Page(props: React.ComponentProps<typeof Group>) {
  return (
    <>
      <button type="button">Before</button>
      <Group {...props} />
      <button type="button">After</button>
    </>
  );
}

const group = (label = 'Group') => screen.getByRole('group', { name: label });
const button = (name: string) => screen.getByRole('button', { name });

describe('useFocusableGroup', () => {
  it('returns the props of a focusable group element', () => {
    const html = renderToString(<Group tabBehavior="limited" />);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-focusable-group=""');
  });

  describe('unlimited (the default)', () => {
    it('is one more tab stop and leaves the inner elements reachable by Tab', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.tab();
      await user.tab();
      expect(group()).toHaveFocus();
      await user.tab();
      expect(button('One')).toHaveFocus();
      await user.tab();
      expect(button('Two')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
    });

    it('does not intercept Enter or Escape', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      expect(group()).toHaveFocus();
      await user.tab();
      await user.keyboard('{Escape}');
      expect(button('One')).toHaveFocus();
    });
  });

  describe.each(['limited', 'limited-trap-focus'] as const)('%s', (tabBehavior) => {
    it('is one tab stop until it is entered', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      expect(button('One')).toHaveAttribute('tabindex', '-1');
      expect(button('Two')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      await user.tab();
      expect(group()).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(group()).toHaveFocus();
    });

    it.each(['{Enter}', '{F2}'])('%s on the group enters it', async (key) => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      await user.tab();
      await user.tab();
      await user.keyboard(key);
      expect(button('One')).toHaveFocus();
      expect(button('Two')).not.toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(button('Two')).toHaveFocus();
    });

    it('Escape returns focus to the group and skips the inner elements again', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      await user.keyboard('{Escape}');
      expect(group()).toHaveFocus();
      expect(button('One')).toHaveAttribute('tabindex', '-1');
    });

    it('restores the original tabindex of an inner element when it is entered', async () => {
      const user = userEvent.setup();
      render(
        <Page tabBehavior={tabBehavior}>
          <button type="button" tabIndex={0}>
            Own
          </button>
          <button type="button" tabIndex={-1}>
            Skipped
          </button>
        </Page>,
      );
      expect(button('Own')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      expect(button('Own')).toHaveFocus();
      expect(button('Own')).toHaveAttribute('tabindex', '0');
      expect(button('Skipped')).toHaveAttribute('tabindex', '-1');
    });

    it('skips hidden elements when entering', async () => {
      const user = userEvent.setup();
      render(
        <Page tabBehavior={tabBehavior}>
          <button type="button" hidden>
            Hidden
          </button>
          <button type="button">Visible</button>
        </Page>,
      );
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      expect(button('Visible')).toHaveFocus();
    });

    it('skips content that is added later until the group is entered', async () => {
      function Growing() {
        const [extra, setExtra] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setExtra(true)}>
              Add
            </button>
            <Group tabBehavior={tabBehavior}>{extra && <button type="button">Late</button>}</Group>
          </>
        );
      }
      const user = userEvent.setup();
      render(<Growing />);
      await user.click(button('Add'));
      await act(async () => {});
      expect(button('Late')).toHaveAttribute('tabindex', '-1');
    });

    it('leaves when focus moves outside, and the inner elements are skipped again', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      act(() => button('After').focus());
      expect(button('One')).toHaveAttribute('tabindex', '-1');
    });

    it('leaves an Escape that an inner element consumed', async () => {
      const user = userEvent.setup();
      render(
        <Page tabBehavior={tabBehavior}>
          <input
            aria-label="Field"
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.preventDefault();
            }}
          />
        </Page>,
      );
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus();
    });

    it('ignores a key from a portaled popup opened inside', async () => {
      function WithPopup() {
        const [host, setHost] = React.useState<HTMLElement | null>(null);
        return (
          <>
            <div ref={setHost} />
            <Group tabBehavior={tabBehavior}>
              <button type="button">One</button>
              {host && createPortal(<button type="button">Portaled</button>, host)}
            </Group>
          </>
        );
      }
      render(<WithPopup />);
      const portaled = screen.getByRole('button', { name: 'Portaled' });
      portaled.focus();
      fireEvent.keyDown(portaled, { key: 'Escape' });
      expect(portaled).toHaveFocus();
    });

    it('Escape leaves only the innermost of nested groups', async () => {
      const user = userEvent.setup();
      render(
        <Page tabBehavior={tabBehavior}>
          <Group tabBehavior={tabBehavior} label="Inner">
            <button type="button">Deep</button>
          </Group>
        </Page>,
      );
      await user.tab();
      await user.tab();
      expect(group()).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(group('Inner')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(button('Deep')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(group('Inner')).toHaveFocus();
    });

    it('works in StrictMode', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <Page tabBehavior={tabBehavior} />
        </React.StrictMode>,
      );
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      expect(button('One')).toHaveFocus();
    });
  });

  describe('limited-trap-focus', () => {
    it('wraps Tab at the last inner element and Shift+Tab at the first', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior="limited-trap-focus" />);
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      await user.tab();
      expect(button('Two')).toHaveFocus();
      await user.tab();
      expect(button('One')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Two')).toHaveFocus();
    });
  });

  describe('limited', () => {
    it('Shift+Tab before the first inner element returns to the group', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior="limited" />);
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      await user.tab({ shift: true });
      expect(group()).toHaveFocus();
    });

    it('Tab past the last inner element leaves the group', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior="limited" />);
      await user.tab();
      await user.tab();
      await user.keyboard('{Enter}');
      await user.tab();
      await user.tab();
      expect(button('After')).toHaveFocus();
      expect(button('One')).toHaveAttribute('tabindex', '-1');
    });
  });
});
