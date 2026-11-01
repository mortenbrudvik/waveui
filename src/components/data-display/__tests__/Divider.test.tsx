import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Divider } from '../Divider';
import type { DividerOwnProps, DividerProps } from '../Divider';
import { dividerClassNames } from '../../../lib/classNames';
import type { Orientation } from '../../../lib/types';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  normaliseIds,
  openingTags,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';

describe('Divider', () => {
  testSystemProps(Divider, {
    expectedTag: 'hr',
    displayName: 'Divider',
    polymorphic: true,
    a11yVariants: [
      { name: 'labelled', props: { children: 'OR' } },
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'vertical labelled', props: { orientation: 'vertical', children: 'OR' } },
    ],
  });

  it('renders as a separator hr by default (horizontal, no children)', () => {
    render(<Divider data-testid="divider" />);
    const divider = screen.getByTestId('divider');
    expect(divider.tagName.toLowerCase()).toBe('hr');
    expect(screen.getByRole('separator')).toBe(divider);
    expect(divider).toHaveClass('border-t', 'border-border');
  });

  it('renders children text between lines', () => {
    render(<Divider>OR</Divider>);
    expect(screen.getByRole('separator', { name: 'OR' })).toHaveTextContent('OR');
  });

  it('renders as div when children are provided', () => {
    render(<Divider data-testid="divider">OR</Divider>);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('div');
  });

  it('renders vertical orientation', () => {
    render(<Divider orientation="vertical" data-testid="divider" />);
    const el = screen.getByTestId('divider');
    expect(el).toHaveAttribute('role', 'separator');
    expect(el).toHaveAttribute('aria-orientation', 'vertical');
    expect(el).toHaveClass('border-s', 'border-border');
  });

  it('renders as custom element via as prop', () => {
    render(<Divider as="section" data-testid="divider" />);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('section');
  });

  it('renders as custom element with children', () => {
    render(
      <Divider as="section" data-testid="divider">
        Text
      </Divider>,
    );
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('section');
  });

  it('renders as custom element in vertical mode', () => {
    render(<Divider as="span" orientation="vertical" data-testid="divider" />);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('span');
  });

  describe('labelled divider (data-display#12)', () => {
    it('is a single separator named by its label, with presentational lines', () => {
      render(<Divider>OR</Divider>);
      const separators = screen.getAllByRole('separator');
      expect(separators).toHaveLength(1);
      const separator = screen.getByRole('separator', { name: 'OR' });
      expect(separator).toBe(separators[0]);
      expect(separator.querySelector('hr')).toBeNull();
      const lines = separator.querySelectorAll('[aria-hidden="true"]');
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line.tagName.toLowerCase()).toBe('div');
        expect(line).toHaveClass('border-t');
      }
    });

    it('lets a consumer aria-label name the separator instead of the label', () => {
      render(<Divider aria-label="Alternative sign-in">OR</Divider>);
      expect(screen.getByRole('separator', { name: 'Alternative sign-in' })).toBeInTheDocument();
    });

    it('joins a consumer aria-labelledby with the label', () => {
      render(
        <>
          <span id="section-name">Options</span>
          <Divider aria-labelledby="section-name">OR</Divider>
        </>,
      );
      expect(screen.getByRole('separator', { name: 'Options OR' })).toBeInTheDocument();
    });
  });

  describe('vertical divider with children (data-display#11)', () => {
    it('renders the label between two vertical line segments', () => {
      render(<Divider orientation="vertical">OR</Divider>);
      const separator = screen.getByRole('separator', { name: 'OR' });
      expect(separator).toHaveAttribute('aria-orientation', 'vertical');
      expect(separator).toHaveClass('flex-col');
      expect(separator).toHaveTextContent('OR');
      const lines = separator.querySelectorAll('[aria-hidden="true"]');
      expect(lines).toHaveLength(2);
      for (const line of lines) expect(line).toHaveClass('border-s');
      expect(screen.getAllByRole('separator')).toHaveLength(1);
    });
  });

  // A consumer aria-labelledby names the unlabelled separators too.
  it.each([
    ['plain', {}, 'HR'],
    ['vertical', { orientation: 'vertical' }, 'DIV'],
  ] as Array<[string, DividerProps, string]>)(
    'names the %s separator with a consumer aria-labelledby',
    (_case, props, tagName) => {
      render(
        <>
          <span id="section-title">Options</span>
          <Divider {...props} aria-labelledby="section-title" />
        </>,
      );
      expect(screen.getByRole('separator', { name: 'Options' }).tagName).toBe(tagName);
    },
  );

  // C-SLOTS: children that render nothing (an empty
  // `.map()` result) are no label: the divider stays a plain, unnamed separator.
  describe.each([
    ['an empty array', () => []],
    ['an array of empty items', () => [null, false, '', [undefined]]],
    ['a Set of empty items', () => new Set([null, ''])],
    [
      'a generator of empty items',
      function* emptyItems() {
        yield null;
        yield false;
      },
    ],
  ] as Array<[string, () => React.ReactNode]>)('children set to %s', (_kind, makeChildren) => {
    it('renders the plain horizontal rule', () => {
      render(<Divider data-testid="divider">{makeChildren()}</Divider>);
      const divider = screen.getByTestId('divider');
      expect(divider.tagName).toBe('HR');
      expect(divider).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('separator')).toBe(divider);
    });

    it('renders the plain vertical line', () => {
      render(
        <Divider orientation="vertical" data-testid="divider">
          {makeChildren()}
        </Divider>,
      );
      const divider = screen.getByTestId('divider');
      expect(divider).toHaveClass('inline-block', 'h-6');
      expect(divider).toBeEmptyDOMElement();
      expect(divider).not.toHaveAttribute('aria-labelledby');
    });
  });

  it.each([
    ['0', () => 0, '0'],
    ['an array with a label', () => [null, 'OR'], 'OR'],
    [
      'a generator with a label',
      function* label() {
        yield null;
        yield 'OR';
      },
      'OR',
    ],
  ] as Array<[string, () => React.ReactNode, string]>)(
    'renders %s as the label',
    (_kind, makeChildren, name) => {
      render(<Divider>{makeChildren()}</Divider>);
      expect(screen.getByRole('separator', { name })).toHaveTextContent(name);
    },
  );

  it('uses logical borders, so a vertical divider is RTL-safe (feedback-navigation#34)', () => {
    renderWithProviders(<Divider orientation="vertical" data-testid="divider" />, { dir: 'rtl' });
    const divider = screen.getByTestId('divider');
    expect(divider).toHaveClass('border-s');
    expect(divider.className).not.toMatch(/\bborder-[lr]\b/);
  });

  describe('types (button-provider#8, layout#16)', () => {
    it('type-checks props against the `as` element', () => {
      const anchorRef = React.createRef<HTMLAnchorElement>();
      const elementRef = React.createRef<HTMLElement>();
      render(
        <>
          <Divider ref={elementRef} />
          <Divider as="a" href="/more" ref={anchorRef}>
            More
          </Divider>
        </>,
      );
      expect(elementRef.current?.tagName.toLowerCase()).toBe('hr');
      expect(anchorRef.current).toBe(screen.getByRole('separator', { name: 'More' }));
    });

    it('rejects props the rendered element does not have', () => {
      const elements = [
        // @ts-expect-error href is not an <hr> attribute
        <Divider key="1" href="/nope" />,
        // @ts-expect-error orientation keeps its literal type
        <Divider key="2" orientation="diagonal" />,
      ];
      expect(elements).toHaveLength(2);
    });

    it('exports DividerOwnProps and the 0.4 DividerProps name', () => {
      expectTypeOf<DividerOwnProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
      expectTypeOf<DividerProps>().toEqualTypeOf<DividerProps<'hr'>>();
      expectTypeOf<DividerProps>().toHaveProperty('ref');
      interface SectionDividerProps extends DividerProps {
        tracking?: string;
      }
      expectTypeOf<SectionDividerProps>().toHaveProperty('orientation');
    });
  });
});

describe('Divider — slotProps', () => {
  type DividerSlotProps = NonNullable<DividerOwnProps['slotProps']>;
  const EVERY_PART: DividerSlotProps = { line: {}, label: {} };
  const all = (root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`));
  const partsOf = (root: ParentNode = document) => [
    ...all(root, dividerClassNames.line),
    ...all(root, dividerClassNames.label),
  ];

  /** A labelled divider of each orientation. */
  function Dividers({ slotProps }: { slotProps?: DividerSlotProps }) {
    return (
      <>
        <Divider slotProps={slotProps}>OR</Divider>
        <Divider orientation="vertical" slotProps={slotProps}>
          AND
        </Divider>
      </>
    );
  }

  // Captured from ee05cf8's dist (client and server agree).
  const BASE_PINS = [
    '<div aria-hidden="true" class="wave-divider__line h-0 min-w-2 flex-1 border-t border-border">',
    '<div aria-hidden="true" class="wave-divider__line h-0 min-w-2 flex-1 border-t border-border">',
    '<div aria-hidden="true" class="wave-divider__line w-0 min-h-2 flex-1 border-s border-border">',
    '<div aria-hidden="true" class="wave-divider__line w-0 min-h-2 flex-1 border-s border-border">',
    '<span class="wave-divider__label shrink-0 text-caption-1 text-muted-foreground" id="divider-label-_id0_">',
    '<span class="wave-divider__label shrink-0 text-caption-1 text-muted-foreground" id="divider-label-_id1_">',
  ].join('\n');

  it('renders the parts of ee05cf8 (attributes sorted), on the client and the server', () => {
    for (const slotProps of [undefined, EVERY_PART]) {
      const view = render(<Dividers slotProps={slotProps} />);
      expect(openingTags(...partsOf())).toBe(BASE_PINS);
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Dividers slotProps={slotProps} />);
      expect(openingTags(...partsOf(template.content))).toBe(BASE_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    expectInertSlotProps(
      (slotProps: DividerSlotProps | undefined) => <Dividers slotProps={slotProps} />,
      EVERY_PART,
    );
    expectInertSlotProps(
      (slotProps: DividerSlotProps | undefined) => (
        <Divider as="li" aria-label="Named" aria-labelledby="other" slotProps={slotProps}>
          <b>{0}</b>
        </Divider>
      ),
      EVERY_PART,
    );
  });

  it('keeps the attribute order of ee05cf8 with every part empty', () => {
    const markup = (slotProps?: DividerSlotProps) => {
      const { container, unmount } = render(<Dividers slotProps={slotProps} />);
      const html = normaliseIds(container.innerHTML);
      unmount();
      return html;
    };
    expect(markup(EVERY_PART)).toBe(markup());
  });

  it('puts your className, style, data-* and ref on each part, the line props on both lines', () => {
    const refs: Element[] = [];
    const collect = (node: Element | null) => void (node && refs.push(node));
    render(
      <Divider
        slotProps={{
          line: {
            className: 'my-line border-dashed min-w-4',
            style: { opacity: 0.5 },
            'data-part': 'line',
            ref: collect,
          },
          label: {
            className: 'my-label text-body-1',
            style: { opacity: 0.5 },
            'data-part': 'label',
            ref: collect,
          },
        }}
      >
        OR
      </Divider>,
    );
    for (const [cls, name, conflict, count] of [
      [dividerClassNames.line, 'line', 'min-w-2', 2],
      [dividerClassNames.label, 'label', 'text-caption-1', 1],
    ] as const) {
      const elements = all(document, cls);
      expect(elements).toHaveLength(count);
      for (const element of elements) {
        expect(element.classList[0]).toBe(cls);
        expect(element).toHaveClass(`my-${name}`);
        // Your class replaces a conflicting one of the part.
        expect(element).not.toHaveClass(conflict);
        expect(element).toHaveAttribute('data-part', name);
        expect(element).toHaveStyle({ opacity: '0.5' });
        expect(refs).toContain(element);
      }
    }
    expect(refs).toHaveLength(3);
    expect(screen.getByRole('separator')).not.toHaveAttribute('data-part');
  });

  it('locks the decorative lines and the label the separator is named by', () => {
    const hiddenState = { hidden: true, inert: true, 'aria-hidden': true };
    render(
      <Dividers
        slotProps={
          {
            line: { role: 'presentation', tabIndex: 0, 'aria-hidden': false },
            label: { ...hiddenState, id: 'mine', role: 'heading', 'aria-label': 'Mine' },
          } as unknown as DividerSlotProps
        }
      />,
    );
    expect(openingTags(...partsOf())).toBe(BASE_PINS);
    expect(screen.getByRole('separator', { name: 'OR' })).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'AND' })).toBeInTheDocument();
  });

  it('adds your ids to the aria-describedby of the label', () => {
    render(
      <>
        <span id="note">Note</span>
        <Divider slotProps={{ label: { 'aria-describedby': 'note' } }}>OR</Divider>
      </>,
    );
    expect(all(document, dividerClassNames.label)[0]).toHaveAttribute('aria-describedby', 'note');
  });

  it('runs your label handler; the divider has no handler of its own', () => {
    const onClick = vi.fn();
    const label = vi.fn();
    render(
      <Divider onClick={onClick} slotProps={{ label: { onClick: label } }}>
        OR
      </Divider>,
    );
    fireEvent.click(screen.getByText('OR'));
    expect(label).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls each part handler once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const label = vi.fn();
    const line = vi.fn();
    render(
      <React.StrictMode>
        <Divider slotProps={{ label: { onClick: label }, line: { onClick: line } }}>OR</Divider>
      </React.StrictMode>,
    );
    await user.click(screen.getByText('OR'));
    await user.click(all(document, dividerClassNames.line)[0]);
    expect(label).toHaveBeenCalledTimes(1);
    expect(line).toHaveBeenCalledTimes(1);
  });

  it('draws no part without a label, and passes no slotProps to the element', () => {
    const error = vi.spyOn(console, 'error');
    try {
      render(
        <>
          <Divider slotProps={EVERY_PART} />
          <Divider orientation="vertical" slotProps={EVERY_PART} />
          <Divider slotProps={EVERY_PART}>{''}</Divider>
        </>,
      );
      expect(partsOf()).toHaveLength(0);
      for (const separator of screen.getAllByRole('separator')) {
        expect(separator).not.toHaveAttribute('slotprops');
      }
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('keeps the logical lines of a right-to-left vertical divider', () => {
    renderWithProviders(
      <Divider orientation="vertical" slotProps={{ line: { className: 'my-line' } }}>
        AND
      </Divider>,
      { dir: 'rtl' },
    );
    for (const line of all(document, dividerClassNames.line)) {
      expect(line).toHaveClass('my-line', 'border-s');
    }
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <Divider
        slotProps={{ line: { className: 'my-line' }, label: { className: 'my-label', lang: 'en' } }}
      >
        OR
      </Divider>,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element on every element type, and takes no children', () => {
    expectTypeOf<keyof DividerSlotProps>().toEqualTypeOf<'line' | 'label'>();
    expectTypeOf<NonNullable<DividerSlotProps['line']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<DividerSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<DividerProps<'li'>['slotProps']>().toEqualTypeOf<DividerOwnProps['slotProps']>();
    // @ts-expect-error -- the label's content is the divider's children
    const label: DividerSlotProps = { label: { children: 'x' } };
    expect([label]).toHaveLength(1);
  });
});
