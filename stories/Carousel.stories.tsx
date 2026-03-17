import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Carousel } from '../src';

const meta = {
  title: 'Layout/Carousel',
  component: Carousel,
  argTypes: {
    autoPlay: { control: 'boolean' },
    autoPlayInterval: { control: 'number' },
    loop: { control: 'boolean' },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    autoPlay: false,
    loop: false,
  },
  render: (args) => (
    <Carousel {...args} style={{ width: 500, height: 250 }}>
      <Carousel.Item>
        <div style={{ background: '#f0f0f0', padding: 32, textAlign: 'center', height: 180 }}>
          <h3>Slide 1</h3>
          <p>First slide content</p>
        </div>
      </Carousel.Item>
      <Carousel.Item>
        <div style={{ background: '#e0e0e0', padding: 32, textAlign: 'center', height: 180 }}>
          <h3>Slide 2</h3>
          <p>Second slide content</p>
        </div>
      </Carousel.Item>
      <Carousel.Item>
        <div style={{ background: '#d0d0d0', padding: 32, textAlign: 'center', height: 180 }}>
          <h3>Slide 3</h3>
          <p>Third slide content</p>
        </div>
      </Carousel.Item>
    </Carousel>
  ),
};

export const WithLoop: Story = {
  args: { loop: true },
  render: (args) => (
    <Carousel {...args} style={{ width: 500, height: 250 }}>
      <Carousel.Item>
        <div style={{ background: '#dbeafe', padding: 32, textAlign: 'center', height: 180 }}>
          Slide A
        </div>
      </Carousel.Item>
      <Carousel.Item>
        <div style={{ background: '#dcfce7', padding: 32, textAlign: 'center', height: 180 }}>
          Slide B
        </div>
      </Carousel.Item>
      <Carousel.Item>
        <div style={{ background: '#fef3c7', padding: 32, textAlign: 'center', height: 180 }}>
          Slide C
        </div>
      </Carousel.Item>
    </Carousel>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = React.useState(0);
    return (
      <div>
        <p style={{ marginBottom: 8 }}>Active slide: {value + 1}</p>
        <Carousel value={value} onValueChange={setValue} style={{ width: 500, height: 250 }}>
          <Carousel.Item>
            <div style={{ background: '#f0f0f0', padding: 32, textAlign: 'center', height: 180 }}>
              Slide 1
            </div>
          </Carousel.Item>
          <Carousel.Item>
            <div style={{ background: '#e0e0e0', padding: 32, textAlign: 'center', height: 180 }}>
              Slide 2
            </div>
          </Carousel.Item>
        </Carousel>
      </div>
    );
  },
};
