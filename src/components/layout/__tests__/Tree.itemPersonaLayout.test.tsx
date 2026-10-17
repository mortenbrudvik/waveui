import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree, TreeItemPersonaLayout, type TreeItemPersonaLayoutProps } from '../Tree';
import { Avatar } from '../../data-display/Avatar';
import { treeItemPersonaLayoutClassNames } from '../../../lib/classNames';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
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
