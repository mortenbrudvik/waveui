import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';
import { testSystemProps } from '../../../test-utils';

describe('Tooltip', () => {
  testSystemProps(Tooltip, {
    expectedTag: 'span',
    displayName: 'Tooltip',
    defaultProps: { content: 'tip', children: <span>target</span> },
  });

  it('does not show tooltip by default', () => {
    render(
      <Tooltip content="Tooltip text">
        <span>Hover me</span>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on hover after delay', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <span>Hover me</span>
      </Tooltip>,
    );
    await user.hover(screen.getByText('Hover me'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Tooltip text');
    });
  });

  it('hides tooltip on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <span>Hover me</span>
      </Tooltip>,
    );
    await user.hover(screen.getByText('Hover me'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
    await user.unhover(screen.getByText('Hover me'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('applies dark variant by default', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip" delay={0}>
        <span>Target</span>
      </Tooltip>,
    );
    await user.hover(screen.getByText('Target'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip').className).toContain('bg-[#242424]');
    });
  });

  it('applies light variant', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip" variant="light" delay={0}>
        <span>Target</span>
      </Tooltip>,
    );
    await user.hover(screen.getByText('Target'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip').className).toContain('bg-white');
    });
  });

  it('sets aria-describedby on child when visible', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tip" delay={0}>
        <span>Target</span>
      </Tooltip>,
    );
    await user.hover(screen.getByText('Target'));
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      const tooltipId = tooltip.getAttribute('id');
      expect(screen.getByText('Target')).toHaveAttribute('aria-describedby', tooltipId);
    });
  });
});
