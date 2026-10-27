import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  Breadcrumb,
  Tooltip,
  isTruncatableBreadcrumbContent,
  truncateBreadcrumbLongName,
  truncateBreadcrumbLongTooltip,
} from '../src';

const meta = {
  title: 'Components/Navigation/Breadcrumb',
  component: Breadcrumb,
  args: {
    children: [
      <Breadcrumb.Item key="home" href="#">
        Home
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="products" href="#">
        Products
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="details" current>
        Details
      </Breadcrumb.Item>,
    ],
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Icons are decorative (`aria-hidden`), so they are not part of the link names. */
export const WithIcons: Story = {
  args: {
    children: [
      <Breadcrumb.Item key="home" href="#" icon={{ children: '🏠' }}>
        Home
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="documents" href="#" icon={{ children: '📁' }}>
        Documents
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="report" current icon={{ children: '📄' }}>
        Report.pdf
      </Breadcrumb.Item>,
    ],
  },
};

export const CurrentItem: Story = {
  args: {
    children: [
      <Breadcrumb.Item key="dashboard" href="#">
        Dashboard
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="settings" href="#">
        Settings
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="account" href="#">
        Account
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="profile" current>
        Profile
      </Breadcrumb.Item>,
    ],
  },
};

/** Items without `href` but with `onClick` render as buttons (in-app navigation without URLs). */
export const WithButtons: Story = {
  args: {
    children: [
      <Breadcrumb.Item key="home" onClick={fn()}>
        Home
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="library" onClick={fn()}>
        Library
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="album" current>
        Album
      </Breadcrumb.Item>,
    ],
  },
};

const TRAIL = ['Home', 'Library', 'Reports', '2026', 'Quarterly', 'Northern region', 'Summary'];

/** A trail of links that ends in the current page. */
function trail(labels: readonly string[] = TRAIL) {
  return labels.map((label, index) =>
    index === labels.length - 1 ? (
      <Breadcrumb.Item key={label} current>
        {label}
      </Breadcrumb.Item>
    ) : (
      <Breadcrumb.Item key={label} href="#">
        {label}
      </Breadcrumb.Item>
    ),
  );
}

/**
 * `maxDisplayedItems` shows that many items and collapses the rest, from `overflowIndex` (1 by
 * default, so the first item stays), into a "…" button that opens a menu of them. The first item
 * and the current page never collapse.
 */
export const CollapsedTrail: Story = {
  args: {
    maxDisplayedItems: 4,
    children: trail(),
  },
};

/** `overflowIndex` moves the collapse: here the first two items stay before the "…" button. */
export const CollapseFromIndex: Story = {
  args: {
    maxDisplayedItems: 5,
    overflowIndex: 2,
    overflowLabel: 'Hidden levels',
    children: trail(),
  },
};

/**
 * `overflow="auto"` fits the trail to its room instead: drag the corner of the frame to resize
 * it. The middle items that do not fit collapse into the "…" button, from the start of the trail.
 */
export const ResponsiveTrail: Story = {
  args: {
    overflow: 'auto',
    children: trail(),
  },
  render: (args) => (
    <div className="w-[360px] max-w-full min-w-40 resize-x overflow-hidden rounded border border-border">
      <Breadcrumb {...args} />
    </div>
  ),
};

/** `size` sets the text step and the separator size of the trail. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(['small', 'medium', 'large'] as const).map((size) => (
        <Breadcrumb key={size} {...args} size={size} aria-label={`Breadcrumb, ${size}`}>
          {trail(TRAIL.slice(0, 4))}
        </Breadcrumb>
      ))}
    </div>
  ),
};

/**
 * `focusMode="arrow"` makes the trail one Tab stop: it returns to the last focused link, and the
 * arrow keys, Home and End move between the links and the "…" button.
 */
export const ArrowKeyFocus: Story = {
  args: {
    focusMode: 'arrow',
    maxDisplayedItems: 4,
    children: trail(),
  },
};

/**
 * `divider` replaces the chevron with any content (it is decorative and not mirrored in
 * right-to-left layouts); `false` hides the separators.
 */
export const CustomDivider: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Breadcrumb {...args} aria-label="Breadcrumb, slash divider" divider="/">
        {trail(TRAIL.slice(0, 4))}
      </Breadcrumb>
      <Breadcrumb {...args} aria-label="Breadcrumb, no divider" divider={false}>
        {trail(TRAIL.slice(0, 4))}
      </Breadcrumb>
    </div>
  ),
};

const LONG_NAME = 'Quarterly financial results for the northern sales region';

/**
 * Long names are cut with `truncateBreadcrumbLongName` and the full text moves to a Tooltip
 * (`truncateBreadcrumbLongTooltip` limits the tooltip itself) when
 * `isTruncatableBreadcrumbContent` says the name is cut. Keep a Tooltip-wrapped item out of the
 * collapsed part of the trail: a wrapped item cannot be listed in the overflow menu.
 */
export const TruncatedNamesWithTooltip: Story = {
  render: (args) => {
    const truncated = isTruncatableBreadcrumbContent(LONG_NAME, 30);
    const link = (
      <Breadcrumb.Item href="#">{truncateBreadcrumbLongName(LONG_NAME)}</Breadcrumb.Item>
    );
    return (
      <Breadcrumb {...args}>
        <Breadcrumb.Item href="#">Home</Breadcrumb.Item>
        {truncated ? (
          <Tooltip content={truncateBreadcrumbLongTooltip(LONG_NAME)}>{link}</Tooltip>
        ) : (
          link
        )}
        <Breadcrumb.Item current>Summary</Breadcrumb.Item>
      </Breadcrumb>
    );
  },
};
