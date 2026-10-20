import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Dialog, Popover } from '../src';
import { AppStatusRegion, CommandPalette, CustomPopup } from './CustomOverlays.fixtures';

const meta = {
  title: 'Components/Overlays/Custom overlays',
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A popup placed and dismissed by the public hooks; a Popover opened inside it is its child layer. */
export const PopupOnPublicHooks: Story = {
  name: 'Popup on the public hooks',
  render: () => (
    <div className="p-8">
      <CustomPopup label="Details">
        <Popover>
          <Popover.Trigger>
            <Button>More</Button>
          </Popover.Trigger>
          <Popover.Content aria-label="More details">Escape closes this first.</Popover.Content>
        </Popover>
      </CustomPopup>
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
        <div className="p-8">
          <Dialog defaultOpen>
            <Dialog.Content title="Project">
              <Button ref={openerRef} onClick={() => setPaletteOpen(true)}>
                Open palette
              </Button>
            </Dialog.Content>
          </Dialog>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} triggerRef={openerRef} />
          <AppStatusRegion />
        </div>
      );
    }
    return <Example />;
  },
};
