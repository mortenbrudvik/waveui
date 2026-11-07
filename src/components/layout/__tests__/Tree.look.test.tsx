import { describe, it, expect, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tree, type TreeAppearance, type TreeProps, type TreeSize } from '../Tree';
import { treeItemClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations } from '../../../test-utils';

const rows = () => Array.from(document.querySelectorAll<HTMLElement>(`.${treeItemClassNames.row}`));

const tree = (props: Partial<TreeProps> = {}) => (
  <Tree aria-label="Files" {...props}>
    <Tree.Item value="a">Alpha</Tree.Item>
    <Tree.Item value="b">Beta</Tree.Item>
  </Tree>
);

describe('Tree - size and appearance (tree-3)', () => {
  it('defaults to medium and subtle, rendered as data attributes', () => {
    render(tree());
    const root = screen.getByRole('tree');
    expect(root).toHaveAttribute('data-size', 'medium');
    expect(root).toHaveAttribute('data-appearance', 'subtle');
    expect(rows()[0]).toHaveClass('wave:py-1', 'wave:gap-1.5', 'wave:hover:bg-subtle-hover');
  });

  it('small makes tighter rows', () => {
    render(tree({ size: 'small' }));
    expect(screen.getByRole('tree')).toHaveAttribute('data-size', 'small');
    for (const row of rows()) {
      expect(row).toHaveClass('wave:py-0.5', 'wave:gap-1');
      expect(row).not.toHaveClass('wave:py-1');
    }
  });

  it('subtle-alpha uses translucent fills, also for the selected row', () => {
    render(tree({ appearance: 'subtle-alpha', selected: 'a' }));
    expect(screen.getByRole('tree')).toHaveAttribute('data-appearance', 'subtle-alpha');
    expect(rows()[1]).toHaveClass('wave:hover:bg-subtle-hover/60');
    expect(rows()[0]).toHaveClass('wave:bg-subtle-selected/70', 'wave:font-semibold');
  });

  it('transparent draws no fill but keeps the selected row bold', () => {
    render(tree({ appearance: 'transparent', selected: 'a' }));
    for (const row of rows()) {
      expect(Array.from(row.classList).filter((word) => word.includes('bg-subtle'))).toEqual([]);
    }
    expect(rows()[0]).toHaveClass('wave:font-semibold');
  });

  it('a nested tree takes its own size and appearance', () => {
    render(
      <Tree aria-label="Outer" size="small">
        <Tree.Item value="a">
          Alpha
          <Tree.Item value="b">Beta</Tree.Item>
        </Tree.Item>
      </Tree>,
    );
    expect(screen.getByRole('tree')).toHaveAttribute('data-size', 'small');
  });

  it('is typed and has no axe violations', async () => {
    expectTypeOf<TreeSize>().toEqualTypeOf<'small' | 'medium'>();
    expectTypeOf<TreeAppearance>().toEqualTypeOf<'subtle' | 'subtle-alpha' | 'transparent'>();
    expectTypeOf<TreeProps['size']>().toEqualTypeOf<TreeSize | undefined>();
    const view = render(tree({ size: 'small', appearance: 'subtle-alpha' }));
    await expectNoA11yViolations(view.container);
  });
});
