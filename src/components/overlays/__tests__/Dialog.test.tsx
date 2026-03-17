import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '../Dialog';

describe('Dialog', () => {
  it('renders trigger and does not show content by default', () => {
    render(
      <Dialog>
        <Dialog.Trigger>
          <button>Open</button>
        </Dialog.Trigger>
        <Dialog.Content title="Test Dialog">Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <Dialog.Trigger>
          <button>Open</button>
        </Dialog.Trigger>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    await user.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders with defaultOpen=true', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('is controlled via open prop', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <Dialog.Trigger>
          <button>Open</button>
        </Dialog.Trigger>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <Dialog.Trigger>
          <button>Open</button>
        </Dialog.Trigger>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on ESC key', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Click on the backdrop (the fixed overlay div)
    const backdrop = screen.getByRole('dialog').parentElement!;
    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title with correct id for aria-labelledby', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="My Title">Body</Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    const titleEl = document.getElementById(titleId!);
    expect(titleEl).toHaveTextContent('My Title');
  });

  it('has aria-modal="true"', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>Body</Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('portals content to document.body', () => {
    const { container } = render(
      <Dialog defaultOpen>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    // Dialog should not be inside the container, but in document.body
    const dialog = screen.getByRole('dialog');
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it('renders DialogFooter', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Test">
          Body
          <Dialog.Footer data-testid="footer">
            <button>OK</button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('calls onOpenChange when opened and closed', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog onOpenChange={onOpenChange}>
        <Dialog.Trigger>
          <button>Open</button>
        </Dialog.Trigger>
        <Dialog.Content title="Test">Body</Dialog.Content>
      </Dialog>,
    );
    await user.click(screen.getByText('Open'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
