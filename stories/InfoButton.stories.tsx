import type { Meta, StoryObj } from '@storybook/react';
import { InfoButton, type InfoButtonProps } from '../src/components/data-display/InfoButton';

const meta = {
  title: 'Components/Data Display/InfoButton',
  component: InfoButton,
  args: {
    info: 'Charges appear on the first of the month.',
  },
} satisfies Meta<typeof InfoButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NextToAHeading: Story = {
  render: (args: InfoButtonProps) => (
    <div className="flex items-center gap-1">
      <h2 id="billing-heading" className="text-subtitle-2">
        Billing
      </h2>
      <InfoButton
        {...args}
        id="billing-info"
        aria-labelledby="billing-heading billing-info"
        info="Charges appear on the first of the month."
      />
    </div>
  ),
};
