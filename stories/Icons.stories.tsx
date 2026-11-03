import type { Meta, StoryObj } from '@storybook/react';
import {
  AddIcon,
  Button,
  CalendarIcon,
  CheckIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
  DismissIcon,
  ErrorIcon,
  InfoIcon,
  NavigationIcon,
  PersonIcon,
  PresenceAvailableIcon,
  PresenceAwayIcon,
  PresenceBlockedIcon,
  PresenceBusyIcon,
  PresenceDndIcon,
  PresenceOfflineIcon,
  PresenceOofIcon,
  PresenceUnknownIcon,
  SearchIcon,
  SortArrowDownIcon,
  SortArrowUpIcon,
  StarIcon,
  SubtractIcon,
  SuccessIcon,
  WarningIcon,
  flipIconInRtl,
} from '../src';
import type { IconComponent } from '../src';

const GLYPHS: ReadonlyArray<readonly [name: string, Icon: IconComponent]> = [
  ['DismissIcon', DismissIcon],
  ['AddIcon', AddIcon],
  ['SubtractIcon', SubtractIcon],
  ['CheckIcon', CheckIcon],
  ['SearchIcon', SearchIcon],
  ['NavigationIcon', NavigationIcon],
  ['ChevronDownIcon', ChevronDownIcon],
  ['ChevronUpIcon', ChevronUpIcon],
  ['ChevronLeftIcon', ChevronLeftIcon],
  ['ChevronRightIcon', ChevronRightIcon],
  ['ChevronDoubleLeftIcon', ChevronDoubleLeftIcon],
  ['ChevronDoubleRightIcon', ChevronDoubleRightIcon],
  ['SortArrowUpIcon', SortArrowUpIcon],
  ['SortArrowDownIcon', SortArrowDownIcon],
  ['CalendarIcon', CalendarIcon],
  ['ClockIcon', ClockIcon],
  ['StarIcon', StarIcon],
  ['PersonIcon', PersonIcon],
  ['InfoIcon', InfoIcon],
  ['SuccessIcon', SuccessIcon],
  ['WarningIcon', WarningIcon],
  ['ErrorIcon', ErrorIcon],
  ['PresenceAvailableIcon', PresenceAvailableIcon],
  ['PresenceBusyIcon', PresenceBusyIcon],
  ['PresenceAwayIcon', PresenceAwayIcon],
  ['PresenceOfflineIcon', PresenceOfflineIcon],
  ['PresenceDndIcon', PresenceDndIcon],
  ['PresenceOofIcon', PresenceOofIcon],
  ['PresenceBlockedIcon', PresenceBlockedIcon],
  ['PresenceUnknownIcon', PresenceUnknownIcon],
];

const meta = {
  title: 'Guides/Icons',
  parameters: {
    docs: {
      description: {
        component:
          "The glyphs WaveUI's own components draw, exported for your own use. Each is an SVG component that paints with `currentColor`, takes `size` and `title`, is hidden from assistive technology unless it has a `title`, and carries a stable `data-wave-icon` name. A glyph that points along the reading direction takes `flipInRtl`; for an icon of another library use `flipIconInRtl`. The direction toolbar shows the flip.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every exported glyph with its export name. */
export const Gallery: Story = {
  render: () => (
    <ul className="grid max-w-3xl grid-cols-2 gap-4 p-6 sm:grid-cols-3">
      {GLYPHS.map(([name, Icon]) => (
        <li key={name} className="flex items-center gap-3 text-wave-caption-1">
          <Icon size={24} />
          <code>{name}</code>
        </li>
      ))}
    </ul>
  ),
};

/**
 * Mirroring in a right-to-left layout (switch the direction toolbar): the first chevron and the
 * Next button's arrow, an icon of your own made directional with `flipIconInRtl`, face the other way
 * under `dir="rtl"`; the second chevron does not flip.
 */
export const FlipInRtl: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-6">
      <span className="flex items-center gap-2 text-wave-body-1">
        <ChevronRightIcon size={24} flipInRtl />
        flipInRtl
      </span>
      <span className="flex items-center gap-2 text-wave-body-1">
        <ChevronRightIcon size={24} />
        fixed
      </span>
      <Button icon={flipIconInRtl(<ChevronRightIcon size={16} />)} iconPosition="after">
        Next
      </Button>
    </div>
  ),
};
