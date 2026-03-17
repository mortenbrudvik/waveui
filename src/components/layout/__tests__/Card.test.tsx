import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from '../Card';
import { testSystemProps, testCompoundExposure } from '../../../test-utils';

describe('Card', () => {
  testSystemProps(Card, {
    expectedTag: 'div',
    displayName: 'Card',
    polymorphic: true,
  });

  testCompoundExposure(Card, ['Header', 'Body', 'Footer']);

  it('renders without crashing', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders as custom element', () => {
    render(
      <Card as="article" data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card').tagName.toLowerCase()).toBe('article');
  });

  it('applies selected styling', () => {
    render(
      <Card selected data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('border-primary');
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Card onSelect={onSelect} data-testid="card">
        Content
      </Card>,
    );
    await user.click(screen.getByTestId('card'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('has cursor-pointer when onSelect is provided', () => {
    render(
      <Card onSelect={() => {}} data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('cursor-pointer');
  });
});

describe('Card.Header', () => {
  testSystemProps(Card.Header, {
    expectedTag: 'div',
    displayName: 'CardHeader',
    polymorphic: true,
  });

  it('renders title', () => {
    render(<Card.Header title="Header Title" />);
    expect(screen.getByText('Header Title')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<Card.Header title="Title" subtitle="Subtitle" />);
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Card.Header>Custom content</Card.Header>);
    expect(screen.getByText('Custom content')).toBeInTheDocument();
  });
});

describe('Card.Body', () => {
  testSystemProps(Card.Body, {
    expectedTag: 'div',
    displayName: 'CardBody',
    polymorphic: true,
  });

  it('renders children', () => {
    render(<Card.Body>Body content</Card.Body>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});

describe('Card.Footer', () => {
  testSystemProps(Card.Footer, {
    expectedTag: 'div',
    displayName: 'CardFooter',
    polymorphic: true,
  });

  it('renders children', () => {
    render(<Card.Footer>Footer content</Card.Footer>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });
});

describe('Card composition', () => {
  it('renders full card with header, body, and footer', () => {
    render(
      <Card data-testid="card">
        <Card.Header title="My Card" subtitle="Description" />
        <Card.Body>Body text</Card.Body>
        <Card.Footer>
          <button>Action</button>
        </Card.Footer>
      </Card>,
    );
    expect(screen.getByText('My Card')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
