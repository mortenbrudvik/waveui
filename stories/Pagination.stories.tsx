import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Pagination } from '../src';
import type { PaginationItemType } from '../src';

const meta = {
  title: 'Components/Navigation/Pagination',
  component: Pagination,
  args: {
    totalPages: 10,
    siblingCount: 1,
    boundaryCount: 1,
    showPreviousNext: true,
    showFirstLast: false,
    disabled: false,
    size: 'medium',
    onPageChange: fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['small', 'medium'] },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ManyPages: Story = {
  args: {
    totalPages: 50,
    defaultCurrentPage: 25,
  },
};

export const SmallSize: Story = {
  args: {
    size: 'small',
  },
};

/** First/Last buttons; at a boundary they stay focusable with `aria-disabled`. */
export const WithFirstLast: Story = {
  args: {
    totalPages: 20,
    showFirstLast: true,
    defaultCurrentPage: 10,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultCurrentPage: 3,
  },
};

const norwegianLabels = (type: PaginationItemType, page: number, selected: boolean): string => {
  switch (type) {
    case 'first':
      return 'Første side';
    case 'previous':
      return 'Forrige side';
    case 'next':
      return 'Neste side';
    case 'last':
      return 'Siste side';
    default:
      return selected ? `Side ${page}, gjeldende side` : `Side ${page}`;
  }
};

/**
 * Localized button names with `getItemAriaLabel`, and the landmark name with `aria-label`. `lang`
 * marks the pagination as Norwegian Bokmål, so screen readers pronounce its names as Norwegian.
 */
export const Localized: Story = {
  args: {
    'aria-label': 'Sidenavigasjon',
    lang: 'nb',
    showFirstLast: true,
    getItemAriaLabel: norwegianLabels,
  },
};

export const Controlled: Story = {
  render: ({ onPageChange, ...args }) => {
    const [page, setPage] = React.useState(3);
    return (
      <div className="flex flex-col gap-4">
        <Pagination
          currentPage={page}
          onPageChange={(next) => {
            setPage(next);
            onPageChange?.(next);
          }}
          {...args}
        />
        <p className="text-body-1">Current page: {page}</p>
      </div>
    );
  },
};
