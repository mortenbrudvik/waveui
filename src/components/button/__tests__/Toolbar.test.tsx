import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';
import type { ToolbarOwnProps, ToolbarProps } from '../Toolbar';
import { Button } from '../Button';
import { Link } from '../Link';
import { MenuButton } from '../MenuButton';
import { Checkbox } from '../../input/Checkbox';
import { Dropdown } from '../../input/Dropdown';
import { RadioGroup } from '../../input/RadioGroup';
import { Menu } from '../../navigation/Menu';
import { Popover } from '../../overlays/Popover';
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

/** The elements inside the toolbar that hold a Tab stop (`tabindex="0"`). */
const tabStops = () =>
  Array.from(screen.getByRole('toolbar').querySelectorAll<HTMLElement>('[tabindex="0"]'));

/** A Dropdown (select-only combobox) with two sizes. */
const SizeDropdown = (props: { name?: string }) => (
  <Dropdown aria-label="Size" defaultValue="m" {...props}>
    <Dropdown.Option value="s">Small</Dropdown.Option>
    <Dropdown.Option value="m">Medium</Dropdown.Option>
  </Dropdown>
);

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
      // Focusing an item updates the Toolbar's roving state, so it goes through act().
      act(() => button('Filter').focus());
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

    it('keys in a menu opened from a toolbar MenuButton stay in the menu', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Formatting">
          <Button appearance="subtle">Bold</Button>
          <Menu>
            <Menu.Trigger>
              <MenuButton appearance="subtle">Insert</MenuButton>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Table</Menu.Item>
              <Menu.Item>Image</Menu.Item>
            </Menu.Popover>
          </Menu>
          <Button appearance="subtle">Underline</Button>
        </Toolbar>,
      );
      const menuitem = (name: string) => screen.getByRole('menuitem', { name });
      await user.click(button('Insert'));
      expect(menuitem('Table')).toHaveFocus();

      // The menu leaves Left/Right to the page; they bubble through the Toolbar (React tree) but
      // must not move focus back into it.
      await user.keyboard('{ArrowRight}');
      expect(menuitem('Table')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(menuitem('Table')).toHaveFocus();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await user.keyboard('{End}');
      expect(menuitem('Image')).toHaveFocus();
    });

    it('keys in a Popover opened from a toolbar button stay in the Popover', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Formatting">
          <Button appearance="subtle">Bold</Button>
          <Popover>
            <Popover.Trigger>
              <Button appearance="subtle">Link</Button>
            </Popover.Trigger>
            <Popover.Content aria-label="Insert link">
              <Button>Apply</Button>
              <Button>Remove</Button>
            </Popover.Content>
          </Popover>
          <Button appearance="subtle">Underline</Button>
        </Toolbar>,
      );
      await user.click(button('Link'));
      act(() => button('Remove').focus());
      for (const key of ['{End}', '{Home}', '{ArrowRight}', '{ArrowLeft}']) {
        await user.keyboard(key);
        expect(button('Remove')).toHaveFocus();
      }
      expect(button('Link')).toHaveAttribute('tabindex', '0');
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

    it('a link and a Button as="div" are controls: one tab stop, reached by the arrows (button-tests-1)', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Toolbar aria-label="Tools">
            <Button appearance="subtle">Filter</Button>
            <Link href="#help">Help</Link>
            <Button as="div" appearance="subtle">
              More
            </Button>
          </Toolbar>
          <button type="button">After</button>
        </>,
      );
      const help = screen.getByRole('link', { name: 'Help' });
      expect(tabStops()).toEqual([button('Filter')]);
      expect(help).toHaveAttribute('tabindex', '-1');
      expect(button('More')).toHaveAttribute('tabindex', '-1');

      await user.tab();
      expect(button('Filter')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Filter')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(help).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('More')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Filter')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('More')).toHaveFocus();
    });
  });

  describe('value controls with a hidden form input (x-keyboard-1)', () => {
    it.each([
      [
        'a named Checkbox',
        <Checkbox key="grid" name="grid" defaultChecked label="Grid" />,
        'grid',
        () => screen.getByRole('checkbox', { name: 'Grid' }),
      ],
      [
        'a named Dropdown',
        <SizeDropdown key="size" name="size" />,
        'size',
        () => screen.getByRole('combobox', { name: 'Size' }),
      ],
    ])(
      '%s as the last child: End, wrap-around, a re-render and Tab reach the control, never its hidden input',
      async (_name, lastChild, inputName, control) => {
        const user = userEvent.setup();
        const View = ({ label }: { label: string }) => (
          <>
            <button type="button">Before</button>
            <Toolbar aria-label={label}>
              <Button appearance="subtle">Bold</Button>
              <Button appearance="subtle">Italic</Button>
              {lastChild}
            </Toolbar>
            <button type="button">After</button>
          </>
        );
        const { rerender } = render(<View label="View" />);
        const hiddenInput = screen.getByRole('toolbar').querySelector('input[type="hidden"]');
        expect(hiddenInput).toHaveAttribute('name', inputName);

        button('Before').focus();
        await user.tab();
        expect(button('Bold')).toHaveFocus();
        await user.keyboard('{End}');
        expect(control()).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(button('Bold')).toHaveFocus();
        await user.keyboard('{ArrowLeft}');
        expect(control()).toHaveFocus();
        expect(tabStops()).toEqual([control()]);

        // A Toolbar re-render stamps the tab indexes again: the stop stays on the control.
        rerender(<View label="View options" />);
        expect(tabStops()).toEqual([control()]);
        expect(hiddenInput).not.toHaveAttribute('tabindex');

        await user.tab();
        expect(button('After')).toHaveFocus();
        await user.tab({ shift: true });
        expect(control()).toHaveFocus();
        button('Before').focus();
        await user.tab();
        expect(control()).toHaveFocus();
      },
    );
  });

  describe('nested widgets keep every control reachable (x-keyboard-2)', () => {
    it('a RadioGroup child keeps its own keys, and the toolbar keeps its Tab stop on the control focused last', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Toolbar aria-label="Text">
            <Button appearance="subtle">Bold</Button>
            <RadioGroup aria-label="Align" orientation="horizontal" defaultValue="left">
              <RadioGroup.Item value="left" label="Left" />
              <RadioGroup.Item value="center" label="Center" />
            </RadioGroup>
            <Button appearance="subtle">Copy</Button>
          </Toolbar>
          <button type="button">After</button>
        </>,
      );
      const radio = (name: string) => screen.getByRole('radio', { name });

      button('Before').focus();
      await user.tab();
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(radio('Left')).toHaveFocus();
      // The radio group handles its own arrows (APG radio group): Right selects the next radio.
      await user.keyboard('{ArrowRight}');
      expect(radio('Center')).toHaveFocus();
      expect(radio('Center')).toBeChecked();
      // The group keeps its own stop; the toolbar's stays on the last focused control.
      expect(tabStops()).toEqual([button('Bold'), radio('Center')]);
      expect(button('Copy')).toHaveAttribute('tabindex', '-1');

      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(radio('Center')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Bold')).toHaveFocus();

      // From the toolbar's own controls, the keys pass the group as one control.
      await user.keyboard('{End}');
      expect(button('Copy')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('Copy')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(radio('Center')).toHaveFocus();
      expect(tabStops()).toEqual([radio('Center'), button('Copy')]);

      // Every control stays reachable by Tab and Shift+Tab.
      button('Before').focus();
      await user.tab();
      expect(radio('Center')).toHaveFocus();
      await user.tab();
      expect(button('Copy')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Copy')).toHaveFocus();
      await user.tab({ shift: true });
      expect(radio('Center')).toHaveFocus();
    });

    it('Left/Right leave a Dropdown child, which can hold the Tab stop like any control', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Toolbar aria-label="Text">
            <Button appearance="subtle">Bold</Button>
            <SizeDropdown />
            <Button appearance="subtle">Italic</Button>
          </Toolbar>
          <button type="button">After</button>
        </>,
      );
      const size = screen.getByRole('combobox', { name: 'Size' });

      button('Before').focus();
      await user.tab();
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(size).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(size).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('Bold')).toHaveFocus();
      await user.keyboard('{End}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('Bold')).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(size).toHaveFocus();
      expect(tabStops()).toEqual([size]);
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(size).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('Bold')).toHaveFocus();
      expect(tabStops()).toEqual([button('Bold')]);
      // Left/Right never opened the listbox.
      expect(size).toHaveAttribute('aria-expanded', 'false');
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
