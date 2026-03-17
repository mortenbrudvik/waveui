import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../Label';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Label', () => {
  testForwardRef(Label, 'label');
  testRestSpread(Label);
  testClassName(Label);

  it('renders without crashing', () => {
    render(<Label data-testid="label">Name</Label>);
    expect(screen.getByTestId('label')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Label>Username</Label>);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('shows required indicator', () => {
    render(<Label required data-testid="label">Name</Label>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not show required indicator by default', () => {
    render(<Label data-testid="label">Name</Label>);
    expect(screen.queryByText('*')).toBeNull();
  });

  it('applies disabled styling', () => {
    render(<Label disabled data-testid="label">Name</Label>);
    expect(screen.getByTestId('label').className).toContain('text-muted-foreground');
  });

  it('passes htmlFor to the label element', () => {
    render(<Label htmlFor="input-1" data-testid="label">Name</Label>);
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'input-1');
  });

  it.each(['small', 'medium', 'large'] as const)(
    'renders size variant: %s',
    (size) => {
      render(<Label size={size} data-testid="label">Name</Label>);
      expect(screen.getByTestId('label')).toBeInTheDocument();
    },
  );

  it('applies semibold weight', () => {
    render(<Label weight="semibold" data-testid="label">Name</Label>);
    expect(screen.getByTestId('label').className).toContain('font-semibold');
  });
});
