import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from '../Accordion';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Accordion', () => {
  testForwardRef(Accordion, 'div');
  testRestSpread(Accordion);
  testClassName(Accordion);

  it('renders without crashing', () => {
    render(
      <Accordion data-testid="accordion">
        <Accordion.Item value="1">
          <Accordion.Trigger>Item 1</Accordion.Trigger>
          <Accordion.Panel>Panel 1</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getByTestId('accordion')).toBeInTheDocument();
  });

  it('renders trigger text', () => {
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>First Item</Accordion.Trigger>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getByText('First Item')).toBeInTheDocument();
  });

  it('panel is hidden by default', () => {
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item</Accordion.Trigger>
          <Accordion.Panel>Hidden content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('opens panel on click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Click me</Accordion.Trigger>
          <Accordion.Panel>Revealed</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Revealed')).toBeInTheDocument();
  });

  it('closes panel on second click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Toggle</Accordion.Trigger>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button');
    await user.click(button);
    expect(screen.getByText('Content')).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('single mode: only one item open at a time', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="single">
        <Accordion.Item value="1">
          <Accordion.Trigger>Item 1</Accordion.Trigger>
          <Accordion.Panel>Panel 1</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="2">
          <Accordion.Trigger>Item 2</Accordion.Trigger>
          <Accordion.Panel>Panel 2</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    await user.click(buttons[1]);
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
  });

  it('multiple mode: multiple items open at once', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="multiple">
        <Accordion.Item value="1">
          <Accordion.Trigger>Item 1</Accordion.Trigger>
          <Accordion.Panel>Panel 1</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="2">
          <Accordion.Trigger>Item 2</Accordion.Trigger>
          <Accordion.Panel>Panel 2</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
  });

  it('respects defaultOpenItems', () => {
    render(
      <Accordion defaultOpenItems={['2']}>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item 1</Accordion.Trigger>
          <Accordion.Panel>Panel 1</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="2">
          <Accordion.Trigger>Item 2</Accordion.Trigger>
          <Accordion.Panel>Panel 2</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.queryByText('Panel 1')).not.toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
  });

  it('controlled: respects openItems prop', () => {
    render(
      <Accordion openItems={['1']}>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item 1</Accordion.Trigger>
          <Accordion.Panel>Panel 1</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="2">
          <Accordion.Trigger>Item 2</Accordion.Trigger>
          <Accordion.Panel>Panel 2</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    expect(screen.queryByText('Panel 2')).not.toBeInTheDocument();
  });

  it('controlled: calls onOpenItemsChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Accordion openItems={[]} onOpenItemsChange={onChange}>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item 1</Accordion.Trigger>
          <Accordion.Panel>Panel 1</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    await user.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(['1']);
  });

  it('sets aria-expanded on trigger button', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item</Accordion.Trigger>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('panel has role="region"', async () => {
    const user = userEvent.setup();
    render(
      <Accordion>
        <Accordion.Item value="1">
          <Accordion.Trigger>Item</Accordion.Trigger>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});
