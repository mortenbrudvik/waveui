import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Button,
  Dialog,
  Popover,
  Toaster,
  useFocusVisible,
  useFocusableGroup,
  useRovingTabIndex,
  useToastController,
} from '../src';
import { AppStatusRegion, CommandPalette, CustomPopup } from './CustomOverlays.fixtures';

const meta = {
  title: 'Components/Overlays/Custom overlays',
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function NotifyButton() {
  const { dispatchToast } = useToastController();
  return <Button onClick={() => dispatchToast({ title: 'Saved', timeout: 0 })}>Notify</Button>;
}

/** A popup placed and dismissed by the public hooks; a Popover opened inside it is its child layer. */
export const PopupOnPublicHooks: Story = {
  name: 'Popup on the public hooks',
  render: () => (
    <Toaster>
      <div className="p-8">
        <NotifyButton />{' '}
        <CustomPopup label="Details">
          <Popover>
            <Popover.Trigger>
              <Button>More</Button>
            </Popover.Trigger>
            <Popover.Content aria-label="More details">Escape closes this first.</Popover.Content>
          </Popover>
        </CustomPopup>
      </div>
    </Toaster>
  ),
};

/** A popup whose anchor scrolls: it flips to a fallback placement and hides while the anchor is clipped. */
export const FlipAndHideWhenDetached: Story = {
  name: 'Fallback placements and hide when detached',
  render: () => (
    <div
      className="h-64 overflow-auto rounded-md border border-border p-4"
      role="region"
      aria-label="Scrolling page"
      tabIndex={0}
    >
      <div className="h-24" />
      <CustomPopup
        label="Anchored"
        positioning={{ fallbackPlacements: [{ side: 'end' }, { side: 'top' }] }}
        hideWhenDetached
      >
        Scroll the page: this popup hides while its button is out of view.
      </CustomPopup>
      <div className="h-[60rem]" />
    </div>
  ),
};

/** A Popover limited to the space the viewport leaves: long content scrolls inside the border. */
export const FitViewportPopover: Story = {
  name: 'Popover fitted to the viewport',
  render: () => (
    <div className="flex h-72 items-end p-4">
      <Popover defaultOpen positioning={{ fitViewport: true }}>
        <Popover.Trigger>
          <Button>Terms</Button>
        </Popover.Trigger>
        <Popover.Content title="Terms">
          {Array.from({ length: 24 }, (_, index) => (
            <p key={index}>Clause {index + 1}: the long text scrolls inside the popover.</p>
          ))}
        </Popover.Content>
      </Popover>
    </div>
  ),
};

/** A command palette over a Dialog, with an app-owned status region that stays usable. */
export const PaletteOverDialog: Story = {
  name: 'Command palette over a Dialog',
  render: () => {
    function Example() {
      const [paletteOpen, setPaletteOpen] = React.useState(false);
      const openerRef = React.useRef<HTMLButtonElement>(null);
      return (
        <Toaster>
          <div className="p-8">
            <Dialog defaultOpen>
              <Dialog.Content title="Project">
                <Button ref={openerRef} onClick={() => setPaletteOpen(true)}>
                  Open palette
                </Button>{' '}
                <NotifyButton />
              </Dialog.Content>
            </Dialog>
            <CommandPalette
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              triggerRef={openerRef}
            />
            <AppStatusRegion />
          </div>
        </Toaster>
      );
    }
    return <Example />;
  },
};

const CELLS = Array.from({ length: 10 }, (_, index) => `Cell ${index + 1}`);

/** A flat list of cells navigated as a grid with `columns`: arrows, Home and End, Ctrl+Home and Ctrl+End. */
export const GridRoving: Story = {
  name: 'Grid roving with columns',
  render: () => {
    function Grid() {
      const { containerProps, getTabIndex } = useRovingTabIndex({
        orientation: 'grid',
        columns: 4,
        loop: false,
      });
      return (
        <div
          role="group"
          aria-label="Cells in a grid of four columns"
          className="grid w-80 grid-cols-4 gap-2 p-4"
          {...containerProps}
        >
          {CELLS.map((name) => (
            <Button key={name} size="small" data-roving-value={name} tabIndex={getTabIndex(name)}>
              {name.replace('Cell ', '')}
            </Button>
          ))}
        </div>
      );
    }
    return <Grid />;
  },
};

const ROWS = ['Quarterly report', 'Design review', 'Release notes'];

/** Rows that are one tab stop each: Enter or F2 enters a row, Escape leaves it. */
export const FocusableGroupRows: Story = {
  name: 'Focusable group rows',
  render: () => {
    function Row({ title }: { title: string }) {
      const { groupProps } = useFocusableGroup({ tabBehavior: 'limited' });
      return (
        <div
          role="group"
          aria-label={title}
          className="flex items-center gap-2 rounded-md border border-border p-2"
          {...groupProps}
        >
          <span className="grow">{title}</span>
          <Button size="small">Open</Button>
          <Button size="small">Share</Button>
        </div>
      );
    }
    return (
      <div className="p-4">
        <Button>Before the list</Button>
        <div role="region" aria-label="Documents" className="my-2 flex flex-col gap-2">
          {ROWS.map((title) => (
            <Row key={title} title={title} />
          ))}
        </div>
        <Button>After the list</Button>
      </div>
    );
  },
};

/** Shows `useFocusVisible`: the mode switches to the keyboard on a key press and back on a click. */
export const KeyboardMode: Story = {
  name: 'Keyboard mode',
  render: () => {
    function Indicator() {
      const keyboard = useFocusVisible();
      return (
        <p role="status" className="p-4">
          Input mode: {keyboard ? 'keyboard' : 'pointer'}
        </p>
      );
    }
    return <Indicator />;
  },
};
