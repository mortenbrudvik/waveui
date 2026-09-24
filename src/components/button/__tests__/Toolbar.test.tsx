import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';
import type { ToolbarOwnProps, ToolbarProps } from '../Toolbar';
import { Button } from '../Button';
import { testSystemProps, renderWithProviders } from '../../../test-utils';

/** Three formatting buttons, the usual toolbar content. */
const FormattingButtons = () => (
  <>
    <Button appearance="subtle">Bold</Button>
    <Button appearance="subtle">Italic</Button>
    <Button appearance="subtle">Underline</Button>
  </>
);

const button = (name: string) => screen.getByRole('button', { name });

/** A child that disables one of its own buttons without the Toolbar re-rendering. */
const SelfDisablingGroup = () => {
  const [locked, setLocked] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setLocked((value) => !value)}>
        Lock
      </button>
      <button type="button" disabled={locked}>
        Share
      </button>
    </>
  );
};

describe('Toolbar', () => {
  testSystemProps(Toolbar, {
    expectedTag: 'div',
    displayName: 'Toolbar',
    polymorphic: true,
    defaultProps: { children: <FormattingButtons />, 'aria-label': 'Formatting' },
    a11yVariants: [{ name: 'vertical', props: { orientation: 'vertical' } }],
  });

  it('has role="toolbar" and its accessible name', () => {
    render(<Toolbar aria-label="Formatting">Content</Toolbar>);
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
  });

  it('renders as a different element via as prop', () => {
    render(
      <Toolbar as="nav" data-testid="toolbar" aria-label="Nav">
        Content
      </Toolbar>,
    );
    expect(screen.getByTestId('toolbar').tagName.toLowerCase()).toBe('nav');
    expect(screen.getByRole('toolbar', { name: 'Nav' })).toBe(screen.getByTestId('toolbar'));
  });

  describe('orientation (button-provider#12)', () => {
    it('is horizontal by default (aria-orientation)', () => {
      render(<Toolbar aria-label="Formatting">Content</Toolbar>);
      const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
      expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
      expect(toolbar).not.toHaveClass('flex-col');
    });

    it('vertical sets aria-orientation and stacks the items', () => {
      render(
        <Toolbar aria-label="Formatting" orientation="vertical">
          Content
        </Toolbar>,
      );
      const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
      expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
      expect(toolbar).toHaveClass('flex-col');
    });

    it('a forwarded undefined keeps role="toolbar" and aria-orientation', () => {
      render(
        <Toolbar
          aria-label="Formatting"
          orientation="vertical"
          role={undefined}
          aria-orientation={undefined}
        >
          Content
        </Toolbar>,
      );
      expect(screen.getByRole('toolbar', { name: 'Formatting' })).toHaveAttribute(
        'aria-orientation',
        'vertical',
      );
    });

    it('a defined consumer role and aria-orientation still win', () => {
      render(
        <Toolbar aria-label="Formatting" role="group" aria-orientation="vertical">
          Content
        </Toolbar>,
      );
      expect(screen.getByRole('group', { name: 'Formatting' })).toHaveAttribute(
        'aria-orientation',
        'vertical',
      );
    });
  });

  describe('keyboard (button-provider#12, APG Toolbar)', () => {
    it('is a single tab stop', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Toolbar aria-label="Formatting">
            <FormattingButtons />
          </Toolbar>
          <button type="button">After</button>
        </>,
      );
      expect(button('Bold')).toHaveAttribute('tabindex', '0');
      expect(button('Italic')).toHaveAttribute('tabindex', '-1');
      expect(button('Underline')).toHaveAttribute('tabindex', '-1');

      button('Before').focus();
      await user.tab();
      expect(button('Bold')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Bold')).toHaveFocus();
    });

    it('ArrowRight/ArrowLeft move between items and wrap', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Formatting">
          <FormattingButtons />
        </Toolbar>,
      );
      await user.tab();
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Underline')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('Underline')).toHaveFocus();
      // Up/Down do nothing in a horizontal toolbar.
      await user.keyboard('{ArrowDown}');
      expect(button('Underline')).toHaveFocus();
    });

    it('Home and End move to the first and last item', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Formatting">
          <FormattingButtons />
        </Toolbar>,
      );
      await user.tab();
      await user.keyboard('{End}');
      expect(button('Underline')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('Bold')).toHaveFocus();
    });

    it('keeps the last focused item as the tab stop', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Toolbar aria-label="Formatting">
            <FormattingButtons />
          </Toolbar>
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      expect(button('Italic')).toHaveAttribute('tabindex', '0');
      expect(button('Bold')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Italic')).toHaveFocus();
    });

    it('vertical toolbars use ArrowDown/ArrowUp', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Formatting" orientation="vertical">
          <FormattingButtons />
        </Toolbar>,
      );
      await user.tab();
      await user.keyboard('{ArrowDown}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Bold')).toHaveFocus();
    });

    it('mirrors Left/Right in RTL', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <Toolbar aria-label="Formatting">
          <FormattingButtons />
        </Toolbar>,
        { dir: 'rtl' },
      );
      await user.tab();
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Bold')).toHaveFocus();
    });

    it('skips disabled controls', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Formatting">
          <Button appearance="subtle">Bold</Button>
          <Button appearance="subtle" disabled>
            Italic
          </Button>
          <Button appearance="subtle">Underline</Button>
        </Toolbar>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(button('Underline')).toHaveFocus();
    });

    it('skips a child that disables itself without a Toolbar re-render, then includes it again', async () => {
      const user = userEvent.setup();
      // The Toolbar receives no new props: only the child's own state toggles `disabled`.
      render(
        <Toolbar aria-label="Sharing">
          <SelfDisablingGroup />
          <button type="button">Print</button>
        </Toolbar>,
      );

      await user.click(button('Lock'));
      expect(button('Share')).toBeDisabled();
      await user.keyboard('{ArrowRight}');
      expect(button('Print')).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(button('Lock')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(button('Share')).toBeEnabled();
      await user.keyboard('{ArrowRight}');
      expect(button('Share')).toHaveFocus();
    });

    it('moves the tab stop off a control that disables itself', async () => {
      const user = userEvent.setup();
      const Lockable = () => {
        const [locked, setLocked] = React.useState(false);
        return (
          <button type="button" disabled={locked} onClick={() => setLocked(true)}>
            Archive
          </button>
        );
      };
      render(
        <Toolbar aria-label="Mail">
          <Lockable />
          <button type="button">Reply</button>
        </Toolbar>,
      );
      expect(button('Archive')).toHaveAttribute('tabindex', '0');
      await user.click(button('Archive'));
      expect(button('Archive')).toBeDisabled();
      // The MutationObserver re-stamps without a Toolbar re-render.
      await vi.waitFor(() => expect(button('Reply')).toHaveAttribute('tabindex', '0'));
    });

    it('an Input child keeps Left/Right for its caret', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Search tools">
          <button type="button">Filter</button>
          <input aria-label="Search" defaultValue="wave" />
          <button type="button">Go</button>
        </Toolbar>,
      );
      const input = screen.getByRole('textbox', { name: 'Search' });
      await user.click(input);
      expect(fireEvent.keyDown(input, { key: 'ArrowLeft' })).toBe(true);
      expect(input).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();

      // Tab stops: the text field is still reachable, but arrows start from the buttons.
      button('Filter').focus();
      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();
    });

    it('leaves a child with tabindex=-1 inner buttons untouched', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Zoom">
          <button type="button">Reset</button>
          <span>
            <button type="button" tabIndex={-1}>
              Zoom in
            </button>
          </span>
          <button type="button">Fit</button>
        </Toolbar>,
      );
      expect(button('Zoom in')).toHaveAttribute('tabindex', '-1');
      await user.tab();
      expect(button('Reset')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Fit')).toHaveFocus();
      expect(button('Zoom in')).toHaveAttribute('tabindex', '-1');
      expect(button('Zoom in')).not.toHaveAttribute('data-roving-value');
    });

    it('a consumer onKeyDown runs first and can cancel the navigation with preventDefault', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
        if (event.key === 'ArrowRight') event.preventDefault();
      });
      render(
        <Toolbar aria-label="Formatting" onKeyDown={onKeyDown}>
          <FormattingButtons />
        </Toolbar>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(onKeyDown).toHaveBeenCalled();
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{End}');
      expect(button('Underline')).toHaveFocus();
    });

    it('a consumer onFocus is called and the ref receives the element', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Toolbar aria-label="Formatting" onFocus={onFocus} ref={ref}>
          <FormattingButtons />
        </Toolbar>,
      );
      expect(ref.current).toBe(screen.getByRole('toolbar'));
      await user.tab();
      expect(onFocus).toHaveBeenCalled();
    });
  });

  it('uses tokens for its border', () => {
    render(<Toolbar aria-label="Formatting">Content</Toolbar>);
    expect(screen.getByRole('toolbar')).toHaveClass('border', 'border-border', 'rounded');
  });

  describe('types (button-provider#8, #27)', () => {
    it('is polymorphic and keeps the 0.4 ToolbarProps name', () => {
      expectTypeOf<ToolbarProps>().toEqualTypeOf<ToolbarProps<'div'>>();
      expectTypeOf<ToolbarProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<keyof ToolbarOwnProps>().toEqualTypeOf<'orientation'>();
      const elements = [
        <Toolbar key="1" as="nav" aria-label="Nav" />,
        // @ts-expect-error orientation is 'horizontal' | 'vertical'
        <Toolbar key="2" orientation="diagonal" />,
        // @ts-expect-error href does not exist on <div>
        <Toolbar key="3" href="/nope" />,
      ];
      expect(elements).toHaveLength(3);
    });

    it('ToolbarProps (0.4 name) stays extendable by interfaces', () => {
      interface MyToolbarProps extends ToolbarProps {
        extra?: string;
      }
      expectTypeOf<MyToolbarProps>().toHaveProperty('orientation');
      expectTypeOf<MyToolbarProps>().toHaveProperty('extra');
      expectTypeOf<MyToolbarProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    });
  });
});
