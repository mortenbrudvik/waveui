import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarGroup,
  ToolbarRadioButton,
  ToolbarRadioGroup,
  ToolbarToggleButton,
} from '../Toolbar';
import type {
  ToolbarButtonProps,
  ToolbarProps,
  ToolbarRadioButtonProps,
  ToolbarToggleButtonProps,
} from '../Toolbar';
import { Button } from '../Button';
import { buttonClassName } from '../buttonStyles';
import {
  expectNoA11yViolations,
  expectThrows,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const button = (name: string) => screen.getByRole('button', { name });
const radio = (name: string) => screen.getByRole('radio', { name });

/** The class list of an element as a sorted array (order-independent comparison). */
const classesOf = (el: Element) => Array.from(el.classList).sort();
/** The classes of a `buttonClassName()` result as a sorted array. */
const classesFrom = (value: string) => value.split(/\s+/).filter(Boolean).sort();

/** The elements inside the toolbar that hold a Tab stop (`tabindex="0"`). */
const tabStops = () =>
  Array.from(screen.getByRole('toolbar').querySelectorAll<HTMLElement>('[tabindex="0"]'));

const ToolbarWrapper = ({ children }: { children: React.ReactNode }) => (
  <Toolbar aria-label="Tools">{children}</Toolbar>
);

const RadioGroupWrapper = ({ children }: { children: React.ReactNode }) => (
  <Toolbar aria-label="Tools">
    <Toolbar.RadioGroup aria-label="Alignment">{children}</Toolbar.RadioGroup>
  </Toolbar>
);

const GlyphIcon = () => (
  <svg data-testid="glyph" viewBox="0 0 16 16" width="16" height="16">
    <path d="M2 2h12v12H2z" fill="currentColor" />
  </svg>
);

/** The text-editor toolbar of the stories: toggles, an alignment radio group, dividers, a group. */
function TextEditor(props: Partial<ToolbarProps>) {
  return (
    <Toolbar aria-label="Text formatting" {...props}>
      <Toolbar.ToggleButton name="format" value="bold">
        Bold
      </Toolbar.ToggleButton>
      <Toolbar.ToggleButton name="format" value="italic">
        Italic
      </Toolbar.ToggleButton>
      <Toolbar.Divider />
      <Toolbar.RadioGroup aria-label="Alignment">
        <Toolbar.RadioButton name="align" value="left">
          Left
        </Toolbar.RadioButton>
        <Toolbar.RadioButton name="align" value="center">
          Center
        </Toolbar.RadioButton>
        <Toolbar.RadioButton name="align" value="right">
          Right
        </Toolbar.RadioButton>
      </Toolbar.RadioGroup>
      <Toolbar.Divider />
      <Toolbar.Group aria-label="Actions">
        <Toolbar.Button>Share</Toolbar.Button>
      </Toolbar.Group>
    </Toolbar>
  );
}

/** A toolbar whose alignment group has a disabled radio in the middle. */
function AlignmentToolbar(props: Partial<ToolbarProps>) {
  return (
    <>
      <Toolbar aria-label="Paragraph" {...props}>
        <Toolbar.Button>Indent</Toolbar.Button>
        <Toolbar.RadioGroup aria-label="Alignment">
          <Toolbar.RadioButton name="align" value="left">
            Left
          </Toolbar.RadioButton>
          <Toolbar.RadioButton name="align" value="center" disabled>
            Center
          </Toolbar.RadioButton>
          <Toolbar.RadioButton name="align" value="right">
            Right
          </Toolbar.RadioButton>
          <Toolbar.RadioButton name="align" value="justify">
            Justify
          </Toolbar.RadioButton>
        </Toolbar.RadioGroup>
        <Toolbar.Button>Outdent</Toolbar.Button>
      </Toolbar>
      <button type="button">After</button>
    </>
  );
}

describe('Toolbar parts', () => {
  describe('system props', () => {
    describe('Toolbar.Button', () => {
      testSystemProps(ToolbarButton, {
        expectedTag: 'button',
        displayName: 'ToolbarButton',
        polymorphic: true,
        defaultProps: { children: 'Share' },
        conflictingClass: { className: 'px-8', overrides: 'px-3' },
        wrapper: ToolbarWrapper,
        a11yVariants: [
          { name: 'vertical with an icon', props: { vertical: true, icon: <GlyphIcon /> } },
        ],
      });
    });

    describe('Toolbar.ToggleButton', () => {
      testSystemProps(ToolbarToggleButton, {
        expectedTag: 'button',
        displayName: 'ToolbarToggleButton',
        defaultProps: { name: 'format', value: 'bold', children: 'Bold' },
        conflictingClass: { className: 'px-8', overrides: 'px-3' },
        wrapper: ToolbarWrapper,
        a11yVariants: [
          {
            name: 'isAccessible, icon only',
            props: {
              isAccessible: true,
              icon: <GlyphIcon />,
              'aria-label': 'Bold',
              children: undefined,
            },
          },
        ],
      });
    });

    describe('Toolbar.RadioButton', () => {
      testSystemProps(ToolbarRadioButton, {
        expectedTag: 'button',
        displayName: 'ToolbarRadioButton',
        defaultProps: { name: 'align', value: 'left', children: 'Left' },
        conflictingClass: { className: 'px-8', overrides: 'px-3' },
        wrapper: RadioGroupWrapper,
      });
    });

    describe('Toolbar.RadioGroup', () => {
      testSystemProps(ToolbarRadioGroup, {
        expectedTag: 'div',
        displayName: 'ToolbarRadioGroup',
        defaultProps: {
          'aria-label': 'Alignment',
          children: (
            <>
              <Toolbar.RadioButton name="align" value="left">
                Left
              </Toolbar.RadioButton>
              <Toolbar.RadioButton name="align" value="right">
                Right
              </Toolbar.RadioButton>
            </>
          ),
        },
        conflictingClass: { className: 'gap-3', overrides: 'gap-1' },
        wrapper: ToolbarWrapper,
      });
    });

    describe('Toolbar.Group', () => {
      testSystemProps(ToolbarGroup, {
        expectedTag: 'div',
        displayName: 'ToolbarGroup',
        defaultProps: { children: <Toolbar.Button>Share</Toolbar.Button> },
        conflictingClass: { className: 'gap-3', overrides: 'gap-1' },
        wrapper: ToolbarWrapper,
        a11yVariants: [{ name: 'named', props: { 'aria-label': 'Actions' } }],
      });
    });

    describe('Toolbar.Divider', () => {
      testSystemProps(ToolbarDivider, {
        expectedTag: 'div',
        displayName: 'ToolbarDivider',
        conflictingClass: { className: 'mx-3', overrides: 'mx-1' },
        wrapper: ToolbarWrapper,
      });
    });
  });

  testNoImplicitSubmit(TextEditor);

  it('a text-editor toolbar has no axe violations (with checked values, in RTL too)', async () => {
    const { unmount } = render(
      <TextEditor defaultCheckedValues={{ format: ['bold'], align: ['center'] }} />,
    );
    await expectNoA11yViolations();
    unmount();
    renderWithProviders(<TextEditor orientation="vertical" size="small" />, { dir: 'rtl' });
    await expectNoA11yViolations();
  });

  describe('Toolbar.Button', () => {
    it("is a subtle Button of the toolbar's size", () => {
      render(
        <Toolbar aria-label="Tools" size="large">
          <Toolbar.Button>Share</Toolbar.Button>
        </Toolbar>,
      );
      expect(classesOf(button('Share'))).toEqual(
        classesFrom(buttonClassName({ appearance: 'subtle', size: 'large' })),
      );
      expect(button('Share')).toHaveAttribute('type', 'button');
      expect(button('Share')).not.toHaveAttribute('data-vertical');
    });

    it('vertical puts the icon above a caption-size label and marks data-vertical', () => {
      render(
        <Toolbar aria-label="Tools">
          <Toolbar.Button vertical icon={<GlyphIcon />}>
            Share
          </Toolbar.Button>
        </Toolbar>,
      );
      const share = button('Share');
      expect(share).toHaveAttribute('data-vertical', '');
      expect(share).toHaveClass(
        'h-auto',
        'min-w-0',
        'flex-col',
        'gap-0.5',
        'px-2',
        'py-1',
        'text-caption-1',
      );
      expect(share).not.toHaveClass('h-8', 'min-w-24', 'px-3', 'text-body-1', 'gap-1.5');
      const iconBox = screen.getByTestId('glyph').parentElement;
      expect(iconBox).toHaveAttribute('aria-hidden', 'true');
      expect(iconBox).toHaveClass('size-6', 'justify-center', '[&>svg]:size-full');
      expect(share.firstElementChild).toBe(iconBox);
    });

    it.each([
      ['extra-small', 'size-5'],
      ['small', 'size-5'],
      ['medium', 'size-6'],
      ['large', 'size-6'],
      ['extra-large', 'size-6'],
    ] as const)('vertical at size="%s" has a %s icon box', (size, box) => {
      render(
        <Toolbar aria-label="Tools" size={size}>
          <Toolbar.Button vertical icon={<GlyphIcon />}>
            Share
          </Toolbar.Button>
        </Toolbar>,
      );
      const iconBox = screen.getByTestId('glyph').parentElement;
      expect(iconBox).toHaveClass(box);
      expect(iconBox).not.toHaveClass(box === 'size-5' ? 'size-6' : 'size-5');
    });

    it('vertical keeps the attributes and classes of an icon slot object', () => {
      render(
        <Toolbar aria-label="Tools">
          <Toolbar.Button
            vertical
            icon={{ children: <GlyphIcon />, className: 'text-primary', 'data-part': 'icon' }}
          >
            Share
          </Toolbar.Button>
        </Toolbar>,
      );
      const iconBox = screen.getByTestId('glyph').parentElement;
      expect(iconBox).toHaveClass('size-6', 'text-primary', 'inline-flex', 'shrink-0');
      expect(iconBox).toHaveAttribute('data-part', 'icon');
      expect(iconBox).toHaveAttribute('aria-hidden', 'true');
    });

    it('as="a" renders a link that is one of the toolbar controls', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Tools">
          <Toolbar.Button>Share</Toolbar.Button>
          <Toolbar.Button as="a" href="#help">
            Help
          </Toolbar.Button>
        </Toolbar>,
      );
      const help = screen.getByRole('link', { name: 'Help' });
      expect(help.tagName).toBe('A');
      expect(help).toHaveAttribute('href', '#help');
      expect(help).toHaveAttribute('tabindex', '-1');
      await user.tab();
      await user.keyboard('{ArrowRight}');
      expect(help).toHaveFocus();
    });
  });

  describe('Toolbar.ToggleButton', () => {
    it('adds its value to checkedValues[name] and removes it again', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(<TextEditor onCheckedValuesChange={onCheckedValuesChange} />);
      await user.click(button('Italic'));
      await user.click(button('Bold'));
      await user.click(button('Italic'));
      expect(onCheckedValuesChange.mock.calls.map(([values]) => values)).toEqual([
        { format: ['italic'] },
        { format: ['italic', 'bold'] },
        { format: ['bold'] },
      ]);
      expect(button('Bold')).toHaveAttribute('aria-pressed', 'true');
      expect(button('Italic')).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders aria-pressed and data-pressed, and no data-checked without a checked role', async () => {
      const user = userEvent.setup();
      render(<TextEditor />);
      const bold = button('Bold');
      expect(bold).toHaveAttribute('aria-pressed', 'false');
      expect(bold).not.toHaveAttribute('data-pressed');
      await user.click(bold);
      expect(bold).toHaveAttribute('aria-pressed', 'true');
      expect(bold).toHaveAttribute('data-pressed', '');
      expect(bold).not.toHaveAttribute('data-checked');
      expect(bold).not.toHaveAttribute('aria-checked');
    });

    it('uses name and value as binding keys only, not as attributes', () => {
      render(<TextEditor />);
      expect(button('Bold')).not.toHaveAttribute('name');
      expect(button('Bold')).not.toHaveAttribute('value');
      expect(radio('Left')).not.toHaveAttribute('name');
      expect(radio('Left')).not.toHaveAttribute('value');
    });

    it('a consumer onClick runs first; preventDefault() cancels the change', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      const onCheckedValuesChange = vi.fn(() => order.push('change'));
      const onClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => {
        order.push('consumer');
        if (event.currentTarget.dataset.locked === 'true') event.preventDefault();
      });
      const { rerender } = render(
        <Toolbar aria-label="Tools" onCheckedValuesChange={onCheckedValuesChange}>
          <Toolbar.ToggleButton name="format" value="bold" onClick={onClick}>
            Bold
          </Toolbar.ToggleButton>
        </Toolbar>,
      );
      await user.click(button('Bold'));
      expect(order).toEqual(['consumer', 'change']);
      rerender(
        <Toolbar aria-label="Tools" onCheckedValuesChange={onCheckedValuesChange}>
          <Toolbar.ToggleButton name="format" value="bold" onClick={onClick} data-locked="true">
            Bold
          </Toolbar.ToggleButton>
        </Toolbar>,
      );
      await user.click(button('Bold'));
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
      expect(button('Bold')).toHaveAttribute('aria-pressed', 'true');
    });

    it('passes isAccessible and disabledFocusable through', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(
        <Toolbar
          aria-label="Tools"
          defaultCheckedValues={{ format: ['bold'] }}
          onCheckedValuesChange={onCheckedValuesChange}
        >
          <Toolbar.ToggleButton name="format" value="bold" isAccessible>
            Bold
          </Toolbar.ToggleButton>
          <Toolbar.ToggleButton name="format" value="italic" disabledFocusable>
            Italic
          </Toolbar.ToggleButton>
        </Toolbar>,
      );
      expect(classesOf(button('Bold'))).toEqual(
        classesFrom(buttonClassName({ appearance: 'subtle', pressed: true, accessible: true })),
      );
      const italic = button('Italic');
      expect(italic).toHaveAttribute('aria-disabled', 'true');
      await user.click(italic);
      expect(onCheckedValuesChange).not.toHaveBeenCalled();
      expect(italic).toHaveAttribute('aria-pressed', 'false');
    });

    it('with a checked role renders aria-checked and data-checked (and data-pressed)', () => {
      render(
        <Toolbar aria-label="View" defaultCheckedValues={{ view: ['grid'] }}>
          <Toolbar.ToggleButton name="view" value="grid" role="checkbox">
            Grid
          </Toolbar.ToggleButton>
        </Toolbar>,
      );
      const grid = screen.getByRole('checkbox', { name: 'Grid' });
      expect(grid).toHaveAttribute('aria-checked', 'true');
      expect(grid).toHaveAttribute('data-checked', '');
      expect(grid).toHaveAttribute('data-pressed', '');
      expect(grid).not.toHaveAttribute('aria-pressed');
    });
  });

  describe('Toolbar.RadioButton', () => {
    it('is a radio (aria-checked, data-checked and data-pressed while checked; no aria-pressed)', async () => {
      const user = userEvent.setup();
      render(<TextEditor />);
      const left = radio('Left');
      expect(left.tagName).toBe('BUTTON');
      expect(left).toHaveAttribute('aria-checked', 'false');
      expect(left).not.toHaveAttribute('data-checked');
      expect(left).not.toHaveAttribute('data-pressed');
      await user.click(left);
      expect(left).toHaveAttribute('aria-checked', 'true');
      expect(left).toHaveAttribute('data-checked', '');
      expect(left).toHaveAttribute('data-pressed', '');
      expect(left).not.toHaveAttribute('aria-pressed');
      expect(classesOf(left)).toEqual(
        classesFrom(buttonClassName({ appearance: 'subtle', pressed: true })),
      );
    });

    it('radios of one name are exclusive; a click on the checked radio changes and calls nothing', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(<TextEditor onCheckedValuesChange={onCheckedValuesChange} />);
      await user.click(radio('Left'));
      await user.click(radio('Right'));
      expect(radio('Left')).toHaveAttribute('aria-checked', 'false');
      expect(radio('Right')).toHaveAttribute('aria-checked', 'true');
      await user.click(radio('Right'));
      expect(radio('Right')).toHaveAttribute('aria-checked', 'true');
      expect(onCheckedValuesChange.mock.calls.map(([values]) => values)).toEqual([
        { align: ['left'] },
        { align: ['right'] },
      ]);
    });

    it('radio groups of different names keep their own value', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Layout">
          <Toolbar.RadioGroup aria-label="Alignment">
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
            <Toolbar.RadioButton name="align" value="right">
              Right
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
          <Toolbar.RadioGroup aria-label="Spacing">
            <Toolbar.RadioButton name="spacing" value="single">
              Single
            </Toolbar.RadioButton>
            <Toolbar.RadioButton name="spacing" value="double">
              Double
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
        </Toolbar>,
      );
      await user.click(radio('Right'));
      await user.click(radio('Double'));
      expect(radio('Right')).toHaveAttribute('aria-checked', 'true');
      expect(radio('Double')).toHaveAttribute('aria-checked', 'true');
      expect(radio('Left')).toHaveAttribute('aria-checked', 'false');
      expect(radio('Single')).toHaveAttribute('aria-checked', 'false');
    });

    it('Space and Enter check a radio and press a toggle', async () => {
      const user = userEvent.setup();
      render(<TextEditor />);
      await user.tab();
      expect(button('Bold')).toHaveFocus();
      await user.keyboard(' ');
      expect(button('Bold')).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('{Enter}');
      expect(button('Bold')).toHaveAttribute('aria-pressed', 'false');
      act(() => radio('Center').focus());
      await user.keyboard(' ');
      expect(radio('Center')).toHaveAttribute('aria-checked', 'true');
      act(() => radio('Right').focus());
      await user.keyboard('{Enter}');
      expect(radio('Right')).toHaveAttribute('aria-checked', 'true');
      expect(radio('Center')).toHaveAttribute('aria-checked', 'false');
    });

    it('a consumer onClick runs first; preventDefault() cancels the check', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(
        <Toolbar aria-label="Tools" onCheckedValuesChange={onCheckedValuesChange}>
          <Toolbar.RadioGroup aria-label="Alignment">
            <Toolbar.RadioButton
              name="align"
              value="left"
              onClick={(event) => event.preventDefault()}
            >
              Left
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
        </Toolbar>,
      );
      await user.click(radio('Left'));
      expect(onCheckedValuesChange).not.toHaveBeenCalled();
      expect(radio('Left')).toHaveAttribute('aria-checked', 'false');
    });

    it('its role cannot be replaced', () => {
      render(
        <RadioGroupWrapper>
          {/* @ts-expect-error role is not a prop of Toolbar.RadioButton */}
          <Toolbar.RadioButton name="align" value="left" role="checkbox">
            Left
          </Toolbar.RadioButton>
        </RadioGroupWrapper>,
      );
      expect(radio('Left')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('keyboard (APG Toolbar)', () => {
    it('the arrows move through toggles and radios without pressing or checking them', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(<TextEditor onCheckedValuesChange={onCheckedValuesChange} />);
      await user.tab();
      const control = (name: string) => screen.queryByRole('button', { name }) ?? radio(name);
      const order = ['Italic', 'Left', 'Center', 'Right', 'Share', 'Bold'];
      for (const name of order) {
        await user.keyboard('{ArrowRight}');
        expect(control(name)).toHaveFocus();
      }
      await user.keyboard('{ArrowLeft}');
      expect(button('Share')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(radio('Right')).toHaveFocus();
      await user.keyboard('{End}');
      expect(button('Share')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('Bold')).toHaveFocus();
      expect(onCheckedValuesChange).not.toHaveBeenCalled();
      expect(screen.getAllByRole('radio').map((el) => el.getAttribute('aria-checked'))).toEqual([
        'false',
        'false',
        'false',
      ]);
    });

    it('the divider is not in the arrow order', async () => {
      const user = userEvent.setup();
      render(<TextEditor />);
      const separators = screen.getAllByRole('separator');
      expect(separators).toHaveLength(2);
      for (const separator of separators) {
        expect(separator).not.toHaveAttribute('tabindex');
      }
      await user.tab();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(radio('Left')).toHaveFocus();
    });

    it('horizontal: Down/Up move among the enabled radios of the group, wrap and check nothing', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(<AlignmentToolbar onCheckedValuesChange={onCheckedValuesChange} />);
      act(() => radio('Left').focus());
      await user.keyboard('{ArrowDown}');
      expect(radio('Right')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(radio('Justify')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(radio('Left')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(radio('Justify')).toHaveFocus();
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(radio('Left')).toHaveFocus();
      expect(onCheckedValuesChange).not.toHaveBeenCalled();
      // The key is consumed: the page does not scroll.
      expect(fireEvent.keyDown(radio('Left'), { key: 'ArrowDown' })).toBe(false);
    });

    it('horizontal: Down/Up on a control outside a radio group do nothing', async () => {
      const user = userEvent.setup();
      render(<AlignmentToolbar />);
      act(() => button('Indent').focus());
      await user.keyboard('{ArrowDown}');
      expect(button('Indent')).toHaveFocus();
      expect(fireEvent.keyDown(button('Indent'), { key: 'ArrowUp' })).toBe(true);
    });

    it('vertical: Right/Left move among the radios of the group, Down/Up through the toolbar', async () => {
      const user = userEvent.setup();
      render(<AlignmentToolbar orientation="vertical" />);
      act(() => radio('Left').focus());
      await user.keyboard('{ArrowRight}');
      expect(radio('Right')).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(radio('Justify')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(button('Outdent')).toHaveFocus();
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(radio('Right')).toHaveFocus();
      expect(
        screen.getAllByRole('radio').every((el) => el.getAttribute('aria-checked') === 'false'),
      ).toBe(true);
    });

    it('vertical in RTL: Left moves to the next radio and Right to the previous one', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlignmentToolbar orientation="vertical" />, { dir: 'rtl' });
      act(() => radio('Left').focus());
      await user.keyboard('{ArrowLeft}');
      expect(radio('Right')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(radio('Left')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(radio('Justify')).toHaveFocus();
    });

    it('horizontal in RTL: Left/Right move through the toolbar (mirrored), Down/Up through the group', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlignmentToolbar />, { dir: 'rtl' });
      await user.tab();
      expect(button('Indent')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(radio('Left')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(radio('Right')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(radio('Left')).toHaveFocus();
    });

    it('one tab stop: Tab out and back returns to the last focused control, also after a cross-axis move', async () => {
      const user = userEvent.setup();
      render(<AlignmentToolbar />);
      await user.tab();
      expect(button('Indent')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(radio('Left')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(radio('Right')).toHaveFocus();
      expect(tabStops()).toEqual([radio('Right')]);
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(radio('Right')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(radio('Justify')).toHaveFocus();
      expect(tabStops()).toEqual([radio('Justify')]);
    });

    it("a consumer onKeyDown on the group runs first; preventDefault() cancels the group's move", async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown') event.preventDefault();
      });
      render(
        <Toolbar aria-label="Paragraph">
          <Toolbar.RadioGroup aria-label="Alignment" onKeyDown={onKeyDown}>
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
            <Toolbar.RadioButton name="align" value="right">
              Right
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
        </Toolbar>,
      );
      act(() => radio('Left').focus());
      await user.keyboard('{ArrowDown}');
      expect(onKeyDown).toHaveBeenCalled();
      expect(radio('Left')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(radio('Right')).toHaveFocus();
    });

    it('modified arrow keys are shortcuts, not moves', async () => {
      const user = userEvent.setup();
      render(<AlignmentToolbar />);
      act(() => radio('Left').focus());
      await user.keyboard('{Control>}{ArrowDown}{/Control}');
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      await user.keyboard('{Meta>}{ArrowDown}{/Meta}');
      expect(radio('Left')).toHaveFocus();
    });
  });

  describe('Toolbar.RadioGroup', () => {
    it('is a radiogroup whose radios join the toolbar arrow order, laid out in its direction', () => {
      const { rerender } = render(<AlignmentToolbar />);
      const group = screen.getByRole('radiogroup', { name: 'Alignment' });
      expect(group).toHaveAttribute('data-roving-transparent', '');
      expect(group).not.toHaveAttribute('data-roving-container');
      expect(group).toHaveClass('flex', 'gap-1');
      expect(group).not.toHaveClass('flex-col');
      rerender(<AlignmentToolbar orientation="vertical" />);
      expect(group).toHaveClass('flex', 'flex-col', 'gap-1');
    });

    it('its role cannot be replaced: its radios and cross-axis keys need the radiogroup', () => {
      render(
        <Toolbar aria-label="Paragraph">
          <Toolbar.RadioGroup aria-label="Alignment" role="toolbar">
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
        </Toolbar>,
      );
      expect(screen.getByRole('radiogroup', { name: 'Alignment' })).toContainElement(
        screen.getByRole('radio', { name: 'Left' }),
      );
    });

    it('warns once in development when it has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Toolbar aria-label="Paragraph">
          <Toolbar.RadioGroup>
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
          <Toolbar.RadioGroup>
            <Toolbar.RadioButton name="spacing" value="single">
              Single
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
        </Toolbar>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Toolbar.RadioGroup: a radio group needs an accessible name that says what it chooses (e.g. "Text alignment"). Pass `aria-label` or `aria-labelledby`.',
        ],
      ]);
    });

    it('does not warn with aria-label or aria-labelledby', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <>
          <span id="spacing-label">Spacing</span>
          <Toolbar aria-label="Paragraph">
            <Toolbar.RadioGroup aria-label="Alignment">
              <Toolbar.RadioButton name="align" value="left">
                Left
              </Toolbar.RadioButton>
            </Toolbar.RadioGroup>
            <Toolbar.RadioGroup aria-labelledby="spacing-label">
              <Toolbar.RadioButton name="spacing" value="single">
                Single
              </Toolbar.RadioButton>
            </Toolbar.RadioGroup>
          </Toolbar>
        </>,
      );
      expect(screen.getByRole('radiogroup', { name: 'Spacing' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('Toolbar.Group', () => {
    it('is presentational by default, and lays out its controls in the toolbar direction', () => {
      const { rerender } = render(
        <Toolbar aria-label="Tools">
          <Toolbar.Group data-testid="group">
            <Toolbar.Button>Share</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>,
      );
      const group = screen.getByTestId('group');
      expect(group).toHaveAttribute('role', 'presentation');
      expect(group).toHaveAttribute('data-orientation', 'horizontal');
      expect(group).toHaveClass('flex', 'gap-1');
      expect(group).not.toHaveClass('flex-col');
      rerender(
        <Toolbar aria-label="Tools" orientation="vertical">
          <Toolbar.Group data-testid="group">
            <Toolbar.Button>Share</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>,
      );
      expect(group).toHaveAttribute('data-orientation', 'vertical');
      expect(group).toHaveClass('flex-col');
    });

    it('is a named group with aria-label (axe clean)', async () => {
      render(
        <Toolbar aria-label="Tools">
          <Toolbar.Group aria-label="Sharing">
            <Toolbar.Button>Share</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>,
      );
      expect(screen.getByRole('group', { name: 'Sharing' })).toBeInTheDocument();
      await expectNoA11yViolations();
    });

    it('is a named group with aria-labelledby', () => {
      render(
        <Toolbar aria-label="Tools">
          <span id="sharing-label">Sharing</span>
          <Toolbar.Group aria-labelledby="sharing-label">
            <Toolbar.Button>Share</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>,
      );
      expect(screen.getByRole('group', { name: 'Sharing' })).toBeInTheDocument();
    });

    it('a consumer role wins; an undefined one keeps the default', () => {
      render(
        <Toolbar aria-label="Tools">
          <Toolbar.Group role="list" aria-label="Recent" data-testid="list">
            <Toolbar.Button role="listitem">Share</Toolbar.Button>
          </Toolbar.Group>
          <Toolbar.Group role={undefined} data-testid="plain">
            <Toolbar.Button>Copy</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>,
      );
      expect(screen.getByTestId('list')).toHaveAttribute('role', 'list');
      expect(screen.getByTestId('plain')).toHaveAttribute('role', 'presentation');
    });
  });

  describe('Toolbar.Divider', () => {
    it('is a vertical separator across a horizontal toolbar', () => {
      render(
        <Toolbar aria-label="Tools">
          <Toolbar.Button>Cut</Toolbar.Button>
          <Toolbar.Divider />
          <Toolbar.Button>Copy</Toolbar.Button>
        </Toolbar>,
      );
      const divider = screen.getByRole('separator');
      expect(divider.tagName).toBe('DIV');
      expect(divider).toHaveAttribute('aria-orientation', 'vertical');
      expect(divider).toHaveClass(
        'mx-1',
        'w-0',
        'shrink-0',
        'self-stretch',
        'border-s',
        'border-border',
        'forced-colors:border-[CanvasText]',
      );
      expect(divider).not.toHaveClass('border-t', 'h-0', 'my-1');
    });

    it('is a horizontal separator across a vertical toolbar', () => {
      render(
        <Toolbar aria-label="Tools" orientation="vertical">
          <Toolbar.Button>Cut</Toolbar.Button>
          <Toolbar.Divider />
          <Toolbar.Button>Copy</Toolbar.Button>
        </Toolbar>,
      );
      const divider = screen.getByRole('separator');
      expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
      expect(divider).toHaveClass(
        'my-1',
        'h-0',
        'shrink-0',
        'self-stretch',
        'border-t',
        'border-border',
        'forced-colors:border-[CanvasText]',
      );
      expect(divider).not.toHaveClass('border-s', 'w-0', 'mx-1');
    });
  });

  describe('registration', () => {
    it('warns once when two parts of one toolbar share a name and a value', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Toolbar aria-label="Tools">
          <Toolbar.ToggleButton name="format" value="bold">
            Bold
          </Toolbar.ToggleButton>
          <Toolbar.ToggleButton name="format" value="bold">
            Strong
          </Toolbar.ToggleButton>
          <Toolbar.ToggleButton name="format" value="italic">
            Italic
          </Toolbar.ToggleButton>
        </Toolbar>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Toolbar: two toggle or radio buttons of one toolbar have the name "format" and the value "bold", so both show as pressed. Give every part of a group its own value.',
        ],
      ]);
    });

    it('does not warn for the same pair in two toolbars, or in StrictMode', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <React.StrictMode>
          <Toolbar aria-label="One">
            <Toolbar.ToggleButton name="format" value="bold">
              Bold
            </Toolbar.ToggleButton>
          </Toolbar>
          <Toolbar aria-label="Two">
            <Toolbar.ToggleButton name="format" value="bold">
              Bold too
            </Toolbar.ToggleButton>
          </Toolbar>
        </React.StrictMode>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('outside a Toolbar (C-CONTEXT)', () => {
    it.each([
      ['Toolbar.Button', <Toolbar.Button key="b">Cut</Toolbar.Button>],
      [
        'Toolbar.ToggleButton',
        <Toolbar.ToggleButton key="t" name="format" value="bold">
          Bold
        </Toolbar.ToggleButton>,
      ],
      ['Toolbar.RadioGroup', <Toolbar.RadioGroup key="g" aria-label="Alignment" />],
      [
        'Toolbar.RadioButton',
        <Toolbar.RadioButton key="r" name="align" value="left">
          Left
        </Toolbar.RadioButton>,
      ],
      ['Toolbar.Group', <Toolbar.Group key="p" />],
      ['Toolbar.Divider', <Toolbar.Divider key="d" />],
    ])('%s throws in development', (name, ui) => {
      expectThrows(ui, `[WaveUI] ${name} must be used within Toolbar`);
    });

    it('in production, parts log once and render with the inert toolbar (horizontal, medium, nothing checked)', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const user = userEvent.setup();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { rerender } = render(
        <>
          <Toolbar.Button>Cut</Toolbar.Button>
          <Toolbar.ToggleButton name="format" value="bold">
            Bold
          </Toolbar.ToggleButton>
          <Toolbar.RadioGroup aria-label="Alignment">
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
          <Toolbar.Group data-testid="group" />
          <Toolbar.Divider />
        </>,
      );
      rerender(
        <>
          <Toolbar.Button>Cut</Toolbar.Button>
          <Toolbar.ToggleButton name="format" value="bold">
            Bold
          </Toolbar.ToggleButton>
          <Toolbar.RadioGroup aria-label="Alignment">
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
          <Toolbar.Group data-testid="group" />
          <Toolbar.Divider />
        </>,
      );
      expect(classesOf(button('Cut'))).toEqual(
        classesFrom(buttonClassName({ appearance: 'subtle', size: 'medium' })),
      );
      await user.click(button('Bold'));
      expect(button('Bold')).toHaveAttribute('aria-pressed', 'false');
      const left = screen.getByRole('radio', { name: 'Left' });
      await user.click(left);
      expect(left).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('radiogroup', { name: 'Alignment' })).toContainElement(left);
      expect(screen.getByTestId('group')).toHaveAttribute('role', 'presentation');
      expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
      expect(error.mock.calls).toEqual([
        ['[WaveUI] Toolbar.Button must be used within Toolbar'],
        ['[WaveUI] Toolbar.ToggleButton must be used within Toolbar'],
        ['[WaveUI] Toolbar.RadioGroup must be used within Toolbar'],
        ['[WaveUI] Toolbar.RadioButton must be used within Toolbar'],
        ['[WaveUI] Toolbar.Group must be used within Toolbar'],
        ['[WaveUI] Toolbar.Divider must be used within Toolbar'],
      ]);
    });
  });

  describe('types', () => {
    it('Toolbar.ToggleButton and Toolbar.RadioButton require name and value and own their state', () => {
      expectTypeOf<ToolbarToggleButtonProps['name']>().toEqualTypeOf<string>();
      expectTypeOf<ToolbarToggleButtonProps['value']>().toEqualTypeOf<string>();
      expectTypeOf<ToolbarRadioButtonProps['name']>().toEqualTypeOf<string>();
      expectTypeOf<ToolbarRadioButtonProps['value']>().toEqualTypeOf<string>();
      expectTypeOf<ToolbarToggleButtonProps['isAccessible']>().toEqualTypeOf<boolean | undefined>();
      const elements = [
        // @ts-expect-error name and value are required
        <Toolbar.ToggleButton key="1">Bold</Toolbar.ToggleButton>,
        // @ts-expect-error pressed belongs to the Toolbar's checkedValues
        <Toolbar.ToggleButton key="2" name="format" value="bold" pressed />,
        // @ts-expect-error value is a string
        <Toolbar.RadioButton key="3" name="align" value={1} />,
        // @ts-expect-error role is always radio
        <Toolbar.RadioButton key="4" name="align" value="left" role="checkbox" />,
        // @ts-expect-error onPressedChange belongs to the Toolbar's onCheckedValuesChange
        <Toolbar.RadioButton key="5" name="align" value="left" onPressedChange={() => {}} />,
      ];
      expect(elements).toHaveLength(5);
    });

    it('Toolbar.Button is polymorphic, like Button', () => {
      expectTypeOf<ToolbarButtonProps<'a'>['href']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<ToolbarButtonProps['vertical']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<ToolbarButtonProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLButtonElement> | undefined
      >();
      expectTypeOf<typeof Toolbar.Button>().toEqualTypeOf<typeof ToolbarButton>();
      const elements = [
        <Toolbar.Button key="1" as="a" href="/help" />,
        // @ts-expect-error href does not exist on <button>
        <Toolbar.Button key="2" href="/help" />,
        <Toolbar.Button key="3" as={Button} appearance="primary" />,
      ];
      expect(elements).toHaveLength(3);
    });
  });
});
