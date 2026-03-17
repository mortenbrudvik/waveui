import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Badge', () => {
  testForwardRef(Badge, 'span');
  testRestSpread(Badge);
  testClassName(Badge);

  it('renders without crashing', () => {
    render(<Badge data-testid="badge">Label</Badge>);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('renders children text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it.each(['filled', 'tint', 'outline'] as const)('renders appearance: %s', (appearance) => {
    render(
      <Badge appearance={appearance} data-testid="badge">
        Label
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it.each(['brand', 'success', 'warning', 'danger', 'important', 'informative'] as const)(
    'renders color: %s',
    (color) => {
      render(
        <Badge color={color} data-testid="badge">
          Label
        </Badge>,
      );
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    },
  );

  it.each(['extra-small', 'small', 'medium', 'large', 'extra-large'] as const)(
    'renders size: %s',
    (size) => {
      render(
        <Badge size={size} data-testid="badge">
          Label
        </Badge>,
      );
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    },
  );

  it('combines appearance and color', () => {
    render(
      <Badge appearance="tint" color="success" data-testid="badge">
        OK
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });
});
