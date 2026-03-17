import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoLabel } from '../InfoLabel';
import { testSystemProps } from '../../../test-utils';

describe('InfoLabel', () => {
  testSystemProps(InfoLabel, {
    expectedTag: 'span',
    displayName: 'InfoLabel',
    defaultProps: { label: 'Name', info: 'Enter your name' },
  });

  it('renders the label text', () => {
    render(<InfoLabel label="Email" info="Your email address" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders info as title attribute on the info icon', () => {
    render(<InfoLabel label="Name" info="Enter your full name" />);
    const infoIcon = screen.getByTitle('Enter your full name');
    expect(infoIcon).toBeInTheDocument();
  });

  it('renders info as aria-label for accessibility', () => {
    render(<InfoLabel label="Name" info="Your name here" />);
    const infoIcon = screen.getByLabelText('Your name here');
    expect(infoIcon).toBeInTheDocument();
  });

  it('info icon has role="img"', () => {
    render(<InfoLabel label="Name" info="Info text" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('info icon is focusable', () => {
    render(<InfoLabel label="Name" info="Info text" />);
    const infoIcon = screen.getByRole('img');
    expect(infoIcon).toHaveAttribute('tabIndex', '0');
  });
});
