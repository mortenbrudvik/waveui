import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { testForwardRef, testRestSpread, testClassName, testPolymorphicAs } from '../../../test-utils';

describe('Button', () => {
  testForwardRef(Button, 'button');
  testRestSpread(Button);
  testClassName(Button);
  testPolymorphicAs(Button);

  it('renders without crashing', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders with primary appearance', () => {
    render(<Button appearance="primary" data-testid="btn">Primary</Button>);
    expect(screen.getByTestId('btn').className).toContain('bg-primary');
  });

  it('renders with outline appearance by default', () => {
    render(<Button data-testid="btn">Outline</Button>);
    expect(screen.getByTestId('btn').className).toContain('border');
  });

  it('renders with subtle appearance', () => {
    render(<Button appearance="subtle" data-testid="btn">Subtle</Button>);
    expect(screen.getByTestId('btn').className).toContain('bg-transparent');
  });

  it('renders with transparent appearance', () => {
    render(<Button appearance="transparent" data-testid="btn">Transparent</Button>);
    expect(screen.getByTestId('btn').className).toContain('bg-transparent');
  });

  it('renders small size', () => {
    render(<Button size="small" data-testid="btn">Small</Button>);
    expect(screen.getByTestId('btn').className).toContain('h-6');
  });

  it('renders large size', () => {
    render(<Button size="large" data-testid="btn">Large</Button>);
    expect(screen.getByTestId('btn').className).toContain('h-10');
  });

  it('renders as a different element via as prop', () => {
    render(<Button as="a" data-testid="btn" href="#">Link Button</Button>);
    expect(screen.getByTestId('btn').tagName.toLowerCase()).toBe('a');
  });

  it('renders icon as ReactNode shorthand', () => {
    render(<Button icon={<span data-testid="icon">X</span>}>With Icon</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders icon as SlotObject', () => {
    render(
      <Button icon={{ children: <span data-testid="slot-icon">I</span>, className: 'custom-icon' }}>
        Slot Icon
      </Button>,
    );
    expect(screen.getByTestId('slot-icon')).toBeInTheDocument();
  });

  it('applies disabled state', () => {
    render(<Button disabled data-testid="btn">Disabled</Button>);
    expect(screen.getByTestId('btn')).toBeDisabled();
    expect(screen.getByTestId('btn').className).toContain('opacity-50');
  });

  it('calls onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
