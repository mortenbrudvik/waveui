import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Overflow, OverflowItem } from '../src';

const meta = {
  title: 'Components/Layout/Overflow',
  component: Overflow,
} satisfies Meta<typeof Overflow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: 400 }}>
      <Overflow
        overflowButton={(count) => (
          <button className="px-3 py-1 text-body-1 rounded bg-[#f0f0f0] hover:bg-[#e0e0e0]">
            +{count} more
          </button>
        )}
      >
        {['Home', 'Products', 'Services', 'About', 'Blog', 'Contact', 'Careers'].map((item) => (
          <OverflowItem key={item} itemId={item}>
            <button className="px-3 py-1.5 text-body-1 rounded hover:bg-[#f0f0f0] whitespace-nowrap">
              {item}
            </button>
          </OverflowItem>
        ))}
      </Overflow>
    </div>
  ),
};

export const NarrowContainer: Story = {
  render: () => (
    <div style={{ width: 200 }}>
      <Overflow
        overflowButton={(count) => (
          <button className="px-2 py-1 text-caption-1 rounded bg-[#f0f0f0]">+{count}</button>
        )}
      >
        {['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((item) => (
          <OverflowItem key={item} itemId={item}>
            <span className="px-2 py-1 text-body-1 whitespace-nowrap">{item}</span>
          </OverflowItem>
        ))}
      </Overflow>
    </div>
  ),
};
