import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvatarGroup } from '../AvatarGroup';
import { Avatar } from '../Avatar';
import { testSystemProps } from '../../../test-utils';

describe('AvatarGroup', () => {
  testSystemProps(AvatarGroup, {
    expectedTag: 'div',
    displayName: 'AvatarGroup',
  });

  it('renders without crashing', () => {
    render(<AvatarGroup data-testid="group" />);
    expect(screen.getByTestId('group')).toBeInTheDocument();
  });

  it('renders all children when no max', () => {
    render(
      <AvatarGroup data-testid="group">
        <Avatar name="Alice" />
        <Avatar name="Bob" />
        <Avatar name="Charlie" />
      </AvatarGroup>,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('shows overflow indicator when max is exceeded', () => {
    render(
      <AvatarGroup max={2} data-testid="group">
        <Avatar name="Alice" />
        <Avatar name="Bob" />
        <Avatar name="Charlie" />
        <Avatar name="Diana" />
      </AvatarGroup>,
    );
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('does not show overflow when items <= max', () => {
    render(
      <AvatarGroup max={3} data-testid="group">
        <Avatar name="Alice" />
        <Avatar name="Bob" />
      </AvatarGroup>,
    );
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('applies size prop to overflow indicator', () => {
    render(
      <AvatarGroup max={1} size="large" data-testid="group">
        <Avatar name="Alice" />
        <Avatar name="Bob" />
      </AvatarGroup>,
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
