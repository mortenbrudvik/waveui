import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Carousel } from '../src';
import type { CarouselProps } from '../src';

const slideClass =
  'flex h-44 flex-col items-center justify-center gap-2 rounded-md text-center text-body-1';

const neutralSlides = [
  <Carousel.Item key="1">
    <div className={`${slideClass} bg-muted text-foreground`}>
      <h3 className="text-subtitle-2">Slide 1</h3>
      <p>First slide content</p>
    </div>
  </Carousel.Item>,
  <Carousel.Item key="2">
    <div className={`${slideClass} bg-card text-card-foreground border border-border`}>
      <h3 className="text-subtitle-2">Slide 2</h3>
      <p>Second slide content</p>
    </div>
  </Carousel.Item>,
  <Carousel.Item key="3">
    <div className={`${slideClass} bg-selected text-selected-foreground`}>
      <h3 className="text-subtitle-2">Slide 3</h3>
      <p>Third slide content</p>
    </div>
  </Carousel.Item>,
];

const tintedSlides = [
  <Carousel.Item key="a">
    <div className={`${slideClass} bg-info-tint text-info-tint-foreground`}>Slide A</div>
  </Carousel.Item>,
  <Carousel.Item key="b">
    <div className={`${slideClass} bg-success-tint text-success-tint-foreground`}>Slide B</div>
  </Carousel.Item>,
  <Carousel.Item key="c">
    <div className={`${slideClass} bg-warning-tint text-warning-tint-foreground`}>Slide C</div>
  </Carousel.Item>,
];

const meta = {
  title: 'Components/Layout/Carousel',
  component: Carousel,
  args: {
    'aria-label': 'Featured content',
    autoPlay: false,
    autoPlayInterval: 5000,
    loop: false,
    onValueChange: fn(),
    className: 'w-full max-w-lg',
    children: neutralSlides,
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLoop: Story = {
  args: { loop: true, children: tintedSlides },
};

/**
 * Rotates every 4 seconds. The Pause/Start control comes first; rotation pauses while focus is
 * inside the carousel (the control included; in most browsers a click on Previous, Next or a dot
 * also leaves focus there) or the pointer is over its content, and starts paused under reduced
 * motion. Activating Start rotates at once.
 */
export const AutoPlay: Story = {
  args: { autoPlay: true, loop: true, autoPlayInterval: 4000, children: tintedSlides },
};

/**
 * Without `loop`, rotation ends at the last slide; the control then offers Start. Rotation stays
 * stopped when the user moves back to an earlier slide; only Start resumes it (from the first
 * slide while the last one is shown). Slides added later, or turning `loop` on, let it continue.
 */
export const AutoPlayOnce: Story = {
  args: { autoPlay: true, autoPlayInterval: 3000, children: tintedSlides },
};

/**
 * The direction comes from the rendered element, so an RTL section needs neither a WaveProvider
 * `dir` nor a `dir` prop: slides move right-to-left and the arrows are mirrored.
 */
export const RightToLeftSection: Story = {
  args: { children: tintedSlides },
  render: (args) => (
    <div dir="rtl">
      <Carousel {...args} />
    </div>
  ),
};

/**
 * `labels` translates the names of Previous, Next, the slide picker and the slides (also what the
 * live region announces), and `autoPlayLabels` those of the rotation control. `lang` marks the
 * carousel's language for screen readers.
 */
export const Localized: Story = {
  args: {
    'aria-label': 'Angebote',
    lang: 'de',
    autoPlay: true,
    loop: true,
    autoPlayLabels: { pause: 'Rotation anhalten', play: 'Rotation starten' },
    labels: {
      previous: 'Vorherige Folie',
      next: 'Nächste Folie',
      picker: 'Folie auswählen',
      slide: (index, total) => `Folie ${index + 1} von ${total}`,
    },
    children: tintedSlides,
  },
};

/** Controls inside inactive slides are `inert`: Tab reaches only the visible slide's action. */
export const InteractiveSlides: Story = {
  args: {
    children: ['Plan', 'Build', 'Ship'].map((step) => (
      <Carousel.Item key={step}>
        <div className={`${slideClass} bg-muted text-foreground`}>
          <h3 className="text-subtitle-2">{step}</h3>
          <Button appearance="primary">Learn about {step.toLowerCase()}</Button>
        </div>
      </Carousel.Item>
    )),
  },
};

function ControlledCarousel(args: CarouselProps) {
  const { onValueChange } = args;
  const [value, setValue] = React.useState(0);
  return (
    <div>
      <p className="mb-2 text-body-1 text-foreground">Active slide: {value + 1}</p>
      <Carousel
        {...args}
        value={value}
        onValueChange={(index) => {
          setValue(index);
          onValueChange?.(index);
        }}
      />
    </div>
  );
}

export const Controlled: Story = {
  render: (args) => <ControlledCarousel {...args} />,
};
