import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, TreeItemPersonaLayout, type TreeItemPersonaLayoutProps } from '../Tree';
import { Avatar } from '../../data-display/Avatar';
import { treeItemPersonaLayoutClassNames } from '../../../lib/classNames';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  expectThrows,
  openingTags,
  testSystemProps,
  type TestWrapper,
} from '../../../test-utils';

const item = (name: string) => screen.getByRole('treeitem', { name });

const InItem: TestWrapper = ({ children }) => (
  <Tree aria-label="People">
    <Tree.Item value="kat">{children}</Tree.Item>
  </Tree>
);

const person = (name: string, description?: string) => (
  <Tree.ItemPersonaLayout
    media={<Avatar decorative name={name} size="small" />}
    description={description}
  >
    {name}
  </Tree.ItemPersonaLayout>
);

describe('Tree.ItemPersonaLayout', () => {
  testSystemProps(Tree.ItemPersonaLayout, {
    expectedTag: 'span',
    displayName: 'TreeItemPersonaLayout',
    defaultProps: { children: 'Kat Sharp', description: 'Designer' },
    wrapper: InItem,
  });

  it('is exported under its flat name (C-COMPOUND)', () => {
    expect(TreeItemPersonaLayout).toBe(Tree.ItemPersonaLayout);
  });

  it('names the item by the name only and describes it by the description; each part carries its class', () => {
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
      </Tree>,
    );
    const kat = item('Kat Sharp');
    expect(kat).toHaveAccessibleDescription('Designer');
    const root = kat.querySelector(`.${treeItemPersonaLayoutClassNames.root}`)!;
    expect(root.querySelector(`.${treeItemPersonaLayoutClassNames.media}`)).not.toBeNull();
    expect(screen.getByText('Kat Sharp')).toHaveClass(treeItemPersonaLayoutClassNames.main);
    expect(screen.getByText('Designer')).toHaveClass(treeItemPersonaLayoutClassNames.description);
  });

  it('without a description, adds no description; without media, renders no media element', () => {
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat">
          <Tree.ItemPersonaLayout>Kat Sharp</Tree.ItemPersonaLayout>
        </Tree.Item>
      </Tree>,
    );
    expect(item('Kat Sharp')).not.toHaveAttribute('aria-describedby');
    expect(document.querySelector(`.${treeItemPersonaLayoutClassNames.description}`)).toBeNull();
    expect(document.querySelector(`.${treeItemPersonaLayoutClassNames.media}`)).toBeNull();
  });

  it("a consumer aria-label on the item still names it, and the item's aside joins the description", () => {
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat" aria-label="Kat Sharp (away)" aside="Away">
          {person('Kat Sharp', 'Designer')}
        </Tree.Item>
      </Tree>,
    );
    expect(item('Kat Sharp (away)')).toHaveAccessibleDescription('Away Designer');
  });

  it('typeahead matches the name, not the avatar initials in front of it', async () => {
    const user = userEvent.setup();
    render(
      <Tree aria-label="People">
        <Tree.Item value="mia">{person('Mia Lopez')}</Tree.Item>
        <Tree.Item value="luca">{person('Luca Mora')}</Tree.Item>
      </Tree>,
    );
    act(() => item('Mia Lopez').focus());
    await user.keyboard('lu');
    expect(item('Luca Mora')).toHaveFocus();
  });

  it('in a checkbox tree with actions, the checkbox and the toolbar are named by the name', () => {
    render(
      <Tree aria-label="People" selectionMode="multiple">
        <Tree.Item value="kat" actions={<button type="button">Message Kat</button>}>
          {person('Kat Sharp', 'Designer')}
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('checkbox', { name: 'Kat Sharp' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Kat Sharp' })).toBeInTheDocument();
  });

  it('throws outside a Tree.Item (C-CONTEXT)', () => {
    expectThrows(
      <Tree.ItemPersonaLayout>Kat Sharp</Tree.ItemPersonaLayout>,
      '[WaveUI] Tree.ItemPersonaLayout must be used within <Tree.Item>',
    );
  });

  it('written in a Server Component (a lazy type): the same server HTML, and it names the item the same', () => {
    const LazyLayout = asClientReference(Tree.ItemPersonaLayout);
    const people = (Layout: typeof Tree.ItemPersonaLayout) => (
      <Tree aria-label="People">
        <Tree.Item value="kat">
          <Layout description="Designer">Kat Sharp</Layout>
        </Tree.Item>
      </Tree>
    );
    expect(renderToString(people(LazyLayout))).toBe(renderToString(people(Tree.ItemPersonaLayout)));
    render(people(LazyLayout));
    expect(item('Kat Sharp')).toHaveAccessibleDescription('Designer');
  });

  it('StrictMode: the registration survives the double effects', () => {
    render(
      <React.StrictMode>
        <Tree aria-label="People">
          <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
        </Tree>
      </React.StrictMode>,
    );
    expect(item('Kat Sharp')).toHaveAccessibleDescription('Designer');
  });

  it('removing the layout gives the item its label name back', () => {
    const { rerender } = render(
      <Tree aria-label="People">
        <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
      </Tree>,
    );
    rerender(
      <Tree aria-label="People">
        <Tree.Item value="kat">Kat Sharp, designer</Tree.Item>
      </Tree>,
    );
    expect(item('Kat Sharp, designer')).not.toHaveAttribute('aria-describedby');
  });

  it('has no accessibility violations with persona rows', async () => {
    render(
      <Tree aria-label="People" defaultExpandedItems={['team']}>
        <Tree.Item value="team">
          Design team
          <Tree.Item value="kat">{person('Kat Sharp', 'Designer')}</Tree.Item>
          <Tree.Item value="luca">{person('Luca Mora', 'Researcher')}</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    await expectNoA11yViolations();
  });

  it('types (C-REF)', () => {
    expectTypeOf<TreeItemPersonaLayoutProps['media']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps['description']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
  });
});

describe('Tree.ItemPersonaLayout — slotProps', () => {
  type LayoutSlotProps = NonNullable<TreeItemPersonaLayoutProps['slotProps']>;
  const EVERY_PART: LayoutSlotProps = { media: {}, main: {}, description: {} };
  const NAMES = ['media', 'main', 'description'] as const;
  const partsOf = (root: ParentNode) =>
    NAMES.map(
      (name) => root.querySelector(`.${treeItemPersonaLayoutClassNames[name]}`) as HTMLElement,
    );

  // Captured from ce1620c's dist (client and server agree).
  const BASE_PINS = [
    '<span class="wave-tree-item-persona-layout__media inline-flex shrink-0">',
    '<span class="wave-tree-item-persona-layout__main truncate" data-tree-persona-name="" id="tree-persona-name-_id0_">',
    '<span class="wave-tree-item-persona-layout__description truncate text-caption-1 text-muted-foreground" id="tree-persona-description-_id1_">',
  ].join('\n');

  function People({ slotProps, onClick }: { slotProps?: LayoutSlotProps; onClick?: () => void }) {
    return (
      <Tree aria-label="People">
        <Tree.Item value="kat" onClick={onClick}>
          <Tree.ItemPersonaLayout
            media={<Avatar decorative name="Kat Sharp" size="small" />}
            description="Designer"
            slotProps={slotProps}
          >
            Kat Sharp
          </Tree.ItemPersonaLayout>
        </Tree.Item>
      </Tree>
    );
  }

  it('renders the parts of ce1620c (attributes sorted), on the client and the server', () => {
    render(<People />);
    expect(openingTags(...partsOf(document.body))).toBe(BASE_PINS);
    const template = document.createElement('template');
    template.innerHTML = renderToString(<People slotProps={EVERY_PART} />);
    expect(openingTags(...partsOf(template.content))).toBe(BASE_PINS);
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    expectInertSlotProps((slotProps) => <People slotProps={slotProps} />, EVERY_PART);
    expectInertSlotProps(
      (slotProps) => (
        <Tree aria-label="People">
          <Tree.Item value="kat">
            <Tree.ItemPersonaLayout slotProps={slotProps}>Kat Sharp</Tree.ItemPersonaLayout>
          </Tree.Item>
        </Tree>
      ),
      EVERY_PART,
    );
  });

  it('puts your className, style, data-* and ref on each part, after its own classes', () => {
    const refs = NAMES.map(() => React.createRef<HTMLSpanElement>());
    const slotProps = Object.fromEntries(
      NAMES.map((name, i) => [
        name,
        { className: `my-${name}`, style: { opacity: 0.5 }, 'data-part': name, ref: refs[i] },
      ]),
    ) as LayoutSlotProps;
    render(<People slotProps={slotProps} />);
    partsOf(document.body).forEach((element, i) => {
      expect(element.classList[0]).toBe(treeItemPersonaLayoutClassNames[NAMES[i]]);
      expect(element.classList[element.classList.length - 1]).toBe(`my-${NAMES[i]}`);
      expect(element).toHaveAttribute('data-part', NAMES[i]);
      expect(element).toHaveStyle({ opacity: '0.5' });
      expect(refs[i].current).toBe(element);
    });
  });

  it('lets your class replace a conflicting class of a part', () => {
    render(
      <People
        slotProps={{
          media: { className: 'inline-block' },
          main: { className: 'text-clip' },
          description: { className: 'text-caption-2' },
        }}
      />,
    );
    const [media, main, description] = partsOf(document.body);
    expect(media).toHaveClass('inline-block');
    expect(media).not.toHaveClass('inline-flex');
    expect(main).toHaveClass('text-clip');
    expect(main).not.toHaveClass('truncate');
    expect(description).toHaveClass('text-caption-2');
    expect(description).not.toHaveClass('text-caption-1');
  });

  it('keeps the item’s name and description: the ids, names and hidden state of the parts are locked', () => {
    const attempt = (id: string) => ({
      id,
      role: 'treeitem',
      tabIndex: 0,
      hidden: true,
      inert: true,
      'aria-hidden': true,
      'aria-label': 'Mine',
      'data-tree-persona-name': 'x',
      'data-tree-row': '',
      'data-tree-checkbox': '',
      'data-tree-actions': '',
      'data-roving-container': '',
    });
    render(
      <People
        slotProps={{
          media: attempt('my-media'),
          main: attempt('my-main'),
          description: attempt('my-description'),
        }}
      />,
    );
    const kat = screen.getByRole('treeitem');
    expect(kat).toHaveAccessibleName('Kat Sharp');
    expect(kat).toHaveAccessibleDescription('Designer');
    expect(screen.getAllByRole('treeitem')).toHaveLength(1);
    const [media, main, description] = partsOf(document.body);
    expect(main.id).toMatch(/^tree-persona-name-/);
    expect(description.id).toMatch(/^tree-persona-description-/);
    expect(main).toHaveAttribute('data-tree-persona-name', '');
    for (const element of [media, description]) {
      expect(element).not.toHaveAttribute('data-tree-persona-name');
    }
    for (const element of [media, main, description]) {
      expect(element).not.toHaveAttribute('role');
      expect(element).not.toHaveAttribute('tabindex');
      for (const marker of [
        'data-tree-row',
        'data-tree-checkbox',
        'data-tree-actions',
        'data-roving-container',
      ]) {
        expect(element).not.toHaveAttribute(marker);
      }
    }
    for (const element of [main, description]) {
      expect(element).not.toHaveAttribute('aria-label');
      for (const hiding of ['hidden', 'inert', 'aria-hidden']) {
        expect(element).not.toHaveAttribute(hiding);
      }
    }
    // The media takes your id and hidden state: it is not part of the name.
    expect(media).toHaveAttribute('id', 'my-media');
    expect(media).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps typeahead on the name: the media cannot mark itself as the name', async () => {
    // Every key in one task: the typeahead buffer is a real 500 ms timer.
    const user = userEvent.setup({ delay: null });
    const marked: LayoutSlotProps = { media: { 'data-tree-persona-name': '' } };
    const row = (name: string) => (
      <Tree.ItemPersonaLayout
        media={<Avatar decorative name={name} size="small" />}
        slotProps={marked}
      >
        {name}
      </Tree.ItemPersonaLayout>
    );
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat">{row('Kat Sharp')}</Tree.Item>
        <Tree.Item value="sam">{row('Sam Kerr')}</Tree.Item>
        <Tree.Item value="sue">{row('Sue Adams')}</Tree.Item>
      </Tree>,
    );
    act(() => item('Kat Sharp').focus());
    // "sa" starts the name Sam Kerr; it would start Sue Adams' initials (SA) if the media's text
    // were the item's.
    await user.keyboard('sa');
    expect(item('Sam Kerr')).toHaveFocus();
  });

  it('runs a part’s click first: preventDefault() keeps the item from activating, its onClick still runs', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onClick = vi.fn(() => void order.push('item'));
    render(
      <People
        onClick={onClick}
        slotProps={{
          main: {
            onClick: (event) => {
              order.push('main');
              event.preventDefault();
            },
          },
          description: { onClick: () => void order.push('description') },
        }}
      />,
    );
    const [, main, description] = partsOf(document.body);
    await user.click(main);
    await user.click(description);
    expect(order).toEqual(['main', 'item', 'description', 'item']);
  });

  it('calls your part handlers once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const handlers = { media: vi.fn(), main: vi.fn(), description: vi.fn() };
    render(
      <React.StrictMode>
        <People
          slotProps={{
            media: { onClick: handlers.media },
            main: { onClick: handlers.main },
            description: { onClick: handlers.description },
          }}
        />
      </React.StrictMode>,
    );
    for (const element of partsOf(document.body)) await user.click(element);
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores the parts the layout does not draw: no media, no description', () => {
    render(
      <Tree aria-label="People">
        <Tree.Item value="kat">
          <Tree.ItemPersonaLayout
            slotProps={{
              media: { className: 'my-media' },
              description: { className: 'my-description' },
              main: { className: 'my-main' },
            }}
          >
            Kat Sharp
          </Tree.ItemPersonaLayout>
        </Tree.Item>
      </Tree>,
    );
    expect(document.querySelector('.my-media, .my-description')).toBeNull();
    expect(screen.getByText('Kat Sharp')).toHaveClass('my-main');
  });

  it('keeps the layout element its own: slotProps never reaches it', () => {
    render(<People slotProps={{ root: { className: 'my-root' } } as unknown as LayoutSlotProps} />);
    const root = document.querySelector(`.${treeItemPersonaLayoutClassNames.root}`)!;
    expect(root).not.toHaveAttribute('slotprops');
    expect(document.querySelector('.my-root')).toBeNull();
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <People
        slotProps={{
          media: { className: 'my-media', title: 'Photo' },
          main: { className: 'my-main' },
          description: { className: 'my-description' },
        }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof LayoutSlotProps>().toEqualTypeOf<'media' | 'main' | 'description'>();
    expectTypeOf<NonNullable<LayoutSlotProps['media']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<LayoutSlotProps['main']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<LayoutSlotProps['description']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    void (
      (
        // @ts-expect-error -- a part takes no children: the layout draws them
        <Tree.ItemPersonaLayout slotProps={{ main: { children: 'Name' } }}>
          Kat
        </Tree.ItemPersonaLayout>
      )
    );
  });
});
