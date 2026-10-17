/**
 * Stable class names of the layout folder (spec P3-00, Appendix A "layout"): every root and part
 * carries its registered class on the element the registry names, in every layout where it
 * renders, on the server too. The values are read from the registry, never written as literals.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  accordionClassNames,
  accordionItemClassNames,
  accordionPanelClassNames,
  accordionTriggerClassNames,
  cardBodyClassNames,
  cardClassNames,
  cardFooterClassNames,
  cardHeaderClassNames,
  carouselClassNames,
  carouselItemClassNames,
  flexClassNames,
  gridClassNames,
  overflowClassNames,
  overflowItemClassNames,
  stackClassNames,
  tabListClassNames,
  tabListPanelClassNames,
  tabListPanelsClassNames,
  tabListTabClassNames,
  treeClassNames,
  treeItemClassNames,
} from '../../../lib/classNames';
import { Accordion } from '../Accordion';
import { Card } from '../Card';
import { Carousel } from '../Carousel';
import { Flex } from '../Flex';
import { Grid } from '../Grid';
import { Overflow } from '../Overflow';
import { Stack } from '../Stack';
import { TabList } from '../TabList';
import { Tree } from '../Tree';

/** Server HTML in a detached element (never appended: src/test-setup.ts checks document.body). */
function parse(html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/** A wrapper component around a Trigger: the Item renders the heading around it. */
function Wrap({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * jsdom has no layout: the Overflow row and its items get widths by `data-testid` (the wrapper of
 * the overflow button by the key `button`), as in Overflow.test.tsx. Returns the restore function.
 */
function stubOverflowWidths(widths: Record<string, number>): () => void {
  const targets: Array<[object, string]> = [
    [HTMLElement.prototype, 'offsetWidth'],
    [Element.prototype, 'clientWidth'],
    [Element.prototype, 'scrollWidth'],
  ];
  const saved = targets.map(([proto, name]) => Object.getOwnPropertyDescriptor(proto, name));
  const width = (el: Element): number => {
    if (el.hasAttribute('data-overflow-hidden')) return 0;
    const key = el.hasAttribute('data-overflow-button') ? 'button' : el.getAttribute('data-testid');
    return key !== null && key in widths ? widths[key] : 0;
  };
  for (const [proto, name] of targets) {
    Object.defineProperty(proto, name, {
      configurable: true,
      get(this: Element) {
        return width(this);
      },
    });
  }
  return () => {
    targets.forEach(([proto, name], i) => {
      const descriptor = saved[i];
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else Reflect.deleteProperty(proto, name);
    });
  };
}

describe('stable class names: layout folder', () => {
  it('Card: root, built-in checkbox, header with title and subtitle, body and footer', () => {
    render(
      <Card onSelect={() => {}} selected selectionControl="checkbox">
        <Card.Header title="Report" subtitle="Weekly" />
        <Card.Body>Body text</Card.Body>
        <Card.Footer>Footer text</Card.Footer>
      </Card>,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Report' });
    expect(checkbox).toHaveClass(cardClassNames.checkbox);
    expect(checkbox.parentElement).toHaveClass(cardClassNames.root);
    const title = screen.getByText('Report');
    expect(title).toHaveClass(cardHeaderClassNames.title);
    expect(title.parentElement).toHaveClass(cardHeaderClassNames.root);
    expect(screen.getByText('Weekly')).toHaveClass(cardHeaderClassNames.subtitle);
    expect(screen.getByText('Body text')).toHaveClass(cardBodyClassNames.root);
    expect(screen.getByText('Footer text')).toHaveClass(cardFooterClassNames.root);
  });

  it('Card: the check glyph of a selected card', () => {
    render(
      <Card data-testid="plan" onSelect={() => {}} selected>
        Plan
      </Card>,
    );
    const card = screen.getByTestId('plan');
    expect(card).toHaveClass(cardClassNames.root);
    expect(card.querySelector('svg')).toHaveClass(cardClassNames.checkmark);
  });

  it('Accordion: root, item, trigger with its heading and chevron, panel', () => {
    render(
      <Accordion defaultOpenItem="shipping">
        <Accordion.Item value="shipping">
          <Accordion.Trigger>Shipping</Accordion.Trigger>
          <Accordion.Panel>Ships in two days</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const trigger = screen.getByRole('button', { name: 'Shipping' });
    expect(trigger).toHaveClass(accordionTriggerClassNames.root);
    expect(trigger.querySelector('svg')).toHaveClass(accordionTriggerClassNames.expandIcon);
    // The heading sits outside the trigger's className target and keeps its part class.
    const heading = screen.getByRole('heading', { name: 'Shipping' });
    expect(heading).toHaveClass(accordionTriggerClassNames.heading);
    const item = heading.parentElement as HTMLElement;
    expect(item).toHaveClass(accordionItemClassNames.root);
    expect(item.parentElement).toHaveClass(accordionClassNames.root);
    expect(screen.getByRole('region', { name: 'Shipping' })).toHaveClass(
      accordionPanelClassNames.root,
    );
  });

  it('Accordion: the heading the item renders around a wrapped trigger is the heading part', () => {
    render(
      <Accordion>
        <Accordion.Item value="returns">
          <Wrap>
            <Accordion.Trigger>Returns</Accordion.Trigger>
          </Wrap>
          <Accordion.Panel>Within 30 days</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getByRole('heading', { name: 'Returns' })).toHaveClass(
      accordionTriggerClassNames.heading,
    );
  });

  it('TabList: the tablist element (not its wrapper), tabs, panels and the panels container', () => {
    render(
      <TabList aria-label="Sections" defaultValue="overview">
        <TabList.Tab value="overview">Overview</TabList.Tab>
        <TabList.Panels>
          <TabList.Panel value="overview">Overview panel</TabList.Panel>
        </TabList.Panels>
      </TabList>,
    );
    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    expect(tablist).toHaveClass(tabListClassNames.root);
    expect(tablist.parentElement).not.toHaveClass(tabListClassNames.root);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveClass(tabListTabClassNames.root);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveClass(tabListPanelClassNames.root);
    expect(panel.parentElement).toHaveClass(tabListPanelsClassNames.root);
  });

  it('Tree: root, item, row, chevron, icon, label and group', () => {
    render(
      <Tree aria-label="Files" defaultExpandedItems={['docs']}>
        <Tree.Item value="docs" icon={<svg data-testid="folder-icon" />}>
          Documents
          <Tree.Item value="cv">CV.pdf</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('tree', { name: 'Files' })).toHaveClass(treeClassNames.root);
    const docs = screen.getByRole('treeitem', { name: 'Documents' });
    expect(docs).toHaveClass(treeItemClassNames.root);
    const row = docs.firstElementChild as HTMLElement;
    expect(row).toHaveClass(treeItemClassNames.row);
    expect(row.firstElementChild).toHaveClass(treeItemClassNames.expandIcon);
    expect(screen.getByTestId('folder-icon').parentElement).toHaveClass(treeItemClassNames.icon);
    expect(screen.getByText('Documents')).toHaveClass(treeItemClassNames.label);
    expect(screen.getByRole('group')).toHaveClass(treeItemClassNames.group);
  });

  it('Carousel: root, rotation button, track, slides, arrows, picker with buttons and dots; items', () => {
    render(
      <Carousel autoPlay>
        <Carousel.Item>Slide one</Carousel.Item>
        <Carousel.Item>Slide two</Carousel.Item>
      </Carousel>,
    );
    expect(screen.getByRole('region', { name: 'Carousel' })).toHaveClass(carouselClassNames.root);
    expect(screen.getByRole('button', { name: /slide rotation/ })).toHaveClass(
      carouselClassNames.autoPlayButton,
    );
    const slide = screen.getByRole('group', { name: 'Slide 1 of 2' });
    expect(slide).toHaveClass(carouselClassNames.slide);
    expect(slide.parentElement).toHaveClass(carouselClassNames.track);
    expect(screen.getByText('Slide one')).toHaveClass(carouselItemClassNames.root);
    expect(screen.getByRole('button', { name: 'Previous slide' })).toHaveClass(
      carouselClassNames.previousButton,
    );
    expect(screen.getByRole('button', { name: 'Next slide' })).toHaveClass(
      carouselClassNames.nextButton,
    );
    const picker = screen.getByRole('group', { name: 'Choose slide' });
    expect(picker).toHaveClass(carouselClassNames.picker);
    const [pickerButton] = within(picker).getAllByRole('button');
    expect(pickerButton).toHaveClass(carouselClassNames.pickerButton);
    expect(pickerButton.firstElementChild).toHaveClass(carouselClassNames.pickerIndicator);
  });

  it('Carousel: the root without slides', () => {
    render(<Carousel data-testid="empty" />);
    expect(screen.getByTestId('empty')).toHaveClass(carouselClassNames.root);
  });

  it('Overflow: root, items and the wrapper of the overflow button', () => {
    const restore = stubOverflowWidths({ overflow: 60, 'item-a': 40, 'item-b': 40, button: 20 });
    try {
      render(
        <Overflow
          data-testid="overflow"
          overflowButton={(count) => <button type="button">+{count}</button>}
        >
          <Overflow.Item itemId="a" data-testid="item-a">
            A
          </Overflow.Item>
          <Overflow.Item itemId="b" data-testid="item-b">
            B
          </Overflow.Item>
        </Overflow>,
      );
      expect(screen.getByTestId('overflow')).toHaveClass(overflowClassNames.root);
      expect(screen.getByTestId('item-a')).toHaveClass(overflowItemClassNames.root);
      expect(screen.getByTestId('item-b')).toHaveClass(overflowItemClassNames.root);
      expect(screen.getByRole('button', { name: '+1' }).parentElement).toHaveClass(
        overflowClassNames.overflowButton,
      );
    } finally {
      restore();
    }
  });

  it('Stack, Flex and Grid: the rendered element is the root', () => {
    render(
      <>
        <Stack data-testid="stack" />
        <Flex data-testid="flex" />
        <Grid data-testid="grid" />
      </>,
    );
    expect(screen.getByTestId('stack')).toHaveClass(stackClassNames.root);
    expect(screen.getByTestId('flex')).toHaveClass(flexClassNames.root);
    expect(screen.getByTestId('grid')).toHaveClass(gridClassNames.root);
  });

  it('renders the classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <>
          <Card>
            <Card.Header title="Report" />
          </Card>
          <Tree aria-label="Files" defaultExpandedItems={['docs']}>
            <Tree.Item value="docs">
              Documents
              <Tree.Item value="cv">CV.pdf</Tree.Item>
            </Tree.Item>
          </Tree>
        </>,
      ),
    );
    const card = host.firstElementChild as HTMLElement;
    expect(card).toHaveClass(cardClassNames.root);
    expect(card.firstElementChild).toHaveClass(cardHeaderClassNames.root);
    expect(host.querySelector('[role="tree"]')).toHaveClass(treeClassNames.root);
    expect(host.querySelector('[role="treeitem"]')).toHaveClass(treeItemClassNames.root);
    expect(host.querySelector('[data-tree-row]')).toHaveClass(treeItemClassNames.row);
    expect(host.querySelector('[role="group"]')).toHaveClass(treeItemClassNames.group);
  });
});
