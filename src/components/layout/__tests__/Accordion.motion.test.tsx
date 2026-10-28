import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion, type AccordionPanelProps } from '../Accordion';
import { accordionItemClassNames, accordionPanelClassNames } from '../../../lib/classNames';
import { collapseMotion, collapseStructure } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-ACC (spec §5.1, §2.5, D7, D9, D12): an Accordion.Panel's region sits in a collapse wrapper,
 * the presence element, whose default motion opens and closes its rows track with a fade. The
 * region keeps every 0.14 prop and attribute, reads `data-state="closed"` while it exits, and
 * focus inside it at close moves to the item's trigger. A misplaced panel (inside another panel)
 * renders as in 0.14. jsdom loads no CSS, so the phases wait only where `mockAnimations` gives the
 * wrapper a running animation.
 */

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

const button = (name: string) => screen.getByRole('button', { name });
/** The region of an item, exiting ones included (role queries ignore `inert` in jsdom). */
const region = (name: string) => screen.queryByRole('region', { name });
/** The collapse wrapper around the region named `name`. */
const wrapperOf = (name: string) => region(name)?.parentElement ?? null;
/** The presence element of every Accordion panel: its collapse wrapper. */
const isCollapse = (el: Element) => el.classList.contains(accordionPanelClassNames.collapse);

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** The warning of a Panel rendered inside another Panel (asserted where a test renders one). */
const MISPLACED_PANEL =
  '[WaveUI] Accordion.Panel was rendered inside the panel of an Accordion.Item, so it is not ' +
  "the item's panel. Place Accordion.Trigger and Accordion.Panel directly in Accordion.Item, in " +
  'a Fragment, or in an element that wraps them as `children` (such as a Tooltip). The Item ' +
  'cannot see inside a component that renders them itself and treats that component as panel ' +
  'content.';

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

interface FaqProps {
  motion?: MotionSlot | null;
  defaultOpenItem?: string | null;
  panelProps?: Partial<AccordionPanelProps> & { 'data-testid'?: string };
}

/** Two items, `a` and `b`; panel `a` holds an uncontrolled input. */
function Faq({ motion, defaultOpenItem = 'a', panelProps }: FaqProps) {
  return (
    <Accordion defaultOpenItem={defaultOpenItem}>
      <Accordion.Item value="a">
        <Accordion.Trigger>Shipping</Accordion.Trigger>
        <Accordion.Panel motion={motion} {...panelProps}>
          Ships in two days.
          <input aria-label="Notes" />
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Trigger>Returns</Accordion.Trigger>
        <Accordion.Panel motion={motion}>Within 30 days.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

describe('the collapse wrapper (§5.1 markup)', () => {
  it('wraps an open region: structure, default motion, entered, the region its only child', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Faq
        panelProps={{
          id: 'shipping-panel',
          className: 'my-panel',
          'data-testid': 'panel',
          ref,
        }}
      />,
    );
    const el = region('Shipping')!;
    const wrapper = el.parentElement!;
    expect(wrapper).toHaveClass(
      accordionPanelClassNames.collapse,
      ...motionClasses(collapseStructure),
      ...motionClasses(collapseMotion),
    );
    expect(wrapper.classList[0]).toBe(accordionPanelClassNames.collapse);
    expect(wrapper).toHaveAttribute('data-presence', 'entered');
    expect(wrapper).not.toHaveAttribute('inert');
    expect(Array.from(wrapper.children)).toEqual([el]);
    expect(wrapper.parentElement).toHaveClass(accordionItemClassNames.root);

    // The region keeps every 0.14 prop and attribute.
    const trigger = button('Shipping');
    expect(ref.current).toBe(el);
    expect(el).toHaveClass(accordionPanelClassNames.root, 'px-4', 'pb-3', 'my-panel');
    expect(el.classList[0]).toBe(accordionPanelClassNames.root);
    expect(el.getAttributeNames().sort()).toEqual(
      ['aria-labelledby', 'class', 'data-state', 'data-testid', 'id', 'role'].sort(),
    );
    expect(el).toHaveAttribute('role', 'region');
    expect(el).toHaveAttribute('id', 'shipping-panel');
    expect(el).toHaveAttribute('aria-labelledby', trigger.id);
    expect(el).toHaveAttribute('data-state', 'open');
    expect(el).toHaveAttribute('data-testid', 'panel');
    expect(trigger).toHaveAttribute('aria-controls', 'shipping-panel');
    // The wrapper takes none of the consumer's props.
    expect(wrapper.getAttributeNames().sort()).toEqual(['class', 'data-presence']);
  });

  it('wraps the panel an Item renders for its plain content', () => {
    render(
      <Accordion defaultOpenItem="Shipping">
        <Accordion.Item value="Shipping">Ships within two days.</Accordion.Item>
      </Accordion>,
    );
    expect(wrapperOf('Shipping')).toHaveClass(accordionPanelClassNames.collapse);
    expect(wrapperOf('Shipping')).toHaveAttribute('data-presence', 'entered');
  });

  it('a closed item renders neither the wrapper nor the region', () => {
    render(<Faq defaultOpenItem={null} />);
    expect(document.querySelector('.' + accordionPanelClassNames.collapse)).toBeNull();
    expect(region('Shipping')).toBeNull();
  });

  it('a misplaced panel renders as in 0.14: no wrapper, no motion', () => {
    warn.mockImplementation(() => {});
    render(
      <Accordion defaultOpenItem="a">
        <Accordion.Item value="a">
          <Accordion.Trigger>Shipping</Accordion.Trigger>
          <Accordion.Panel>
            Outer content.
            <Accordion.Panel data-testid="misplaced" motion="my-motion">
              Misplaced content.
            </Accordion.Panel>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const misplaced = screen.getByTestId('misplaced');
    expect(misplaced.parentElement).toBe(region('Shipping'));
    expect(misplaced).toHaveClass(accordionPanelClassNames.root);
    expect(misplaced).not.toHaveAttribute('motion');
    expect(misplaced).not.toHaveAttribute('data-presence');
    expect(misplaced).not.toHaveClass('my-motion');
    expect(misplaced.querySelector('.' + accordionPanelClassNames.collapse)).toBeNull();
    expect(document.querySelectorAll('.' + accordionPanelClassNames.collapse)).toHaveLength(1);
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([MISPLACED_PANEL]);
    warn.mockClear();
  });

  it('a misplaced panel keeps its content in the enclosing region while that region exits', async () => {
    warn.mockImplementation(() => {});
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(
      <Accordion defaultOpenItem="a">
        <Accordion.Item value="a">
          <Accordion.Trigger>Shipping</Accordion.Trigger>
          <Accordion.Panel>
            <Accordion.Panel data-testid="misplaced">Misplaced content.</Accordion.Panel>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    await user.click(button('Shipping'));
    expect(wrapperOf('Shipping')).toHaveAttribute('data-presence', 'exiting');
    expect(screen.getByTestId('misplaced')).toHaveTextContent('Misplaced content.');
    await finish(motion);
    expect(screen.queryByTestId('misplaced')).toBeNull();
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([MISPLACED_PANEL]);
    warn.mockClear();
  });
});

describe('presence (D7, the presence pair on the wrapper)', () => {
  it('a close keeps the region, inert and closed, its trigger collapsed, until the exit ends', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Faq />);
    const el = region('Shipping')!;
    const wrapper = el.parentElement!;

    await user.click(button('Shipping'));
    expect(region('Shipping')).toBe(el);
    expect(wrapper).toHaveAttribute('data-presence', 'exiting');
    expect(el.closest('[inert]')).toBe(wrapper);
    expect(el).toHaveAttribute('data-state', 'closed');
    expect(button('Shipping')).toHaveAttribute('aria-expanded', 'false');
    expect(button('Shipping')).toHaveAttribute('data-state', 'closed');
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(region('Shipping')).toBeNull();
    expect(wrapper).not.toBeInTheDocument();
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('an opening enters from the wrapper’s motion (never on mount, D9)', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Faq />);
    expect(wrapperOf('Shipping')).toHaveAttribute('data-presence', 'entered');
    expect(motion.started).toBe(0);

    await user.click(button('Returns'));
    expect(wrapperOf('Returns')).toHaveAttribute('data-presence', 'entering');
    expect(region('Returns')).toHaveAttribute('data-state', 'open');
    await finish(motion);
    expect(wrapperOf('Returns')).toHaveAttribute('data-presence', 'entered');
  });

  it('single mode: opening B while A exits (A exiting, B entering)', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Faq />);
    await user.click(button('Returns'));
    expect(wrapperOf('Shipping')).toHaveAttribute('data-presence', 'exiting');
    expect(region('Shipping')).toHaveAttribute('data-state', 'closed');
    expect(wrapperOf('Returns')).toHaveAttribute('data-presence', 'entering');
    expect(region('Returns')).toHaveAttribute('data-state', 'open');
    expect(button('Shipping')).toHaveAttribute('aria-expanded', 'false');
    expect(button('Returns')).toHaveAttribute('aria-expanded', 'true');
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(region('Shipping')).toBeNull();
    expect(wrapperOf('Returns')).toHaveAttribute('data-presence', 'entered');
  });

  it('closed and reopened before the exit ends: the same region and its state, entering, not inert, open (Review Focus 3)', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Faq />);
    const el = region('Shipping')!;
    await user.type(within(el).getByRole('textbox', { name: 'Notes' }), 'Leave at the door');

    await user.click(button('Shipping'));
    expect(el.parentElement).toHaveAttribute('data-presence', 'exiting');
    await user.click(button('Shipping'));

    expect(region('Shipping')).toBe(el);
    expect(within(el).getByRole('textbox', { name: 'Notes' })).toHaveValue('Leave at the door');
    expect(el.parentElement).toHaveAttribute('data-presence', 'entering');
    expect(el.closest('[inert]')).toBeNull();
    expect(el).toHaveAttribute('data-state', 'open');
    expect(button('Shipping')).toHaveAttribute('aria-expanded', 'true');

    await finish(motion);
    expect(region('Shipping')).toBe(el);
    expect(el.parentElement).toHaveAttribute('data-presence', 'entered');
  });

  it('under reduced motion a close removes the region within the same act', async () => {
    mockAnimations({ animated: isCollapse });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<Faq />);
    await user.click(button('Shipping'));
    expect(region('Shipping')).toBeNull();
    expect(document.querySelector('.' + accordionPanelClassNames.collapse)).toBeNull();
  });

  it('without reduced motion the same close waits for the wrapper’s motion', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const user = userEvent.setup();
    render(<Faq />);
    await user.click(button('Shipping'));
    expect(wrapperOf('Shipping')).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(region('Shipping')).toBeNull();
  });
});

describe('focus inside a closing region (§2.5)', () => {
  /** Panel `a` holds a Done button that closes it (a controlled Accordion). */
  function ControlledFaq() {
    const [openItem, setOpenItem] = React.useState<string | null>('a');
    return (
      <Accordion openItem={openItem} onOpenItemChange={setOpenItem}>
        <Accordion.Item value="a">
          <Accordion.Trigger>Shipping</Accordion.Trigger>
          <Accordion.Panel>
            <button type="button" onClick={() => setOpenItem(null)}>
              Done
            </button>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Trigger>Returns</Accordion.Trigger>
          <Accordion.Panel>Within 30 days.</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );
  }

  it('lands on the item’s trigger in the closing act, while the region exits', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    const user = userEvent.setup();
    render(<ControlledFaq />);
    const done = button('Done');

    await user.click(done);
    expect(wrapperOf('Shipping')).toHaveAttribute('data-presence', 'exiting');
    expect(done.closest('[inert]')).toBe(wrapperOf('Shipping'));
    expect(button('Shipping')).toHaveFocus();
    await finish(motion);
    expect(region('Shipping')).toBeNull();
    expect(button('Shipping')).toHaveFocus();
  });

  it('lands on a consumer-id trigger, and with no motion before the region unmounts', async () => {
    honourInert();
    const user = userEvent.setup();
    function Notes() {
      const [openItem, setOpenItem] = React.useState<string | null>('a');
      return (
        <Accordion openItem={openItem} onOpenItemChange={setOpenItem}>
          <Accordion.Item value="a">
            <Accordion.Trigger id="shipping-trigger">Shipping</Accordion.Trigger>
            <Accordion.Panel motion={null}>
              <button type="button" onClick={() => setOpenItem(null)}>
                Done
              </button>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      );
    }
    render(<Notes />);
    await user.click(button('Done'));
    expect(region('Shipping')).toBeNull();
    expect(button('Shipping')).toHaveFocus();
    expect(button('Shipping')).toHaveAttribute('id', 'shipping-trigger');
  });

  it('a panel removed while open with focus inside moves focus to the trigger after the commit', async () => {
    honourInert();
    function RemovablePanel({ withPanel }: { withPanel: boolean }) {
      return (
        <Accordion defaultOpenItem="a">
          <Accordion.Item value="a">
            <Accordion.Trigger>Shipping</Accordion.Trigger>
            {withPanel ? (
              <Accordion.Panel>
                <button type="button">Track parcel</button>
              </Accordion.Panel>
            ) : null}
          </Accordion.Item>
        </Accordion>
      );
    }
    const { rerender } = render(<RemovablePanel withPanel />);
    act(() => button('Track parcel').focus());
    rerender(<RemovablePanel withPanel={false} />);
    await act(async () => {});
    expect(region('Shipping')).toBeNull();
    expect(button('Shipping')).toHaveFocus();
  });

  it('focus outside the region (another item’s trigger) stays where it is', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    const user = userEvent.setup();
    render(<Faq />);
    await user.click(button('Returns'));
    expect(wrapperOf('Shipping')).toHaveAttribute('data-presence', 'exiting');
    expect(button('Returns')).toHaveFocus();
    await finish(motion);
    expect(button('Returns')).toHaveFocus();
  });
});

describe('motion slot (D5, the slot table on the wrapper)', () => {
  it('undefined: the default motion', () => {
    render(<Faq />);
    expect(wrapperOf('Shipping')).toHaveClass(...motionClasses(collapseMotion));
  });

  it('null: no motion; the structure and data-presence stay', () => {
    render(<Faq motion={null} />);
    const wrapper = wrapperOf('Shipping');
    expectNoWordOf(wrapper, collapseMotion);
    expect(wrapper).toHaveClass(...motionClasses(collapseStructure));
    expect(wrapper).toHaveAttribute('data-presence', 'entered');
  });

  it.each<[string, MotionSlot]>([
    ['a string', 'my-motion'],
    ['{ className }', { className: 'my-motion' }],
  ])('%s replaces the default motion', (_, slot) => {
    render(<Faq motion={slot} />);
    const wrapper = wrapperOf('Shipping');
    expect(wrapper).toHaveClass('my-motion', ...motionClasses(collapseStructure));
    expectNoWordOf(wrapper, collapseMotion);
    expect(region('Shipping')).not.toHaveAttribute('motion');
    expect(region('Shipping')).not.toHaveClass('my-motion');
  });

  it('the provider’s none drops the default motion; a panel’s own motion still applies', () => {
    renderWithProviders(
      <Accordion type="multiple" defaultOpenItems={['a', 'b']}>
        <Accordion.Item value="a">
          <Accordion.Trigger>Shipping</Accordion.Trigger>
          <Accordion.Panel>Ships in two days.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Trigger>Returns</Accordion.Trigger>
          <Accordion.Panel motion="my-motion">Within 30 days.</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
      { motion: 'none' },
    );
    expectNoWordOf(wrapperOf('Shipping'), collapseMotion);
    expect(wrapperOf('Shipping')).toHaveClass(...motionClasses(collapseStructure));
    expect(wrapperOf('Returns')).toHaveClass('my-motion');
  });
});

describe('server rendering (D9)', () => {
  const page = (
    <Accordion defaultOpenItem="a">
      <Accordion.Item value="a">
        <Accordion.Trigger>Shipping</Accordion.Trigger>
        <Accordion.Panel>Ships in two days.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Trigger>Returns</Accordion.Trigger>
        <Accordion.Panel>Within 30 days.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );

  it('an open item’s wrapper is entered in the server HTML, and hydration logs nothing', async () => {
    const html = renderToString(page);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      const wrapper = container.querySelector('.' + accordionPanelClassNames.collapse);
      expect(wrapper).toHaveAttribute('data-presence', 'entered');
      expect(wrapper).toHaveClass(...motionClasses(collapseStructure));
      expect(wrapper?.firstElementChild).toHaveAttribute('role', 'region');
      expect(container.querySelectorAll('.' + accordionPanelClassNames.collapse)).toHaveLength(1);

      await act(async () => {
        root = hydrateRoot(container, page, { onRecoverableError });
      });
      expect(container.querySelector('.' + accordionPanelClassNames.collapse)).toBe(wrapper);
      expect(wrapper).toHaveAttribute('data-presence', 'entered');
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});
