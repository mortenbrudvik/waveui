import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
  type AccordionProps,
  type AccordionSingleProps,
  type AccordionMultipleProps,
  type AccordionTriggerProps,
  type AccordionPanelProps,
} from '../Accordion';
import { Tooltip } from '../../overlays/Tooltip';
import type { SelectionMode } from '../../../lib/types';
import {
  asClientReference,
  expectNoA11yViolations,
  testSystemProps,
  testCompoundExposure,
  testComposedHandler,
  expectThrows,
} from '../../../test-utils';

/** Stand-in for a Tooltip (P16): a wrapper component that renders its `children` (§5.9). */
const WrapperStandIn = ({ children }: { children: React.ReactNode }) => (
  <span className="contents">{children}</span>
);

/** Every id in the document is unique. */
const expectUniqueIds = () => {
  const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
  expect(new Set(ids).size).toBe(ids.length);
};

const items = (
  <>
    <Accordion.Item value="1">
      <Accordion.Trigger>Item 1</Accordion.Trigger>
      <Accordion.Panel>Panel 1</Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="2">
      <Accordion.Trigger>Item 2</Accordion.Trigger>
      <Accordion.Panel>Panel 2</Accordion.Panel>
    </Accordion.Item>
  </>
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Accordion', () => {
  testSystemProps(Accordion, {
    expectedTag: 'div',
    displayName: 'Accordion',
    defaultProps: { children: items },
    a11yVariants: [
      { name: 'open item', props: { defaultOpenItem: '1' } },
      { name: 'multiple open items', props: { type: 'multiple', defaultOpenItems: ['1', '2'] } },
      { name: 'heading level 2', props: { headingLevel: 2, defaultOpenItem: '2' } },
      {
        name: 'open item without panel content',
        props: {
          defaultOpenItem: '1',
          children: (
            <Accordion.Item value="1">
              <Accordion.Trigger>Heading only</Accordion.Trigger>
            </Accordion.Item>
          ),
        },
      },
    ],
  });

  testCompoundExposure(Accordion, ['Item', 'Trigger', 'Panel']);

  it('exports every sub-component under its flat name (C-COMPOUND)', () => {
    expect(AccordionItem).toBe(Accordion.Item);
    expect(AccordionTrigger).toBe(Accordion.Trigger);
    expect(AccordionPanel).toBe(Accordion.Panel);
  });

  it('renders the trigger text as the button name', () => {
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>First Item</Accordion.Trigger>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getByRole('button', { name: 'First Item' })).toBeInTheDocument();
  });

  it('panel is hidden by default', () => {
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item</Accordion.Trigger>
          <Accordion.Panel>Hidden content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('opens panel on click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Click me</Accordion.Trigger>
          <Accordion.Panel>Revealed</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(screen.getByRole('region', { name: 'Click me' })).toHaveTextContent('Revealed');
  });

  it('closes panel on second click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Toggle</Accordion.Trigger>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Toggle' });
    await user.click(button);
    expect(screen.getByText('Content')).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('opens and closes with Enter and Space on the focused trigger', async () => {
    const user = userEvent.setup();
    render(<Accordion>{items}</Accordion>);
    const button = screen.getByRole('button', { name: 'Item 1' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('single mode: only one item open at a time', async () => {
    const user = userEvent.setup();
    render(<Accordion type="single">{items}</Accordion>);
    await user.click(screen.getByRole('button', { name: 'Item 1' }));
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Item 2' }));
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
  });

  it('multiple mode: multiple items open at once', async () => {
    const user = userEvent.setup();
    render(<Accordion type="multiple">{items}</Accordion>);
    await user.click(screen.getByRole('button', { name: 'Item 1' }));
    await user.click(screen.getByRole('button', { name: 'Item 2' }));
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
  });

  it('sets aria-expanded and data-state on the trigger button', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item</Accordion.Trigger>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Item' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('data-state', 'closed');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('data-state', 'open');
  });

  it('the trigger is not a submit button and gates its hover color (C-TOKENS)', () => {
    render(<Accordion>{items}</Accordion>);
    const button = screen.getByRole('button', { name: 'Item 1' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('not-disabled:not-aria-disabled:hover:bg-subtle-hover');
    expect(button.className).not.toMatch(/(^|\s)enabled:/);
  });

  it('StrictMode: onOpenItemsChange fires exactly once per click', async () => {
    const user = userEvent.setup();
    const onOpenItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <Accordion type="multiple" onOpenItemsChange={onOpenItemsChange}>
          {items}
        </Accordion>
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Item 2' }));
    expect(onOpenItemsChange).toHaveBeenCalledTimes(1);
    expect(onOpenItemsChange).toHaveBeenCalledWith(['2']);
  });
});

describe('Accordion - ids and relationships (layout#11)', () => {
  it('links each trigger and region through aria-controls and aria-labelledby', async () => {
    const user = userEvent.setup();
    render(<Accordion type="multiple">{items}</Accordion>);
    for (const name of ['Item 1', 'Item 2']) {
      const button = screen.getByRole('button', { name });
      await user.click(button);
      const region = screen.getByRole('region', { name });
      expect(button.getAttribute('aria-controls')).toBe(region.id);
      expect(region.getAttribute('aria-labelledby')).toBe(button.id);
    }
  });

  it('two accordions with the same item values get distinct ids', () => {
    render(
      <>
        <Accordion aria-label="First" defaultOpenItem="1">
          {items}
        </Accordion>
        <Accordion aria-label="Second" defaultOpenItem="1">
          {items}
        </Accordion>
      </>,
    );
    const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const [first, second] = screen.getAllByRole('button', { name: 'Item 1' });
    const [firstRegion, secondRegion] = screen.getAllByRole('region', { name: 'Item 1' });
    expect(firstRegion.getAttribute('aria-labelledby')).toBe(first.id);
    expect(secondRegion.getAttribute('aria-labelledby')).toBe(second.id);
    expect(first.id).not.toBe(second.id);
  });

  it('a collapsed trigger keeps aria-controls to the id its region will have', async () => {
    const user = userEvent.setup();
    render(<Accordion>{items}</Accordion>);
    const button = screen.getByRole('button', { name: 'Item 1' });
    const controls = button.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    await user.click(button);
    expect(screen.getByRole('region', { name: 'Item 1' }).id).toBe(controls);
  });

  it('an open item without panel content has no aria-controls (no dangling reference)', async () => {
    render(
      <Accordion defaultOpenItem="1">
        <Accordion.Item value="1">
          <Accordion.Trigger>Heading only</Accordion.Trigger>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Heading only' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('keeps a consumer id on the Trigger and the Panel and links them through it (layout#10)', () => {
    render(
      <Accordion defaultOpenItem="1">
        <Accordion.Item value="1">
          <Accordion.Trigger id="my-trigger">Item 1</Accordion.Trigger>
          <Accordion.Panel id="my-panel">Panel 1</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Item 1' });
    const region = screen.getByRole('region', { name: 'Item 1' });
    expect(button).toHaveAttribute('id', 'my-trigger');
    expect(region).toHaveAttribute('id', 'my-panel');
    expect(button).toHaveAttribute('aria-controls', 'my-panel');
    expect(region).toHaveAttribute('aria-labelledby', 'my-trigger');
  });

  it('an empty consumer id counts as none: the generated ids are rendered and linked (layout#10)', async () => {
    render(
      <Accordion defaultOpenItem="1">
        <Accordion.Item value="1">
          <Accordion.Trigger id="">Item 1</Accordion.Trigger>
          <Accordion.Panel id="">Panel 1</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Item 1' });
    const region = screen.getByRole('region', { name: 'Item 1' });
    expect(button.id).not.toBe('');
    expect(region.id).not.toBe('');
    expect(button).toHaveAttribute('aria-controls', region.id);
    expect(region).toHaveAttribute('aria-labelledby', button.id);
    await expectNoA11yViolations();
  });

  it('values that differ only in punctuation or spaces do not collide', () => {
    render(
      <Accordion type="multiple" defaultOpenItems={['a b', 'a.b', 'a_b']}>
        {['a b', 'a.b', 'a_b'].map((value) => (
          <Accordion.Item key={value} value={value}>
            <Accordion.Trigger>{`Trigger ${value}`}</Accordion.Trigger>
            <Accordion.Panel>{`Panel ${value}`}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>,
    );
    const buttonIds = screen.getAllByRole('button').map((button) => button.id);
    expect(new Set(buttonIds).size).toBe(3);
    for (const value of ['a b', 'a.b', 'a_b']) {
      expect(screen.getByRole('region', { name: `Trigger ${value}` })).toHaveTextContent(
        `Panel ${value}`,
      );
    }
  });
});

describe('Accordion.Trigger and Accordion.Panel (layout#17)', () => {
  it('merge className, data-* attributes and ref onto the button and the region', () => {
    const triggerRef = React.createRef<HTMLButtonElement>();
    const panelRef = React.createRef<HTMLDivElement>();
    render(
      <Accordion defaultOpenItem="1">
        <Accordion.Item value="1">
          <Accordion.Trigger ref={triggerRef} className="custom-trigger" data-testid="trigger">
            Item 1
          </Accordion.Trigger>
          <Accordion.Panel ref={panelRef} className="custom-panel" data-testid="panel">
            Panel 1
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Item 1' });
    const region = screen.getByRole('region', { name: 'Item 1' });
    expect(triggerRef.current).toBe(button);
    expect(panelRef.current).toBe(region);
    expect(button).toHaveAttribute('data-testid', 'trigger');
    expect(region).toHaveAttribute('data-testid', 'panel');
    expect(button).toHaveClass('custom-trigger', 'w-full');
    expect(region).toHaveClass('custom-panel', 'px-4');
  });

  it('a conflicting className on the trigger wins over the default', () => {
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger className="px-8">Item 1</Accordion.Trigger>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Item 1' });
    expect(button).toHaveClass('px-8');
    expect(button).not.toHaveClass('px-4');
  });

  testComposedHandler(Accordion.Trigger, {
    handler: 'onClick',
    defaultProps: { children: 'Composed' },
    wrapper: ({ children }) => (
      <Accordion>
        <Accordion.Item value="1">
          {children}
          <Accordion.Panel>Composed panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    ),
    act: async ({ user }) => {
      await user.click(screen.getByRole('button', { name: 'Composed' }));
    },
    assertInternal: () => {
      expect(screen.getByRole('region', { name: 'Composed' })).toBeInTheDocument();
    },
    assertInternalSuppressed: () => {
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Composed' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    },
  });

  it('renders plain-text children of an Item in its panel, with the value as the label', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="Shipping">Ships within two days.</Accordion.Item>
      </Accordion>,
    );
    await user.click(screen.getByRole('button', { name: 'Shipping' }));
    expect(screen.getByRole('region', { name: 'Shipping' })).toHaveTextContent(
      'Ships within two days.',
    );
  });

  it('renders extra children of an Item after the Panel content', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item 1</Accordion.Trigger>
          <Accordion.Panel>Panel text.</Accordion.Panel>
          Trailing text.
        </Accordion.Item>
      </Accordion>,
    );
    await user.click(screen.getByRole('button', { name: 'Item 1' }));
    expect(screen.getByRole('region', { name: 'Item 1' })).toHaveTextContent(
      'Panel text.Trailing text.',
    );
    expect(screen.getAllByRole('region')).toHaveLength(1);
  });

  it('finds Trigger and Panel inside a Fragment', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <>
            <Accordion.Trigger>Fragment trigger</Accordion.Trigger>
            <Accordion.Panel>Fragment panel</Accordion.Panel>
          </>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Fragment trigger' }));
    expect(screen.getByRole('region', { name: 'Fragment trigger' })).toHaveTextContent(
      'Fragment panel',
    );
  });

  it('finds a Trigger and a Panel wrapped in another component (a Tooltip stand-in)', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="x">
          <WrapperStandIn>
            <Accordion.Trigger>Real trigger</Accordion.Trigger>
          </WrapperStandIn>
          <WrapperStandIn>
            <Accordion.Panel>Wrapped panel</Accordion.Panel>
          </WrapperStandIn>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const button = screen.getByRole('button', { name: 'Real trigger' });
    await user.click(button);
    const region = screen.getByRole('region', { name: 'Real trigger' });
    expect(region).toHaveTextContent('Wrapped panel');
    expect(region).not.toContainElement(button);
    expect(button).toHaveAttribute('aria-controls', region.id);
    expectUniqueIds();
  });

  it('a Trigger or Panel rendered inside a component is panel content: it warns and duplicates no id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function OpaqueTrigger() {
      return <Accordion.Trigger>Opaque trigger</Accordion.Trigger>;
    }
    function OpaquePanel() {
      return <Accordion.Panel>Opaque panel</Accordion.Panel>;
    }
    render(
      <Accordion defaultOpenItem="x">
        <Accordion.Item value="x">
          <OpaqueTrigger />
          <OpaquePanel />
        </Accordion.Item>
      </Accordion>,
    );
    // The Item cannot see through the components: `value` labels its trigger, and both render in
    // its panel.
    const region = screen.getByRole('region', { name: 'x' });
    expect(within(region).getByRole('button', { name: 'Opaque trigger' })).not.toHaveAttribute(
      'id',
    );
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expectUniqueIds();
    const misplaced = (part: 'Trigger' | 'Panel') =>
      `[WaveUI] Accordion.${part} was rendered inside the panel of an Accordion.Item, so it is ` +
      `not the item's ${part === 'Trigger' ? 'header' : 'panel'}. Place Accordion.Trigger and ` +
      'Accordion.Panel directly in Accordion.Item, in a Fragment, or in an element that wraps ' +
      'them as `children` (such as a Tooltip). The Item cannot see inside a component that ' +
      'renders them itself and treats that component as panel content.';
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      misplaced('Trigger'),
      misplaced('Panel'),
    ]);
  });

  it('extra Item content does not re-render the Trigger when only that content changes (table-core#25)', () => {
    const onRender = vi.fn();
    // A constant element: React re-renders the Trigger only when the item context changes.
    const trigger = (
      <React.Profiler id="trigger" onRender={onRender}>
        <Accordion.Trigger>Item 1</Accordion.Trigger>
      </React.Profiler>
    );
    const panel = <Accordion.Panel>Panel text.</Accordion.Panel>;
    const renderItem = (extra: string) => (
      <Accordion defaultOpenItem="1">
        <Accordion.Item value="1">
          {trigger}
          {panel}
          {extra}
        </Accordion.Item>
      </Accordion>
    );
    const { rerender } = render(renderItem('First.'));
    const initial = onRender.mock.calls.length;
    rerender(renderItem('Second.'));
    expect(screen.getByRole('region', { name: 'Item 1' })).toHaveTextContent('Panel text.Second.');
    expect(onRender.mock.calls.length).toBe(initial);
  });

  it('types ref on the Props interfaces (C-REF)', () => {
    expectTypeOf<AccordionTriggerProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<AccordionPanelProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
  });
});

describe('Accordion - heading (layout#18)', () => {
  it('wraps each trigger button in a level-3 heading by default', () => {
    render(<Accordion>{items}</Accordion>);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(2);
    expect(within(headings[0]).getByRole('button', { name: 'Item 1' })).toBeInTheDocument();
    expect(headings[0]).toHaveClass('m-0');
  });

  it('uses the Accordion headingLevel, overridable per Item', () => {
    render(
      <Accordion headingLevel={2}>
        <Accordion.Item value="1">
          <Accordion.Trigger>Level two</Accordion.Trigger>
        </Accordion.Item>
        <Accordion.Item value="2" headingLevel={4}>
          <Accordion.Trigger>Level four</Accordion.Trigger>
        </Accordion.Item>
      </Accordion>,
    );
    expect(
      within(screen.getByRole('heading', { level: 2 })).getByRole('button', {
        name: 'Level two',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('heading', { level: 4 })).getByRole('button', {
        name: 'Level four',
      }),
    ).toBeInTheDocument();
  });

  it('a Tooltip around the Trigger renders inside the heading, which stretches it to the full row', async () => {
    render(
      <Accordion headingLevel={2} defaultOpenItem="x">
        <Accordion.Item value="x">
          <Tooltip content="Delivery times and costs">
            <Accordion.Trigger>Shipping</Accordion.Trigger>
          </Tooltip>
          <Accordion.Panel>Ships in two days.</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    const heading = screen.getByRole('heading', { level: 2, name: 'Shipping' });
    const button = within(heading).getByRole('button', { name: 'Shipping' });
    // The heading is the outer element: no heading inside the Tooltip's phrasing <span>.
    expect(heading.closest('span')).toBeNull();
    const tooltipWrapper = button.parentElement;
    expect(tooltipWrapper?.tagName).toBe('SPAN');
    expect(tooltipWrapper?.parentElement).toBe(heading);
    // A grid heading stretches the inline-block wrapper, so the full-width button keeps its
    // chevron at the end of the row.
    expect(heading).toHaveClass('m-0', 'grid');
    expect(button).toHaveClass('w-full');
    expect(button).toHaveAccessibleDescription('Delivery times and costs');
    const region = screen.getByRole('region', { name: 'Shipping' });
    expect(button).toHaveAttribute('aria-controls', region.id);
    expect(heading).not.toContainElement(region);
    await expectNoA11yViolations();
  });

  it('a wrapper component chain around the Trigger alone moves inside the heading', () => {
    render(
      <Accordion>
        <Accordion.Item value="x">
          <WrapperStandIn>
            <WrapperStandIn>
              <Accordion.Trigger>Nested wrappers</Accordion.Trigger>
            </WrapperStandIn>
          </WrapperStandIn>
        </Accordion.Item>
      </Accordion>,
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(heading.closest('span')).toBeNull();
    expect(within(heading).getByRole('button', { name: 'Nested wrappers' })).toBeInTheDocument();
  });

  it('an element wrapper, or a wrapper that holds more than the Trigger, keeps the heading inside it', () => {
    render(
      <Accordion>
        <Accordion.Item value="1">
          <div data-testid="row">
            <Accordion.Trigger>Element wrapper</Accordion.Trigger>
          </div>
        </Accordion.Item>
        <Accordion.Item value="2">
          <WrapperStandIn>
            <Accordion.Trigger>Two children</Accordion.Trigger>
            <span>Badge</span>
          </WrapperStandIn>
        </Accordion.Item>
      </Accordion>,
    );
    const [first, second] = screen.getAllByRole('heading', { level: 3 });
    expect(first.parentElement).toBe(screen.getByTestId('row'));
    expect(within(first).getByRole('button', { name: 'Element wrapper' })).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: 'Two children' })).toBeInTheDocument();
    expect(second).not.toHaveTextContent('Badge');
    expect(screen.getByText('Badge').closest('h3')).toBeNull();
  });
});

describe('Accordion - single and multiple APIs (layout#19)', () => {
  it('single: openItem controls the open item', () => {
    render(<Accordion openItem="2">{items}</Accordion>);
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
  });

  it('single: openItem={null} closes every item', () => {
    render(<Accordion openItem={null}>{items}</Accordion>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('single: defaultOpenItem opens an item uncontrolled', async () => {
    const user = userEvent.setup();
    render(<Accordion defaultOpenItem="2">{items}</Accordion>);
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Item 1' }));
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    expect(screen.queryByText('Panel 2')).not.toBeInTheDocument();
  });

  it('single: onOpenItemChange reports the opened value, then null', async () => {
    const user = userEvent.setup();
    const onOpenItemChange = vi.fn();
    render(<Accordion onOpenItemChange={onOpenItemChange}>{items}</Accordion>);
    const button = screen.getByRole('button', { name: 'Item 1' });
    await user.click(button);
    expect(onOpenItemChange).toHaveBeenLastCalledWith('1');
    await user.click(button);
    expect(onOpenItemChange).toHaveBeenLastCalledWith(null);
    expect(onOpenItemChange).toHaveBeenCalledTimes(2);
  });

  it('single: a controlled parent that ignores onOpenItemChange keeps the item closed', async () => {
    const user = userEvent.setup();
    const onOpenItemChange = vi.fn();
    render(
      <Accordion openItem={null} onOpenItemChange={onOpenItemChange}>
        {items}
      </Accordion>,
    );
    const button = screen.getByRole('button', { name: 'Item 1' });
    await user.click(button);
    await user.click(button);
    expect(onOpenItemChange).toHaveBeenNthCalledWith(1, '1');
    expect(onOpenItemChange).toHaveBeenNthCalledWith(2, '1');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('single: a parent that accepts onOpenItemChange moves the open item', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [openItem, setOpenItem] = React.useState<string | null>('1');
      return (
        <Accordion openItem={openItem} onOpenItemChange={setOpenItem}>
          {items}
        </Accordion>
      );
    }
    render(<Controlled />);
    expect(screen.getByRole('region', { name: 'Item 1' })).toHaveTextContent('Panel 1');
    await user.click(screen.getByRole('button', { name: 'Item 2' }));
    expect(screen.getByRole('region', { name: 'Item 2' })).toHaveTextContent('Panel 2');
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Item 2' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Item 2' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('single: follows a new openItem from the parent', () => {
    const { rerender } = render(<Accordion openItem="1">{items}</Accordion>);
    expect(screen.getByRole('region', { name: 'Item 1' })).toBeInTheDocument();
    rerender(<Accordion openItem="2">{items}</Accordion>);
    expect(screen.getByRole('region', { name: 'Item 2' })).toHaveTextContent('Panel 2');
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument();
    rerender(<Accordion openItem={null}>{items}</Accordion>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('multiple: follows new openItems from the parent', () => {
    const { rerender } = render(
      <Accordion type="multiple" openItems={['1']}>
        {items}
      </Accordion>,
    );
    expect(screen.getAllByRole('region').map((region) => region.textContent)).toEqual(['Panel 1']);
    rerender(
      <Accordion type="multiple" openItems={['1', '2']}>
        {items}
      </Accordion>,
    );
    expect(screen.getAllByRole('region').map((region) => region.textContent)).toEqual([
      'Panel 1',
      'Panel 2',
    ]);
    rerender(
      <Accordion type="multiple" openItems={[]}>
        {items}
      </Accordion>,
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('multiple: accepts readonly arrays and still reports a mutable array (C-NAMING)', async () => {
    const user = userEvent.setup();
    const openItems = ['1'] as const;
    const onOpenItemsChange = vi.fn();
    render(
      <Accordion type="multiple" openItems={openItems} onOpenItemsChange={onOpenItemsChange}>
        {items}
      </Accordion>,
    );
    await user.click(screen.getByRole('button', { name: 'Item 2' }));
    expect(onOpenItemsChange).toHaveBeenCalledWith(['1', '2']);
    expectTypeOf<AccordionMultipleProps['openItems']>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<AccordionMultipleProps['defaultOpenItems']>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<
      Parameters<NonNullable<AccordionMultipleProps['onOpenItemsChange']>>[0]
    >().toEqualTypeOf<string[]>();
  });

  it('single: the legacy openItems/defaultOpenItems/onOpenItemsChange still work and warn once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    const onOpenItemsChange = vi.fn();
    render(
      <Accordion defaultOpenItems={['2']} onOpenItemsChange={onOpenItemsChange}>
        {items}
      </Accordion>,
    );
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Item 1' }));
    expect(onOpenItemsChange).toHaveBeenCalledWith(['1']);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      '[WaveUI] Accordion: `defaultOpenItems` is deprecated and will be removed in 1.0. Use `defaultOpenItem` instead. In single mode the Accordion takes one value.',
      '[WaveUI] Accordion: `onOpenItemsChange` is deprecated and will be removed in 1.0. Use `onOpenItemChange` instead. In single mode the Accordion reports one value.',
    ]);
  });

  it('single: legacy controlled openItems still controls the open item and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<Accordion openItems={['1']}>{items}</Accordion>);
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    expect(screen.queryByText('Panel 2')).not.toBeInTheDocument();
    rerender(<Accordion openItems={['1']}>{items}</Accordion>);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      '[WaveUI] Accordion: `openItems` is deprecated and will be removed in 1.0. Use `openItem` instead. In single mode the Accordion takes one value.',
    ]);
  });

  it('single: calls both onOpenItemChange and its deprecated alias onOpenItemsChange (C-NAMING)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    const onOpenItemChange = vi.fn();
    const onOpenItemsChange = vi.fn();
    render(
      <Accordion onOpenItemChange={onOpenItemChange} onOpenItemsChange={onOpenItemsChange}>
        {items}
      </Accordion>,
    );
    await user.click(screen.getByRole('button', { name: 'Item 1' }));
    expect(onOpenItemChange).toHaveBeenCalledTimes(1);
    expect(onOpenItemChange).toHaveBeenCalledWith('1');
    expect(onOpenItemsChange).toHaveBeenCalledTimes(1);
    expect(onOpenItemsChange).toHaveBeenCalledWith(['1']);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      '[WaveUI] Accordion: `onOpenItemsChange` is deprecated and will be removed in 1.0. Use `onOpenItemChange` instead. In single mode the Accordion reports one value.',
    ]);
  });

  it('single: warns when more than one item is open', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Accordion openItems={['1', '2']}>{items}</Accordion>);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      '[WaveUI] Accordion: `openItems` is deprecated and will be removed in 1.0. Use `openItem` instead. In single mode the Accordion takes one value.',
      '[WaveUI] Accordion: type="single" allows one open item, but 2 are open. Pass `openItem`, or use type="multiple".',
    ]);
  });

  it('multiple: openItems is not deprecated', async () => {
    const warn = vi.spyOn(console, 'warn');
    const user = userEvent.setup();
    const onOpenItemsChange = vi.fn();
    render(
      <Accordion type="multiple" openItems={['1']} onOpenItemsChange={onOpenItemsChange}>
        {items}
      </Accordion>,
    );
    await user.click(screen.getByRole('button', { name: 'Item 2' }));
    expect(onOpenItemsChange).toHaveBeenCalledWith(['1', '2']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('multiple: respects defaultOpenItems', () => {
    render(
      <Accordion type="multiple" defaultOpenItems={['2']}>
        {items}
      </Accordion>,
    );
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
  });

  it('types the props as a discriminated union on the shared SelectionMode', () => {
    expectTypeOf<NonNullable<AccordionProps['type']>>().toEqualTypeOf<SelectionMode>();
    const single: AccordionProps = {
      openItem: 'a',
      onOpenItemChange: (value: string | null) => value,
    };
    const multiple: AccordionProps = { type: 'multiple', openItems: ['a', 'b'] };
    // @ts-expect-error openItem is single-mode only
    const invalid: AccordionProps = { type: 'multiple', openItem: 'a' };
    expect([single, multiple, invalid]).toHaveLength(3);
  });

  it('interfaces extend AccordionSingleProps / AccordionMultipleProps (the union cannot be extended)', () => {
    interface MySingleProps extends AccordionSingleProps {
      note?: string;
    }
    interface MyMultipleProps extends AccordionMultipleProps {
      note?: string;
    }
    expectTypeOf<MySingleProps>().toExtend<AccordionProps>();
    expectTypeOf<MyMultipleProps>().toExtend<AccordionProps>();
    expectTypeOf<MySingleProps['openItem']>().toEqualTypeOf<string | null | undefined>();
  });
});

describe('Accordion - context guards (overlays#34)', () => {
  it('throws when Accordion.Item is used outside an Accordion', () => {
    expectThrows(
      <Accordion.Item value="1">Orphan</Accordion.Item>,
      '[WaveUI] Accordion.Item must be used within <Accordion>',
    );
  });

  it('throws when Accordion.Trigger is used outside an Accordion.Item', () => {
    expectThrows(
      <Accordion>
        <Accordion.Trigger>Orphan</Accordion.Trigger>
      </Accordion>,
      '[WaveUI] Accordion.Trigger must be used within <Accordion.Item>',
    );
  });

  it('a nested Accordion does not hand the outer item to a Trigger outside its own items', () => {
    expectThrows(
      <Accordion defaultOpenItem="outer">
        <Accordion.Item value="outer">
          <Accordion.Trigger>Outer</Accordion.Trigger>
          <Accordion.Panel>
            <Accordion>
              <Accordion.Trigger>Orphan</Accordion.Trigger>
            </Accordion>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
      '[WaveUI] Accordion.Trigger must be used within <Accordion.Item>',
    );
  });

  it('throws when Accordion.Panel is used outside an Accordion.Item', () => {
    expectThrows(
      <Accordion.Panel>Orphan</Accordion.Panel>,
      '[WaveUI] Accordion.Panel must be used within <Accordion.Item>',
    );
  });
});

describe('Accordion - context guards in production (C-CONTEXT)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('logs each missing-context error once and renders inert parts instead of throwing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const orphans = (
      <>
        <Accordion.Item value="1">
          <Accordion.Trigger>Orphan item</Accordion.Trigger>
        </Accordion.Item>
        <Accordion.Item value="2">Second orphan</Accordion.Item>
        <Accordion>
          <Accordion.Panel>Orphan panel</Accordion.Panel>
        </Accordion>
      </>
    );
    const { rerender } = render(orphans);
    rerender(orphans);
    // Inert: the orphan item's trigger toggles nothing.
    const trigger = screen.getByRole('button', { name: 'Orphan item' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Orphan panel')).not.toBeInTheDocument();
    expect(error.mock.calls.map(([message]) => String(message))).toEqual([
      '[WaveUI] Accordion.Item must be used within <Accordion>',
      '[WaveUI] Accordion.Panel must be used within <Accordion.Item>',
    ]);
  });
});

describe('Accordion - duplicate item values (C-DEV)', () => {
  const duplicateMessage = (value: string) =>
    `[WaveUI] Accordion: several items share the value "${value}". Item values must be unique ` +
    'within an Accordion; items with the same value open and close together and share their ' +
    'trigger and panel ids.';

  it('warns once per duplicated value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(
      <Accordion>
        {['a', 'a', 'a', 'b', 'b', 'c'].map((value, i) => (
          <Accordion.Item key={i} value={value}>
            <Accordion.Trigger>{`Trigger ${i}`}</Accordion.Trigger>
          </Accordion.Item>
        ))}
      </Accordion>,
    );
    rerender(
      <Accordion>
        {['a', 'a', 'a', 'b', 'b', 'c'].map((value, i) => (
          <Accordion.Item key={i} value={value}>
            <Accordion.Trigger>{`Trigger ${i}`}</Accordion.Trigger>
          </Accordion.Item>
        ))}
      </Accordion>,
    );
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      duplicateMessage('a'),
      duplicateMessage('b'),
    ]);
  });

  it('warns when an item added later repeats a value (wrapped items included)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function Faq({ value }: { value: string }) {
      return (
        <Accordion.Item value={value}>
          <Accordion.Trigger>{`Question ${value}`}</Accordion.Trigger>
        </Accordion.Item>
      );
    }
    const { rerender } = render(
      <Accordion>
        <Faq value="x" />
      </Accordion>,
    );
    expect(warn).not.toHaveBeenCalled();
    rerender(
      <Accordion>
        <Faq value="x" />
        <Faq value="x" />
      </Accordion>,
    );
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([duplicateMessage('x')]);
  });

  it('does not warn for unique values, in StrictMode, or for the same value in separate or nested accordions', () => {
    const warn = vi.spyOn(console, 'warn');
    const { rerender } = render(
      <React.StrictMode>
        <Accordion aria-label="First">{items}</Accordion>
        <Accordion aria-label="Second" defaultOpenItem="1">
          <Accordion.Item value="1">
            <Accordion.Trigger>Outer</Accordion.Trigger>
            <Accordion.Panel>
              <Accordion>{items}</Accordion>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </React.StrictMode>,
    );
    // An item that is removed frees its value.
    rerender(
      <React.StrictMode>
        <Accordion aria-label="First">
          <Accordion.Item value="1">
            <Accordion.Trigger>Replacement</Accordion.Trigger>
          </Accordion.Item>
        </Accordion>
      </React.StrictMode>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('Accordion - parts written in a Server Component', () => {
  // A client component written in a Server Component reaches the client as a lazy reference.
  const Item = asClientReference(AccordionItem);
  const Trigger = asClientReference(AccordionTrigger);
  const Panel = asClientReference(AccordionPanel);
  const Wrapper = asClientReference(WrapperStandIn);

  const plainFaq = (
    <Accordion defaultOpenItem="q1">
      <AccordionItem value="q1">
        <AccordionTrigger>Question one?</AccordionTrigger>
        <AccordionPanel>Answer one.</AccordionPanel>
      </AccordionItem>
      <AccordionItem value="q2">
        <WrapperStandIn>
          <AccordionTrigger>Question two?</AccordionTrigger>
        </WrapperStandIn>
        <AccordionPanel>Answer two.</AccordionPanel>
        Trailing note.
      </AccordionItem>
    </Accordion>
  );
  const lazyFaq = (
    <Accordion defaultOpenItem="q1">
      <Item value="q1">
        <Trigger>Question one?</Trigger>
        <Panel>Answer one.</Panel>
      </Item>
      <Item value="q2">
        <Wrapper>
          <Trigger>Question two?</Trigger>
        </Wrapper>
        <Panel>Answer two.</Panel>
        Trailing note.
      </Item>
    </Accordion>
  );

  it('server-renders the same HTML as with the plain part types', () => {
    const plain = renderToString(plainFaq);
    expect(plain).toContain('Question one?');
    expect(renderToString(lazyFaq)).toBe(plain);
  });

  it('finds the trigger and panel, and opens and closes like the plain parts', async () => {
    const user = userEvent.setup();
    render(lazyFaq);
    // The real triggers, not a button labelled by the item value.
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Question one?',
      'Question two?',
    ]);
    expect(screen.getByRole('region', { name: 'Question one?' })).toHaveTextContent('Answer one.');
    // The heading goes around the wrapper component that holds only the Trigger.
    const heading = screen.getByRole('heading', { level: 3, name: 'Question two?' });
    expect(heading.closest('span')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Question two?' }));
    expect(screen.queryByRole('region', { name: 'Question one?' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Question two?' })).toHaveTextContent(
      'Answer two.Trailing note.',
    );
    expectUniqueIds();
    await expectNoA11yViolations();
  });
});

// The Item looks for its Trigger and Panel through wrapper elements, `<Suspense>` included. Content
// still loading inside the consumer's own <Suspense> suspends that boundary only, never the
// Accordion (a React.lazy there must not be read as a part while its chunk loads).
describe('Accordion - content still loading inside its own Suspense', () => {
  type AnswerModule = { default: React.ComponentType };

  /** A `React.lazy` answer whose chunk loads only when `load()` is called. */
  function pendingAnswer() {
    let resolveModule: (module: AnswerModule) => void = () => {};
    const loading = new Promise<AnswerModule>((resolve) => {
      resolveModule = resolve;
    });
    const LazyAnswer = React.lazy(() => loading);
    return { LazyAnswer, load: () => resolveModule({ default: () => <p>Answer one.</p> }) };
  }

  const faq = (LazyAnswer: React.ComponentType) => (
    <Accordion defaultOpenItem="q1">
      <Accordion.Item value="q1">
        <Accordion.Trigger>Question one?</Accordion.Trigger>
        <React.Suspense fallback="Loading answer">
          <LazyAnswer />
        </React.Suspense>
      </Accordion.Item>
      <Accordion.Item value="q2">
        <Accordion.Trigger>Question two?</Accordion.Trigger>
        <Accordion.Panel>Answer two.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );

  it('shows the consumer fallback in the panel, not an outer fallback instead of the Accordion', async () => {
    const { LazyAnswer, load } = pendingAnswer();
    render(<React.Suspense fallback="Loading page">{faq(LazyAnswer)}</React.Suspense>);
    expect(screen.queryByText('Loading page')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question one?' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Question one?' })).toHaveTextContent(
      'Loading answer',
    );
    expect(screen.getByRole('button', { name: 'Question two?' })).toBeInTheDocument();

    await act(async () => load());
    expect(screen.getByRole('region', { name: 'Question one?' })).toHaveTextContent('Answer one.');
    expectUniqueIds();
  });

  it('server-renders the Accordion around the consumer fallback', () => {
    const { LazyAnswer } = pendingAnswer();
    const html = renderToString(faq(LazyAnswer));
    expect(html).toContain('Question one?');
    expect(html).toContain('Loading answer');
    expect(html).toContain('Question two?');
  });

  // A wrapper still loading around the Trigger (a code-split Tooltip): the Item asks whether the
  // child only wraps the Trigger, to put the heading around it, which must not suspend it either.
  function pendingWrapper() {
    let resolveModule: (module: { default: typeof WrapperStandIn }) => void = () => {};
    const loading = new Promise<{ default: typeof WrapperStandIn }>((resolve) => {
      resolveModule = resolve;
    });
    const LazyWrapper = React.lazy(() => loading);
    return { LazyWrapper, load: () => resolveModule({ default: WrapperStandIn }) };
  }

  const wrappedTrigger = (LazyWrapper: React.ComponentType<{ children: React.ReactNode }>) => (
    <Accordion defaultOpenItem="q1">
      <Accordion.Item value="q1">
        <React.Suspense fallback="Loading question">
          <LazyWrapper>
            <Accordion.Trigger>Question one?</Accordion.Trigger>
          </LazyWrapper>
        </React.Suspense>
        <Accordion.Panel>Answer one.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="q2">
        <Accordion.Trigger>Question two?</Accordion.Trigger>
        <Accordion.Panel>Answer two.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );

  it('keeps the Accordion for a wrapper around the Trigger still loading, not an outer fallback', async () => {
    const { LazyWrapper, load } = pendingWrapper();
    render(<React.Suspense fallback="Loading page">{wrappedTrigger(LazyWrapper)}</React.Suspense>);
    expect(screen.queryByText('Loading page')).not.toBeInTheDocument();
    expect(screen.getByText('Loading question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question two?' })).toBeInTheDocument();

    await act(async () => load());
    const trigger = screen.getByRole('button', { name: 'Question one?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Question one?' })).toHaveTextContent('Answer one.');
    expectUniqueIds();
  });

  it('server-renders the Accordion for a wrapper around the Trigger still loading', () => {
    const { LazyWrapper } = pendingWrapper();
    const html = renderToString(wrappedTrigger(LazyWrapper));
    expect(html).toContain('Loading question');
    expect(html).toContain('Question two?');
  });
});
