import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toolbar } from '../Toolbar';
import { testForwardRef, testRestSpread, testClassName, testPolymorphicAs } from '../../../test-utils';

describe('Toolbar', () => {
  testForwardRef(Toolbar, 'div');
  testRestSpread(Toolbar);
  testClassName(Toolbar);
  testPolymorphicAs(Toolbar);

  it('renders without crashing', () => {
    render(<Toolbar aria-label="Formatting">Content</Toolbar>);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('has role="toolbar"', () => {
    render(<Toolbar aria-label="Formatting">Content</Toolbar>);
    expect(screen.getByRole('toolbar')).toHaveAttribute('role', 'toolbar');
  });

  it('renders children', () => {
    render(
      <Toolbar aria-label="Formatting">
        <button>Bold</button>
        <button>Italic</button>
      </Toolbar>,
    );
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('Italic')).toBeInTheDocument();
  });

  it('renders as a different element via as prop', () => {
    render(<Toolbar as="nav" data-testid="toolbar" aria-label="Nav">Content</Toolbar>);
    expect(screen.getByTestId('toolbar').tagName.toLowerCase()).toBe('nav');
  });

  it('passes aria-label', () => {
    render(<Toolbar aria-label="Test label">Content</Toolbar>);
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Test label');
  });
});
