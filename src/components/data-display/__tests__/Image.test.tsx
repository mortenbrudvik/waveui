import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Image } from '../Image';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Image', () => {
  testForwardRef(Image, 'img');
  testRestSpread(Image);
  testClassName(Image);

  it('renders without crashing', () => {
    render(<Image data-testid="img" src="test.png" />);
    expect(screen.getByTestId('img')).toBeInTheDocument();
  });

  it('renders as img element', () => {
    render(<Image data-testid="img" src="test.png" />);
    expect(screen.getByTestId('img').tagName.toLowerCase()).toBe('img');
  });

  it('applies src and alt', () => {
    render(<Image src="photo.jpg" alt="A photo" data-testid="img" />);
    const el = screen.getByTestId('img');
    expect(el).toHaveAttribute('src', 'photo.jpg');
    expect(el).toHaveAttribute('alt', 'A photo');
  });

  it('does not default alt attribute (requires explicit alt)', () => {
    render(<Image src="photo.jpg" data-testid="img" />);
    expect(screen.getByTestId('img')).not.toHaveAttribute('alt');
  });

  it.each(['none', 'center', 'contain', 'cover', 'default'] as const)(
    'applies fit variant: %s',
    (fit) => {
      render(<Image fit={fit} src="test.png" data-testid="img" />);
      expect(screen.getByTestId('img')).toBeInTheDocument();
    },
  );

  it.each(['circular', 'rounded', 'square'] as const)('applies shape variant: %s', (shape) => {
    render(<Image shape={shape} src="test.png" data-testid="img" />);
    expect(screen.getByTestId('img')).toBeInTheDocument();
  });

  it('applies circular shape class', () => {
    render(<Image shape="circular" src="test.png" data-testid="img" />);
    expect(screen.getByTestId('img').className).toContain('rounded-full');
  });

  it('applies shadow', () => {
    render(<Image shadow src="test.png" data-testid="img" />);
    expect(screen.getByTestId('img').className).toContain('shadow');
  });

  it('applies block display', () => {
    render(<Image block src="test.png" data-testid="img" />);
    const cls = screen.getByTestId('img').className;
    expect(cls).toContain('block');
    expect(cls).toContain('w-full');
  });

  it('applies bordered', () => {
    render(<Image bordered src="test.png" data-testid="img" />);
    expect(screen.getByTestId('img').className).toContain('border');
  });
});
