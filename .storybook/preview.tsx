import * as React from 'react';
import type { Preview } from '@storybook/react';
import { WaveProvider } from '../src/components/provider/WaveProvider';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#292929' },
        { name: 'grey', value: '#f5f5f5' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <WaveProvider theme="light">
        <Story />
      </WaveProvider>
    ),
  ],
};

export default preview;
