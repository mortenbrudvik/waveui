import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../Field';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Field', () => {
  testForwardRef(Field, 'div');
  testRestSpread(Field);
  testClassName(Field);

  it('renders without crashing', () => {
    render(<Field><input /></Field>);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<Field label="Name"><input /></Field>);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders required indicator', () => {
    render(<Field label="Name" required><input /></Field>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    render(<Field hint="Enter your full name"><input /></Field>);
    expect(screen.getByText('Enter your full name')).toBeInTheDocument();
  });

  it('renders error text', () => {
    render(<Field error="This field is required"><input /></Field>);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('shows error over hint when both provided', () => {
    render(<Field error="Error!" hint="Hint"><input /></Field>);
    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('links label to child via htmlFor', () => {
    render(<Field label="Email" htmlFor="email-input"><input id="email-input" /></Field>);
    const label = screen.getByText('Email');
    expect(label).toHaveAttribute('for', 'email-input');
  });

  it('sets aria-describedby on child linking to error', () => {
    render(<Field error="Required" htmlFor="test-field"><input /></Field>);
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain('test-field-error');
  });

  it('sets aria-describedby on child linking to hint', () => {
    render(<Field hint="Some hint" htmlFor="test-field"><input /></Field>);
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain('test-field-hint');
  });

  it('sets aria-invalid on child when error is provided', () => {
    render(<Field error="Required"><input /></Field>);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(<Field><input /></Field>);
    const input = screen.getByRole('textbox');
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});
