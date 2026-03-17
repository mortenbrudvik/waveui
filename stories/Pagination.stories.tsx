import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Pagination } from '../src';

const meta = {
  title: 'Components/Navigation/Pagination',
  component: Pagination,
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    totalPages: 10,
  },
};

export const ManyPages: Story = {
  args: {
    totalPages: 50,
    defaultCurrentPage: 25,
  },
};

export const SmallSize: Story = {
  args: {
    totalPages: 10,
    size: 'small',
  },
};

export const WithFirstLast: Story = {
  args: {
    totalPages: 20,
    showFirstLast: true,
    defaultCurrentPage: 10,
  },
};

export const Controlled: Story = {
  render: () => {
    const [page, setPage] = React.useState(3);
    return (
      <div className="flex flex-col gap-4">
        <Pagination totalPages={10} currentPage={page} onPageChange={setPage} />
        <p className="text-body-1">Current page: {page}</p>
      </div>
    );
  },
};
