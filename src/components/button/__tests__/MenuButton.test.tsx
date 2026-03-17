import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuButton } from '../MenuButton';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('MenuButton', () => {
  testForwardRef(MenuButton, 'button');
  testRestSpread(MenuButton);
  testClassName(MenuButton);

  it('renders without crashing', () => {
    render(<MenuButton>Menu</MenuButton>);
    expect(screen.getByRole('button', { name: /Menu/i })).toBeInTheDocument();
  });

  it('has aria-haspopup="menu"', () => {
    render(<MenuButton>Menu</MenuButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('renders default chevron icon when menuIcon is not provided', () => {
    render(<MenuButton data-testid="btn">Menu</MenuButton>);
    const svg = screen.getByTestId('btn').querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders icon as ReactNode shorthand', () => {
    render(<MenuButton icon={<span data-testid="icon">I</span>}>Menu</MenuButton>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders icon as SlotObject', () => {
    render(
      <MenuButton icon={{ children: <span data-testid="slot-icon">I</span>, className: 'custom' }}>
        Menu
      </MenuButton>,
    );
    expect(screen.getByTestId('slot-icon')).toBeInTheDocument();
  });

  it('renders menuIcon as ReactNode shorthand', () => {
    render(<MenuButton menuIcon={<span data-testid="menu-icon">V</span>}>Menu</MenuButton>);
    expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
  });

  it('renders menuIcon as SlotObject', () => {
    render(
      <MenuButton
        menuIcon={{ children: <span data-testid="slot-menu-icon">V</span>, className: 'custom' }}
      >
        Menu
      </MenuButton>,
    );
    expect(screen.getByTestId('slot-menu-icon')).toBeInTheDocument();
  });

  it('sets aria-expanded when expanded', () => {
    render(<MenuButton expanded>Menu</MenuButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not set aria-expanded when not expanded', () => {
    render(<MenuButton>Menu</MenuButton>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-expanded');
  });

  it('calls onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MenuButton onClick={onClick}>Menu</MenuButton>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
