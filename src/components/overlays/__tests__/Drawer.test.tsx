import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from '../Drawer';
describe('Drawer', () => {
  it('does not render when closed', () => {
    render(<Drawer>Content</Drawer>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when defaultOpen is true', () => {
    render(<Drawer defaultOpen>Content</Drawer>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('is controlled via open prop', () => {
    const { rerender } = render(<Drawer open={false}>Content</Drawer>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<Drawer open={true}>Content</Drawer>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <Drawer defaultOpen title="Drawer Title">
        Content
      </Drawer>,
    );
    expect(screen.getByText('Drawer Title')).toBeInTheDocument();
  });

  it('has aria-modal="true"', () => {
    render(<Drawer defaultOpen>Content</Drawer>);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby when title is provided', () => {
    render(
      <Drawer defaultOpen title="My Drawer">
        Content
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)!.textContent).toBe('My Drawer');
  });

  it('closes on ESC key', async () => {
    const user = userEvent.setup();
    render(<Drawer defaultOpen>Content</Drawer>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const user = userEvent.setup();
    render(<Drawer defaultOpen>Content</Drawer>);
    const backdrop = screen.getByRole('dialog').parentElement!;
    await user.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Drawer defaultOpen>Content</Drawer>);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies right position classes by default', () => {
    render(<Drawer defaultOpen>Content</Drawer>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('right-0');
  });

  it('applies left position classes', () => {
    render(
      <Drawer defaultOpen position="left">
        Content
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('left-0');
  });

  it('portals content to document.body', () => {
    const { container } = render(<Drawer defaultOpen>Content</Drawer>);
    const dialog = screen.getByRole('dialog');
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it('calls onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        Content
      </Drawer>,
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('forwards ref', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Drawer defaultOpen ref={ref}>
        Content
      </Drawer>,
    );
    expect(ref.current).toBe(screen.getByRole('dialog'));
  });
});
