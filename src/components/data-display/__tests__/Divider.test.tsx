import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Divider } from '../Divider';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Divider', () => {
  testForwardRef(Divider, 'hr');
  testRestSpread(Divider);
  testClassName(Divider);

  it('renders without crashing', () => {
    render(<Divider data-testid="divider" />);
    expect(screen.getByTestId('divider')).toBeInTheDocument();
  });

  it('renders as hr by default (horizontal, no children)', () => {
    render(<Divider data-testid="divider" />);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('hr');
  });

  it('renders with role="separator"', () => {
    render(<Divider />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('renders children text between lines', () => {
    render(<Divider>OR</Divider>);
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('renders as div when children are provided', () => {
    render(<Divider data-testid="divider">OR</Divider>);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('div');
  });

  it('renders vertical orientation', () => {
    render(<Divider orientation="vertical" data-testid="divider" />);
    const el = screen.getByTestId('divider');
    expect(el).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('renders as custom element via as prop', () => {
    render(<Divider as="section" data-testid="divider" />);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('section');
  });

  it('renders as custom element with children', () => {
    render(
      <Divider as="section" data-testid="divider">
        Text
      </Divider>,
    );
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('section');
  });

  it('renders as custom element in vertical mode', () => {
    render(<Divider as="span" orientation="vertical" data-testid="divider" />);
    expect(screen.getByTestId('divider').tagName.toLowerCase()).toBe('span');
  });
});
