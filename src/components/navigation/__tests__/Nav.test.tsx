import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from '../Nav';
import { testSystemProps, testCompoundExposure } from '../../../test-utils';

describe('Nav', () => {
  testSystemProps(Nav, {
    expectedTag: 'nav',
    displayName: 'Nav',
  });

  testCompoundExposure(Nav, ['Category', 'Item', 'SubItem']);

  it('renders without crashing', () => {
    render(
      <Nav data-testid="nav">
        <Nav.Item value="home">Home</Nav.Item>
      </Nav>,
    );
    expect(screen.getByTestId('nav')).toBeInTheDocument();
  });

  it('has navigation aria-label', () => {
    render(<Nav data-testid="nav" />);
    expect(screen.getByTestId('nav')).toHaveAttribute('aria-label', 'Navigation');
  });

  it('renders nav items', () => {
    render(
      <Nav>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="settings">Settings</Nav.Item>
      </Nav>,
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('selects an item on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Nav onNavItemSelect={onSelect}>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="settings">Settings</Nav.Item>
      </Nav>,
    );
    await user.click(screen.getByText('Home'));
    expect(onSelect).toHaveBeenCalledWith('home');
  });

  it('sets aria-current on selected item', async () => {
    const user = userEvent.setup();
    render(
      <Nav defaultSelectedValue="">
        <Nav.Item value="home">Home</Nav.Item>
      </Nav>,
    );
    const btn = screen.getByText('Home').closest('button')!;
    expect(btn).not.toHaveAttribute('aria-current');
    await user.click(btn);
    expect(btn).toHaveAttribute('aria-current', 'page');
  });

  it('controlled: respects selectedValue prop', () => {
    render(
      <Nav selectedValue="settings">
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="settings">Settings</Nav.Item>
      </Nav>,
    );
    const settingsBtn = screen.getByText('Settings').closest('button')!;
    expect(settingsBtn).toHaveAttribute('aria-current', 'page');
  });

  it('renders collapsible NavCategory', async () => {
    const user = userEvent.setup();
    render(
      <Nav>
        <Nav.Category value="docs">
          Docs
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    // Category should show label
    expect(screen.getByText('Docs')).toBeInTheDocument();
    // Sub-items hidden by default
    expect(screen.queryByText('Introduction')).not.toBeInTheDocument();
    // Click to expand
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Introduction')).toBeInTheDocument();
  });

  it('collapses NavCategory on second click', async () => {
    const user = userEvent.setup();
    render(
      <Nav>
        <Nav.Category value="docs">
          Docs
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    const toggle = screen.getByRole('button', { expanded: false });
    await user.click(toggle);
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByText('Introduction')).not.toBeInTheDocument();
  });

  it('NavSubItem triggers selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Nav onNavItemSelect={onSelect}>
        <Nav.Category value="docs">
          Docs
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    // Expand the category
    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByText('Introduction'));
    expect(onSelect).toHaveBeenCalledWith('intro');
  });
});
