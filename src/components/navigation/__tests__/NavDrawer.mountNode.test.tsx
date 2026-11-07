import { afterEach, describe, it, expect, expectTypeOf } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Nav } from '../Nav';
import { NavDrawer, NavDrawerBody, type NavDrawerProps } from '../NavDrawer';
import { drawerClassNames } from '../../../lib/classNames';
import { WaveProvider } from '../../provider/WaveProvider';
import { expectNoA11yViolations } from '../../../test-utils';

let node: HTMLElement | null = null;
function makeNode() {
  node = document.createElement('div');
  document.body.appendChild(node);
  return node;
}
afterEach(() => {
  node?.remove();
  node = null;
});

const drawer = (props: Partial<NavDrawerProps> = {}) => (
  <NavDrawer open aria-label="Main" {...props}>
    <NavDrawerBody>
      <Nav.Item value="home">Home</Nav.Item>
    </NavDrawerBody>
  </NavDrawer>
);

describe('NavDrawer - mountNode', () => {
  it('renders an overlay drawer and its backdrop into the node instead of the body', () => {
    const target = makeNode();
    render(drawer({ mountNode: target }));
    const dialog = screen.getByRole('dialog', { name: 'Main' });
    expect(target).toContainElement(dialog);
    expect(target.querySelector(`.${drawerClassNames.backdrop}`)).not.toBeNull();
  });

  it('defaults to the provider portalContainer, and the prop wins over it', () => {
    const fromProvider = makeNode();
    const own = document.createElement('div');
    document.body.appendChild(own);
    try {
      render(
        <WaveProvider portalContainer={fromProvider}>
          {drawer({ 'aria-label': 'A' })}
          {drawer({ 'aria-label': 'B', mountNode: own, modalType: 'non-modal' })}
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

  it('null means the default, and an inline drawer ignores it', () => {
    const target = makeNode();
    const { unmount } = render(drawer({ mountNode: null }));
    expect(target).toBeEmptyDOMElement();
    expect(screen.getByRole('dialog', { name: 'Main' })).toBeInTheDocument();
    unmount();
    render(drawer({ type: 'inline', mountNode: target }));
    expect(target).toBeEmptyDOMElement();
  });

  it('has no axe violations', async () => {
    const target = makeNode();
    render(drawer({ mountNode: target }));
    await expectNoA11yViolations();
  });

  it('types', () => {
    expectTypeOf<NavDrawerProps['mountNode']>().toEqualTypeOf<HTMLElement | null | undefined>();
  });
});
