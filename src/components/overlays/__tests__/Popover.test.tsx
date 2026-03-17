import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover } from '../Popover';

describe('Popover', () => {
  it('does not show content by default', () => {
    render(
      <Popover>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Popover body</Popover.Content>
      </Popover>,
    );
    await user.click(screen.getByText('Toggle'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Popover body')).toBeInTheDocument();
  });

  it('toggles on repeated clicks', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    await user.click(screen.getByText('Toggle'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByText('Toggle'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders with defaultOpen', () => {
    render(
      <Popover defaultOpen>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('is controlled via open prop', () => {
    const { rerender } = render(
      <Popover open={false}>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Popover open={true}>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on click outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Popover defaultOpen>
          <Popover.Trigger>
            <button>Toggle</button>
          </Popover.Trigger>
          <Popover.Content>Body</Popover.Content>
        </Popover>
        <button data-testid="outside">Outside</button>
      </div>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Popover defaultOpen>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sets aria-expanded on trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger data-testid="trigger">
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByText('Toggle'));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Popover onOpenChange={onOpenChange}>
        <Popover.Trigger>
          <button>Toggle</button>
        </Popover.Trigger>
        <Popover.Content>Body</Popover.Content>
      </Popover>,
    );
    await user.click(screen.getByText('Toggle'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
