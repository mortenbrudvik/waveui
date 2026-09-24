import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { SearchBox, type SearchBoxProps } from '../SearchBox';
import { Button } from '../../button/Button';
import type { Slot, SlotObject } from '../../../lib/types';
import { inputInvalidWithin } from '../../../lib/styles';
import {
  testSystemProps,
  testFocusEvents,
  testNoImplicitSubmit,
  renderWithProviders,
  expectNoA11yViolations,
  asClientReference,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

/** The development warnings of the `dismiss` slot (C-SLOTS). */
const ELEMENT_WARNING = /^\[WaveUI\] SearchBox: `dismiss` received a button element/;
const OBJECT_WARNING = /^\[WaveUI\] SearchBox: `dismiss` with button props .* is deprecated/;

/** Asserts that `warn` logged exactly one message per pattern (in any order) and nothing else. */
function expectWarnings(warn: { mock: { calls: unknown[][] } }, patterns: RegExp[]) {
  const messages = warn.mock.calls.map(([message]) => String(message));
  expect(messages).toHaveLength(patterns.length);
  for (const pattern of patterns) {
    expect(messages.filter((message) => pattern.test(message))).toHaveLength(1);
  }
}

describe('SearchBox', () => {
  testSystemProps(SearchBox, {
    expectedTag: 'div',
    displayName: 'SearchBox',
    defaultProps: { 'aria-label': 'Search' },
    control: { role: 'searchbox' },
    a11yVariants: [
      { name: 'with value (clear button)', props: { defaultValue: 'hello' } },
      { name: 'disabled', props: { disabled: true, defaultValue: 'hello' } },
    ],
    conflictingClass: { className: 'w-64', overrides: 'w-full' },
  });

  testFocusEvents(SearchBox, { 'aria-label': 'Search' }, 'input');

  testNoImplicitSubmit(SearchBox, { defaultProps: { 'aria-label': 'Search', defaultValue: 'x' } });

  describe('types', () => {
    it('declares ref and controlRef in SearchBoxProps (C-REF, C-ROUTING)', () => {
      expectTypeOf<SearchBoxProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<SearchBoxProps['controlRef']>().toEqualTypeOf<
        React.Ref<HTMLInputElement> | undefined
      >();
    });

    it("types dismiss as Slot<'span'> | SlotObject<'button'> (table-core#18)", () => {
      expectTypeOf<SearchBoxProps['dismiss']>().toEqualTypeOf<
        Slot<'span'> | SlotObject<'button'> | undefined
      >();
      // Compile-time checks (type-checked by tsconfig.dev.json).
      const iconContent = <SearchBox dismiss={<span>x</span>} />;
      const spanObject = <SearchBox dismiss={{ children: 'x', title: 'Clear' }} />;
      const deprecatedButtonObject = (
        <SearchBox dismiss={{ as: 'button', type: 'button', onClick: () => {}, children: 'x' }} />
      );
      // @ts-expect-error `href` is neither a span nor a button attribute
      const invalid = <SearchBox dismiss={{ href: '/x' }} />;
      expect([iconContent, spanObject, deprecatedButtonObject, invalid]).toHaveLength(4);
    });
  });

  it('renders the default placeholder', () => {
    render(<SearchBox />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search');
  });

  it('renders a custom placeholder', () => {
    render(<SearchBox placeholder="Find..." />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Find...');
  });

  describe('slots', () => {
    it('renders the F2 search icon by default (input-datetime#22)', () => {
      const { container } = render(<SearchBox aria-label="Search" />);
      const icon = container.querySelector('[data-wave-icon="search"]');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders contentBefore as ReactNode shorthand (replaces the icon)', () => {
      const { container } = render(
        <SearchBox aria-label="Search" contentBefore={<span data-testid="before">*</span>} />,
      );
      expect(screen.getByTestId('before')).toBeInTheDocument();
      expect(container.querySelector('[data-wave-icon="search"]')).toBeNull();
    });

    it('renders contentBefore as SlotObject', () => {
      render(
        <SearchBox
          aria-label="Search"
          contentBefore={{ children: <span data-testid="before-slot">*</span>, className: 'x' }}
        />,
      );
      expect(screen.getByTestId('before-slot').parentElement).toHaveClass('x');
    });

    it('renders contentAfter as ReactNode shorthand at the inline end, outside the input', () => {
      render(
        <SearchBox
          data-testid="root"
          aria-label="Search"
          defaultValue="test"
          contentAfter={<span data-testid="after">!</span>}
        />,
      );
      const after = screen.getByTestId('after');
      const slot = after.parentElement;
      expect(slot).toHaveClass('shrink-0');
      expect(slot?.parentElement).toHaveClass('shrink-0');
      expect(slot?.parentElement).not.toHaveClass('absolute');
      expect(slot?.parentElement?.parentElement).toBe(screen.getByTestId('root'));
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(input).not.toContainElement(after);
      // Placed between the input and the clear button.
      expect(input.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(
        after.compareDocumentPosition(screen.getByRole('button', { name: 'Clear search' })) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe('layout (input-other-code-2)', () => {
    it('lays the slots, the text and the clear button out side by side, so no slot covers the text', () => {
      render(
        <SearchBox
          data-testid="root"
          aria-label="Search"
          defaultValue="quarterly financial report draft v2"
          contentBefore={<span data-testid="before">Files:</span>}
          contentAfter={<span data-testid="after">⌘K</span>}
        />,
      );
      const root = screen.getByTestId('root');
      const input = screen.getByRole('searchbox', { name: 'Search' });
      // Each slot renders inside its own span, held by a layout box of the field.
      const before = screen.getByTestId('before').parentElement!.parentElement!;
      const after = screen.getByTestId('after').parentElement!.parentElement!;
      const clear = screen.getByRole('button', { name: 'Clear search' });
      // In document order, as flex items of the root: none of them is positioned over the input.
      expect(Array.from(root.children)).toEqual([before, input, after, clear]);
      expect(root).toHaveClass('inline-flex', 'items-center');
      for (const part of [before, input, after, clear]) {
        expect(part).not.toHaveClass('absolute');
        expect(part.className).not.toMatch(/(^|\s)(start|end)-\d/);
      }
      // The text takes the room the slots and the clear button leave; they keep their size.
      expect(input).toHaveClass('min-w-0', 'flex-1');
      expect(input.className).not.toMatch(/(^|\s)(ps|pe)-(8|9)(\s|$)/);
      for (const part of [before, after, clear]) expect(part).toHaveClass('shrink-0');
    });

    it('draws the field (border, focus and disabled look) on the root around the input', () => {
      render(<SearchBox data-testid="root" aria-label="Search" disabled defaultValue="a" />);
      const root = screen.getByTestId('root');
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(root).toHaveClass(
        'border',
        'border-input',
        'border-b-stroke-accessible',
        'bg-background',
        'focus-within:border-b-2',
        'focus-within:border-b-primary',
        'opacity-50',
      );
      expect(input).toHaveClass('border-none', 'bg-transparent', 'focus:outline-hidden');
      expect(input).not.toHaveClass('outline-none', 'outline-hidden', 'border-input');
    });

    it('pressing the icon, a slot or the padding focuses the input', () => {
      const { container } = render(
        <SearchBox
          data-testid="root"
          aria-label="Search"
          contentAfter={<span data-testid="after">⌘K</span>}
        />,
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      const icon = container.querySelector('[data-wave-icon="search"]')!;
      for (const target of [icon, screen.getByTestId('after'), screen.getByTestId('root')]) {
        act(() => input.blur());
        // fireEvent returns false when the default (focus moving to the pressed element) is prevented.
        expect(fireEvent.mouseDown(target)).toBe(false);
        expect(input).toHaveFocus();
      }
    });

    it('leaves a press on a control inside a slot, a secondary-button press and a disabled box alone', () => {
      const { container, rerender } = render(
        <SearchBox aria-label="Search" contentAfter={<button type="button">Filters</button>} />,
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Filters' }))).toBe(true);
      expect(input).not.toHaveFocus();
      const icon = () => container.querySelector('[data-wave-icon="search"]')!;
      expect(fireEvent.mouseDown(icon(), { button: 2 })).toBe(true);
      expect(input).not.toHaveFocus();
      rerender(<SearchBox aria-label="Search" disabled />);
      expect(fireEvent.mouseDown(icon())).toBe(true);
      expect(input).not.toHaveFocus();
    });

    it('runs a consumer onMouseDown first; its preventDefault keeps focus where it is', () => {
      const onMouseDown = vi.fn((event: React.MouseEvent) => event.preventDefault());
      const { container } = render(<SearchBox aria-label="Search" onMouseDown={onMouseDown} />);
      fireEvent.mouseDown(container.querySelector('[data-wave-icon="search"]')!);
      expect(onMouseDown).toHaveBeenCalledOnce();
      expect(screen.getByRole('searchbox', { name: 'Search' })).not.toHaveFocus();
    });
  });

  describe('clear button', () => {
    it('shows the clear button when there is a value', () => {
      render(<SearchBox aria-label="Search" defaultValue="hello" />);
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toHaveAttribute('type', 'button');
      expect(clear.querySelector('[data-wave-icon="dismiss"]')).not.toBeNull();
    });

    it('hides the clear button when the value is empty', () => {
      render(<SearchBox aria-label="Search" />);
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    });

    it('clears the value, removes the clear button and calls the callbacks (input-basic#39)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onClear = vi.fn();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="hello"
          onValueChange={onValueChange}
          onClear={onClear}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('');
      expect(onClear).toHaveBeenCalledOnce();
    });

    it('clears a controlled SearchBox through onValueChange and onClear (input-basic#39)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onClear = vi.fn();
      function Controlled() {
        const [value, setValue] = React.useState('query');
        return (
          <SearchBox
            aria-label="Search"
            value={value}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
            onClear={onClear}
          />
        );
      }
      render(<Controlled />);
      await user.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(onValueChange).toHaveBeenCalledWith('');
      expect(onClear).toHaveBeenCalledOnce();
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
    });

    it('moves focus back to the input after clearing (input-basic#19)', async () => {
      const user = userEvent.setup();
      render(<SearchBox aria-label="Search" defaultValue="abc" />);
      const clear = screen.getByRole('button', { name: 'Clear search' });
      clear.focus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
    });

    it('focuses the input after clearing with a consumer controlRef', async () => {
      const user = userEvent.setup();
      const controlRef = React.createRef<HTMLInputElement>();
      render(<SearchBox aria-label="Search" defaultValue="abc" controlRef={controlRef} />);
      await user.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(controlRef.current).toBe(screen.getByRole('searchbox', { name: 'Search' }));
      expect(controlRef.current).toHaveFocus();
    });

    it('has a 24px target beside the text, never over it (input-basic#20)', () => {
      render(<SearchBox aria-label="Search" defaultValue="abc" />);
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toHaveClass('h-6', 'w-6', 'shrink-0');
      expect(clear).not.toHaveClass('absolute');
      expect(clear.previousElementSibling).toBe(screen.getByRole('searchbox', { name: 'Search' }));
    });

    it('is disabled with the SearchBox', () => {
      render(<SearchBox aria-label="Search" defaultValue="abc" disabled />);
      expect(screen.getByRole('searchbox', { name: 'Search' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeDisabled();
    });

    it('is not rendered for a read-only SearchBox, so the value cannot be cleared (input-basic#1)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onClear = vi.fn();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="abc"
          readOnly
          onValueChange={onValueChange}
          onClear={onClear}
        />,
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(input).toHaveAttribute('readonly');
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
      await user.type(input, 'x');
      expect(input).toHaveValue('abc');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onClear).not.toHaveBeenCalled();
    });
  });

  describe('dismiss slot (C-SLOTS, feedback-navigation#1, table-core#18)', () => {
    it('renders slot content inside the wired clear button', async () => {
      const user = userEvent.setup();
      const onClear = vi.fn();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="test"
          onClear={onClear}
          dismiss={<span data-testid="dismiss-content">X</span>}
        />,
      );
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toHaveAttribute('type', 'button');
      expect(clear).toContainElement(screen.getByTestId('dismiss-content'));
      await user.click(screen.getByTestId('dismiss-content'));
      expect(onClear).toHaveBeenCalledOnce();
    });

    it('renders a span SlotObject inside the wired clear button', () => {
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="test"
          dismiss={{ children: <span data-testid="dismiss-slot">X</span>, className: 'custom' }}
        />,
      );
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toContainElement(screen.getByTestId('dismiss-slot'));
      expect(screen.getByTestId('dismiss-slot').parentElement).toHaveClass('custom');
    });

    it('merges a <button> element slot into the wired button (no nesting) and warns', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onClear = vi.fn();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="test"
          onClear={onClear}
          dismiss={
            <button type="button" className="custom-button" onClick={onClick}>
              <span data-testid="inner">X</span>
            </button>
          }
        />,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toHaveClass('custom-button', 'h-6');
      expect(clear).toContainElement(screen.getByTestId('inner'));
      await user.click(clear);
      expect(onClick).toHaveBeenCalledOnce();
      expect(onClear).toHaveBeenCalledOnce();
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
      expectWarnings(warn, [ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it('merges a Wave Button slot into the wired button', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="test"
          dismiss={
            <Button appearance="subtle" onClick={onClick}>
              X
            </Button>
          }
        />,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).not.toHaveAttribute('appearance');
      await user.click(clear);
      expect(onClick).toHaveBeenCalledOnce();
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
      expectWarnings(warn, [ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it('keeps type="button" when a typeless <button> slot is merged (C-BUTTON-TYPE)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit} aria-label="Search form">
          <SearchBox aria-label="Search" defaultValue="test" dismiss={<button>X</button>} />
        </form>,
      );
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toHaveAttribute('type', 'button');
      fireEvent.click(clear);
      expect(onSubmit).not.toHaveBeenCalled();
      expectWarnings(warn, [ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it('keeps type="button" when a merged slot passes type null (C-BUTTON-TYPE, P12 change request)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit} aria-label="Search form">
          <SearchBox aria-label="Object" defaultValue="a" dismiss={{ type: null } as never} />
          <SearchBox
            aria-label="Element"
            defaultValue="b"
            dismiss={<button type={null as never}>X</button>}
          />
        </form>,
      );
      const clears = screen.getAllByRole('button', { name: 'Clear search' });
      expect(clears).toHaveLength(2);
      for (const clear of clears) {
        expect(clear).toHaveAttribute('type', 'button');
        await user.click(clear);
      }
      expect(onSubmit).not.toHaveBeenCalled();
      expectWarnings(warn, [OBJECT_WARNING, ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it('lets a consumer slot handler cancel the clear with preventDefault', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="keep"
          dismiss={<button type="button" onClick={(e) => e.preventDefault()} />}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('keep');
      expectWarnings(warn, [ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it('merges the deprecated button-object form onto the wired button with a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onClear = vi.fn();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="test"
          onClear={onClear}
          dismiss={{ onClick, children: <span data-testid="obj-content">X</span> }}
        />,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toContainElement(screen.getByTestId('obj-content'));
      await user.click(clear);
      expect(onClick).toHaveBeenCalledOnce();
      expect(onClear).toHaveBeenCalledOnce();
      expectWarnings(warn, [OBJECT_WARNING]);
      warn.mockRestore();
    });

    it('falls back to the default icon for a button object without children (table-core#18)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <>
          <SearchBox aria-label="First" defaultValue="a" dismiss={{ onClick }} />
          <SearchBox aria-label="Second" defaultValue="b" dismiss={{ type: 'button' }} />
          <SearchBox
            aria-label="Third"
            defaultValue="c"
            dismiss={{ onClick, className: 'obj-content', children: false }}
          />
        </>,
      );
      const clears = screen.getAllByRole('button', { name: 'Clear search' });
      expect(clears).toHaveLength(3);
      for (const clear of clears) {
        const icon = clear.querySelector('[data-wave-icon="dismiss"]');
        expect(icon).not.toBeNull();
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      }
      // The object's own content props still apply around the default icon.
      expect(clears[2].querySelector('[data-wave-icon="dismiss"]')?.parentElement).toHaveClass(
        'obj-content',
      );
      await user.click(clears[0]);
      expect(onClick).toHaveBeenCalledOnce();
      expect(screen.getByRole('searchbox', { name: 'First' })).toHaveValue('');
      expectWarnings(warn, [OBJECT_WARNING]);
      warn.mockRestore();
    });

    it('keeps the default icon for empty shorthand (booleans, empty string, empty iterables and Fragments) (table-core#18)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function* nothing(): Generator<React.ReactNode> {
        yield null;
        yield false;
      }
      const empties: Array<[string, SearchBoxProps['dismiss']]> = [
        ['false', false],
        ['true', true],
        ['empty string', ''],
        ['empty array', []],
        ['array of empty values', [null, false, '']],
        ['empty Set', new Set()],
        ['Set of empty values', new Set([null, undefined, ''])],
        ['empty Fragment', <></>],
        ['Fragment of empty values', <>{null}</>],
        [
          'nested empty values',
          [new Set([<React.Fragment key="f">{[false]}</React.Fragment>]), []],
        ],
        ['empty generator', nothing()],
        ['empty custom iterable', { [Symbol.iterator]: () => [null][Symbol.iterator]() }],
      ];
      render(
        <>
          {empties.map(([name, dismiss]) => (
            <SearchBox key={name} aria-label={name} defaultValue="x" dismiss={dismiss} />
          ))}
        </>,
      );
      const clears = screen.getAllByRole('button', { name: 'Clear search' });
      // The slot never hides the clear button: it stays wired and shows the default icon.
      expect(clears).toHaveLength(empties.length);
      clears.forEach((clear, index) => {
        const icon = clear.querySelector('[data-wave-icon="dismiss"]');
        expect(icon, empties[index][0]).not.toBeNull();
        expect(icon, empties[index][0]).toHaveAttribute('aria-hidden', 'true');
      });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('renders non-empty iterables and Fragments as the clear button content', () => {
      function* letters(): Generator<React.ReactNode> {
        yield 'G';
      }
      const contents: Array<[string, SearchBoxProps['dismiss'], string]> = [
        ['Set', new Set(['S']), 'S'],
        ['Fragment', <>F</>, 'F'],
        ['generator', letters(), 'G'],
        ['number', 0, '0'],
      ];
      render(
        <>
          {contents.map(([name, dismiss]) => (
            <SearchBox key={name} aria-label={name} defaultValue="x" dismiss={dismiss} />
          ))}
        </>,
      );
      const clears = screen.getAllByRole('button', { name: 'Clear search' });
      clears.forEach((clear, index) => {
        const [name, , text] = contents[index];
        expect(clear, name).toHaveTextContent(text);
        expect(clear.querySelector('[data-wave-icon="dismiss"]'), name).toBeNull();
      });
    });

    it('keeps the default icon inside a content SlotObject without children (table-core#18)', () => {
      render(
        <>
          <SearchBox aria-label="First" defaultValue="a" dismiss={{ className: 'icon-tone' }} />
          <SearchBox
            aria-label="Second"
            defaultValue="b"
            dismiss={{ as: 'i', className: 'icon-box', children: new Set() }}
          />
        </>,
      );
      const [first, second] = screen.getAllByRole('button', { name: 'Clear search' });
      const firstIcon = first.querySelector('[data-wave-icon="dismiss"]');
      expect(firstIcon).not.toBeNull();
      expect(firstIcon?.parentElement).toHaveClass('icon-tone');
      expect(firstIcon?.parentElement).toHaveAttribute('aria-hidden', 'true');
      const secondIcon = second.querySelector('[data-wave-icon="dismiss"]');
      expect(secondIcon?.parentElement?.tagName).toBe('I');
      expect(secondIcon?.parentElement).toHaveClass('icon-box');
    });

    it('renders a void or component SlotObject as it is (it has content of its own)', () => {
      function Glyph(props: React.HTMLAttributes<HTMLSpanElement>) {
        return (
          <span data-testid="glyph" {...props}>
            G
          </span>
        );
      }
      render(
        <>
          <SearchBox
            aria-label="First"
            defaultValue="a"
            dismiss={
              { as: 'img', src: 'x.svg', alt: '', 'data-testid': 'img-icon' } as Slot<'span'>
            }
          />
          <SearchBox aria-label="Second" defaultValue="b" dismiss={{ as: Glyph }} />
        </>,
      );
      const [first, second] = screen.getAllByRole('button', { name: 'Clear search' });
      expect(first).toContainElement(screen.getByTestId('img-icon'));
      expect(first.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
      expect(second).toContainElement(screen.getByTestId('glyph'));
      expect(screen.getByTestId('glyph')).toHaveAttribute('aria-hidden', 'true');
      expect(second.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
    });

    it('merges a Wave Button written in a Server Component (a lazy client reference) like a plain one (R1)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const user = userEvent.setup();
        const ClientButton = asClientReference(Button);
        const onClick = vi.fn();
        const plain = renderToString(
          <SearchBox aria-label="Search" defaultValue="a" dismiss={<Button>Reset</Button>} />,
        );
        const fromServer = renderToString(
          <SearchBox
            aria-label="Search"
            defaultValue="a"
            dismiss={<ClientButton>Reset</ClientButton>}
          />,
        );
        expect(fromServer).toBe(plain);

        render(
          <SearchBox
            aria-label="Search"
            defaultValue="a"
            dismiss={<ClientButton onClick={onClick}>Reset</ClientButton>}
          />,
        );
        // Merged into the built-in clear button, not nested inside it.
        expect(screen.getAllByRole('button')).toHaveLength(1);
        await user.click(screen.getByRole('button', { name: 'Reset' }));
        expect(onClick).toHaveBeenCalledOnce();
        expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
        expectWarnings(warn, [ELEMENT_WARNING]);
      } finally {
        warn.mockRestore();
      }
    });

    it("renders { as: 'button' } without nesting buttons", () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="test"
          dismiss={{ as: 'button', className: 'obj-button', children: 'X' }}
        />,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Clear search' })).toHaveClass('obj-button');
      expectWarnings(warn, [OBJECT_WARNING]);
      warn.mockRestore();
    });
  });

  describe('clear button name (C-SLOTS naming, WCAG 2.5.3 Label in Name)', () => {
    /** Stands in for `<FormattedMessage>`/`<Trans>`: the text comes from a component. */
    function Translated({ text }: { text: string }) {
      return <>{text}</>;
    }

    it('a merged <button> slot with a text label is named by that label (P12 change request)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onClear = vi.fn();
      render(
        <SearchBox
          defaultValue="a"
          aria-label="Search"
          onClear={onClear}
          dismiss={<button type="button">Reset</button>}
        />,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const clear = screen.getByRole('button', { name: 'Reset' });
      expect(clear).not.toHaveAttribute('aria-label');
      await user.click(clear);
      expect(onClear).toHaveBeenCalledOnce();
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
      expectWarnings(warn, [ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it.each([
      ['a Wave Button with a text label', <Button key="b">Reset</Button>],
      ['the deprecated { as: "button" } object', { as: 'button', children: 'Reset' } as const],
      [
        'a <button> whose child component renders the text (i18n)',
        <button key="t" type="button">
          <Translated text="Reset" />
        </button>,
      ],
    ])('%s is named by its visible text', (_, dismiss) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<SearchBox aria-label="Search" defaultValue="a" dismiss={dismiss} />);
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button')).toHaveAccessibleName('Reset');
      expectWarnings(warn, [React.isValidElement(dismiss) ? ELEMENT_WARNING : OBJECT_WARNING]);
      warn.mockRestore();
    });

    it.each([
      ['a lone letter used as a glyph', 'X'],
      ['a symbol', '×'],
      ['an icon', <svg key="icon" data-testid="slot-icon" />],
      [
        'aria-hidden text',
        <span key="h" aria-hidden="true">
          Reset
        </span>,
      ],
      [
        'hidden text',
        <span key="h" hidden>
          Reset
        </span>,
      ],
    ])('a merged <button> slot whose content is %s keeps "Clear search"', (_, children) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="a"
          dismiss={<button type="button">{children}</button>}
        />,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName('Clear search');
      expectWarnings(warn, [ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it('icon content keeps "Clear search" even with text (slot content is decorative)', () => {
      render(<SearchBox aria-label="Search" defaultValue="a" dismiss={<span>Reset</span>} />);
      expect(screen.getByRole('button')).toHaveAccessibleName('Clear search');
    });

    it('follows text that a child component renders or removes later', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setTextRef = React.createRef<(text: string) => void>();
      function LateText({ ref }: { ref: React.Ref<(text: string) => void> }) {
        const [text, setText] = React.useState('');
        React.useImperativeHandle(ref, () => setText, []);
        return <>{text}</>;
      }
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="a"
          dismiss={
            <button type="button">
              <svg aria-hidden="true" />
              <LateText ref={setTextRef} />
            </button>
          }
        />,
      );
      const clear = screen.getByRole('button');
      expect(clear).toHaveAccessibleName('Clear search');

      act(() => setTextRef.current?.('Reset'));
      await waitFor(() => expect(clear).toHaveAccessibleName('Reset'));
      expect(clear).not.toHaveAttribute('aria-label');

      act(() => setTextRef.current?.(''));
      await waitFor(() => expect(clear).toHaveAccessibleName('Clear search'));
      expectWarnings(warn, [ELEMENT_WARNING]);
      warn.mockRestore();
    });

    it.each([
      [
        'aria-label on a merged <button>',
        <button key="l" type="button" aria-label="Clear the query">
          Reset
        </button>,
        'Clear the query',
      ],
      [
        'aria-labelledby on a merged <button>',
        <button key="b" type="button" aria-labelledby="clear-label" />,
        'Empty the search field',
      ],
      ['title on a merged <button>', <button key="t" type="button" title="Reset" />, 'Reset'],
      [
        'aria-label on a content slot object',
        { 'aria-label': 'Reset', children: 'Reset' },
        'Reset',
      ],
      ['title on a content slot object', { title: 'Reset' }, 'Reset'],
    ] as const)('%s names the clear button instead of "Clear search"', (_, dismiss, name) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <span id="clear-label">Empty the search field</span>
          <SearchBox aria-label="Search" defaultValue="a" dismiss={dismiss} />
        </>,
      );
      const clear = screen.getByRole('button');
      expect(clear).toHaveAccessibleName(name);
      expect(clear).not.toHaveAttribute('aria-label', 'Clear search');
      expectWarnings(warn, React.isValidElement(dismiss) ? [ELEMENT_WARNING] : []);
      warn.mockRestore();
    });

    it('moves naming attributes of a content slot object to the button without the deprecation warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="a"
          dismiss={{ className: 'tone', 'aria-label': 'Reset', children: 'Reset' }}
        />,
      );
      const clear = screen.getByRole('button', { name: 'Reset' });
      const content = screen.getByText('Reset');
      expect(content).toHaveClass('tone');
      expect(content).toHaveAttribute('aria-hidden', 'true');
      expect(content).not.toHaveAttribute('aria-label');
      expect(clear).toContainElement(content);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('decides the server-rendered name from the literal children', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const named = renderToString(
        <SearchBox
          aria-label="Search"
          defaultValue="a"
          dismiss={<button type="button">Reset</button>}
        />,
      );
      expect(named).not.toContain('aria-label="Clear search"');
      const glyph = renderToString(
        <SearchBox
          aria-label="Search"
          defaultValue="a"
          dismiss={<button type="button">X</button>}
        />,
      );
      expect(glyph).toContain('aria-label="Clear search"');
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('Escape (x-keyboard-5)', () => {
    /**
     * Records whether each Escape keydown reached the document already prevented. Wave's layer
     * stack (Dialog, Drawer, Popover) listens there and ignores prevented events.
     */
    function recordEscapes() {
      const prevented: boolean[] = [];
      const listener = (event: KeyboardEvent) => {
        if (event.key === 'Escape') prevented.push(event.defaultPrevented);
      };
      document.addEventListener('keydown', listener);
      return { prevented, stop: () => document.removeEventListener('keydown', listener) };
    }

    it('clears the text and consumes the key; with an empty field it reaches enclosing layers', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onClear = vi.fn();
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="abc"
          onValueChange={onValueChange}
          onClear={onClear}
        />,
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      const escapes = recordEscapes();
      try {
        await user.click(input);
        await user.keyboard('{Escape}');
        expect(input).toHaveValue('');
        expect(input).toHaveFocus();
        expect(onValueChange.mock.calls).toEqual([['']]);
        expect(onClear).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(escapes.prevented).toEqual([true, false]);
        expect(onValueChange).toHaveBeenCalledOnce();
        expect(onClear).toHaveBeenCalledOnce();
      } finally {
        escapes.stop();
      }
    });

    it('leaves Escape alone while read-only, and after a consumer onKeyDown prevented it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <>
          <SearchBox
            aria-label="Read-only"
            defaultValue="abc"
            readOnly
            onValueChange={onValueChange}
          />
          <SearchBox
            aria-label="Handled"
            defaultValue="abc"
            onValueChange={onValueChange}
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.preventDefault();
            }}
          />
        </>,
      );
      const escapes = recordEscapes();
      try {
        await user.click(screen.getByRole('searchbox', { name: 'Read-only' }));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('searchbox', { name: 'Read-only' })).toHaveValue('abc');
        expect(escapes.prevented).toEqual([false]);

        await user.click(screen.getByRole('searchbox', { name: 'Handled' }));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('searchbox', { name: 'Handled' })).toHaveValue('abc');
        expect(onValueChange).not.toHaveBeenCalled();
      } finally {
        escapes.stop();
      }
    });

    it('controlled: Escape reports the empty text to the parent', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<SearchBox aria-label="Search" value="fixed" onValueChange={onValueChange} />);
      await user.click(screen.getByRole('searchbox', { name: 'Search' }));
      await user.keyboard('{Escape}');
      expect(onValueChange.mock.calls).toEqual([['']]);
    });
  });

  describe('value callbacks (input-basic#29, input-basic#39)', () => {
    it('calls onValueChange for every typed character in uncontrolled mode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<SearchBox aria-label="Search" onValueChange={onValueChange} />);
      await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'hi');
      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange).toHaveBeenLastCalledWith('hi');
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('hi');
    });

    it('respects the controlled value prop', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<SearchBox aria-label="Search" value="fixed" onValueChange={onValueChange} />);
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(input).toHaveValue('fixed');
      await user.type(input, 'x');
      expect(input).toHaveValue('fixed');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('fixedx');
    });

    it('keeps the deprecated onChange(value) alias working and warns once', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      const { rerender } = render(
        <SearchBox aria-label="Search" onChange={onChange} onValueChange={onValueChange} />,
      );
      await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'ab');
      rerender(<SearchBox aria-label="Search" onChange={onChange} onValueChange={onValueChange} />);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith('ab');
      expect(onValueChange).toHaveBeenLastCalledWith('ab');
      const deprecations = warn.mock.calls.filter(([message]) =>
        String(message).includes('SearchBox: `onChange` is deprecated'),
      );
      expect(deprecations).toHaveLength(1);
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('fires onValueChange once per interaction in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <SearchBox aria-label="Search" onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'a');
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('a');
    });
  });

  describe('native forms (C-FORMS)', () => {
    const getForm = () => screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;

    it('form reset restores defaultValue (with and without a name) and removes the clear button', async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Form">
          <SearchBox aria-label="Named" name="q" />
          <SearchBox aria-label="Unnamed" defaultValue="init" />
        </form>,
      );
      const named = screen.getByRole('searchbox', { name: 'Named' });
      const unnamed = screen.getByRole('searchbox', { name: 'Unnamed' });
      await user.type(named, 'typed');
      await user.clear(unnamed);
      await user.type(unnamed, 'other');
      expect(new FormData(getForm()).getAll('q')).toEqual(['typed']);

      act(() => getForm().reset());
      expect(named).toHaveValue('');
      expect(unnamed).toHaveValue('init');
      expect(new FormData(getForm()).getAll('q')).toEqual(['']);
      // Only the unnamed box (default "init") still has text to clear.
      expect(screen.getAllByRole('button', { name: 'Clear search' })).toHaveLength(1);
    });

    it('form reset reports defaultValue once, and nothing for an untouched box', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const untouched = vi.fn();
      render(
        <form aria-label="Form">
          <SearchBox aria-label="Changed" defaultValue="init" onValueChange={onValueChange} />
          <SearchBox aria-label="Untouched" defaultValue="same" onValueChange={untouched} />
        </form>,
      );
      await user.type(screen.getByRole('searchbox', { name: 'Changed' }), 'x');
      expect(onValueChange.mock.calls).toEqual([['initx']]);
      act(() => getForm().reset());
      expect(onValueChange.mock.calls).toEqual([['initx'], ['init']]);
      expect(untouched).not.toHaveBeenCalled();
    });

    it('controlled: form reset reports defaultValue to the parent', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      function Controlled() {
        const [value, setValue] = React.useState('');
        return (
          <SearchBox
            aria-label="Search"
            name="q"
            value={value}
            onValueChange={(next) => {
              onValueChange(next);
              setValue(next);
            }}
          />
        );
      }
      render(
        <form aria-label="Form">
          <Controlled />
        </form>,
      );
      await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'ab');
      act(() => getForm().reset());
      expect(onValueChange).toHaveBeenLastCalledWith('');
      expect(onValueChange).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
    });

    it('resets with the form named by `form` when it is rendered outside it', async () => {
      const user = userEvent.setup();
      render(
        <>
          <form id="search-form" aria-label="Form" />
          <SearchBox aria-label="Search" name="q" form="search-form" defaultValue="a" />
        </>,
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      await user.type(input, 'bc');
      act(() => getForm().reset());
      expect(input).toHaveValue('a');
    });
  });

  describe('prop routing (C-ROUTING, input-basic#1)', () => {
    it('routes id, ARIA and native input attributes to the input', () => {
      render(
        <>
          <span id="hint">Type at least 3 characters</span>
          <SearchBox
            data-testid="root"
            id="site-search"
            aria-label="Site search"
            aria-describedby="hint"
            aria-invalid
            aria-required
            name="q"
            autoComplete="off"
            maxLength={40}
            readOnly
            required
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
            tabIndex={2}
          />
        </>,
      );
      const input = screen.getByRole('searchbox', { name: 'Site search' });
      const root = screen.getByTestId('root');
      expect(root.tagName.toLowerCase()).toBe('div');
      expect(input).toHaveAttribute('id', 'site-search');
      expect(input).toHaveAccessibleDescription('Type at least 3 characters');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('name', 'q');
      expect(input).toHaveAttribute('autocomplete', 'off');
      expect(input).toHaveAttribute('maxlength', '40');
      expect(input).toHaveAttribute('readonly');
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('spellcheck', 'false');
      expect(input).toHaveAttribute('enterkeyhint', 'search');
      expect(input).toHaveAttribute('inputmode', 'search');
      expect(input).toHaveAttribute('tabindex', '2');
      for (const attr of ['id', 'aria-label', 'aria-describedby', 'name', 'tabindex']) {
        expect(root).not.toHaveAttribute(attr);
      }
    });

    it('routes focus and keyboard handlers to the input', () => {
      const onKeyDown = vi.fn();
      const onKeyUp = vi.fn();
      render(
        <SearchBox
          data-testid="root"
          aria-label="Search"
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
        />,
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      // A key event on the root itself (outside the input) does not reach the routed handler.
      fireEvent.keyDown(screen.getByTestId('root'), { key: 'Enter' });
      expect(onKeyDown).not.toHaveBeenCalled();
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyUp(input, { key: 'Enter' });
      expect(onKeyDown).toHaveBeenCalledOnce();
      expect((onKeyDown.mock.calls[0][0] as React.KeyboardEvent).target).toBe(input);
      expect(onKeyUp).toHaveBeenCalledOnce();
    });

    it('keeps ref on the root and exposes the input through controlRef', () => {
      const ref = React.createRef<HTMLDivElement>();
      const controlRef = React.createRef<HTMLInputElement>();
      render(<SearchBox aria-label="Search" ref={ref} controlRef={controlRef} />);
      expect(ref.current?.tagName.toLowerCase()).toBe('div');
      expect(controlRef.current).toBe(screen.getByRole('searchbox', { name: 'Search' }));
    });
  });

  describe('styles', () => {
    it('uses token classes only (button-provider#3, input-basic#7)', () => {
      const { container } = render(
        <SearchBox data-testid="root" aria-label="Search" defaultValue="abc" />,
      );
      expect(screen.getByTestId('root')).toHaveClass('border-input', 'border-b-stroke-accessible');
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(input).toHaveClass('placeholder:text-muted-foreground', 'focus:outline-hidden');
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toHaveClass(
        'text-muted-foreground',
        'not-disabled:not-aria-disabled:hover:text-foreground',
      );
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}|outline-none|enabled:/i);
    });

    it('shows the shared error border when the input is invalid (input-basic#1, R8)', () => {
      render(
        <>
          <SearchBox data-testid="invalid" aria-label="Invalid" aria-invalid />
          <SearchBox data-testid="valid" aria-label="Valid" />
        </>,
      );
      expect(screen.getByRole('searchbox', { name: 'Invalid' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      // The wrapper form of the shared recipe: the root draws the field around the input.
      const invalid = screen.getByTestId('invalid');
      expect(invalid).toHaveClass(...inputInvalidWithin.split(' '));
      expect(invalid).toHaveClass('border-destructive', 'focus-within:border-b-destructive');
      expect(invalid).not.toHaveClass('border-input', 'focus-within:border-b-primary');
      expect(screen.getByTestId('valid')).not.toHaveClass('border-destructive');
    });

    it('shows the error border for the invalid state of a surrounding Field', () => {
      renderWithFieldContext(<SearchBox data-testid="root" />, { errorId: FIELD_TEST_IDS.errorId });
      expect(screen.getByRole('searchbox', { name: FIELD_TEST_TEXT.label })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByTestId('root')).toHaveClass('border-destructive');
    });

    it('positions the icon and clear button with logical utilities in RTL (C-LOGICAL)', () => {
      const { container } = renderWithProviders(
        <SearchBox aria-label="Search" defaultValue="abc" />,
        { dir: 'rtl' },
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(input).toHaveClass('px-2');
      expect(screen.getByRole('button', { name: 'Clear search' })).toHaveClass('me-1');
      const icon = container.querySelector('[data-wave-icon="search"]');
      expect(icon?.parentElement).toHaveClass('ps-2');
      expect(container.innerHTML).not.toMatch(/\b(left|right|pl|pr|ml|mr)-\d/);
    });
  });

  it('passes axe with a value and a custom dismiss slot', async () => {
    render(<SearchBox aria-label="Search" defaultValue="abc" dismiss={<span>X</span>} />);
    await expectNoA11yViolations();
  });
});
