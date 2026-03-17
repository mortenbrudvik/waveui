import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tag } from '../Tag';
import {
  testForwardRef,
  testRestSpread,
  testClassName,
  testPolymorphicAs,
} from '../../../test-utils';

describe('Tag', () => {
  testForwardRef(Tag, 'span');
  testRestSpread(Tag);
  testClassName(Tag);
  testPolymorphicAs(Tag);

  it('renders without crashing', () => {
    render(<Tag data-testid="tag">Label</Tag>);
    expect(screen.getByTestId('tag')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Tag>React</Tag>);
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders as a different element via as prop', () => {
    render(
      <Tag as="div" data-testid="tag">
        Label
      </Tag>,
    );
    expect(screen.getByTestId('tag').tagName.toLowerCase()).toBe('div');
  });

  it('shows dismiss button when dismissible', () => {
    render(<Tag dismissible>Label</Tag>);
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('does not show dismiss button when not dismissible', () => {
    render(<Tag>Label</Tag>);
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Tag dismissible onDismiss={onDismiss}>
        Label
      </Tag>,
    );
    await user.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders custom dismissIcon slot', () => {
    render(
      <Tag dismissible dismissIcon={<span data-testid="custom-icon">X</span>}>
        Label
      </Tag>,
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
