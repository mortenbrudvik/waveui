import * as React from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { WaveProvider, type WaveProviderProps } from '../WaveProvider';
import { Button } from '../../button/Button';
import { ToggleButton } from '../../button/ToggleButton';
import { Dialog } from '../../overlays/Dialog';
import { Menu } from '../../navigation/Menu';
import { Rating } from '../../input/Rating';
import { Portal } from '../../portal/Portal';
import { useAppClassName } from '../../../hooks/useAppClassName';
import {
  buttonClassNames,
  dialogContentClassNames,
  waveProviderClassNames,
} from '../../../lib/classNames';
import type { WaveClassNames } from '../../../hooks/useAppClassName';

function Probe({ id }: { id: string }) {
  return <span data-testid={id} className={useAppClassName('wave-button', 'wave-toggle-button')} />;
}

describe('WaveProvider classNames (app-wide classes)', () => {
  it('adds the classes of a root class to every component with it, after its own', () => {
    render(
      <WaveProvider classNames={{ 'wave-button': 'rounded-full app-a' }}>
        <Button>One</Button>
        <Button className="mine">Two</Button>
      </WaveProvider>,
    );
    const one = screen.getByRole('button', { name: 'One' });
    expect(one).toHaveClass(buttonClassNames.root, 'rounded-full', 'app-a');
    // Wave's own `rounded` is replaced by the app's, which comes later in the merge.
    expect(one).not.toHaveClass('wave:rounded');
    // The instance's className follows the app's.
    const classes = Array.from(screen.getByRole('button', { name: 'Two' }).classList);
    expect(classes.indexOf('app-a')).toBeLessThan(classes.indexOf('mine'));
  });

  it('a consumer className still wins a conflict with the app-wide class', () => {
    render(
      <WaveProvider classNames={{ 'wave-button': 'rounded-full' }}>
        <Button className="rounded-none">Square</Button>
      </WaveProvider>,
    );
    const button = screen.getByRole('button', { name: 'Square' });
    expect(button).toHaveClass('rounded-none');
    expect(button).not.toHaveClass('rounded-full');
  });

  it('a variant receives the classes of the components it is built on', () => {
    render(
      <WaveProvider classNames={{ 'wave-button': 'on-button', 'wave-toggle-button': 'on-toggle' }}>
        <ToggleButton>Toggle</ToggleButton>
        <Button>Plain</Button>
      </WaveProvider>,
    );
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveClass('on-button', 'on-toggle');
    const plain = screen.getByRole('button', { name: 'Plain' });
    expect(plain).toHaveClass('on-button');
    expect(plain).not.toHaveClass('on-toggle');
  });

  it('reaches portaled overlays', () => {
    render(
      <WaveProvider classNames={{ 'wave-dialog-content': 'app-dialog' }}>
        <Dialog defaultOpen>
          <Dialog.Content aria-label="Settings">Body</Dialog.Content>
        </Dialog>
      </WaveProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveClass(
      dialogContentClassNames.root,
      'app-dialog',
    );
  });

  it('reaches items whose classes go through a shared shell (menu and rating)', () => {
    render(
      <WaveProvider classNames={{ 'wave-menu-item': 'app-item', 'wave-rating-item': 'app-star' }}>
        <Menu defaultOpen>
          <Menu.Trigger>
            <Button>Open</Button>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.ItemCheckbox name="a" value="1">
              Check
            </Menu.ItemCheckbox>
          </Menu.Popover>
        </Menu>
        <Rating aria-label="Score" defaultValue={2} />
      </WaveProvider>,
    );
    const item = screen.getByRole('menuitemcheckbox', { name: 'Check' });
    const classes = Array.from(item.classList);
    expect(classes).toContain('app-item');
    // After the item's own utilities, so it can replace them.
    expect(classes.at(-1)).toBe('app-item');
    expect(screen.getAllByRole('radio')[0]).toHaveClass('app-star');
  });

  it('the provider root takes the classes of wave-root, before its className', () => {
    const { container } = render(
      <WaveProvider classNames={{ [waveProviderClassNames.root]: 'app-root' }} className="mine">
        x
      </WaveProvider>,
    );
    const classes = Array.from((container.firstElementChild as HTMLElement).classList);
    expect(classes).toContain('app-root');
    expect(classes.indexOf('app-root')).toBeLessThan(classes.indexOf('mine'));
  });

  it('renders the same markup without classNames, with {} and with null', () => {
    const plain = renderToString(
      <WaveProvider>
        <Button>Go</Button>
      </WaveProvider>,
    );
    for (const classNames of [{}, null, { 'wave-button': undefined }] as const) {
      expect(
        renderToString(
          <WaveProvider classNames={classNames}>
            <Button>Go</Button>
          </WaveProvider>,
        ),
      ).toBe(plain);
    }
    expect(renderToString(<Button>Go</Button>)).not.toContain('app-');
  });

  it('renders on the server', () => {
    expect(
      renderToString(
        <WaveProvider classNames={{ 'wave-button': 'app-a' }}>
          <Button>Go</Button>
        </WaveProvider>,
      ),
    ).toContain('app-a');
  });

  describe('nesting', () => {
    it('merges key by key; a key it sets replaces, "" removes, undefined and omission inherit', () => {
      render(
        <WaveProvider classNames={{ 'wave-button': 'outer', 'wave-toggle-button': 'outer-toggle' }}>
          <WaveProvider classNames={{ 'wave-button': 'inner' }}>
            <Probe id="replaced" />
          </WaveProvider>
          <WaveProvider classNames={{ 'wave-button': '' }}>
            <Probe id="removed" />
          </WaveProvider>
          <WaveProvider classNames={{ 'wave-button': undefined }}>
            <Probe id="undefined" />
          </WaveProvider>
          <WaveProvider>
            <Probe id="omitted" />
          </WaveProvider>
        </WaveProvider>,
      );
      expect(screen.getByTestId('replaced')).toHaveAttribute('class', 'inner outer-toggle');
      expect(screen.getByTestId('removed')).toHaveAttribute('class', 'outer-toggle');
      expect(screen.getByTestId('undefined')).toHaveAttribute('class', 'outer outer-toggle');
      expect(screen.getByTestId('omitted')).toHaveAttribute('class', 'outer outer-toggle');
    });

    it('null clears everything inherited', () => {
      render(
        <WaveProvider classNames={{ 'wave-button': 'outer' }}>
          <WaveProvider classNames={null}>
            <Probe id="cleared" />
          </WaveProvider>
        </WaveProvider>,
      );
      expect(screen.getByTestId('cleared')).not.toHaveAttribute('class');
    });

    it('a provider without any app classes gives the components nothing', () => {
      render(
        <WaveProvider>
          <Probe id="none" />
        </WaveProvider>,
      );
      expect(screen.getByTestId('none')).not.toHaveAttribute('class');
    });
  });

  it('keeps the identity of the context while the entries are equal (no re-render of consumers)', () => {
    // The memoised consumer re-renders only when the context value changes.
    const rendered = vi.fn();
    const Counter = React.memo(function Counter() {
      rendered();
      return <span data-testid="counter" className={useAppClassName('wave-button')} />;
    });
    const tree = (classNames: WaveClassNames) => (
      <WaveProvider classNames={classNames}>
        <Counter />
      </WaveProvider>
    );
    const { rerender } = render(tree({ 'wave-button': 'a' }));
    expect(rendered).toHaveBeenCalledTimes(1);
    rerender(tree({ 'wave-button': 'a' }));
    expect(rendered).toHaveBeenCalledTimes(1);
    rerender(tree({ 'wave-button': 'b' }));
    expect(rendered).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('counter')).toHaveAttribute('class', 'b');
  });

  it('does not re-run consumers under StrictMode beyond React’s double render, and applies once', () => {
    render(
      <React.StrictMode>
        <WaveProvider classNames={{ 'wave-button': 'strict' }}>
          <Button>Go</Button>
        </WaveProvider>
      </React.StrictMode>,
    );
    const classes = Array.from(screen.getByRole('button', { name: 'Go' }).classList);
    expect(classes.filter((name) => name === 'strict')).toHaveLength(1);
  });

  it('a Portal outside the provider tree of an inner subtree still inherits from the context', () => {
    render(
      <WaveProvider classNames={{ 'wave-button': 'in-portal' }}>
        <Portal>
          <Button>Floating</Button>
        </Portal>
      </WaveProvider>,
    );
    expect(screen.getByRole('button', { name: 'Floating' })).toHaveClass('in-portal');
  });

  it('types: keys are the root classes of the registry', () => {
    expectTypeOf<WaveProviderProps['classNames']>().toEqualTypeOf<
      WaveClassNames | null | undefined
    >();
    const ok: WaveClassNames = { 'wave-button': 'x', 'wave-card-header': 'y' };
    expect(ok).toBeDefined();
    // @ts-expect-error not a root class of the registry
    const bad: WaveClassNames = { 'wave-nothing': 'x' };
    expect(bad).toBeDefined();
    // @ts-expect-error a part class is not a root class
    const part: WaveClassNames = { 'wave-button__icon': 'x' };
    expect(part).toBeDefined();
  });
});
