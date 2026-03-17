import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabList } from '../TabList';
import { testSystemProps, testCompoundExposure } from '../../../test-utils';

describe('TabList', () => {
  testSystemProps(TabList, {
    expectedTag: 'div',
    displayName: 'TabList',
  });

  testCompoundExposure(TabList, ['Tab', 'Panel']);

  it('renders without crashing', () => {
    render(
      <TabList data-testid="tablist">
        <TabList.Tab value="a">Tab A</TabList.Tab>
      </TabList>,
    );
    expect(screen.getByTestId('tablist')).toBeInTheDocument();
  });

  it('renders tablist role', () => {
    render(
      <TabList>
        <TabList.Tab value="a">Tab A</TabList.Tab>
      </TabList>,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders tab with role="tab"', () => {
    render(
      <TabList>
        <TabList.Tab value="a">Tab A</TabList.Tab>
      </TabList>,
    );
    expect(screen.getByRole('tab')).toBeInTheDocument();
  });

  it('sets aria-orientation on tablist', () => {
    const { rerender } = render(
      <TabList>
        <TabList.Tab value="a">Tab A</TabList.Tab>
      </TabList>,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');

    rerender(
      <TabList vertical>
        <TabList.Tab value="a">Tab A</TabList.Tab>
      </TabList>,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
  });
});

describe('TabList - uncontrolled', () => {
  it('selects defaultSelectedValue', () => {
    render(
      <TabList defaultSelectedValue="b">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
      </TabList>,
    );
    expect(screen.getByText('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Tab A')).toHaveAttribute('aria-selected', 'false');
  });

  it('changes tab on click', async () => {
    const user = userEvent.setup();
    render(
      <TabList defaultSelectedValue="a">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
      </TabList>,
    );
    await user.click(screen.getByText('Tab B'));
    expect(screen.getByText('Tab B')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Tab A')).toHaveAttribute('aria-selected', 'false');
  });
});

describe('TabList - controlled', () => {
  it('respects selectedValue prop', () => {
    render(
      <TabList selectedValue="b">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
      </TabList>,
    );
    expect(screen.getByText('Tab B')).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onTabSelect when tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList selectedValue="a" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
      </TabList>,
    );
    await user.click(screen.getByText('Tab B'));
    expect(onTabSelect).toHaveBeenCalledWith('b');
  });
});

describe('TabList.Panel', () => {
  it('renders active panel', () => {
    render(
      <TabList defaultSelectedValue="a">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a">Panel A content</TabList.Panel>
        <TabList.Panel value="b">Panel B content</TabList.Panel>
      </TabList>,
    );
    expect(screen.getByText('Panel A content')).toBeInTheDocument();
    expect(screen.queryByText('Panel B content')).not.toBeInTheDocument();
  });

  it('panel has role="tabpanel"', () => {
    render(
      <TabList defaultSelectedValue="a">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Panel value="a">Content</TabList.Panel>
      </TabList>,
    );
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('switches panel on tab click', async () => {
    const user = userEvent.setup();
    render(
      <TabList defaultSelectedValue="a">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a">Panel A</TabList.Panel>
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </TabList>,
    );
    await user.click(screen.getByText('Tab B'));
    expect(screen.queryByText('Panel A')).not.toBeInTheDocument();
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });

  it('panel has correct aria-labelledby', () => {
    render(
      <TabList defaultSelectedValue="test">
        <TabList.Tab value="test">Test Tab</TabList.Tab>
        <TabList.Panel value="test">Test Content</TabList.Panel>
      </TabList>,
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-test');
    expect(panel).toHaveAttribute('id', 'tabpanel-test');
  });

  it('active tab has aria-controls, inactive tab does not', () => {
    render(
      <TabList defaultSelectedValue="a">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Panel value="a">Panel A</TabList.Panel>
        <TabList.Panel value="b">Panel B</TabList.Panel>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-controls', 'tabpanel-a');
    expect(tabs[1]).not.toHaveAttribute('aria-controls');
  });

  it('panel has tabIndex 0 for keyboard access', () => {
    render(
      <TabList defaultSelectedValue="a">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Panel value="a">Content</TabList.Panel>
      </TabList>,
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');
  });
});

describe('TabList - vertical', () => {
  it('renders vertical layout', () => {
    render(
      <TabList vertical>
        <TabList.Tab value="a">Tab A</TabList.Tab>
      </TabList>,
    );
    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toContain('flex-col');
    expect(tablist.className).toContain('border-r');
  });
});

describe('TabList - roving tabindex', () => {
  it('only the selected tab has tabIndex 0', () => {
    render(
      <TabList defaultSelectedValue="b">
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c">Tab C</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '-1');
    expect(tabs[1]).toHaveAttribute('tabindex', '0');
    expect(tabs[2]).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight moves focus and selects next tab (horizontal)', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList defaultSelectedValue="a" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c">Tab C</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(onTabSelect).toHaveBeenCalledWith('b');
    expect(tabs[1]).toHaveFocus();
  });

  it('ArrowLeft moves focus to previous tab', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList defaultSelectedValue="b" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c">Tab C</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[1].focus();
    await user.keyboard('{ArrowLeft}');
    expect(onTabSelect).toHaveBeenCalledWith('a');
    expect(tabs[0]).toHaveFocus();
  });

  it('ArrowDown/ArrowUp navigates in vertical mode', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList vertical defaultSelectedValue="a" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(onTabSelect).toHaveBeenCalledWith('b');
    expect(tabs[1]).toHaveFocus();
  });

  it('wraps from last to first tab', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList defaultSelectedValue="c" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c">Tab C</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[2].focus();
    await user.keyboard('{ArrowRight}');
    expect(onTabSelect).toHaveBeenCalledWith('a');
    expect(tabs[0]).toHaveFocus();
  });

  it('wraps in vertical mode (ArrowDown from last)', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList vertical defaultSelectedValue="c" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c">Tab C</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[2].focus();
    await user.keyboard('{ArrowDown}');
    expect(onTabSelect).toHaveBeenCalledWith('a');
    expect(tabs[0]).toHaveFocus();
  });

  it('Home moves to first tab', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList defaultSelectedValue="c" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c">Tab C</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[2].focus();
    await user.keyboard('{Home}');
    expect(onTabSelect).toHaveBeenCalledWith('a');
    expect(tabs[0]).toHaveFocus();
  });

  it('End moves to last tab', async () => {
    const user = userEvent.setup();
    const onTabSelect = vi.fn();
    render(
      <TabList defaultSelectedValue="a" onTabSelect={onTabSelect}>
        <TabList.Tab value="a">Tab A</TabList.Tab>
        <TabList.Tab value="b">Tab B</TabList.Tab>
        <TabList.Tab value="c">Tab C</TabList.Tab>
      </TabList>,
    );
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    await user.keyboard('{End}');
    expect(onTabSelect).toHaveBeenCalledWith('c');
    expect(tabs[2]).toHaveFocus();
  });
});
