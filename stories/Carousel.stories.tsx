import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Carousel } from '../src';
import type { CarouselMotion, CarouselProps } from '../src';

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
    motion: 'slide',
    motionDuration: 300,
    onValueChange: fn(),
    className: 'w-full max-w-lg',
    children: neutralSlides,
  },
  argTypes: {
    motion: {
      control: 'inline-radio',
      options: ['slide', 'fade'] satisfies readonly CarouselMotion[],
    },
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

const manySlides = Array.from({ length: 7 }, (_, i) => (
  <Carousel.Item key={i}>
    <div className={`${slideClass} bg-muted text-foreground`}>Slide {i + 1}</div>
  </Carousel.Item>
));

// A tiny grey picture for each thumbnail.
const thumbColors = ['gray', 'slategray', 'dimgray', 'darkgray', 'lightslategray'];
const thumbnail = (n: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="${thumbColors[n % 5]}"/></svg>`)}`; // wave-allow-color: fixture

const thumbSlides = Array.from({ length: 5 }, (_, i) => (
  <Carousel.Item key={i} thumbnail={thumbnail(i + 1)}>
    <div className={`${slideClass} bg-muted text-foreground`}>Slide {i + 1}</div>
  </Carousel.Item>
));

/** `groupSize` shows several slides at once; paging, the picker and autoplay move by page. */
export const Groups: Story = {
  args: { groupSize: 3, children: manySlides },
};

/** `groupSize="auto"` shows as many slides as fit; they keep their own width. */
export const AutoSize: Story = {
  args: {
    groupSize: 'auto',
    align: 'center',
    children: manySlides.map((slide, i) => (
      <Carousel.Item key={i}>
        <div className={`${slideClass} w-40 bg-card text-card-foreground border border-border`}>
          Slide {i + 1}
        </div>
      </Carousel.Item>
    )),
  },
};

/** Drag with a mouse, finger or pen; a vertical swipe still scrolls the page. */
export const Draggable: Story = {
  args: { draggable: true, groupSize: 2, children: manySlides },
};

/** A `thumbnail` on a slide turns the picker into a row of thumbnails. */
export const Thumbnails: Story = {
  args: { children: thumbSlides },
};

/** Where the Previous and Next buttons go. */
export const ControlsLayouts: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(['overlay', 'overlay-wide', 'inline', 'inline-wide'] as const).map((controlsLayout) => (
        <Carousel
          key={controlsLayout}
          {...args}
          controlsLayout={controlsLayout}
          aria-label={controlsLayout}
          autoPlay
        >
          {neutralSlides}
        </Carousel>
      ))}
    </div>
  ),
};

/** `Carousel.Button` replaces the built-in button of its direction with your own glyph. */
export const CustomButtons: Story = {
  render: (args) => (
    <Carousel {...args} controlsLayout="inline">
      {neutralSlides}
      <Carousel.Button direction="previous">‹</Carousel.Button>
      <Carousel.Button direction="next">›</Carousel.Button>
    </Carousel>
  ),
};

export const Elevated: Story = {
  args: { appearance: 'elevated' },
};

/** The cases of the Motion story: its name, `motion` and `motionDuration`. */
const carouselMotions: ReadonlyArray<{
  label: string;
  motion: CarouselMotion | null;
  motionDuration?: number;
}> = [
  { label: 'Slide, the default', motion: 'slide' },
  { label: 'Fade', motion: 'fade' },
  { label: 'No motion', motion: null },
  { label: 'Slide over 800ms', motion: 'slide', motionDuration: 800 },
];

/**
 * `motion` and `motionDuration`. `slide` (the default) glides the slides in from the side of the
 * page order, mirrored in right-to-left layouts; `fade` cross-fades them in place (one slide per
 * page; with `groupSize` above 1 they slide, with a development warning); `null` changes the page
 * at once. `motionDuration` is in milliseconds (300 by default; Fluent's `duration` is another
 * unit). The root renders the motion as `data-motion`. Under reduced motion every carousel
 * changes its page at once (and one with `autoPlay` starts stopped).
 */
export const Motion: Story = {
  render: ({ motion: _motion, motionDuration, ...args }) => (
    <div className="flex flex-col gap-6">
      {carouselMotions.map((option) => (
        // The story renders one carousel per case; every other arg is forwarded.
        <Carousel
          key={option.label}
          {...args}
          aria-label={option.label}
          motion={option.motion}
          motionDuration={option.motionDuration ?? motionDuration}
        >
          {tintedSlides}
        </Carousel>
      ))}
    </div>
  ),
};
