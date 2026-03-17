import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '../Avatar';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Avatar', () => {
  testForwardRef(Avatar, 'span');
  testRestSpread(Avatar);
  testClassName(Avatar);

  it('renders without crashing', () => {
    render(<Avatar data-testid="avatar" />);
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
  });

  it('renders initials from name', () => {
    render(<Avatar name="John Doe" data-testid="avatar" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders single initial for single name', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders img when src is provided', () => {
    render(<Avatar src="https://example.com/photo.jpg" name="John" data-testid="avatar" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(img).toHaveAttribute('alt', 'John');
  });

  it('renders icon when icon prop is provided', () => {
    render(<Avatar icon={<span data-testid="icon">IC</span>} data-testid="avatar" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders image slot as SlotObject', () => {
    render(
      <Avatar
        image={{ as: 'img', src: 'https://example.com/photo.jpg', alt: 'test' } as any}
        data-testid="avatar"
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('renders badge slot', () => {
    render(<Avatar name="John Doe" badge={<span data-testid="badge">Online</span>} />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('wraps in relative container when badge is present', () => {
    const { container } = render(<Avatar name="John" badge="online" />);
    expect(container.querySelector('.relative')).toBeInTheDocument();
  });

  it.each(['extra-small', 'small', 'medium', 'large', 'extra-large'] as const)(
    'renders size variant: %s',
    (size) => {
      render(<Avatar size={size} name="A" data-testid="avatar" />);
      expect(screen.getByTestId('avatar')).toBeInTheDocument();
    },
  );

  it('prioritizes image slot over src', () => {
    render(
      <Avatar
        src="https://example.com/src.jpg"
        image={{ as: 'img', src: 'https://example.com/slot.jpg', alt: 'slot' } as any}
        data-testid="avatar"
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/slot.jpg');
  });
});
