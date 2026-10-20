import * as React from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { useFocusableGroup, type UseFocusableGroupOptions } from '../useFocusableGroup';
import { Toolbar } from '../../components/button/Toolbar';

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

/** Tab to the group element: Before, then the group. */
async function tabToGroup(user: ReturnType<typeof userEvent.setup>) {
  await user.tab();
  await user.tab();
  expect(group()).toHaveFocus();
}

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
      await tabToGroup(user);
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
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      expect(group()).toHaveFocus();
      await user.tab();
      await user.keyboard('{Escape}');
      expect(button('One')).toHaveFocus();
    });
  });

  describe.each(['limited', 'limited-trap-focus'] as const)('%s', (tabBehavior) => {
    it('is one tab stop in both directions until it is entered', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      await tabToGroup(user);
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(group()).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Before')).toHaveFocus();
    });

    it('never changes the tabindex of the elements inside', async () => {
      render(
        <Page tabBehavior={tabBehavior}>
          <button type="button" tabIndex={0}>
            Own
          </button>
          <button type="button" tabIndex={-1}>
            Skipped
          </button>
          <button type="button">Plain</button>
        </Page>,
      );
      expect(button('Own')).toHaveAttribute('tabindex', '0');
      expect(button('Skipped')).toHaveAttribute('tabindex', '-1');
      expect(button('Plain')).not.toHaveAttribute('tabindex');
    });

    it.each(['{Enter}', '{F2}'])('%s on the group enters it', async (key) => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      await tabToGroup(user);
      await user.keyboard(key);
      expect(button('One')).toHaveFocus();
      await user.tab();
      expect(button('Two')).toHaveFocus();
    });

    it('Escape returns focus to the group, and Tab skips the inner elements again', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      await user.keyboard('{Escape}');
      expect(group()).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
    });

    it('a click on an inner element enters the group: Tab moves between the inner elements', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior={tabBehavior} />);
      await user.click(button('One'));
      await user.tab();
      expect(button('Two')).toHaveFocus();
    });

    it('focus returning from a popup opened inside keeps the group entered', async () => {
      function WithPopup() {
        const [open, setOpen] = React.useState(false);
        const [host, setHost] = React.useState<HTMLElement | null>(null);
        return (
          <>
            <div ref={setHost} />
            <Group tabBehavior={tabBehavior}>
              <button type="button" onClick={() => setOpen(true)}>
                More
              </button>
              <button type="button">Three</button>
              {open &&
                host &&
                createPortal(
                  <button type="button" onClick={() => setOpen(false)}>
                    Close popup
                  </button>,
                  host,
                )}
            </Group>
            <button type="button">After</button>
          </>
        );
      }
      const user = userEvent.setup();
      render(<WithPopup />);
      await user.click(button('More'));
      await user.click(button('Close popup'));
      await act(async () => button('More').focus());
      await user.tab();
      expect(button('Three')).toHaveFocus();
    });

    it('a roving composite inside keeps its own tab stop and is skipped until the group is entered', async () => {
      const user = userEvent.setup();
      render(
        <Page tabBehavior={tabBehavior}>
          <Toolbar aria-label="Actions">
            <Toolbar.Button>Bold</Toolbar.Button>
            <Toolbar.Button>Italic</Toolbar.Button>
          </Toolbar>
        </Page>,
      );
      await tabToGroup(user);
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(group()).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
    });

    it('a button that gets enabled later is skipped until the group is entered', async () => {
      function Enabling() {
        const [enabled, setEnabled] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setEnabled(true)}>
              Enable
            </button>
            <Group tabBehavior={tabBehavior}>
              <button type="button" disabled={!enabled}>
                Save
              </button>
            </Group>
            <button type="button">After</button>
          </>
        );
      }
      const user = userEvent.setup();
      render(<Enabling />);
      await user.click(button('Enable'));
      await user.tab();
      expect(group()).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
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
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      expect(button('Visible')).toHaveFocus();
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
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus();
    });

    it('ignores a key from a portaled popup opened inside', () => {
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

    it('nested groups: Enter and Escape go one level at a time, and Escape on the inner group element goes to the outer one', async () => {
      const user = userEvent.setup();
      render(
        <Page tabBehavior={tabBehavior}>
          <Group tabBehavior={tabBehavior} label="Inner">
            <button type="button">Deep</button>
          </Group>
        </Page>,
      );
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      expect(group('Inner')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(button('Deep')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(group('Inner')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(group()).toHaveFocus();
    });

    it('Shift+Tab from outside lands on the outer group of nested groups', async () => {
      const user = userEvent.setup();
      render(
        <Page tabBehavior={tabBehavior}>
          <Group tabBehavior={tabBehavior} label="Inner">
            <button type="button">Deep</button>
          </Group>
        </Page>,
      );
      await user.click(button('After'));
      await user.tab({ shift: true });
      expect(group()).toHaveFocus();
    });

    it('works in StrictMode', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <Page tabBehavior={tabBehavior} />
        </React.StrictMode>,
      );
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      expect(button('One')).toHaveFocus();
      await user.tab({ shift: true });
      // Shift+Tab before the first element: the group element, or the last element when it traps.
      if (tabBehavior === 'limited') expect(group()).toHaveFocus();
      else expect(button('Two')).toHaveFocus();
    });
  });

  describe('limited', () => {
    it('Shift+Tab before the first inner element returns to the group', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior="limited" />);
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      await user.tab({ shift: true });
      expect(group()).toHaveFocus();
    });

    it('Tab past the last inner element leaves the group', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior="limited" />);
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      await user.tab();
      await user.tab();
      expect(button('After')).toHaveFocus();
    });
  });

  describe('limited-trap-focus', () => {
    it('wraps Tab at the last inner element and Shift+Tab at the first', async () => {
      const user = userEvent.setup();
      render(<Page tabBehavior="limited-trap-focus" />);
      await tabToGroup(user);
      await user.keyboard('{Enter}');
      await user.tab();
      expect(button('Two')).toHaveFocus();
      await user.tab();
      expect(button('One')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Two')).toHaveFocus();
    });
  });
});
