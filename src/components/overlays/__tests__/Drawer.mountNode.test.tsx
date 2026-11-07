import { afterEach, describe, it, expect, expectTypeOf } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Drawer, type DrawerProps } from '../Drawer';
import { drawerClassNames } from '../../../lib/classNames';
import { WaveProvider } from '../../provider/WaveProvider';
import { expectNoA11yViolations } from '../../../test-utils';

let node: HTMLElement | null = null;
function mountNode() {
  node = document.createElement('div');
  node.setAttribute('data-testid', 'mount');
  document.body.appendChild(node);
  return node;
}
afterEach(() => {
  node?.remove();
  node = null;
});

describe('Drawer - mountNode (drw-5)', () => {
  it('renders the panel and its backdrop into the node instead of the body', () => {
    const target = mountNode();
    render(
      <Drawer open mountNode={target} title="Settings">
        Content
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Settings' });
    expect(target).toContainElement(panel);
    expect(target.querySelector(`.${drawerClassNames.backdrop}`)).not.toBeNull();
    expect(panel.closest('.wave-portal')?.parentElement).toBe(target);
  });

  it('defaults to the provider’s portalContainer, and the prop wins over it', () => {
    const fromProvider = mountNode();
    const own = document.createElement('div');
    document.body.appendChild(own);
    try {
      render(
        <WaveProvider portalContainer={fromProvider}>
          <Drawer open title="A">
            One
          </Drawer>
          <Drawer open mountNode={own} title="B" modalType="non-modal">
            Two
          </Drawer>
        </WaveProvider>,
      );
      expect(fromProvider).toContainElement(
        screen.getByRole('dialog', { name: 'A', hidden: true }),
      );
      expect(own).toContainElement(screen.getByRole('dialog', { name: 'B', hidden: true }));
    } finally {
      own.remove();
    }
  });

  it('null and undefined mean the default', () => {
    render(
      <Drawer open mountNode={null} title="Settings">
        Content
      </Drawer>,
    );
    expect(screen.getByRole('dialog').closest('.wave-portal')?.parentElement).toBe(document.body);
  });

  it('is ignored by an inline drawer, which renders in place', () => {
    const target = mountNode();
    render(
      <div data-testid="page">
        <Drawer open type="inline" mountNode={target} title="Inline">
          Content
        </Drawer>
      </div>,
    );
    expect(screen.getByTestId('page')).toContainElement(screen.getByRole('complementary'));
    expect(target).toBeEmptyDOMElement();
  });

  it('is typed, and has no axe violations', async () => {
    expectTypeOf<DrawerProps['mountNode']>().toEqualTypeOf<HTMLElement | null | undefined>();
    const target = mountNode();
    render(
      <Drawer open mountNode={target} title="Settings">
        Content
      </Drawer>,
    );
    await expectNoA11yViolations();
  });
});
