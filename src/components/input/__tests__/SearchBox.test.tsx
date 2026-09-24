import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { SearchBox, type SearchBoxProps } from '../SearchBox';
import { Button } from '../../button/Button';
import type { Slot, SlotObject } from '../../../lib/types';
import {
  testSystemProps,
  testFocusEvents,
  testNoImplicitSubmit,
  renderWithProviders,
  expectNoA11yViolations,
} from '../../../test-utils';

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
      expect(slot?.parentElement).toHaveClass('absolute', 'end-8');
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

    it('has a 24px target with room reserved in the input (input-basic#20)', () => {
      render(<SearchBox aria-label="Search" defaultValue="abc" />);
      expect(screen.getByRole('button', { name: 'Clear search' })).toHaveClass('h-6', 'w-6');
      expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveClass('pe-9');
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
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[WaveUI\] SearchBox: `dismiss`/));
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
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SearchBox: `dismiss`.*deprecated/));
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
      warn.mockRestore();
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
      const { container } = render(<SearchBox aria-label="Search" defaultValue="abc" />);
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(input).toHaveClass(
        'border-input',
        'border-b-stroke-accessible',
        'placeholder:text-muted-foreground',
        'focus:outline-hidden',
      );
      const clear = screen.getByRole('button', { name: 'Clear search' });
      expect(clear).toHaveClass(
        'text-muted-foreground',
        'not-disabled:not-aria-disabled:hover:text-foreground',
      );
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}|outline-none|enabled:/i);
    });

    it('shows the error border when the input is invalid (input-basic#1)', () => {
      render(
        <>
          <SearchBox aria-label="Invalid" aria-invalid />
          <SearchBox aria-label="Valid" />
        </>,
      );
      expect(screen.getByRole('searchbox', { name: 'Invalid' })).toHaveClass(
        'border-destructive',
        'focus:border-b-destructive',
      );
      expect(screen.getByRole('searchbox', { name: 'Valid' })).not.toHaveClass(
        'border-destructive',
      );
    });

    it('positions the icon and clear button with logical utilities in RTL (C-LOGICAL)', () => {
      const { container } = renderWithProviders(
        <SearchBox aria-label="Search" defaultValue="abc" />,
        { dir: 'rtl' },
      );
      const input = screen.getByRole('searchbox', { name: 'Search' });
      expect(input).toHaveClass('ps-8', 'pe-9');
      expect(screen.getByRole('button', { name: 'Clear search' })).toHaveClass('end-1');
      const icon = container.querySelector('[data-wave-icon="search"]');
      expect(icon?.parentElement).toHaveClass('start-2');
      expect(container.innerHTML).not.toMatch(/\b(left|right|pl|pr|ml|mr)-\d/);
    });
  });

  it('passes axe with a value and a custom dismiss slot', async () => {
    render(<SearchBox aria-label="Search" defaultValue="abc" dismiss={<span>X</span>} />);
    await expectNoA11yViolations();
  });
});
