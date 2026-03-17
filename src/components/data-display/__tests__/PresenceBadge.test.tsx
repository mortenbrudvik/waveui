import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceBadge } from '../PresenceBadge';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('PresenceBadge', () => {
  testForwardRef(PresenceBadge, 'span', { status: 'available' });
  testRestSpread(PresenceBadge, { status: 'available' });
  testClassName(PresenceBadge, { status: 'available' });

  it('renders with role="status"', () => {
    render(<PresenceBadge status="available" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it.each([
    ['available', 'Available'],
    ['busy', 'Busy'],
    ['away', 'Away'],
    ['offline', 'Offline'],
    ['dnd', 'Do not disturb'],
    ['oof', 'Out of office'],
  ] as const)('renders status "%s" with aria-label "%s"', (status, label) => {
    render(<PresenceBadge status={status} />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-label', label);
  });

  it.each(['extra-small', 'small', 'medium', 'large', 'extra-large'] as const)(
    'renders size: %s',
    (size) => {
      render(<PresenceBadge status="available" size={size} data-testid="pb" />);
      expect(screen.getByTestId('pb')).toBeInTheDocument();
    },
  );
});
