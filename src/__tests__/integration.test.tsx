/**
 * Cross-package composition tests (spec §5.9, INTEGRATION). Every composition that a package could
 * only test with a stand-in during wave D is tested here with the real components, imported
 * through the public barrel (`src/index.ts`), so the barrel exports are exercised as well.
 *
 * Each composition asserts behaviour (roles, names, focus, keyboard) and runs axe on
 * `document.body` (portals included).
 */
import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import * as ImageStories from '../../stories/Image.stories';
import * as Wave from '../index';
import {
  Accordion,
  AlphaSlider,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Button,
  Calendar,
  Card,
  Carousel,
  CarouselItem,
  Checkbox,
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Combobox,
  ComboboxOption,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  DatePicker,
  Dialog,
  Drawer,
  DrawerClose,
  DrawerTitle,
  DrawerTrigger,
  Dropdown,
  DropdownOption,
  EmptySwatch,
  Field,
  ImageSwatch,
  InfoLabel,
  Input,
  Link,
  Listbox,
  ListboxOption,
  ListboxOptionGroup,
  ListboxSurface,
  Menu,
  MessageBar,
  MenuButton,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuItemCheckbox,
  MenuItemRadio,
  MenuPopover,
  MenuSplitGroup,
  MenuTrigger,
  Nav,
  NavCategory,
  NavItem,
  NavSubItem,
  Option,
  Overflow,
  OverflowItem,
  Popover,
  Portal,
  ProgressBar,
  RadioGroup,
  Rating,
  SearchBox,
  Select,
  Slider,
  SpinButton,
  Spinner,
  SplitButton,
  Stack,
  SwatchPicker,
  SwatchPickerRow,
  Switch,
  Table,
  TabList,
  TabListPanel,
  TabListTab,
  TagPicker,
  TeachingPopover,
  Textarea,
  TimePicker,
  Toast,
  Toaster,
  ToggleButton,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarRadioButton,
  ToolbarRadioGroup,
  ToolbarToggleButton,
  Tooltip,
  Tree,
  TreeItem,
  colorAreaClassNames,
  createToaster,
  useListbox,
  useListboxPopup,
  useMergedRefs,
  useOverflowMenu,
  useToastController,
  Avatar,
  ColorPickerHexField,
  ColorPickerPreview,
  ColorPickerSwatches,
  MessageBarActions,
  MessageBarTitle,
  Persona,
  ToastBody,
  ToastClose,
  ToastFooter,
  ToastTitle,
  TreeItemPersonaLayout,
  avatarClassNames,
  buttonClassNames,
  dialogContentClassNames,
  dialogTitleClassNames,
  menuButtonClassNames,
  menuItemClassNames,
  menuPopoverClassNames,
  messageBarTitleClassNames,
  personaClassNames,
  splitButtonClassNames,
  toastBodyClassNames,
  toastClassNames,
  toasterClassNames,
  toastTitleClassNames,
  toggleButtonClassNames,
  toolbarClassNames,
  toolbarToggleButtonClassNames,
  type CheckedValuesChangeDetails,
  type DialogProps,
  type ListboxItem,
  type MenuProps,
} from '../index';
import { getOpenLayers } from '../lib/layers';
import {
  asClientReference,
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  installResizeObserverMock,
  mockAnimations,
  mockRect,
} from '../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every `id` in the document that more than one element carries. */
function duplicateIds(): string[] {
  const counts = new Map<string, number>();
  for (const el of Array.from(document.querySelectorAll('[id]'))) {
    counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
}

/** The portaled, aria-hidden visual surface of the visible tooltip. */
const tooltipSurface = () => document.querySelector<HTMLElement>('[data-wave-tooltip-surface]');

/** The Portal wrapper (`[data-wave-portal]`) an element is rendered in, if any. */
const portalOf = (el: Element) => el.closest<HTMLElement>('[data-wave-portal]');

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const menuitem = (name: string) => screen.getByRole('menuitem', { name });

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

/**
 * Flat names of compound members that a package attaches before the barrels export them (the
 * barrel test's twin of `PENDING_FLAT_EXPORTS` in `scripts/verify-dist.mjs`). Empty since wave C
 * of 0.8; a later phase whose parts land before their flat names lists them here the same way.
 */
const PENDING_FLAT_MEMBERS: readonly string[] = [];

describe('public barrel (spec §5.11, C-COMPOUND)', () => {
  const barrel = Wave as unknown as Record<string, unknown>;
  const isComponent = (value: unknown) =>
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value);

  it('exports every sub-component of a compound under its flat name, equal to the dotted member', () => {
    const missing: string[] = [];
    const different: string[] = [];
    let compounds = 0;
    for (const [name, value] of Object.entries(barrel)) {
      if (!/^[A-Z]/.test(name) || !isComponent(value)) continue;
      const members = Object.keys(value as object).filter(
        (key) => /^[A-Z]/.test(key) && isComponent((value as Record<string, unknown>)[key]),
      );
      if (members.length > 0) compounds += 1;
      for (const member of members) {
        const flat = `${name}${member}`;
        if (!(flat in barrel)) {
          if (!PENDING_FLAT_MEMBERS.includes(flat)) missing.push(flat);
        } else if (barrel[flat] !== (value as Record<string, unknown>)[member]) {
          different.push(flat);
        }
      }
    }
    // At least 19 compounds in 0.7; Toast, MessageBar and ColorPicker join them in 0.8.
    expect(compounds).toBeGreaterThanOrEqual(22);
    expect(missing).toEqual([]);
    expect(different).toEqual([]);
  });

  it('lists on PENDING_FLAT_MEMBERS only flat names the barrel does not export yet', () => {
    expect(PENDING_FLAT_MEMBERS).toEqual([...new Set(PENDING_FLAT_MEMBERS)].sort());
    expect(PENDING_FLAT_MEMBERS.filter((flat) => flat in barrel)).toEqual([]);
  });

  it('exports the new public hooks, utilities and Portal', () => {
    for (const name of [
      'Portal',
      'useMergedRefs',
      'useFieldControl',
      'useAnnounce',
      'announce',
      'composeEventHandlers',
      'mergeRefs',
      'getThemeClassName',
      'useIsClient',
      'useOverflowMenu',
      'useIsOverflowItemVisible',
      'RadioItem',
      'OverflowItem',
    ]) {
      expect(barrel[name], name).toBeTypeOf('function');
    }
  });

  it('exports the 0.8 compound parts, the color parts and helpers, and createToaster', () => {
    const members: Array<[string, string]> = [
      ['Toast', 'Title'],
      ['Toast', 'Body'],
      ['Toast', 'Footer'],
      ['Toast', 'Close'],
      ['MessageBar', 'Title'],
      ['MessageBar', 'Actions'],
      ['ColorPicker', 'HexField'],
      ['ColorPicker', 'Swatches'],
      ['ColorPicker', 'Preview'],
      ['Tree', 'ItemPersonaLayout'],
    ];
    for (const [compound, member] of members) {
      const flat = `${compound}${member}`;
      expect(barrel[flat], flat).toBeDefined();
      expect(barrel[flat], flat).toBe((barrel[compound] as Record<string, unknown>)[member]);
    }
    for (const name of [
      'ColorArea',
      'ColorSlider',
      'AlphaSlider',
      'createToaster',
      'hsvToHex',
      'hexToHsv',
    ]) {
      expect(barrel[name], name).toBeTypeOf('function');
    }
  });

  it('keeps internal helpers out of the public API', () => {
    const internal = [
      'buttonClassName',
      'buttonBaseClasses',
      'rendersContent',
      'buttonIconRenders',
      'HiddenInput',
      'useFormReset',
      'useTriggerElement',
      'useModalLayer',
      'useModalIsolation',
      'useDismiss',
      'ListboxContext',
      'getPaginationRange',
      'useControlErrorMessage',
      'isInvalidLook',
      'useGridNavigation',
      'parseHexColor',
      'formatDate',
      'parseDate',
      'isValidLocaleTag',
      'generateTimeOptions',
      'PortalDepthContext',
      'FieldContext',
      'StatusIcon',
      'useModalTrigger',
      'ListRegistry',
      'StatusText',
      'withPartClass',
      'getStableClassNames',
      'isToastOptions',
      'bindToasterHandle',
      'ToasterHandleBinding',
      'MessageBarPartContext',
      'useMessageBarReflow',
      'useColorPickerContext',
      'hsvToRgb',
      'rgbToHsv',
      'collectItems',
      'computeCheckStates',
      'toggleCheck',
      'isHiddenByCss',
    ];
    expect(internal.filter((name) => name in barrel)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Menu.Trigger / Menu.Popover + MenuButton and SplitButton (feedback-navigation#51, §5.2)
// ---------------------------------------------------------------------------

describe('Menu with MenuButton (feedback-navigation#51)', () => {
  function ActionsMenu({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
    return (
      <Menu>
        <Menu.Trigger>
          <MenuButton>Actions</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item onClick={onEdit}>Edit</Menu.Item>
          <Menu.Item disabled>Share</Menu.Item>
          <Menu.Divider />
          <Menu.Item onClick={onDelete}>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  it('is an APG menu button: the trigger ARIA follows the portaled, labelled menu', async () => {
    const user = userEvent.setup();
    const { container } = render(<ActionsMenu />);
    const trigger = button('Actions');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.parentElement).toBe(container); // merged onto MenuButton, no wrapper span
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');

    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(container.contains(menu)).toBe(false);
    expect(portalOf(menu)).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(menuitem('Edit')).toHaveFocus();
    await expectNoA11yViolations(document.body);
  });

  it('roves with arrows (skipping disabled items), activates with Enter and restores focus', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<ActionsMenu onDelete={onDelete} />);
    await user.click(button('Actions'));
    await user.keyboard('{ArrowDown}');
    expect(menuitem('Delete')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
    expect(button('Actions')).toHaveAttribute('aria-expanded', 'false');
  });

  it.each([
    ['Enter', 'Edit', '{Enter}'],
    ['Space', 'Edit', ' '],
    ['ArrowDown', 'Edit', '{ArrowDown}'],
    ['ArrowUp', 'Delete', '{ArrowUp}'],
  ])('%s on the MenuButton opens the menu and focuses %s', async (_key, focused, keys) => {
    const user = userEvent.setup();
    render(<ActionsMenu />);
    await user.tab();
    expect(button('Actions')).toHaveFocus();
    await user.keyboard(keys);
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(menuitem(focused)).toHaveFocus();
  });

  it('Escape closes the menu and returns focus to the MenuButton', async () => {
    const user = userEvent.setup();
    render(<ActionsMenu />);
    await user.click(button('Actions'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
  });

  it('an item click calls its handler, closes the menu and returns focus', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ActionsMenu onEdit={onEdit} />);
    await user.click(button('Actions'));
    await user.click(menuitem('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('Actions')).toHaveFocus();
  });
});

describe('Menu with SplitButton (render-prop trigger, feedback-navigation#51)', () => {
  function SaveButton({ onSave, onSaveAs }: { onSave?: () => void; onSaveAs?: () => void }) {
    return (
      <Menu>
        <Menu.Trigger>
          {(triggerProps) => (
            <SplitButton menuButtonProps={triggerProps} onClick={onSave}>
              Save
            </SplitButton>
          )}
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item onClick={onSaveAs}>Save as</Menu.Item>
          <Menu.Item>Save a copy</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  it('puts the menu-button semantics on the chevron half only', () => {
    render(<SaveButton />);
    const primary = button('Save');
    const more = button('More options');
    expect(within(screen.getByRole('group')).getAllByRole('button')).toEqual([primary, more]);
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(primary).not.toHaveAttribute('aria-haspopup');
    expect(primary).not.toHaveAttribute('aria-expanded');
  });

  it('the primary half runs its action without opening the menu', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SaveButton onSave={onSave} />);
    await user.click(button('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('the chevron opens a menu labelled by it; an item closes it and focus returns', async () => {
    const user = userEvent.setup();
    const onSaveAs = vi.fn();
    render(<SaveButton onSaveAs={onSaveAs} />);
    const more = button('More options');
    await user.click(more);
    const menu = screen.getByRole('menu', { name: 'More options' });
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(more).toHaveAttribute('aria-controls', menu.id);
    expect(menuitem('Save as')).toHaveFocus();
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Enter}');
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it('ArrowDown on the chevron opens the menu from the keyboard; Escape returns to it', async () => {
    const user = userEvent.setup();
    render(<SaveButton />);
    await user.tab();
    await user.tab();
    expect(button('More options')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(menuitem('Save as')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('More options')).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// Tooltip on a trigger (overlays#5, §5.3)
// ---------------------------------------------------------------------------

describe('Tooltip > Dialog.Trigger > Button (overlays#5)', () => {
  function SettingsDialog() {
    return (
      <Dialog>
        <Tooltip content="Opens the settings" openDelay={0}>
          <Dialog.Trigger>
            <Button>Settings</Button>
          </Dialog.Trigger>
        </Tooltip>
        <Dialog.Content title="Settings">
          <p>Body</p>
          <Dialog.Close>
            <Button>Done</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog>
    );
  }

  it('describes the Button itself, which also carries the dialog trigger ARIA', () => {
    render(<SettingsDialog />);
    const trigger = button('Settings');
    expect(trigger).toHaveAccessibleDescription('Opens the settings');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Dialog.Trigger merged onto the Button: its parent is the Tooltip wrapper, no extra span.
    expect(trigger.parentElement?.querySelector(':scope > [role="tooltip"]')).not.toBeNull();
  });

  it('opens the dialog on click and returns focus to the described Button on Escape', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    const trigger = button('Settings');
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    expect(dialog).not.toHaveAttribute('aria-modal');
    await expectNoA11yViolations(document.body);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAccessibleDescription('Opens the settings');
  });

  it('Dialog.Close inside the content closes it', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog />);
    await user.click(button('Settings'));
    await user.click(button('Done'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button('Settings')).toHaveFocus();
  });

  it('the deprecated delay prop still sets the open delay, and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <Dialog>
        <Tooltip content="Opens the settings" delay={0}>
          <Dialog.Trigger>
            <Button>Settings</Button>
          </Dialog.Trigger>
        </Tooltip>
        <Dialog.Content title="Settings">
          <p>Body</p>
        </Dialog.Content>
      </Dialog>,
    );
    await user.hover(button('Settings'));
    expect(tooltipSurface()).toHaveTextContent('Opens the settings');
    await user.click(button('Settings'));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Tooltip: `delay` is deprecated and will be removed in 1.0. Use `openDelay` instead.',
      ],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Tooltip inside clipping containers (overlays#36)
// ---------------------------------------------------------------------------

describe('Tooltip inside clipping containers (overlays#36)', () => {
  /** Hovers the trigger and returns the visible surface, asserting it lives in a portal root. */
  async function showTooltip(trigger: HTMLElement, clipping: HTMLElement) {
    const user = userEvent.setup();
    await user.hover(trigger);
    const surface = tooltipSurface();
    expect(surface).not.toBeNull();
    const portal = portalOf(surface!);
    expect(portal).not.toBeNull();
    expect(portal!.parentElement).toBe(document.body);
    expect(portal).toHaveAttribute('data-layer', 'tooltip');
    expect(clipping.contains(surface)).toBe(false);
    return { user, surface: surface! };
  }

  it('inside a Card (overflow-hidden)', async () => {
    render(
      <Card data-testid="card">
        <Card.Header title="Project" />
        <Card.Body>
          <Tooltip content="Opens the project" openDelay={0}>
            <Button>Open</Button>
          </Tooltip>
        </Card.Body>
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('overflow-hidden');
    const trigger = button('Open');
    expect(trigger).toHaveAccessibleDescription('Opens the project');
    await showTooltip(trigger, card);
    await expectNoA11yViolations(document.body);
  });

  it('inside a Table cell', async () => {
    render(
      <Table aria-label="Files">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Report.pdf</Table.Cell>
            <Table.Cell>
              <Tooltip content="Deletes Report.pdf" openDelay={0}>
                <Button>Delete</Button>
              </Tooltip>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const table = screen.getByRole('table', { name: 'Files' });
    const trigger = button('Delete');
    expect(trigger).toHaveAccessibleDescription('Deletes Report.pdf');
    await showTooltip(trigger, table.parentElement ?? table);
    await expectNoA11yViolations(document.body);
  });

  it('on a Menu.Trigger in a Table cell: the Button is described and the menu is portaled', async () => {
    render(
      <Table aria-label="Files">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Report.pdf</Table.Cell>
            <Table.Cell>
              <Menu>
                <Tooltip content="Actions for Report.pdf" openDelay={0}>
                  <Menu.Trigger>
                    <MenuButton>More</MenuButton>
                  </Menu.Trigger>
                </Tooltip>
                <Menu.Popover>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Delete</Menu.Item>
                </Menu.Popover>
              </Menu>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const table = screen.getByRole('table', { name: 'Files' });
    const trigger = button('More');
    expect(trigger).toHaveAccessibleDescription('Actions for Report.pdf');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    const { user } = await showTooltip(trigger, table.parentElement ?? table);
    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'More' });
    expect(table.contains(menu)).toBe(false);
    expect(menuitem('Rename')).toHaveFocus();
    expect(trigger).toHaveAccessibleDescription('Actions for Report.pdf');
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('on a Popover.Trigger in a Card: the Button is described and the popover is portaled', async () => {
    render(
      <Card data-testid="card">
        <Card.Header title="Project" />
        <Card.Footer>
          <Popover>
            <Tooltip content="Share this project" openDelay={0}>
              <Popover.Trigger>
                <Button>Share</Button>
              </Popover.Trigger>
            </Tooltip>
            <Popover.Content title="Share">
              <Button>Copy link</Button>
            </Popover.Content>
          </Popover>
        </Card.Footer>
      </Card>,
    );
    const card = screen.getByTestId('card');
    const trigger = button('Share');
    expect(trigger).toHaveAccessibleDescription('Share this project');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    const { user } = await showTooltip(trigger, card);
    await user.click(trigger);
    const popover = screen.getByRole('dialog', { name: 'Share' });
    expect(card.contains(popover)).toBe(false);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', popover.id);
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Share' })).not.toBeInTheDocument();
  });

  it('inside an Overflow row (overflow-hidden)', async () => {
    render(
      <Overflow data-testid="row">
        <OverflowItem itemId="bold">
          <Tooltip content="Bold (Ctrl+B)" openDelay={0}>
            <Button>Bold</Button>
          </Tooltip>
        </OverflowItem>
        <OverflowItem itemId="italic">
          <Button>Italic</Button>
        </OverflowItem>
      </Overflow>,
    );
    const row = screen.getByTestId('row');
    expect(row).toHaveClass('overflow-hidden');
    const trigger = button('Bold');
    expect(trigger).toHaveAccessibleDescription('Bold (Ctrl+B)');
    await showTooltip(trigger, row);
    await expectNoA11yViolations(document.body);
  });

  it('inside an open Drawer: not clipped, not inert, and Escape closes only the tooltip', async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer open title="Filters" onOpenChange={onOpenChange}>
        <Tooltip content="Clears every filter" openDelay={0}>
          <Button>Reset</Button>
        </Tooltip>
      </Drawer>,
    );
    const drawer = screen.getByRole('dialog', { name: 'Filters' });
    const trigger = within(drawer).getByRole('button', { name: 'Reset' });
    expect(trigger).toHaveAccessibleDescription('Clears every filter');
    const { user, surface } = await showTooltip(trigger, drawer);
    expect(surface.closest('[inert]')).toBeNull();
    await expectNoA11yViolations(document.body);

    act(() => trigger.focus());
    await user.keyboard('{Escape}');
    expect(tooltipSurface()).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });
});

// ---------------------------------------------------------------------------
// Field around the P03–P06 controls (input-basic#1, §5.1)
// ---------------------------------------------------------------------------

interface FieldCase {
  name: string;
  /** Role of the element Field names. */
  role: string;
  control: () => React.ReactElement;
  /** Element that carries aria-invalid (defaults to the named element). */
  invalidTarget?: () => HTMLElement;
  /** Whether the named element takes aria-required (ARIA allows it on its role). */
  ariaRequired?: boolean;
}

const fruitOptions = [
  <Dropdown.Option key="a" value="apple">
    Apple
  </Dropdown.Option>,
  <Dropdown.Option key="b" value="banana">
    Banana
  </Dropdown.Option>,
];

const fieldCases: FieldCase[] = [
  { name: 'Checkbox', role: 'checkbox', control: () => <Checkbox />, ariaRequired: true },
  { name: 'Switch', role: 'switch', control: () => <Switch />, ariaRequired: true },
  {
    name: 'RadioGroup',
    role: 'radiogroup',
    control: () => (
      <RadioGroup>
        <RadioGroup.Item value="s" label="Small" />
        <RadioGroup.Item value="l" label="Large" />
      </RadioGroup>
    ),
    ariaRequired: true,
  },
  { name: 'Rating', role: 'radiogroup', control: () => <Rating />, ariaRequired: true },
  { name: 'SpinButton', role: 'spinbutton', control: () => <SpinButton />, ariaRequired: true },
  {
    name: 'ColorPicker',
    role: 'group',
    control: () => <ColorPicker />,
    invalidTarget: () => screen.getByRole('textbox', { name: 'Hex color value' }),
    ariaRequired: false,
  },
  {
    name: 'SwatchPicker',
    role: 'radiogroup',
    control: () => (
      <SwatchPicker
        items={[
          // wave-allow-color: fixture
          { value: 'red', color: '#d13438', label: 'Red' },
          // wave-allow-color: fixture
          { value: 'blue', color: '#0f6cbd', label: 'Blue' },
        ]}
      />
    ),
    ariaRequired: true,
  },
  {
    name: 'Combobox',
    role: 'combobox',
    control: () => <Combobox>{fruitOptions}</Combobox>,
    ariaRequired: true,
  },
  {
    name: 'Dropdown',
    role: 'combobox',
    control: () => <Dropdown>{fruitOptions}</Dropdown>,
    ariaRequired: true,
  },
  {
    name: 'TagPicker',
    role: 'combobox',
    control: () => (
      <TagPicker
        options={[
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana' },
        ]}
      />
    ),
    ariaRequired: true,
  },
  {
    name: 'DatePicker',
    role: 'textbox',
    control: () => <DatePicker locale="en-US" />,
    ariaRequired: true,
  },
  { name: 'TimePicker', role: 'combobox', control: () => <TimePicker />, ariaRequired: true },
];

describe('real Field around the P03–P06 controls (input-basic#1)', () => {
  describe.each(fieldCases)('$name', ({ role, control, invalidTarget, ariaRequired }) => {
    it('is named by the label and described by the hint', async () => {
      render(
        <Field label="Preference" hint="Pick one">
          {control()}
        </Field>,
      );
      const el = screen.getByRole(role, { name: 'Preference' });
      expect(el).toHaveAccessibleDescription(/Pick one/);
      expect(el).not.toHaveAttribute('aria-invalid');
      expect(duplicateIds()).toEqual([]);
      await expectNoA11yViolations(document.body);
    });

    it('reports the error (alert, description, aria-invalid) and required', async () => {
      render(
        <Field label="Preference" hint="Pick one" error="This is required" required>
          {control()}
        </Field>,
      );
      const el = screen.getByRole(role, { name: 'Preference' });
      expect(screen.getByRole('alert')).toHaveTextContent('This is required');
      expect(el).toHaveAccessibleDescription(/This is required/);
      expect(invalidTarget ? invalidTarget() : el).toHaveAttribute('aria-invalid', 'true');
      if (ariaRequired) expect(el).toHaveAttribute('aria-required', 'true');
      expect(duplicateIds()).toEqual([]);
      await expectNoA11yViolations(document.body);
    });

    // Field clones props into its first element child and only provides context to a nested one:
    // both paths must let the control's own `required={false}` win.
    it.each([
      ['as its first child', (el: React.ReactElement) => el],
      ['nested in a <div>', (el: React.ReactElement) => <div>{el}</div>],
    ])('an explicit required={false} wins over a required Field %s', (_where, wrap) => {
      const optional = React.cloneElement(control() as React.ReactElement<{ required?: boolean }>, {
        required: false,
      });
      render(
        <form aria-label="Form">
          <Field label="Preference" required>
            {wrap(optional)}
          </Field>
        </form>,
      );
      const el = screen.getByRole(role, { name: 'Preference' });
      expect(el).not.toHaveAttribute('aria-required', 'true');
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });
  });
});

describe('real Field around the native-validation controls (input-basic#1)', () => {
  const nativeCases: Array<{ name: string; role: string; control: React.ReactElement }> = [
    { name: 'Input', role: 'textbox', control: <Input required={false} /> },
    { name: 'Textarea', role: 'textbox', control: <Textarea required={false} /> },
    {
      name: 'Select',
      role: 'combobox',
      control: (
        <Select required={false}>
          <option value="">None</option>
          <option value="a">Apple</option>
        </Select>
      ),
    },
    { name: 'SearchBox', role: 'searchbox', control: <SearchBox required={false} /> },
    { name: 'Slider', role: 'slider', control: <Slider required={false} /> },
    { name: 'a native <input>', role: 'textbox', control: <input required={false} /> },
  ];

  it.each(nativeCases)(
    '$name: an explicit required={false} wins over a required Field',
    ({ role, control }) => {
      render(
        <form aria-label="Form">
          <Field label="Preference" required>
            {control}
          </Field>
        </form>,
      );
      const el = screen.getByRole(role, { name: 'Preference' });
      expect(el).not.toHaveAttribute('required');
      expect(el).not.toHaveAttribute('aria-required', 'true');
      const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    },
  );
});

describe('Field with a wrapper component around the control (input-basic#1, input-basic#15)', () => {
  it('(a) names and describes an Input inside a Tooltip (no own id)', async () => {
    render(
      <Field label="Name" hint="Your full name">
        <Tooltip content="As on your passport">
          <Input />
        </Tooltip>
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAccessibleDescription(/Your full name/);
    expect(input).toHaveAccessibleDescription(/As on your passport/);
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('(b) names and describes an Input with its own id inside a Tooltip', async () => {
    render(
      <Field label="Name" hint="Your full name">
        <Tooltip content="As on your passport">
          <Input id="own" />
        </Tooltip>
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAttribute('id', 'own');
    expect(input).toHaveAccessibleDescription(/Your full name/);
    expect(input).toHaveAccessibleDescription(/As on your passport/);
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('(c) names and describes an Input inside a layout component with its own id', async () => {
    render(
      <Field label="Name" hint="Your full name">
        <Stack id="row">
          <Input />
        </Stack>
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAccessibleDescription(/Your full name/);
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('(c′) names and describes an Input inside a layout component without an id', async () => {
    render(
      <Field label="Name" hint="Your full name">
        <Stack>
          <Input />
        </Stack>
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAccessibleDescription(/Your full name/);
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('(d) documented pattern: a plain <div> around Tooltip > Input, with required', async () => {
    render(
      <Field label="Name" hint="Your full name" required>
        <div>
          <Tooltip content="As on your passport">
            <Input />
          </Tooltip>
        </div>
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /Name/ });
    expect(input).toHaveAccessibleDescription(/Your full name/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('(e) names two sibling library controls of one Field and keeps their ids unique', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Field label="Price range" hint="In euros">
        <Input />
        <Input />
      </Field>,
    );
    const inputs = screen.getAllByRole('textbox', { name: 'Price range' });
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toHaveAccessibleDescription(/In euros/);
    expect(duplicateIds()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('only the first element child receives the Field'),
    );
    await expectNoA11yViolations(document.body);
  });

  // Field leaves a plain <div> alone and hands its `controlId` to the first control inside only
  // (`controlIdClaim`), which its `<label htmlFor>` names; the second control takes an id of its
  // own and is named through `aria-labelledby`, so no id is duplicated.
  it('(f) names two library controls inside a plain <div> and keeps their ids unique', async () => {
    render(
      <Field label="Price range" hint="In euros">
        <div>
          <Input />
          <Input />
        </div>
      </Field>,
    );
    expect(duplicateIds()).toEqual([]);
    const inputs = screen.getAllByRole('textbox', { name: 'Price range' });
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toHaveAccessibleDescription(/In euros/);
    await expectNoA11yViolations(document.body);
  });
});

// ---------------------------------------------------------------------------
// Toasts over modals (feedback-navigation#50, §5.8)
// ---------------------------------------------------------------------------

function NotifyButton() {
  const { dispatchToast } = useToastController();
  return <Button onClick={() => dispatchToast({ title: 'Saved', timeout: 0 })}>Notify</Button>;
}

describe.each([
  [
    'Dialog',
    (onOpenChange: (open: boolean) => void) => (
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Settings">
          <NotifyButton />
        </Dialog.Content>
      </Dialog>
    ),
  ],
  [
    'Drawer',
    (onOpenChange: (open: boolean) => void) => (
      <Drawer open title="Settings" onOpenChange={onOpenChange}>
        <NotifyButton />
      </Drawer>
    ),
  ],
])('a real timeout:0 Toast over an open %s (feedback-navigation#50)', (_name, renderModal) => {
  function setup() {
    const onOpenChange = vi.fn();
    render(<Toaster>{renderModal(onOpenChange)}</Toaster>);
    return { onOpenChange, user: userEvent.setup() };
  }

  const region = () => screen.getByRole('region', { name: 'Notifications' });
  const dismissButton = () => within(region()).queryByRole('button', { name: 'Dismiss' });

  it('is exposed to assistive technology: not inert, announced, the modal has no aria-modal', async () => {
    const { user } = setup();
    await user.click(button('Notify'));
    expect(within(region()).getByText('Saved')).toBeInTheDocument();
    expect(region().closest('[inert]')).toBeNull();
    expect(region().closest('[aria-hidden="true"]')).toBeNull();
    expect(within(region()).getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('dialog', { name: 'Settings' })).not.toHaveAttribute('aria-modal');
    await expectNoA11yViolations(document.body);
  });

  it('is reachable by Tab from the modal and dismissable by keyboard without closing it', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Notify'));
    expect(button('Notify')).toHaveFocus();
    await user.tab();
    expect(dismissButton()).toHaveFocus();
    await user.keyboard('{Enter}');
    await act(async () => {});
    expect(dismissButton()).toBeNull();
    expect(screen.queryByText('Saved', { selector: '[data-wave-toast] *' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Notify')).toHaveFocus();
  });

  it('is dismissable by mouse without closing the modal', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Notify'));
    await user.click(dismissButton()!);
    await act(async () => {});
    expect(dismissButton()).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Listbox and calendar popups inside a Dialog: layered Escape (overlays#1)
// ---------------------------------------------------------------------------

describe('pickers inside a Dialog: Escape closes only the popup (overlays#1)', () => {
  function InDialog({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Order">{children}</Dialog.Content>
      </Dialog>
    );
  }

  it.each([
    ['Dropdown', () => <Dropdown aria-label="Fruit">{fruitOptions}</Dropdown>],
    ['Combobox', () => <Combobox aria-label="Fruit">{fruitOptions}</Combobox>],
    [
      'TagPicker',
      () => (
        <TagPicker
          aria-label="Fruit"
          options={[
            { value: 'a', label: 'Apple' },
            { value: 'b', label: 'Banana' },
          ]}
        />
      ),
    ],
    ['TimePicker', () => <TimePicker aria-label="Fruit" />],
  ])('%s: the first Escape closes the listbox, the second the Dialog', async (_name, picker) => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<InDialog onOpenChange={onOpenChange}>{picker()}</InDialog>);
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    const combobox = within(dialog).getByRole('combobox', { name: 'Fruit' });
    await user.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(dialog.contains(listbox)).toBe(false); // portaled
    expect(listbox.closest('[inert]')).toBeNull();
    await expectNoA11yViolations(document.body);

    await user.keyboard('{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });

  it('DatePicker: the first Escape closes the calendar, the second the Dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <InDialog onOpenChange={onOpenChange}>
        <DatePicker aria-label="Delivery date" locale="en-US" />
      </InDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    const toggle = within(dialog).getByRole('button', { name: 'Open calendar' });
    await user.click(toggle);
    const calendar = screen.getAllByRole('dialog').find((el) => el !== dialog)!;
    expect(calendar).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(calendar)).toBe(false);
    expect(within(calendar).getByRole('grid')).toBeInTheDocument();
    await expectNoA11yViolations(document.body);

    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toEqual([dialog]);
    expect(toggle).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });
});

// ---------------------------------------------------------------------------
// Dialog opened from Popover.Content (overlays#41)
// ---------------------------------------------------------------------------

describe('Dialog opened from Popover.Content (overlays#41)', () => {
  function PopoverWithDialog() {
    return (
      <Popover>
        <Popover.Trigger>
          <Button>Options</Button>
        </Popover.Trigger>
        <Popover.Content title="Options">
          <Dialog>
            <Dialog.Trigger>
              <Button>Delete project</Button>
            </Dialog.Trigger>
            <Dialog.Content title="Delete project?">
              <Button>Keep files</Button>
              <Dialog.Close>
                <Button>Cancel</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </Popover.Content>
      </Popover>
    );
  }

  it('stays open on a click inside the Dialog; Escape unwinds one layer at a time', async () => {
    const user = userEvent.setup();
    render(<PopoverWithDialog />);
    await user.click(button('Options'));
    const popover = screen.getByRole('dialog', { name: 'Options' });
    await user.click(within(popover).getByRole('button', { name: 'Delete project' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete project?' });
    await expectNoA11yViolations(document.body);

    await user.click(within(dialog).getByRole('button', { name: 'Keep files' }));
    expect(screen.getByRole('dialog', { name: 'Delete project?' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Delete project?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();
    expect(button('Delete project')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Options' })).not.toBeInTheDocument();
    expect(button('Options')).toHaveFocus();
  });

  it('Dialog.Close returns focus into the still-open Popover', async () => {
    const user = userEvent.setup();
    render(<PopoverWithDialog />);
    await user.click(button('Options'));
    await user.click(button('Delete project'));
    await user.click(button('Cancel'));
    expect(screen.queryByRole('dialog', { name: 'Delete project?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();
    expect(button('Delete project')).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// A Dialog opened as its Popover or Menu closes, from a tabIndex={-1} trigger span
// ---------------------------------------------------------------------------

describe('a Dialog opened as its Popover or Menu closes, with a tabIndex={-1} trigger span', () => {
  /** An item of the popup closes it and opens the Dialog (rendered after it) in one update. */
  function RenameFlow({ popup }: { popup: 'popover' | 'menu' }) {
    const [popupOpen, setPopupOpen] = React.useState(false);
    const [renaming, setRenaming] = React.useState(false);
    const startRename = () => {
      setPopupOpen(false);
      setRenaming(true);
    };
    return (
      <>
        {popup === 'popover' ? (
          <Popover open={popupOpen} onOpenChange={setPopupOpen}>
            <Popover.Trigger asChild={false} tabIndex={-1}>
              <Button>Actions</Button>
            </Popover.Trigger>
            <Popover.Content aria-label="More actions">
              <Button onClick={startRename}>Rename</Button>
            </Popover.Content>
          </Popover>
        ) : (
          <Menu open={popupOpen} onOpenChange={setPopupOpen}>
            <Menu.Trigger asChild={false} tabIndex={-1}>
              <Button>Actions</Button>
            </Menu.Trigger>
            <Menu.Popover>
              {/* persistOnClick: the item does not move focus to the trigger before it goes. */}
              <Menu.Item persistOnClick onClick={startRename}>
                Rename
              </Menu.Item>
            </Menu.Popover>
          </Menu>
        )}
        <Dialog open={renaming} onOpenChange={setRenaming}>
          <Dialog.Content title="Rename">
            <Dialog.Close>
              <Button>Cancel</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </>
    );
  }

  it.each(['popover', 'menu'] as const)(
    '%s: closing the Dialog returns focus to the button inside the span, not the span',
    async (popup) => {
      const user = userEvent.setup();
      render(<RenameFlow popup={popup} />);
      await user.click(button('Actions'));
      // Rename goes away with the popup, so the Dialog restores to the popup's trigger.
      await user.click(popup === 'menu' ? menuitem('Rename') : button('Rename'));
      expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
      await user.click(button('Cancel'));
      expect(screen.queryByRole('dialog', { name: 'Rename' })).not.toBeInTheDocument();
      expect(button('Actions')).toHaveFocus();
    },
  );
});

// ---------------------------------------------------------------------------
// Confirm Dialog that deletes a row inside a Drawer (overlays#10)
// ---------------------------------------------------------------------------

describe('confirm Dialog deleting a row inside a Drawer (overlays#10)', () => {
  type Layout = 'nested' | 'sibling';

  /**
   * A Drawer listing files; each row's action opens one controlled confirm Dialog, whose Confirm
   * deletes that row. `nested`: the Dialog is rendered in the Drawer's content (a descendant layer
   * of the Drawer); `sibling`: next to the Drawer. Focus must land in the same place either way.
   */
  function FileDrawer({ layout, rowMenu = false }: { layout: Layout; rowMenu?: boolean }) {
    const [rows, setRows] = React.useState(['a', 'b', 'c']);
    const [pending, setPending] = React.useState<string | null>(null);
    const confirm = (
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <Dialog.Content title="Delete file?">
          <Button
            onClick={() => {
              setRows((current) => current.filter((row) => row !== pending));
              setPending(null);
            }}
          >
            Confirm
          </Button>
          <Dialog.Close>
            <Button>Cancel</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog>
    );
    return (
      <>
        <Drawer title="Files">
          <Drawer.Trigger>
            <Button>Files</Button>
          </Drawer.Trigger>
          <ul aria-label="Files">
            {rows.map((row) => (
              <li key={row}>
                {`File ${row} `}
                {rowMenu ? (
                  <Menu>
                    <Menu.Trigger>
                      <MenuButton>{`Actions ${row}`}</MenuButton>
                    </Menu.Trigger>
                    <Menu.Popover>
                      <Menu.Item onClick={() => setPending(row)}>Delete</Menu.Item>
                    </Menu.Popover>
                  </Menu>
                ) : (
                  <Button onClick={() => setPending(row)}>{`Delete ${row}`}</Button>
                )}
              </li>
            ))}
          </ul>
          {layout === 'nested' && confirm}
        </Drawer>
        {layout === 'sibling' && confirm}
      </>
    );
  }

  const layouts: Array<[string, Layout]> = [
    ['nested in the Drawer', 'nested'],
    ['next to the Drawer', 'sibling'],
  ];
  const drawer = () => screen.getByRole('dialog', { name: 'Files' });

  async function confirmDelete(user: ReturnType<typeof userEvent.setup>, action: string) {
    await user.click(within(drawer()).getByRole('button', { name: action }));
    const dialog = screen.getByRole('dialog', { name: 'Delete file?' });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(screen.queryByRole('dialog', { name: 'Delete file?' })).not.toBeInTheDocument();
  }

  it.each(layouts)(
    'Dialog %s: Confirm on a middle row focuses the next row’s action',
    async (_name, layout) => {
      const user = userEvent.setup();
      render(<FileDrawer layout={layout} />);
      await user.click(button('Files'));
      await confirmDelete(user, 'Delete b');
      expect(screen.queryByRole('button', { name: 'Delete b' })).not.toBeInTheDocument();
      expect(drawer()).toBeInTheDocument();
      expect(button('Delete c')).toHaveFocus();
    },
  );

  it.each(layouts)(
    'Dialog %s: Confirm on the last row focuses the previous row’s action',
    async (_name, layout) => {
      const user = userEvent.setup();
      render(<FileDrawer layout={layout} />);
      await user.click(button('Files'));
      await confirmDelete(user, 'Delete c');
      expect(button('Delete b')).toHaveFocus();
    },
  );

  it.each(layouts)('Dialog %s: Cancel returns focus to the row’s action', async (_name, layout) => {
    const user = userEvent.setup();
    render(<FileDrawer layout={layout} />);
    await user.click(button('Files'));
    await user.click(button('Delete b'));
    await user.click(button('Cancel'));
    expect(button('Delete b')).toHaveFocus();
  });

  it.each(layouts)(
    'Dialog %s: a row menu’s Delete returns to its menu button on Cancel, to the next one on Confirm',
    async (_name, layout) => {
      const user = userEvent.setup();
      render(<FileDrawer layout={layout} rowMenu />);
      await user.click(button('Files'));
      await user.click(button('Actions b'));
      await user.click(menuitem('Delete'));
      await user.click(button('Cancel'));
      expect(button('Actions b')).toHaveFocus();

      await user.click(button('Actions b'));
      await user.click(menuitem('Delete'));
      await user.click(button('Confirm'));
      expect(screen.queryByRole('button', { name: 'Actions b' })).not.toBeInTheDocument();
      expect(drawer()).toBeInTheDocument();
      expect(button('Actions c')).toHaveFocus();
    },
  );
});

// ---------------------------------------------------------------------------
// Overflow hidden items in a Menu (layout#4)
// ---------------------------------------------------------------------------

describe('Overflow hidden items in a Menu (layout#4)', () => {
  function stubWidths(widths: Record<string, number>) {
    const width = (el: Element) => {
      if (el.hasAttribute('data-overflow-hidden')) return 0;
      if (el.hasAttribute('data-overflow-button')) return widths.button ?? 0;
      const id = el.getAttribute('data-testid');
      return id !== null && id in widths ? widths[id] : 0;
    };
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return width(this);
    });
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
      return width(this);
    });
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      return width(this);
    });
  }

  function MoreMenu() {
    const { hiddenIds, count } = useOverflowMenu();
    return (
      <Menu>
        <Menu.Trigger>
          <MenuButton appearance="subtle">+{count} more</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          {hiddenIds.map((id) => (
            <Menu.Item key={id}>{id}</Menu.Item>
          ))}
        </Menu.Popover>
      </Menu>
    );
  }

  it('lists the hidden items, in DOM order, in a menu opened from the overflow button', async () => {
    stubWidths({ row: 100, Home: 40, About: 40, Blog: 40, button: 30 });
    const user = userEvent.setup();
    render(
      <Overflow data-testid="row" overflowButton={() => <MoreMenu />}>
        {['Home', 'About', 'Blog'].map((page) => (
          <OverflowItem key={page} itemId={page} data-testid={page}>
            <Button appearance="subtle">{page}</Button>
          </OverflowItem>
        ))}
      </Overflow>,
    );
    const more = button('+2 more');
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(more);
    const menu = screen.getByRole('menu', { name: '+2 more' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['About', 'Blog']);
    expect(menuitem('About')).toHaveFocus();
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(more).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// autoFocus and consumer portals in stacked overlays
// ---------------------------------------------------------------------------

describe('autoFocus and consumer portals in stacked overlays', () => {
  /** The modal focus trap reclaims focus in a microtask: let it run before asserting. */
  const flushMicrotasks = () => act(async () => {});

  it('a confirm Dialog opened from inside an open Drawer keeps focus on its autoFocus Cancel', async () => {
    const user = userEvent.setup();
    function FilesDrawer() {
      const [confirm, setConfirm] = React.useState(false);
      return (
        <Drawer defaultOpen title="Files">
          <Button onClick={() => setConfirm(true)}>Delete</Button>
          <Dialog open={confirm} onOpenChange={setConfirm}>
            <Dialog.Content title="Delete file?">
              <Button>OK</Button>
              <Dialog.Close>
                <Button autoFocus>Cancel</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </Drawer>
      );
    }
    render(<FilesDrawer />);
    await user.click(button('Delete'));
    await flushMicrotasks();
    const dialog = screen.getByRole('dialog', { name: 'Delete file?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(button('Cancel'));
    expect(button('Delete')).toHaveFocus();
  });

  it('a Dialog nested in another Dialog focuses its autoFocus input', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Outer">
          <Dialog>
            <Dialog.Trigger>
              <Button>Open inner</Button>
            </Dialog.Trigger>
            <Dialog.Content title="Inner">
              <Button>Inner first</Button>
              <Input aria-label="Inner name" autoFocus />
            </Dialog.Content>
          </Dialog>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('Open inner'));
    await flushMicrotasks();
    expect(screen.getByRole('textbox', { name: 'Inner name' })).toHaveFocus();
  });

  it('Popover.Content opened inside a Dialog focuses its autoFocus input', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Report">
          <Popover>
            <Popover.Trigger>
              <Button>Filter</Button>
            </Popover.Trigger>
            <Popover.Content title="Filter options">
              <Button>Clear</Button>
              <Input aria-label="Filter text" autoFocus />
            </Popover.Content>
          </Popover>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('Filter'));
    await flushMicrotasks();
    const popover = screen.getByRole('dialog', { name: 'Filter options' });
    expect(within(popover).getByRole('textbox', { name: 'Filter text' })).toHaveFocus();
  });

  it('Tab and Shift+Tab move between the buttons of a consumer Portal inside Dialog.Content', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Quiz">
          <Portal>
            <button type="button">Question 1</button>
            <button type="button">Question 2</button>
          </Portal>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Quiz' });
    const first = button('Question 1');
    expect(dialog).not.toContainElement(first);
    act(() => first.focus());
    await user.tab();
    expect(button('Question 2')).toHaveFocus();
    await user.tab({ shift: true });
    expect(first).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// The trigger of a descendant layer outside a Dialog's container (focus trap)
// ---------------------------------------------------------------------------

// The focus trap never takes an open layer's trigger for that layer's surface: Tab from a control
// whose Tooltip is showing, or from an open InfoLabel button, moves on in the order around it.
describe('Tab from the trigger of an open layer that sits outside the dialog container', () => {
  it('a shown Tooltip in Popover.Content opened from the dialog: Tab reaches the next button', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Edit">
          <Popover>
            <Popover.Trigger>
              <Button>Format</Button>
            </Popover.Trigger>
            <Popover.Content title="Format">
              <Tooltip content="Bold text" openDelay={0}>
                <Button>Bold</Button>
              </Tooltip>
              <Button>Italic</Button>
            </Popover.Content>
          </Popover>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('Format'));
    await user.click(button('Bold'));
    expect(tooltipSurface()).toHaveTextContent('Bold text');
    await user.tab();
    expect(button('Italic')).toHaveFocus();
  });

  it('a shown Tooltip in a consumer Portal inside the dialog: Tab reaches the next button', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Edit">
          <Button>In dialog</Button>
          <Portal>
            <Tooltip content="First" openDelay={0}>
              <Button>P1</Button>
            </Tooltip>
            <Button>P2</Button>
          </Portal>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('P1'));
    expect(tooltipSurface()).toHaveTextContent('First');
    await user.tab();
    expect(button('P2')).toHaveFocus();
  });

  it('an open InfoLabel in a consumer Portal: Tab and Shift+Tab move to the elements around it', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Edit">
          <button type="button">In dialog</button>
          <Portal>
            <button type="button">P1</button>
            <InfoLabel label="Password" info="Use 8 characters." />
            <button type="button">P2</button>
          </Portal>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('Information'));
    expect(button('Information')).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(button('P2')).toHaveFocus();
    await user.click(button('Information'));
    expect(button('Information')).toHaveAttribute('aria-expanded', 'true');
    await user.tab({ shift: true });
    expect(button('P1')).toHaveFocus();
  });

  it('an open InfoLabel in Popover.Content opened from the dialog: Tab moves on', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Edit">
          <Popover>
            <Popover.Trigger>
              <button type="button">Options</button>
            </Popover.Trigger>
            <Popover.Content title="Options">
              <InfoLabel label="Password" info="Use 8 characters." />
              <button type="button">Next</button>
            </Popover.Content>
          </Popover>
        </Dialog.Content>
      </Dialog>,
    );
    await user.click(button('Options'));
    await user.click(button('Information'));
    expect(button('Information')).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(button('Next')).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// Tab out of a Popover or Menu opened from a wrapper-span trigger inside a Dialog
// ---------------------------------------------------------------------------

// The trigger of a wrapper span is the button inside it (the element that carries the state
// ARIA): Tab leaves the popup after that button and Shift+Tab returns to it, never to the span.
describe('Tab out of a Popover or Menu with a wrapper-span trigger inside a Dialog', () => {
  const SPANS = [
    ['asChild={false}', undefined],
    ['asChild={false} tabIndex={-1}', -1],
  ] as const;

  function PopoverInDialog({ spanTabIndex, last }: { spanTabIndex?: number; last?: boolean }) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Edit">
          <Button>Before</Button>
          <Popover>
            <Popover.Trigger asChild={false} tabIndex={spanTabIndex}>
              <Button>Format</Button>
            </Popover.Trigger>
            <Popover.Content title="Format options">
              <Button>Bold</Button>
              <Button>Italic</Button>
            </Popover.Content>
          </Popover>
          {!last && <Button>After</Button>}
        </Dialog.Content>
      </Dialog>
    );
  }

  it.each(SPANS)(
    'Popover, %s: Tab past the content reaches the element after the trigger; Shift+Tab from its first element, the button inside the span',
    async (_name, spanTabIndex) => {
      const user = userEvent.setup();
      render(<PopoverInDialog spanTabIndex={spanTabIndex} />);
      await user.click(button('Format'));
      const popover = screen.getByRole('dialog', { name: 'Format options' });
      await expectNoA11yViolations(document.body);
      await user.tab();
      expect(within(popover).getByRole('button', { name: 'Bold' })).toHaveFocus();
      await user.tab();
      expect(button('Italic')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Italic')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Bold')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Format')).toHaveFocus();
    },
  );

  it.each(SPANS)(
    'Popover, %s, as the last element of the dialog: the focus trap leaves the content after the button inside the span, not back on it',
    async (_name, spanTabIndex) => {
      const user = userEvent.setup();
      render(<PopoverInDialog spanTabIndex={spanTabIndex} last />);
      const dialog = screen.getByRole('dialog', { name: 'Edit' });
      await user.click(button('Format'));
      await user.tab();
      await user.tab();
      expect(button('Italic')).toHaveFocus();
      // Nothing follows the trigger in the dialog, so the popover leaves Tab to the focus trap,
      // which continues after the popover's layer anchor: around the cycle, to the dialog's first
      // element (with the span as the anchor, Tab went back to the button inside it).
      await user.tab();
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    },
  );

  function MenuInDialog({ spanTabIndex }: { spanTabIndex?: number }) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Edit">
          <Button>Before</Button>
          <Menu>
            <Menu.Trigger asChild={false} tabIndex={spanTabIndex}>
              <Button>Actions</Button>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Rename</Menu.Item>
              <Menu.Item>Delete</Menu.Item>
            </Menu.Popover>
          </Menu>
          <Button>After</Button>
        </Dialog.Content>
      </Dialog>
    );
  }

  // The menu closes on Tab and Shift+Tab, puts focus on the button inside the span and lets the
  // browser move on from there (APG menu button), so Shift+Tab reaches the element before the
  // trigger. The key goes through fireEvent, whose result shows that the menu left it to the
  // browser (not prevented), and a Tab from the button stands for the browser's continuation.
  it.each(SPANS)(
    'Menu, %s: Tab and Shift+Tab close the menu on the button inside the span, and tabbing continues from that button',
    async (_name, spanTabIndex) => {
      const user = userEvent.setup();
      render(<MenuInDialog spanTabIndex={spanTabIndex} />);
      await user.click(button('Actions'));
      await expectNoA11yViolations(document.body);
      await user.keyboard('{End}');
      expect(menuitem('Delete')).toHaveFocus();
      // Not prevented: the focus trap leaves a Tab from the button inside the dialog to the browser.
      expect(fireEvent.keyDown(menuitem('Delete'), { key: 'Tab' })).toBe(true);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(button('Actions')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();

      await user.click(button('Actions'));
      expect(menuitem('Rename')).toHaveFocus();
      expect(fireEvent.keyDown(menuitem('Rename'), { key: 'Tab', shiftKey: true })).toBe(true);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(button('Actions')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Before')).toHaveFocus();
    },
  );
});

// ---------------------------------------------------------------------------
// A Popover opened inside a Menu.Item (portal events bubbling through the menu)
// ---------------------------------------------------------------------------

// React bubbles the events of the portaled Popover.Content through the Menu.Item and the menu
// surface. The menu leaves them alone: no activation, no typeahead, no close, no focus move.
describe('a Popover inside a persistOnClick Menu.Item', () => {
  function RenameMenu({ onRename, onDelete }: { onRename?: () => void; onDelete?: () => void }) {
    return (
      <Menu defaultOpen>
        <Menu.Trigger>
          <Button>Actions</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item persistOnClick onClick={onRename}>
            <Popover defaultOpen>
              <Popover.Trigger asChild={false}>Rename…</Popover.Trigger>
              <Popover.Content title="Rename">
                <Input aria-label="New name" />
                <Button>Save</Button>
              </Popover.Content>
            </Popover>
          </Menu.Item>
          <Menu.Item onClick={onDelete}>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  const nameInput = () => screen.getByRole('textbox', { name: 'New name' });

  it('typing, Space and Enter go to the field: the menu neither activates nor searches', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<RenameMenu onRename={onRename} />);
    await user.click(nameInput());
    onRename.mockClear();
    // "d" would move the menu's typeahead to Delete, Space and Enter would activate the item.
    await user.keyboard('del me{Enter}');
    expect(nameInput()).toHaveValue('del me');
    expect(nameInput()).toHaveFocus();
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
  });

  it('Tab moves on inside the popover: the menu stays open and focus stays out of the trigger', async () => {
    const user = userEvent.setup();
    render(<RenameMenu />);
    await user.click(nameInput());
    await user.tab();
    expect(button('Save')).toHaveFocus();
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(button('Actions')).toHaveAttribute('aria-expanded', 'true');
  });

  it('a click inside the popover keeps the menu and the popover open', async () => {
    const user = userEvent.setup();
    render(<RenameMenu />);
    await user.click(button('Save'));
    expect(button('Save')).toHaveFocus();
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
  });

  it('hovering another item while typing in the field leaves focus there: Enter does not activate that item', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<RenameMenu onDelete={onDelete} />);
    await user.click(nameInput());
    await user.keyboard('abc');
    // On its way, the pointer crosses Delete: the item under it takes no focus from the popover.
    await user.hover(menuitem('Delete'));
    expect(nameInput()).toHaveFocus();
    await user.keyboard('d{Enter}');
    expect(nameInput()).toHaveValue('abcd');
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rename' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Toolbar in an anchored TeachingPopover
// ---------------------------------------------------------------------------

describe('a Toolbar inside an anchored TeachingPopover', () => {
  it('keeps its first control as the Tab stop once the popover is shown', async () => {
    function Tour() {
      const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
      return (
        <>
          <Button ref={setTarget}>New feature</Button>
          <TeachingPopover
            target={target}
            steps={[
              {
                title: 'Format your text',
                body: (
                  <Toolbar aria-label="Formatting">
                    <Button>Bold</Button>
                    <Button>Italic</Button>
                  </Toolbar>
                ),
              },
            ]}
          />
        </>
      );
    }
    render(<Tour />);
    // The popover is hidden (visibility) until it is positioned against the target.
    const popover = await screen.findByRole('dialog', { name: /Format your text/ });
    const toolbar = within(popover).getByRole('toolbar', { name: 'Formatting' });
    expect(within(toolbar).getByRole('button', { name: 'Bold' })).toHaveAttribute('tabindex', '0');
    expect(within(toolbar).getByRole('button', { name: 'Italic' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });
});

// ---------------------------------------------------------------------------
// Inner widgets that consume Escape inside a Dialog (C-POPUPS)
// ---------------------------------------------------------------------------

describe('inner widgets that consume Escape inside a real Dialog', () => {
  function InDialog({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Find">{children}</Dialog.Content>
      </Dialog>
    );
  }

  it('SearchBox: the first Escape clears the text, the second closes the Dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <InDialog onOpenChange={onOpenChange}>
        <SearchBox aria-label="Search" />
      </InDialog>,
    );
    const search = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(search, 'wave');
    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Find' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });

  it('SpinButton: the first Escape reverts the draft, the second closes the Dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <InDialog onOpenChange={onOpenChange}>
        <SpinButton aria-label="Quantity" defaultValue={4} />
      </InDialog>,
    );
    const spin = screen.getByRole('spinbutton', { name: 'Quantity' });
    await user.clear(spin);
    await user.type(spin, '9');
    expect(spin).toHaveValue('9');
    await user.keyboard('{Escape}');
    expect(spin).toHaveValue('4');
    expect(spin).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Find' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });
});

// ---------------------------------------------------------------------------
// Focusable disabled buttons in a Toolbar and as menu triggers
// ---------------------------------------------------------------------------

describe('a Toolbar with a focusable disabled Button', () => {
  function Formatting({ onPaste, onBold }: { onPaste?: () => void; onBold?: () => void }) {
    return (
      <Toolbar aria-label="Formatting">
        <Button onClick={onBold}>Bold</Button>
        <Tooltip content="Copy something first" openDelay={0}>
          <Button disabledFocusable onClick={onPaste}>
            Paste
          </Button>
        </Tooltip>
        <ToggleButton>Italic</ToggleButton>
      </Toolbar>
    );
  }

  it('the arrow keys, Home and End reach it, and it can hold the tab stop', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Formatting />
        <button type="button">After</button>
      </>,
    );
    const paste = button('Paste');
    expect(paste).toHaveAttribute('aria-disabled', 'true');
    expect(paste).toHaveAttribute('data-disabled-focusable', '');
    expect(paste).not.toBeDisabled();
    await user.tab();
    expect(button('Bold')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(paste).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Italic')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(paste).toHaveFocus();
    await user.keyboard('{End}');
    expect(button('Italic')).toHaveFocus();
    await user.keyboard('{Home}{ArrowRight}');
    expect(paste).toHaveFocus();
    // Tab leaves the toolbar; Shift+Tab comes back to the focusable disabled button.
    await user.tab();
    expect(button('After')).toHaveFocus();
    await user.tab({ shift: true });
    expect(paste).toHaveFocus();
    await expectNoA11yViolations(document.body);
  });

  it('Enter, Space and a click do nothing, and the click does not reach the toolbar', async () => {
    const user = userEvent.setup();
    const onPaste = vi.fn();
    const onBold = vi.fn();
    const onToolbarClick = vi.fn();
    render(
      <div onClick={onToolbarClick}>
        <Formatting onPaste={onPaste} onBold={onBold} />
      </div>,
    );
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(button('Paste')).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(button('Paste'));
    expect(onPaste).not.toHaveBeenCalled();
    expect(onToolbarClick).not.toHaveBeenCalled();
    expect(button('Paste')).toHaveFocus();
    // The enabled neighbours still act, and their clicks reach the toolbar.
    await user.keyboard('{ArrowLeft}{Enter}');
    expect(onBold).toHaveBeenCalledTimes(1);
    await user.keyboard('{End} ');
    expect(button('Italic')).toHaveAttribute('aria-pressed', 'true');
    expect(onToolbarClick).toHaveBeenCalledTimes(2);
  });

  it('its Tooltip opens when the arrow keys focus it and describes it', async () => {
    const user = userEvent.setup();
    render(<Formatting />);
    expect(button('Paste')).toHaveAccessibleDescription('Copy something first');
    await user.tab();
    expect(tooltipSurface()).toBeNull();
    await user.keyboard('{ArrowRight}');
    expect(button('Paste')).toHaveFocus();
    expect(tooltipSurface()).toHaveTextContent('Copy something first');
    await expectNoA11yViolations(document.body);
    await user.keyboard('{ArrowRight}');
    expect(tooltipSurface()).toBeNull();
  });
});

describe('Menu.Trigger around a focusable disabled MenuButton or SplitButton', () => {
  type Variant =
    | 'MenuButton as the child'
    | 'MenuButton inside the wrapper span'
    | 'SplitButton menu half (render prop)'
    | 'SplitButton inside the wrapper span';

  function Trigger({
    variant,
    disabledFocusable,
  }: {
    variant: Variant;
    disabledFocusable: boolean;
  }) {
    let trigger: React.ReactNode;
    if (variant === 'MenuButton as the child') {
      trigger = (
        <Menu.Trigger>
          <MenuButton disabledFocusable={disabledFocusable}>Actions</MenuButton>
        </Menu.Trigger>
      );
    } else if (variant === 'MenuButton inside the wrapper span') {
      trigger = (
        <Menu.Trigger asChild={false}>
          <MenuButton disabledFocusable={disabledFocusable}>Actions</MenuButton>
        </Menu.Trigger>
      );
    } else if (variant === 'SplitButton menu half (render prop)') {
      trigger = (
        <Menu.Trigger>
          {(triggerProps) => (
            <SplitButton disabledFocusable={disabledFocusable} menuButtonProps={triggerProps}>
              Save
            </SplitButton>
          )}
        </Menu.Trigger>
      );
    } else {
      trigger = (
        <Menu.Trigger asChild={false}>
          <SplitButton disabledFocusable={disabledFocusable}>Save</SplitButton>
        </Menu.Trigger>
      );
    }
    return (
      <Menu>
        {trigger}
        <Menu.Popover>
          <Menu.Item>First</Menu.Item>
          <Menu.Item>Last</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  const variants: Array<[Variant, string]> = [
    ['MenuButton as the child', 'Actions'],
    ['MenuButton inside the wrapper span', 'Actions'],
    ['SplitButton menu half (render prop)', 'More options'],
    ['SplitButton inside the wrapper span', 'More options'],
  ];
  const activations = [
    ['a click', null],
    ['Enter', '{Enter}'],
    ['Space', ' '],
    ['ArrowDown', '{ArrowDown}'],
    ['ArrowUp', '{ArrowUp}'],
  ] as const;
  const cases = variants.flatMap(([variant, name]) =>
    activations.map(([how, keys]) => [variant, how, name, keys] as const),
  );

  async function activate(
    user: ReturnType<typeof userEvent.setup>,
    target: HTMLElement,
    keys: string | null,
  ) {
    if (keys === null) {
      await user.click(target);
    } else {
      act(() => target.focus());
      await user.keyboard(keys);
    }
  }

  it.each(cases)('%s: %s does not open the menu', async (variant, _how, name, keys) => {
    const user = userEvent.setup();
    render(<Trigger variant={variant} disabledFocusable />);
    const target = button(name);
    // The aria-disabled element is the trigger element or inside it, where Menu.Trigger looks.
    expect(target).toHaveAttribute('aria-disabled', 'true');
    expect(target).toHaveAttribute('data-disabled-focusable', '');
    expect(target).not.toBeDisabled();
    await activate(user, target, keys);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(target).toHaveFocus();
    expect(document.querySelector('[aria-haspopup="menu"]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  // The same interactions open the menu without disabledFocusable, so each one reaches the trigger.
  it.each(cases)(
    '%s: %s opens the menu without disabledFocusable',
    async (variant, _how, name, keys) => {
      const user = userEvent.setup();
      render(<Trigger variant={variant} disabledFocusable={false} />);
      await activate(user, button(name), keys);
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(menuitem(keys === '{ArrowUp}' ? 'Last' : 'First')).toHaveFocus();
    },
  );

  it('SplitButton puts aria-disabled on the menu half that carries the trigger props', () => {
    render(<Trigger variant="SplitButton menu half (render prop)" disabledFocusable />);
    const more = button('More options');
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-disabled', 'true');
    expect(button('Save')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-disabled');
  });
});

// ---------------------------------------------------------------------------
// Field validation states around the controls of other packages
// ---------------------------------------------------------------------------

describe('a Field validation message around Input, Checkbox, Combobox, ColorPicker and <input>', () => {
  const controls: Array<{
    name: string;
    role: string;
    control: () => React.ReactElement;
    /**
     * The focusable element inside a composite, which carries `aria-invalid` and is described by
     * the message (ColorPicker's hex input; the group itself is described by message and hint).
     */
    inner?: () => HTMLElement;
  }> = [
    { name: 'Input', role: 'textbox', control: () => <Input /> },
    { name: 'Checkbox', role: 'checkbox', control: () => <Checkbox /> },
    { name: 'Combobox', role: 'combobox', control: () => <Combobox>{fruitOptions}</Combobox> },
    {
      name: 'ColorPicker',
      role: 'group',
      control: () => <ColorPicker />,
      inner: () => screen.getByRole('textbox', { name: 'Hex color value' }),
    },
    { name: 'a native <input>', role: 'textbox', control: () => <input /> },
  ];

  describe.each(controls)('$name', ({ role, control, inner }) => {
    it('a warning describes it (message, then hint) and never marks it invalid', async () => {
      render(
        <Field
          label="Preference"
          hint="Pick one"
          validationState="warning"
          validationMessage="Check this choice"
        >
          {control()}
        </Field>,
      );
      const named = screen.getByRole(role, { name: 'Preference' });
      expect(screen.getByRole('alert')).toHaveTextContent('Check this choice');
      expect(named).toHaveAccessibleDescription(/Check this choice.*Pick one/);
      if (inner) expect(inner()).toHaveAccessibleDescription(/Check this choice/);
      expect(document.querySelector('[aria-invalid]')).toBeNull();
      expect(duplicateIds()).toEqual([]);
      await expectNoA11yViolations(document.body);
    });

    it('an error marks it invalid and describes it (message, then hint)', async () => {
      render(
        <Field label="Preference" hint="Pick one" error="Choose a value">
          {control()}
        </Field>,
      );
      const named = screen.getByRole(role, { name: 'Preference' });
      expect(screen.getByRole('alert')).toHaveTextContent('Choose a value');
      expect(named).toHaveAccessibleDescription(/Choose a value.*Pick one/);
      if (inner) expect(inner()).toHaveAccessibleDescription(/Choose a value/);
      expect(inner ? inner() : named).toHaveAttribute('aria-invalid', 'true');
      expect(duplicateIds()).toEqual([]);
      await expectNoA11yViolations(document.body);
    });

    it('validationState="error" with a validationMessage marks it invalid as error does', () => {
      render(
        <Field
          label="Preference"
          hint="Pick one"
          validationState="error"
          validationMessage="Choose a value"
        >
          {control()}
        </Field>,
      );
      const named = screen.getByRole(role, { name: 'Preference' });
      expect(named).toHaveAccessibleDescription(/Choose a value.*Pick one/);
      expect(inner ? inner() : named).toHaveAttribute('aria-invalid', 'true');
    });
  });
});

describe('a Field validation state around a ProgressBar', () => {
  it.each([
    ['warning', 'bg-severe'],
    ['error', 'bg-error'],
  ] as const)(
    '%s: named by the label, described by the message and hint, colored, never invalid or required',
    async (state, fill) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Field
          label="Upload"
          hint="Up to 10 MB"
          required
          validationState={state}
          validationMessage="The file is large"
        >
          <ProgressBar value={40} />
        </Field>,
      );
      const bar = screen.getByRole('progressbar', { name: 'Upload' });
      expect(bar).toHaveAccessibleDescription('The file is large Up to 10 MB');
      expect(bar).toHaveAttribute('data-color', state);
      expect(bar.querySelector(`.${fill}`)).not.toBeNull();
      expect(bar).not.toHaveAttribute('aria-invalid');
      expect(bar).not.toHaveAttribute('aria-required');
      expect(bar).toHaveAttribute('aria-valuenow', '40');
      await expectNoA11yViolations(document.body);
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it('an explicit color wins over the Field state', () => {
    render(
      <Field label="Upload" validationState="error" validationMessage="Failed">
        <ProgressBar value={40} color="brand" />
      </Field>,
    );
    expect(screen.getByRole('progressbar', { name: 'Upload' })).toHaveAttribute(
      'data-color',
      'brand',
    );
  });
});

// ---------------------------------------------------------------------------
// An inverted Spinner in a primary Button
// ---------------------------------------------------------------------------

describe('an inverted Spinner in the icon slot of a primary Button', () => {
  it('keeps the Button named by its text and passes axe', async () => {
    render(
      <Button appearance="primary" icon={<Spinner appearance="inverted" size="extra-small" />}>
        Saving
      </Button>,
    );
    const saving = button('Saving');
    expect(saving).toHaveAccessibleName('Saving');
    expect(saving.querySelector('[data-appearance="inverted"]')).not.toBeNull();
    await expectNoA11yViolations(document.body);
  });
});

// ---------------------------------------------------------------------------
// Alert dialogs and long forms
// ---------------------------------------------------------------------------

describe('a Toast over an alert Dialog', () => {
  function setup() {
    const onOpenChange = vi.fn();
    render(
      <Toaster>
        <Dialog open modalType="alert" onOpenChange={onOpenChange}>
          <Dialog.Content title="Delete report.pdf?">
            <NotifyButton />
          </Dialog.Content>
        </Dialog>
      </Toaster>,
    );
    return { onOpenChange, user: userEvent.setup() };
  }

  const region = () => screen.getByRole('region', { name: 'Notifications' });
  const alertDialog = () => screen.getByRole('alertdialog', { name: 'Delete report.pdf?' });

  it('stays announced and reachable by Tab while the alert is open', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Notify'));
    expect(region().closest('[inert]')).toBeNull();
    expect(region().closest('[aria-hidden="true"]')).toBeNull();
    expect(within(region()).getByRole('status')).toHaveTextContent('Saved');
    await expectNoA11yViolations(document.body);
    await user.tab();
    const dismiss = within(region()).getByRole('button', { name: 'Dismiss' });
    expect(dismiss).toHaveFocus();
    await user.keyboard('{Enter}');
    await act(async () => {});
    expect(within(region()).queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(alertDialog()).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Notify')).toHaveFocus();
  });

  it('a backdrop press does not close the alert or move focus; Escape does close it', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Notify'));
    const backdrop = alertDialog().parentElement!;
    await user.click(backdrop);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(alertDialog()).toBeInTheDocument();
    expect(within(region()).getByText('Saved')).toBeInTheDocument();
    expect(button('Notify')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });
});

describe('a Dialog with a long form of Fields and a Dialog.Footer', () => {
  const FOOTER_HEIGHT = '--wave-dialog-footer-height';
  let resizeObserver: ReturnType<typeof installResizeObserverMock> | undefined;
  afterEach(() => {
    resizeObserver?.restore();
    resizeObserver = undefined;
  });

  function ProfileDialog({ onSubmit }: { onSubmit: (event: React.FormEvent) => void }) {
    return (
      <Dialog defaultOpen>
        <Dialog.Content title="Profile">
          <form aria-label="Profile" onSubmit={onSubmit}>
            {Array.from({ length: 20 }, (_, index) => (
              <Field key={index} label={`Field ${index + 1}`}>
                <Input />
              </Field>
            ))}
            <Dialog.Footer data-testid="footer">
              <Dialog.Close>
                <Button>Cancel</Button>
              </Dialog.Close>
              <Button type="submit" appearance="primary">
                Save
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>
    );
  }

  it('reserves the footer height as the body scroll padding, so the focused last field stays above it', async () => {
    resizeObserver = installResizeObserverMock();
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<ProfileDialog onSubmit={onSubmit} />);
    const form = screen.getByRole('form', { name: 'Profile' });
    const footer = screen.getByTestId('footer');
    const body = form.parentElement!;
    expect(body).toHaveClass('overflow-y-auto', `scroll-pb-(${FOOTER_HEIGHT})`);
    expect(form.lastElementChild).toBe(footer);
    expect(footer).toHaveClass('sticky', '-bottom-1', 'bg-background');

    mockRect(footer, { height: 64 });
    resizeObserver.trigger(footer);
    expect(body.style.getPropertyValue(FOOTER_HEIGHT)).toBe('64px');

    const last = screen.getByRole('textbox', { name: 'Field 20' });
    await user.click(last);
    expect(last).toHaveFocus();
    expect(last.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.tab();
    expect(button('Cancel')).toHaveFocus();
    await user.tab();
    expect(button('Save')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });
});

describe('a SpinButton in a Dialog or Drawer: a backdrop press commits its typed value', () => {
  type Surface = 'Dialog' | 'Drawer';
  type SurfaceProps = Pick<DialogProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'modalType'>;

  /** A dialog or drawer titled "Page size" around a SpinButton, which commits typed text on blur. */
  function PageSize({
    surface,
    onValueChange,
    ...props
  }: SurfaceProps & { surface: Surface; onValueChange: (value: number) => void }) {
    const rows = <SpinButton aria-label="Rows" defaultValue={10} onValueChange={onValueChange} />;
    if (surface === 'Drawer') {
      const { open, defaultOpen, onOpenChange } = props;
      return (
        <Drawer title="Page size" open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
          {rows}
        </Drawer>
      );
    }
    return (
      <Dialog {...props}>
        <Dialog.Content title="Page size">{rows}</Dialog.Content>
      </Dialog>
    );
  }

  /** The backdrop behind the open surface (its parent element). */
  const backdropOf = (role: 'dialog' | 'alertdialog') => screen.getByRole(role).parentElement!;

  async function typeRows(user: ReturnType<typeof userEvent.setup>, text: string) {
    const rows = screen.getByRole('spinbutton', { name: 'Rows' });
    await user.clear(rows);
    await user.type(rows, text);
    return rows;
  }

  it.each([
    ['Dialog', 'backdrop'],
    ['Dialog', 'Close button'],
    ['Drawer', 'backdrop'],
    ['Drawer', 'Close button'],
  ] as const)('%s: the %s closes it and the typed value is committed', async (surface, path) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<PageSize surface={surface} defaultOpen onValueChange={onValueChange} />);
    await typeRows(user, '50');
    await user.click(path === 'backdrop' ? backdropOf('dialog') : button('Close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onValueChange.mock.calls).toEqual([[50]]);
  });

  it.each(['Dialog', 'Drawer'] as const)(
    '%s: a refused backdrop press commits the typed value and gives focus back to the SpinButton',
    async (surface) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      function RefusesBackdrop() {
        const [open, setOpen] = React.useState(true);
        return (
          <PageSize
            surface={surface}
            open={open}
            onOpenChange={(next, details) => {
              if (details?.reason !== 'outside-press') setOpen(next);
            }}
            onValueChange={onValueChange}
          />
        );
      }
      render(<RefusesBackdrop />);
      const rows = await typeRows(user, '50');
      await user.click(backdropOf('dialog'));
      expect(screen.getByRole('dialog', { name: 'Page size' })).toBeInTheDocument();
      expect(onValueChange.mock.calls).toEqual([[50]]);
      expect(rows).toHaveFocus();
      expect(rows).toHaveValue('50');
    },
  );

  it('an alert Dialog: the press neither closes it nor blurs the SpinButton, whose text stays a draft', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <PageSize surface="Dialog" defaultOpen modalType="alert" onValueChange={onValueChange} />,
    );
    const rows = await typeRows(user, '50');
    await user.click(backdropOf('alertdialog'));
    expect(screen.getByRole('alertdialog', { name: 'Page size' })).toBeInTheDocument();
    expect(rows).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(rows).toHaveValue('50');
  });
});

// ---------------------------------------------------------------------------
// Menus and commands: checkable items, links, submenus, hover and context menus, toolbars
// ---------------------------------------------------------------------------

describe('menus and commands across components', () => {
  const html = document.documentElement;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // A 1024×768 viewport (jsdom has no layout), so a menu fits where it is placed.
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
  });
  afterEach(() => {
    Reflect.deleteProperty(html, 'clientWidth');
    Reflect.deleteProperty(html, 'clientHeight');
    try {
      // Nothing is logged: no test here expects a warning.
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  const checkbox = (name: string) => screen.getByRole('menuitemcheckbox', { name });
  const radio = (name: string) => screen.getByRole('menuitemradio', { name });
  const menuNamed = (name: string) => screen.getByRole('menu', { name });
  const queryMenuNamed = (name: string) => screen.queryByRole('menu', { name });
  const checkedOf = (el: HTMLElement) => el.getAttribute('aria-checked');

  /** The surface's `translate(x, y)` position (floating-ui's transform styles). */
  function translateOf(el: HTMLElement): { x: number; y: number } {
    const match = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
  }

  /** Fake timers for the hover cases, with a user-event instance that advances them. */
  function setupHoverClock(): { user: UserEvent; advance: (ms: number) => void } {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    return {
      user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }),
      advance: (ms) =>
        act(() => {
          vi.advanceTimersByTime(ms);
        }),
    };
  }

  // -------------------------------------------------------------------------
  // Checkable items and groups in a submenu, bound to the root's checked values
  // -------------------------------------------------------------------------

  describe('a File menu with a View submenu of grouped checkbox and radio items', () => {
    function FileMenu({ root, view }: { root?: Partial<MenuProps>; view?: Partial<MenuProps> }) {
      return (
        <Menu defaultCheckedValues={{ show: ['ruler'], sort: ['name'] }} {...root}>
          <Menu.Trigger>
            <MenuButton>File</MenuButton>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>New</Menu.Item>
            <Menu {...view}>
              <Menu.Trigger>
                <Menu.Item>View</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.Group>
                  <Menu.GroupHeader>Show</Menu.GroupHeader>
                  <Menu.ItemCheckbox name="show" value="ruler">
                    Ruler
                  </Menu.ItemCheckbox>
                  <Menu.ItemCheckbox name="show" value="grid">
                    Gridlines
                  </Menu.ItemCheckbox>
                </Menu.Group>
                <Menu.Divider />
                <Menu.Group>
                  <Menu.GroupHeader>Sort by</Menu.GroupHeader>
                  <Menu.ItemRadio name="sort" value="name">
                    Name
                  </Menu.ItemRadio>
                  <Menu.ItemRadio name="sort" value="date">
                    Date
                  </Menu.ItemRadio>
                </Menu.Group>
              </Menu.Popover>
            </Menu>
            <Menu.Item>Exit</Menu.Item>
          </Menu.Popover>
        </Menu>
      );
    }

    async function openView(user: UserEvent) {
      await user.click(button('File'));
      await user.click(menuitem('View'));
      expect(checkbox('Ruler')).toHaveFocus();
    }

    it('Space toggles in the submenu and keeps every menu open; the root holds the values', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(<FileMenu root={{ onCheckedValuesChange }} />);
      await openView(user);
      expect(screen.getByRole('group', { name: 'Show' })).toContainElement(checkbox('Gridlines'));
      expect(screen.getByRole('group', { name: 'Sort by' })).toContainElement(radio('Date'));
      expect(checkedOf(checkbox('Ruler'))).toBe('true');
      expect(checkedOf(radio('Name'))).toBe('true');

      // The group headers are no items: ArrowDown goes from Gridlines to Name.
      await user.keyboard('{ArrowDown} ');
      expect(checkedOf(checkbox('Gridlines'))).toBe('true');
      await user.keyboard('{ArrowDown}{ArrowDown} ');
      expect(radio('Date')).toHaveFocus();
      expect(checkedOf(radio('Date'))).toBe('true');
      expect(checkedOf(radio('Name'))).toBe('false');
      expect(menuNamed('View')).toBeInTheDocument();
      expect(menuNamed('File')).toBeInTheDocument();

      expect(
        onCheckedValuesChange.mock.calls.map(([values, details]) => [
          values,
          details.name,
          details.checkedItems,
          details.event.type,
        ]),
      ).toEqual([
        [{ show: ['ruler', 'grid'], sort: ['name'] }, 'show', ['ruler', 'grid'], 'click'],
        [{ show: ['ruler', 'grid'], sort: ['date'] }, 'sort', ['date'], 'click'],
      ]);
      await expectNoA11yViolations(document.body);
    });

    it('Enter toggles, closes every menu and leaves focus on the root MenuButton', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<FileMenu root={{ onOpenChange }} />);
      await openView(user);
      await user.keyboard('{ArrowDown}{Enter}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(button('File')).toHaveFocus();
      expect(button('File')).toHaveAttribute('aria-expanded', 'false');
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);

      await openView(user);
      expect(checkedOf(checkbox('Gridlines'))).toBe('true');
    });

    it('a submenu with its own defaultCheckedValues keeps a separate state', async () => {
      const user = userEvent.setup();
      const onRootChange = vi.fn();
      const onViewChange = vi.fn();
      render(
        <FileMenu
          root={{ onCheckedValuesChange: onRootChange }}
          view={{ defaultCheckedValues: { show: ['grid'] }, onCheckedValuesChange: onViewChange }}
        />,
      );
      await openView(user);
      expect(checkedOf(checkbox('Ruler'))).toBe('false');
      expect(checkedOf(checkbox('Gridlines'))).toBe('true');
      expect(checkedOf(radio('Name'))).toBe('false');
      await user.keyboard(' ');
      expect(checkedOf(checkbox('Ruler'))).toBe('true');
      expect(onViewChange.mock.calls.map(([values]) => values)).toEqual([
        { show: ['grid', 'ruler'] },
      ]);
      expect(onRootChange).not.toHaveBeenCalled();
    });

    it('a submenu with only onCheckedValuesChange shares the root’s state and hears its changes after the root', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      const rootCalls: Array<[Record<string, string[]>, CheckedValuesChangeDetails | undefined]> =
        [];
      const viewCalls: typeof rootCalls = [];
      render(
        <FileMenu
          root={{
            onCheckedValuesChange: (values, details) => {
              order.push('root');
              rootCalls.push([values, details]);
            },
          }}
          view={{
            onCheckedValuesChange: (values, details) => {
              order.push('view');
              viewCalls.push([values, details]);
            },
          }}
        />,
      );
      await openView(user);
      expect(checkedOf(checkbox('Ruler'))).toBe('true');
      await user.keyboard('{ArrowDown} ');
      expect(order).toEqual(['root', 'view']);
      expect(viewCalls[0][0]).toBe(rootCalls[0][0]);
      expect(viewCalls[0][1]).toBe(rootCalls[0][1]);
      expect(rootCalls[0][0]).toEqual({ show: ['ruler', 'grid'], sort: ['name'] });
    });
  });

  // -------------------------------------------------------------------------
  // Link items in a popup menu and a submenu
  // -------------------------------------------------------------------------

  describe('Menu.ItemLink in a popup menu and in a submenu', () => {
    function AccountMenu(props: Partial<MenuProps>) {
      return (
        <Menu {...props}>
          <Menu.Trigger>
            <MenuButton>Account</MenuButton>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.ItemLink href="#profile">Profile</Menu.ItemLink>
            <Menu>
              <Menu.Trigger>
                <Menu.Item>Help</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.ItemLink href="#docs">Documentation</Menu.ItemLink>
              </Menu.Popover>
            </Menu>
          </Menu.Popover>
        </Menu>
      );
    }

    /**
     * Records, for each click that reaches `document`, whether it was default-prevented and where
     * focus was, then prevents it (jsdom does not navigate). A bubble-phase listener on `document`
     * runs after React's root listener, so it sees what the item did.
     */
    function recordClicks(): Array<{
      prevented: boolean;
      ctrlKey: boolean;
      focused: string | null;
    }> {
      const clicks: Array<{ prevented: boolean; ctrlKey: boolean; focused: string | null }> = [];
      const listener = (event: MouseEvent) => {
        clicks.push({
          prevented: event.defaultPrevented,
          ctrlKey: event.ctrlKey,
          focused: document.activeElement?.textContent ?? null,
        });
        event.preventDefault();
      };
      document.addEventListener('click', listener);
      onTestFinished(() => document.removeEventListener('click', listener));
      return clicks;
    }

    const cases = [
      ['in the root list', 'a click', 'Profile', false, false],
      ['in the root list', 'a Ctrl-click', 'Profile', true, false],
      ['in a submenu', 'a click', 'Documentation', false, false],
      ['in a submenu', 'a Ctrl-click', 'Documentation', true, false],
      ['in a submenu under persistOnItemClick', 'a click', 'Documentation', false, true],
    ] as const;

    it.each(cases)(
      '%s, %s closes every menu, focusing the MenuButton first, and navigates',
      async (_where, _click, name, ctrlKey, persistOnItemClick) => {
        const user = userEvent.setup();
        render(<AccountMenu persistOnItemClick={persistOnItemClick} />);
        await user.click(button('Account'));
        if (name === 'Documentation') await user.click(menuitem('Help'));
        const link = menuitem(name);
        expect(link.tagName).toBe('A');
        const clicks = recordClicks();
        if (ctrlKey) await user.keyboard('{Control>}');
        await user.click(link);
        if (ctrlKey) await user.keyboard('{/Control}');
        expect(clicks).toEqual([{ prevented: false, ctrlKey, focused: 'Account' }]);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(button('Account')).toHaveFocus();
      },
    );
  });

  // -------------------------------------------------------------------------
  // A context menu with checkable items and a submenu
  // -------------------------------------------------------------------------

  describe('a context menu with checkable items and a submenu', () => {
    const ROWS = ['report.docx', 'notes.txt', 'draft.md'];

    function FileList({ onCheckedValuesChange }: Partial<MenuProps>) {
      return (
        <div data-testid="page">
          <Menu
            openOnContext
            defaultCheckedValues={{ sort: ['name'] }}
            onCheckedValuesChange={onCheckedValuesChange}
          >
            <Menu.Trigger>
              <div data-testid="region" aria-keyshortcuts="Shift+F10">
                {ROWS.map((name) => (
                  <button key={name} type="button">
                    {name}
                  </button>
                ))}
              </div>
            </Menu.Trigger>
            <Menu.Popover aria-label="File actions">
              <Menu.Item>Open</Menu.Item>
              <Menu.ItemCheckbox name="flags" value="pinned">
                Pinned
              </Menu.ItemCheckbox>
              <Menu>
                <Menu.Trigger>
                  <Menu.Item>Sort by</Menu.Item>
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.ItemRadio name="sort" value="name">
                    Name
                  </Menu.ItemRadio>
                  <Menu.ItemRadio name="sort" value="date">
                    Date
                  </Menu.ItemRadio>
                </Menu.Popover>
              </Menu>
            </Menu.Popover>
          </Menu>
          <button type="button">Elsewhere</button>
        </div>
      );
    }

    it('a right click opens it at the pointer, named by its aria-label; axe is clean with the submenu open', async () => {
      const user = userEvent.setup();
      render(<FileList />);
      expect(
        fireEvent.contextMenu(button('notes.txt'), { button: 2, clientX: 100, clientY: 200 }),
      ).toBe(false);
      const surface = menuNamed('File actions');
      expect(surface).not.toHaveAttribute('aria-labelledby');
      expect(menuitem('Open')).toHaveFocus();
      await waitFor(() => expect(translateOf(surface)).toEqual({ x: 100, y: 204 }));
      for (const name of ['aria-haspopup', 'aria-expanded', 'aria-controls']) {
        expect(screen.getByTestId('region')).not.toHaveAttribute(name);
      }
      await user.click(menuitem('Sort by'));
      expect(radio('Name')).toHaveFocus();
      expect(menuNamed('Sort by')).toBeInTheDocument();
      await expectNoA11yViolations(document.body);
    });

    it('Shift+F10 on a row opens it at the row; Escape in the submenu closes only the submenu; Enter on a checkable item closes the chain and returns focus to the row', async () => {
      const user = userEvent.setup();
      const onCheckedValuesChange = vi.fn();
      render(<FileList onCheckedValuesChange={onCheckedValuesChange} />);
      mockRect(button('draft.md'), { x: 20, y: 300, width: 200, height: 30 });
      act(() => button('draft.md').focus());
      await user.keyboard('{Shift>}{F10}{/Shift}');
      expect(menuitem('Open')).toHaveFocus();
      await waitFor(() =>
        expect(translateOf(menuNamed('File actions'))).toEqual({ x: 20, y: 334 }),
      );

      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
      expect(radio('Name')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(queryMenuNamed('Sort by')).not.toBeInTheDocument();
      expect(menuitem('Sort by')).toHaveFocus();
      expect(menuNamed('File actions')).toBeInTheDocument();

      await user.keyboard('{ArrowUp}{Enter}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(button('draft.md')).toHaveFocus();
      expect(onCheckedValuesChange.mock.calls.map(([values]) => values)).toEqual([
        { sort: ['name'], flags: ['pinned'] },
      ]);
    });

    it('a right click outside closes the menu and its submenu without preventing the browser’s menu', async () => {
      const user = userEvent.setup();
      render(<FileList />);
      fireEvent.contextMenu(button('notes.txt'), { button: 2, clientX: 100, clientY: 200 });
      await user.click(menuitem('Sort by'));
      expect(menuNamed('Sort by')).toBeInTheDocument();
      expect(fireEvent.contextMenu(button('Elsewhere'), { button: 2 })).toBe(true);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(getOpenLayers()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // A Toolbar over toggles, a radio group, fields and a menu button
  // -------------------------------------------------------------------------

  describe('a Toolbar with toggles, a radio group, an Input, a Combobox and a MenuButton', () => {
    const tabStops = () =>
      Array.from(screen.getByRole('toolbar').querySelectorAll<HTMLElement>('[tabindex="0"]'));
    const toolbarRadio = (name: string) => screen.getByRole('radio', { name });

    function EditorToolbar() {
      return (
        <>
          <button type="button">Before</button>
          <Toolbar
            aria-label="Editor"
            defaultCheckedValues={{ format: ['bold'], align: ['start'] }}
          >
            <Toolbar.ToggleButton name="format" value="bold">
              Bold
            </Toolbar.ToggleButton>
            <Toolbar.ToggleButton name="format" value="italic">
              Italic
            </Toolbar.ToggleButton>
            <Toolbar.Divider />
            <Toolbar.RadioGroup aria-label="Alignment">
              <Toolbar.RadioButton name="align" value="start">
                Start
              </Toolbar.RadioButton>
              <Toolbar.RadioButton name="align" value="center">
                Center
              </Toolbar.RadioButton>
            </Toolbar.RadioGroup>
            <Toolbar.Divider />
            <Input aria-label="Find" defaultValue="wave" />
            <Combobox aria-label="Font">
              <Combobox.Option value="sans">Sans</Combobox.Option>
              <Combobox.Option value="serif">Serif</Combobox.Option>
            </Combobox>
            <Menu defaultCheckedValues={{ view: ['ruler'] }}>
              <Menu.Trigger>
                <MenuButton>View</MenuButton>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.ItemCheckbox name="view" value="ruler">
                  Ruler
                </Menu.ItemCheckbox>
                <Menu.ItemCheckbox name="view" value="grid">
                  Gridlines
                </Menu.ItemCheckbox>
              </Menu.Popover>
            </Menu>
          </Toolbar>
          <button type="button">After</button>
        </>
      );
    }

    it('the arrows reach every control, the MenuButton opens its menu with ArrowDown, Escape returns to it, and the toolbar keeps one tab stop', async () => {
      const user = userEvent.setup();
      render(<EditorToolbar />);
      const find = screen.getByRole('textbox', { name: 'Find' });
      const font = screen.getByRole('combobox', { name: 'Font' });

      await user.tab();
      await user.tab();
      expect(button('Bold')).toHaveFocus();
      expect(button('Bold')).toHaveAttribute('aria-pressed', 'true');
      await user.keyboard('{ArrowRight}');
      expect(button('Italic')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(toolbarRadio('Start')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(toolbarRadio('Center')).toHaveFocus();
      // The arrows only move focus: the checked radio stays checked.
      expect(toolbarRadio('Start')).toHaveAttribute('aria-checked', 'true');
      expect(toolbarRadio('Center')).toHaveAttribute('aria-checked', 'false');
      await user.keyboard('{ArrowRight}');
      expect(find).toHaveFocus();
      // The Input keeps Left/Right for its caret.
      expect(fireEvent.keyDown(find, { key: 'ArrowLeft' })).toBe(true);
      await user.keyboard('{End}');
      expect(find).toHaveFocus();

      act(() => button('View').focus());
      await user.keyboard('{ArrowLeft}');
      expect(font).toHaveFocus();
      act(() => button('View').focus());

      await user.keyboard('{ArrowDown}');
      expect(menuNamed('View')).toBeInTheDocument();
      expect(checkbox('Ruler')).toHaveFocus();
      await user.keyboard('{ArrowDown} ');
      expect(checkedOf(checkbox('Gridlines'))).toBe('true');
      // Keys in the portaled menu stay the menu's: the toolbar did not move focus.
      expect(checkbox('Gridlines')).toHaveFocus();
      await expectNoA11yViolations(document.body);
      await user.keyboard('{Escape}');
      expect(queryMenuNamed('View')).not.toBeInTheDocument();
      expect(button('View')).toHaveFocus();
      expect(tabStops()).toEqual([button('View')]);

      await user.tab();
      expect(button('After')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('View')).toHaveFocus();
    });
  });

  describe('Menu.Trigger around a Toolbar.Button', () => {
    it('the trigger props merge onto the polymorphic part, which keeps its toolbar look', async () => {
      const user = userEvent.setup();
      render(
        <Toolbar aria-label="Insert" size="small">
          <Toolbar.Button>Undo</Toolbar.Button>
          <Menu>
            <Menu.Trigger>
              <Toolbar.Button vertical icon={{ children: '+' }}>
                Insert
              </Toolbar.Button>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Table</Menu.Item>
              <Menu.Item>Picture</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Toolbar>,
      );
      const insert = button('Insert');
      expect(insert.tagName).toBe('BUTTON');
      expect(insert).toHaveAttribute('aria-haspopup', 'menu');
      expect(insert).toHaveAttribute('aria-expanded', 'false');
      expect(insert).toHaveAttribute('data-vertical', '');
      expect(insert.parentElement).toBe(screen.getByRole('toolbar'));

      act(() => button('Undo').focus());
      await user.keyboard('{ArrowRight}');
      expect(insert).toHaveFocus();
      await user.keyboard('{Enter}');
      const menu = menuNamed('Insert');
      expect(insert).toHaveAttribute('aria-expanded', 'true');
      expect(insert).toHaveAttribute('aria-controls', menu.id);
      expect(menuitem('Table')).toHaveFocus();
      await expectNoA11yViolations(document.body);
      await user.keyboard('{ArrowDown}{Enter}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(insert).toHaveFocus();
    });
  });

  // -------------------------------------------------------------------------
  // Hover: a hover card holding a menu, and focus following the mouse in a submenu
  // -------------------------------------------------------------------------

  describe('a Popover with openOnHover holding a MenuButton and a Menu', () => {
    it('opens on hover; while the menu is open (focus in a layer of the popover) the pointer leaving does not close it', async () => {
      const { user, advance } = setupHoverClock();
      const onOpenChange = vi.fn();
      render(
        <>
          <Popover openOnHover onOpenChange={onOpenChange}>
            <Popover.Trigger>
              <Button>Ada Lovelace</Button>
            </Popover.Trigger>
            <Popover.Content title="Ada Lovelace">
              <Menu>
                <Menu.Trigger>
                  <MenuButton>Contact</MenuButton>
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item>Email</Menu.Item>
                  <Menu.Item>Chat</Menu.Item>
                </Menu.Popover>
              </Menu>
            </Popover.Content>
          </Popover>
          <button type="button">Elsewhere</button>
        </>,
      );
      await user.hover(button('Ada Lovelace'));
      advance(300);
      const card = screen.getByRole('dialog', { name: 'Ada Lovelace' });
      expect(button('Ada Lovelace')).not.toHaveFocus();

      await user.hover(button('Contact'));
      await user.click(button('Contact'));
      expect(menuNamed('Contact')).toBeInTheDocument();
      expect(menuitem('Email')).toHaveFocus();

      await user.hover(button('Elsewhere'));
      advance(1000);
      expect(card).toBeInTheDocument();
      expect(menuNamed('Contact')).toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[true]]);

      await user.keyboard('{Escape}');
      expect(queryMenuNamed('Contact')).not.toBeInTheDocument();
      expect(button('Contact')).toHaveFocus();
      // Focus is inside the card: it stays open.
      advance(1000);
      expect(card).toBeInTheDocument();
    });
  });

  describe('a hover-opened submenu inside a click-opened menu', () => {
    it('hovering a checkbox item of the submenu focuses it, and Space toggles that item', async () => {
      const { user, advance } = setupHoverClock();
      const onCheckedValuesChange = vi.fn();
      render(
        <Menu onCheckedValuesChange={onCheckedValuesChange}>
          <Menu.Trigger>
            <MenuButton>File</MenuButton>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.ItemCheckbox name="file" value="autosave">
              Autosave
            </Menu.ItemCheckbox>
            <Menu>
              <Menu.Trigger>
                <Menu.Item>View</Menu.Item>
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.ItemCheckbox name="view" value="ruler">
                  Ruler
                </Menu.ItemCheckbox>
                <Menu.ItemCheckbox name="view" value="grid">
                  Gridlines
                </Menu.ItemCheckbox>
              </Menu.Popover>
            </Menu>
          </Menu.Popover>
        </Menu>,
      );
      await user.click(button('File'));
      expect(checkbox('Autosave')).toHaveFocus();
      await user.hover(menuitem('View'));
      advance(300);
      expect(menuNamed('View')).toBeInTheDocument();
      // The submenu opened by hover: focus followed the mouse to its item, not into it.
      expect(menuitem('View')).toHaveFocus();

      await user.hover(checkbox('Gridlines'));
      expect(checkbox('Gridlines')).toHaveFocus();
      await user.keyboard(' ');
      expect(checkedOf(checkbox('Gridlines'))).toBe('true');
      expect(checkedOf(checkbox('Autosave'))).toBe('false');
      expect(menuNamed('View')).toBeInTheDocument();
      expect(onCheckedValuesChange.mock.calls.map(([values]) => values)).toEqual([
        { view: ['grid'] },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Focus return through a closing chain; exit motion inside a Dialog
  // -------------------------------------------------------------------------

  describe('a Dialog opened from a submenu item', () => {
    function FileMenu() {
      const [confirming, setConfirming] = React.useState(false);
      return (
        <>
          <Menu>
            <Menu.Trigger>
              <MenuButton>File</MenuButton>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>New</Menu.Item>
              <Menu>
                <Menu.Trigger>
                  <Menu.Item>More</Menu.Item>
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item>Duplicate</Menu.Item>
                  <Menu.Item onClick={() => setConfirming(true)}>Delete…</Menu.Item>
                </Menu.Popover>
              </Menu>
            </Menu.Popover>
          </Menu>
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <Dialog.Content title="Delete the file?">
              <Dialog.Close>
                <Button>Cancel</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </>
      );
    }

    it.each([
      ['Escape', '{Escape}'],
      ['its Close button', null],
    ])('returns focus to the root MenuButton when it closes (%s)', async (_how, keys) => {
      const user = userEvent.setup();
      render(<FileMenu />);
      await user.click(button('File'));
      await user.keyboard('{ArrowDown}{ArrowRight}');
      expect(menuitem('Duplicate')).toHaveFocus();
      await user.keyboard('{ArrowDown}{Enter}');
      // Every menu closed (the modal Dialog hides the rest of the page, hence `hidden`).
      expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'File', hidden: true })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.getByRole('dialog', { name: 'Delete the file?' })).toBeInTheDocument();
      if (keys) await user.keyboard(keys);
      else await user.click(button('Cancel'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(button('File')).toHaveFocus();
    });
  });

  describe('a Menu.Popover with an exit motion inside a Dialog, with a submenu of radio items', () => {
    function SettingsDialog({
      onDialogOpenChange,
      onSortOpenChange,
    }: {
      onDialogOpenChange: (open: boolean) => void;
      onSortOpenChange: (open: boolean) => void;
    }) {
      const [sortOpen, setSortOpen] = React.useState(false);
      return (
        <Dialog defaultOpen onOpenChange={onDialogOpenChange}>
          <Dialog.Content title="Settings">
            <Menu defaultCheckedValues={{ sort: ['name'] }}>
              <Menu.Trigger>
                <MenuButton>View</MenuButton>
              </Menu.Trigger>
              <Menu.Popover data-testid="view-surface" data-test-motion="">
                <Menu.Item>Refresh</Menu.Item>
                <Menu
                  open={sortOpen}
                  onOpenChange={(next) => {
                    onSortOpenChange(next);
                    setSortOpen(next);
                  }}
                >
                  <Menu.Trigger>
                    <Menu.Item>Sort by</Menu.Item>
                  </Menu.Trigger>
                  <Menu.Popover data-testid="sort-surface">
                    <Menu.ItemRadio name="sort" value="name">
                      Name
                    </Menu.ItemRadio>
                    <Menu.ItemRadio name="sort" value="date">
                      Date
                    </Menu.ItemRadio>
                  </Menu.Popover>
                </Menu>
              </Menu.Popover>
            </Menu>
          </Dialog.Content>
        </Dialog>
      );
    }

    const surface = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

    it.each([
      ['Enter on a radio item of the submenu', '{ArrowDown}{Enter}'],
      ['Escape in the submenu, then in the root list', '{Escape}{Escape}'],
    ])(
      '%s closes the submenu (its onOpenChange(false) once) and the menu; while it exits no menu layer is left, and the next Escape closes the Dialog',
      async (_how, keys) => {
        const motion = mockAnimations();
        const user = userEvent.setup();
        const onDialogOpenChange = vi.fn();
        const onSortOpenChange = vi.fn();
        render(
          <SettingsDialog
            onDialogOpenChange={onDialogOpenChange}
            onSortOpenChange={onSortOpenChange}
          />,
        );
        await user.click(button('View'));
        await act(async () => {
          await motion.finishAll();
        });
        await user.click(menuitem('Sort by'));
        expect(radio('Name')).toHaveFocus();
        expect(getOpenLayers()).toHaveLength(3);

        await user.keyboard(keys);
        const root = surface('view-surface')!;
        expect(root).toHaveAttribute('data-presence', 'exiting');
        expect(root).toHaveAttribute('data-state', 'closed');
        expect(root).toHaveAttribute('inert');
        expect(surface('sort-surface')).toBeNull();
        expect(onSortOpenChange.mock.calls).toEqual([[true], [false]]);
        expect(button('View')).toHaveFocus();
        // Only the Dialog's layer is left: the exiting surface is no layer.
        expect(getOpenLayers()).toHaveLength(1);

        await user.keyboard('{Escape}');
        expect(onDialogOpenChange.mock.calls).toEqual([[false, expect.anything()]]);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
    );
  });

  // -------------------------------------------------------------------------
  // SplitButton routing with a menu that holds a submenu
  // -------------------------------------------------------------------------

  describe('a SplitButton whose menu half opens a Menu with a submenu', () => {
    it('keeps the routed props on the right halves, and activation in the submenu returns focus to the menu half', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onPdf = vi.fn();
      render(
        <>
          <span id="save-hint">Saves a draft</span>
          <Menu>
            <Menu.Trigger>
              {(triggerProps) => (
                <SplitButton
                  aria-label="Save options"
                  aria-describedby="save-hint"
                  data-testid="split"
                  menuButtonProps={triggerProps}
                  onClick={onSave}
                >
                  Save
                </SplitButton>
              )}
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Save a copy</Menu.Item>
              <Menu>
                <Menu.Trigger>
                  <Menu.Item>Export</Menu.Item>
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item onClick={onPdf}>PDF</Menu.Item>
                  <Menu.Item>Word</Menu.Item>
                </Menu.Popover>
              </Menu>
            </Menu.Popover>
          </Menu>
        </>,
      );
      const group = screen.getByRole('group', { name: 'Save options' });
      expect(group).toHaveAttribute('data-testid', 'split');
      expect(button('Save')).toHaveAccessibleDescription('Saves a draft');
      expect(button('Save')).not.toHaveAttribute('aria-haspopup');
      const more = button('More options');
      expect(more).toHaveAttribute('aria-haspopup', 'menu');
      expect(more).not.toHaveAttribute('aria-describedby');

      await user.click(button('Save'));
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      await user.click(more);
      expect(menuNamed('More options')).toBeInTheDocument();
      await user.keyboard('{ArrowDown}{ArrowRight}');
      expect(menuNamed('Export')).toBeInTheDocument();
      expect(menuitem('PDF')).toHaveFocus();
      await expectNoA11yViolations(document.body);
      await user.keyboard('{Enter}');
      expect(onPdf).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(more).toHaveFocus();
      expect(more).toHaveAttribute('aria-expanded', 'false');
    });
  });

  // -------------------------------------------------------------------------
  // A Tooltip on an accessible Toolbar toggle
  // -------------------------------------------------------------------------

  describe('a Tooltip with openDelay on a Toolbar.ToggleButton with isAccessible', () => {
    it('shows on focus after the delay; the toggle reports aria-pressed and data-pressed together', async () => {
      const { user, advance } = setupHoverClock();
      render(
        <>
          <button type="button">Before</button>
          <Toolbar aria-label="Formatting" defaultCheckedValues={{ format: ['bold'] }}>
            <Tooltip content="Bold (Ctrl+B)" openDelay={300}>
              <Toolbar.ToggleButton name="format" value="bold" isAccessible>
                Bold
              </Toolbar.ToggleButton>
            </Tooltip>
            <Toolbar.ToggleButton name="format" value="italic" isAccessible>
              Italic
            </Toolbar.ToggleButton>
          </Toolbar>
        </>,
      );
      const bold = button('Bold');
      expect(bold).toHaveAccessibleDescription('Bold (Ctrl+B)');
      expect(bold).toHaveAttribute('aria-pressed', 'true');
      expect(bold).toHaveAttribute('data-pressed', '');
      expect(bold).not.toHaveAttribute('aria-checked');
      expect(bold).toHaveClass('bg-primary', 'text-primary-foreground');

      await user.tab();
      await user.tab();
      expect(bold).toHaveFocus();
      advance(250);
      expect(tooltipSurface()).toBeNull();
      advance(60);
      expect(tooltipSurface()).toHaveTextContent('Bold (Ctrl+B)');

      await user.keyboard(' ');
      expect(bold).toHaveAttribute('aria-pressed', 'false');
      expect(bold).not.toHaveAttribute('data-pressed');
      expect(bold).not.toHaveClass('bg-primary');
      await expectNoA11yViolations(document.body);
    });
  });

  // -------------------------------------------------------------------------
  // The checkable item kinds in real menus
  // -------------------------------------------------------------------------

  describe('checkbox, radio and switch items in a real MenuButton menu', () => {
    function OptionsMenu(props: Partial<MenuProps>) {
      return (
        <Menu defaultCheckedValues={{ show: ['ruler'], sort: ['name'] }} {...props}>
          <Menu.Trigger>
            <MenuButton>Options</MenuButton>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.ItemCheckbox name="show" value="ruler">
              Ruler
            </Menu.ItemCheckbox>
            <Menu.Divider />
            <Menu.Group>
              <Menu.GroupHeader>Sort by</Menu.GroupHeader>
              <Menu.ItemRadio name="sort" value="name">
                Name
              </Menu.ItemRadio>
              <Menu.ItemRadio name="sort" value="date">
                Date
              </Menu.ItemRadio>
            </Menu.Group>
            <Menu.Divider />
            <Menu.ItemSwitch name="editor" value="autosave">
              Autosave
            </Menu.ItemSwitch>
          </Menu.Popover>
        </Menu>
      );
    }

    const items = {
      Ruler: () => checkbox('Ruler'),
      Date: () => radio('Date'),
      Autosave: () => checkbox('Autosave'),
    } as const;
    // Space changes the item; Enter changes it back (a checked radio stays checked).
    const cases = [
      ['Ruler', 'false', 'true'],
      ['Date', 'true', 'true'],
      ['Autosave', 'true', 'false'],
    ] as const;

    it.each(cases)(
      '%s: Space keeps the menu open; Enter closes it and focuses the MenuButton',
      async (name, afterSpace, afterEnter) => {
        const user = userEvent.setup();
        render(<OptionsMenu />);
        await user.click(button('Options'));
        act(() => items[name]().focus());
        await user.keyboard(' ');
        expect(checkedOf(items[name]())).toBe(afterSpace);
        expect(menuNamed('Options')).toBeInTheDocument();
        expect(items[name]()).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(button('Options')).toHaveFocus();
        await user.click(button('Options'));
        expect(checkedOf(items[name]())).toBe(afterEnter);
      },
    );

    it('a click closes the menu and focuses the MenuButton; persistOnItemClick keeps it open', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<OptionsMenu />);
      await user.click(button('Options'));
      await user.click(checkbox('Autosave'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(button('Options')).toHaveFocus();

      rerender(<OptionsMenu persistOnItemClick />);
      await user.click(button('Options'));
      expect(checkedOf(checkbox('Autosave'))).toBe('true');
      await user.click(checkbox('Autosave'));
      await user.click(radio('Date'));
      act(() => checkbox('Ruler').focus());
      await user.keyboard('{Enter}');
      expect(menuNamed('Options')).toBeInTheDocument();
      expect(checkedOf(checkbox('Autosave'))).toBe('false');
      expect(checkedOf(radio('Date'))).toBe('true');
      expect(checkedOf(checkbox('Ruler'))).toBe('false');
      await expectNoA11yViolations(document.body);
    });

    it('inside a Dialog, Escape closes only the menu; the next Escape closes the Dialog', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <Dialog.Content title="Page setup">
            <OptionsMenu />
          </Dialog.Content>
        </Dialog>,
      );
      await user.click(button('Options'));
      await user.keyboard('{ArrowDown} ');
      expect(checkedOf(radio('Name'))).toBe('true');
      expect(menuNamed('Options')).toBeInTheDocument();
      await expectNoA11yViolations(document.body);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Page setup' })).toBeInTheDocument();
      expect(button('Options')).toHaveFocus();
      expect(onOpenChange).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onOpenChange.mock.calls).toEqual([[false, expect.anything()]]);
    });

    it('a static Menu renders its checked state, the check glyph and the group’s label in the server HTML, and hydrates it', async () => {
      const tree = (
        <Menu aria-label="View options" defaultCheckedValues={{ show: ['ruler'], sort: ['date'] }}>
          <Menu.ItemCheckbox name="show" value="ruler">
            Ruler
          </Menu.ItemCheckbox>
          <Menu.ItemSwitch name="show" value="grid">
            Gridlines
          </Menu.ItemSwitch>
          <Menu.Divider />
          <Menu.Group>
            <Menu.GroupHeader>Sort by</Menu.GroupHeader>
            <Menu.ItemRadio name="sort" value="name">
              Name
            </Menu.ItemRadio>
            <Menu.ItemRadio name="sort" value="date">
              Date
            </Menu.ItemRadio>
          </Menu.Group>
        </Menu>
      );
      const serverHtml = renderToString(tree);
      expect(findDanglingIdRefsInHtml(serverHtml)).toEqual([]);
      const container = document.createElement('div');
      container.innerHTML = serverHtml;
      document.body.appendChild(container);
      let root: Root | undefined;
      try {
        // The server HTML, before hydration.
        const ruler = within(container).getByRole('menuitemcheckbox', { name: 'Ruler' });
        expect(ruler).toHaveAttribute('aria-checked', 'true');
        expect(ruler).toHaveAttribute('data-checked', '');
        expect(ruler.querySelector('[data-menu-checkmark] svg')).not.toBeNull();
        const date = within(container).getByRole('menuitemradio', { name: 'Date' });
        expect(date).toHaveAttribute('aria-checked', 'true');
        expect(date.querySelector('[data-menu-checkmark] svg')).not.toBeNull();
        const name = within(container).getByRole('menuitemradio', { name: 'Name' });
        expect(name).toHaveAttribute('aria-checked', 'false');
        expect(name.querySelector('[data-menu-checkmark]')).toBeEmptyDOMElement();
        expect(
          within(container).getByRole('menuitemcheckbox', { name: 'Gridlines' }),
        ).toHaveAttribute('aria-checked', 'false');
        const group = within(container).getByRole('group', { name: 'Sort by' });
        expect(group.getAttribute('aria-labelledby')).toBe(
          within(group).getByText('Sort by').closest('[id]')?.id,
        );

        // Hydration: no mismatch (the describe's console.error spy sees any hydration warning).
        const recoverable: unknown[] = [];
        await act(async () => {
          root = hydrateRoot(container, tree, {
            onRecoverableError: (reason) => recoverable.push(reason),
          });
        });
        expect(recoverable).toEqual([]);

        const user = userEvent.setup();
        await user.click(within(container).getByRole('menuitemradio', { name: 'Name' }));
        expect(within(container).getByRole('menuitemradio', { name: 'Name' })).toHaveAttribute(
          'aria-checked',
          'true',
        );
        expect(date).toHaveAttribute('aria-checked', 'false');
        await expectNoA11yViolations(document.body);
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });
  });

  // -------------------------------------------------------------------------
  // A Menu in a Popover opened from a menu item is a root menu
  // -------------------------------------------------------------------------

  describe('a Popover opened from a Menu.Item, holding a MenuButton and a Menu', () => {
    const innerMenu = (
      <Menu>
        <Menu.Trigger>
          <MenuButton>Sort by</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.ItemCheckbox name="view" value="grid">
            Grid
          </Menu.ItemCheckbox>
          <Menu.Item>Name</Menu.Item>
        </Menu.Popover>
      </Menu>
    );

    function Inside() {
      return (
        <Menu defaultCheckedValues={{ view: ['grid'] }}>
          <Menu.Trigger>
            <MenuButton>View</MenuButton>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item persistOnClick>
              <Popover>
                <Popover.Trigger asChild={false}>Sort settings…</Popover.Trigger>
                <Popover.Content title="Sort settings">{innerMenu}</Popover.Content>
              </Popover>
            </Menu.Item>
            <Menu.Item>Refresh</Menu.Item>
          </Menu.Popover>
        </Menu>
      );
    }

    function NextToTheItems() {
      const [open, setOpen] = React.useState(false);
      const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
      return (
        <Menu defaultCheckedValues={{ view: ['grid'] }}>
          <Menu.Trigger>
            <MenuButton>View</MenuButton>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item ref={setAnchor} persistOnClick onClick={() => setOpen(true)}>
              Sort settings…
            </Menu.Item>
            <Menu.Item>Refresh</Menu.Item>
            <Popover open={open} onOpenChange={setOpen} target={anchor}>
              <Popover.Content title="Sort settings">{innerMenu}</Popover.Content>
            </Popover>
          </Menu.Popover>
        </Menu>
      );
    }

    it.each([
      ['inside the item', Inside],
      ['next to the items, placed at the item', NextToTheItems],
    ])('rendered %s, the inner Menu is a root menu of its own', async (_where, Tree) => {
      const { user, advance } = setupHoverClock();
      render(<Tree />);
      await user.click(button('View'));
      await user.click(screen.getByText('Sort settings…'));
      const sortBy = button('Sort by');
      expect(screen.getByRole('dialog', { name: 'Sort settings' })).toContainElement(sortBy);
      expect(sortBy).not.toHaveAttribute('data-has-submenu');

      // No hover opening, as for any root menu.
      await user.hover(sortBy);
      advance(600);
      expect(queryMenuNamed('Sort by')).not.toBeInTheDocument();

      await user.click(sortBy);
      expect(menuNamed('Sort by')).toHaveAttribute('data-side', 'bottom');
      // Its own checked values, not the outer menu's.
      expect(checkedOf(checkbox('Grid'))).toBe('false');
      await user.click(menuitem('Name'));
      expect(queryMenuNamed('Sort by')).not.toBeInTheDocument();
      expect(sortBy).toHaveFocus();
      // The outer menu is still open.
      expect(menuNamed('View')).toBeInTheDocument();
      expect(button('View')).toHaveAttribute('aria-expanded', 'true');
    });

    it('with focus in the inner menu, hovering an item of the outer menu leaves focus in the inner one', async () => {
      const user = userEvent.setup();
      render(<Inside />);
      await user.click(button('View'));
      await user.click(screen.getByText('Sort settings…'));
      await user.click(button('Sort by'));
      expect(checkbox('Grid')).toHaveFocus();

      await user.hover(menuitem('Refresh'));
      await act(async () => {});
      expect(checkbox('Grid')).toHaveFocus();
      expect(menuNamed('Sort by')).toBeInTheDocument();
      // Hover inside the inner menu still moves focus there.
      await user.hover(menuitem('Name'));
      expect(menuitem('Name')).toHaveFocus();
    });
  });
});

// ---------------------------------------------------------------------------
// Compounds written in a React Server Component
// ---------------------------------------------------------------------------

/**
 * A client component written in a React Server Component reaches the client as a lazy reference
 * (React Flight), so a compound composed there with the flat names sees lazy part types. Each case
 * renders one tree twice, with the plain parts and with {@link asClientReference} parts, and checks
 * the whole contract: the same server HTML, and the lazy tree hydrating that HTML without a
 * mismatch and working.
 */
describe('compounds composed in a React Server Component', () => {
  type Parts = Record<string, React.JSXElementConstructor<never>>;
  /** The parts as the client receives them from a Server Component. */
  const asClientReferences = <P extends Parts>(parts: P): P =>
    Object.fromEntries(
      Object.entries(parts).map(([name, part]) => [name, asClientReference(part)]),
    ) as P;

  interface SsrCase<P extends Parts = Parts> {
    name: string;
    parts: P;
    tree: (parts: P) => React.ReactElement;
    /** Text the server HTML must contain, so an empty render cannot pass. */
    serverText: string;
    /** The key interaction, run on the hydrated lazy tree. */
    interact: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
  }
  const ssrCase = <P extends Parts>(c: SsrCase<P>) => c as unknown as SsrCase;

  const toastDismiss = vi.fn();

  const cases: SsrCase[] = [
    ssrCase({
      name: 'Carousel',
      parts: { Item: CarouselItem },
      tree: ({ Item }) => (
        <Carousel aria-label="Promo">
          <Item>First slide</Item>
          <Item>Second slide</Item>
          <Item>Third slide</Item>
        </Carousel>
      ),
      serverText: 'First slide',
      interact: async (user) => {
        const region = screen.getByRole('region', { name: 'Promo' });
        const slides = region.querySelectorAll('[aria-roledescription="slide"]');
        expect(Array.from(slides, (slide) => slide.textContent)).toEqual([
          'First slide',
          'Second slide',
          'Third slide',
        ]);
        await user.click(button('Next slide'));
        expect(region.querySelector('[aria-live]')).toHaveTextContent('Slide 2 of 3');
      },
    }),
    ssrCase({
      name: 'Drawer',
      parts: { Trigger: DrawerTrigger, Title: DrawerTitle, Close: DrawerClose },
      tree: ({ Trigger, Title, Close }) => (
        <Drawer>
          <Trigger>
            <Button>Open filters</Button>
          </Trigger>
          <Title>Filters</Title>
          <p>Body</p>
          <Close>
            <Button>Apply</Button>
          </Close>
        </Drawer>
      ),
      serverText: 'Open filters',
      interact: async (user) => {
        await user.click(button('Open filters'));
        expect(screen.getByRole('dialog', { name: 'Filters' })).toHaveTextContent('Body');
        await user.click(button('Apply'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('Open filters')).toHaveFocus();
      },
    }),
    ssrCase({
      name: 'Accordion',
      parts: { Item: AccordionItem, Trigger: AccordionTrigger, Panel: AccordionPanel },
      tree: ({ Item, Trigger, Panel }) => (
        <Accordion>
          <Item value="q1">
            <Trigger>Question one?</Trigger>
            <Panel>Answer one.</Panel>
          </Item>
        </Accordion>
      ),
      serverText: 'Question one?',
      interact: async (user) => {
        const trigger = button('Question one?');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await user.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('region', { name: 'Question one?' })).toHaveTextContent(
          'Answer one.',
        );
      },
    }),
    ssrCase({
      name: 'Menu (trigger and popover)',
      parts: { Trigger: MenuTrigger, Popover: MenuPopover, Item: MenuItem },
      tree: ({ Trigger, Popover: MenuSurface, Item }) => (
        <Menu>
          <Trigger>
            <MenuButton>Actions</MenuButton>
          </Trigger>
          <MenuSurface>
            <Item>Edit</Item>
          </MenuSurface>
        </Menu>
      ),
      serverText: 'Actions',
      interact: async (user) => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        await user.click(button('Actions'));
        expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
        expect(menuitem('Edit')).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(button('Actions')).toHaveFocus();
      },
    }),
    ssrCase({
      name: 'Menu (static, a labelled group of checkable items)',
      parts: {
        Group: MenuGroup,
        GroupHeader: MenuGroupHeader,
        ItemCheckbox: MenuItemCheckbox,
        ItemRadio: MenuItemRadio,
      },
      tree: ({ Group, GroupHeader, ItemCheckbox, ItemRadio }) => (
        <Menu aria-label="View" defaultCheckedValues={{ show: ['ruler'], sort: ['name'] }}>
          <ItemCheckbox name="show" value="ruler">
            Ruler
          </ItemCheckbox>
          <Group>
            <GroupHeader>Sort by</GroupHeader>
            <ItemRadio name="sort" value="name">
              Name
            </ItemRadio>
            <ItemRadio name="sort" value="date">
              Date
            </ItemRadio>
          </Group>
        </Menu>
      ),
      serverText: 'aria-labelledby',
      interact: async (user) => {
        expect(screen.getByRole('group', { name: 'Sort by' })).toBeInTheDocument();
        const date = screen.getByRole('menuitemradio', { name: 'Date' });
        await user.click(date);
        expect(date).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', { name: 'Name' })).toHaveAttribute(
          'aria-checked',
          'false',
        );
      },
    }),
    ssrCase({
      name: 'Menu (static, a split row with a submenu)',
      parts: {
        SplitGroup: MenuSplitGroup,
        Trigger: MenuTrigger,
        Popover: MenuPopover,
        Item: MenuItem,
      },
      tree: ({ SplitGroup, Trigger, Popover: MenuSurface, Item }) => (
        <Menu aria-label="Edit">
          <Item>Cut</Item>
          <SplitGroup>
            <Item>Find</Item>
            <Menu>
              <Trigger>
                <Item aria-label="More find options" />
              </Trigger>
              <MenuSurface>
                <Item>Replace…</Item>
              </MenuSurface>
            </Menu>
          </SplitGroup>
        </Menu>
      ),
      serverText: 'aria-haspopup="menu"',
      interact: async (user) => {
        const half = menuitem('More find options');
        expect(half).toHaveAttribute('aria-expanded', 'false');
        act(() => menuitem('Find').focus());
        await user.keyboard('{ArrowRight}');
        expect(half).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('menu', { name: 'More find options' })).toBeInTheDocument();
        expect(menuitem('Replace…')).toHaveFocus();
      },
    }),
    ssrCase({
      name: 'Toolbar (bound toggles and a radio group)',
      parts: {
        Button: ToolbarButton,
        ToggleButton: ToolbarToggleButton,
        RadioGroup: ToolbarRadioGroup,
        RadioButton: ToolbarRadioButton,
        Divider: ToolbarDivider,
      },
      tree: ({
        Button: Action,
        ToggleButton: Toggle,
        RadioGroup: Radios,
        RadioButton,
        Divider,
      }) => (
        <Toolbar
          aria-label="Formatting"
          defaultCheckedValues={{ format: ['bold'], align: ['start'] }}
        >
          <Toggle name="format" value="bold">
            Bold
          </Toggle>
          <Divider />
          <Radios aria-label="Alignment">
            <RadioButton name="align" value="start">
              Start
            </RadioButton>
            <RadioButton name="align" value="end">
              End
            </RadioButton>
          </Radios>
          <Action>Clear</Action>
        </Toolbar>
      ),
      serverText: 'aria-pressed="true"',
      interact: async (user) => {
        expect(screen.getByRole('radio', { name: 'Start' })).toHaveAttribute(
          'aria-checked',
          'true',
        );
        await user.click(button('Bold'));
        expect(button('Bold')).toHaveAttribute('aria-pressed', 'false');
        await user.click(screen.getByRole('radio', { name: 'End' }));
        expect(screen.getByRole('radio', { name: 'End' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Start' })).toHaveAttribute(
          'aria-checked',
          'false',
        );
      },
    }),
    ssrCase({
      name: 'TabList',
      parts: { Tab: TabListTab, Panel: TabListPanel },
      tree: ({ Tab, Panel }) => (
        <TabList aria-label="Sections">
          <Tab value="a">Tab A</Tab>
          <Tab value="b">Tab B</Tab>
          <Panel value="a">Panel A</Panel>
          <Panel value="b">Panel B</Panel>
        </TabList>
      ),
      serverText: 'Panel A',
      interact: async (user) => {
        const tablist = screen.getByRole('tablist', { name: 'Sections' });
        expect(screen.getByRole('tab', { name: 'Tab A' })).toHaveAttribute('aria-selected', 'true');
        expect(tablist).not.toContainElement(screen.getByRole('tabpanel', { name: 'Tab A' }));
        await user.click(screen.getByRole('tab', { name: 'Tab B' }));
        expect(screen.getByRole('tabpanel', { name: 'Tab B' })).toHaveTextContent('Panel B');
      },
    }),
    ssrCase({
      name: 'Tree',
      parts: { Item: TreeItem },
      tree: ({ Item }) => (
        <Tree aria-label="Files" defaultExpandedItems={['docs']}>
          <Item value="docs">
            Documents
            <Item value="work">Work</Item>
          </Item>
          <Item value="readme">Readme.md</Item>
        </Tree>
      ),
      serverText: 'Readme.md',
      interact: async (user) => {
        const docs = screen.getByRole('treeitem', { name: 'Documents' });
        expect(docs).toHaveAttribute('aria-expanded', 'true');
        expect(within(within(docs).getByRole('group')).getByRole('treeitem')).toHaveTextContent(
          'Work',
        );
        await user.click(within(docs).getByText('Documents'));
        expect(docs).toHaveAttribute('aria-expanded', 'false');
      },
    }),
    ssrCase({
      name: 'Nav (sub-item defaultValue)',
      parts: { Item: NavItem, Category: NavCategory, SubItem: NavSubItem },
      tree: ({ Item, Category, SubItem }) => (
        <Nav aria-label="Main" defaultValue="api">
          <Item value="home">Home</Item>
          <Category value="docs" label="Docs">
            <SubItem value="intro">Introduction</SubItem>
            <SubItem value="api">API</SubItem>
          </Category>
        </Nav>
      ),
      serverText: 'aria-current="page"',
      interact: async (user) => {
        const docs = button('Docs');
        expect(docs).toHaveAttribute('aria-expanded', 'true');
        expect(button('API')).toHaveAttribute('aria-current', 'page');
        await user.click(button('Introduction'));
        expect(button('Introduction')).toHaveAttribute('aria-current', 'page');
        expect(button('API')).not.toHaveAttribute('aria-current');
      },
    }),
    ssrCase({
      name: 'Dropdown (defaultValue)',
      parts: { Option: DropdownOption },
      tree: ({ Option }) => (
        <Dropdown aria-label="Country" defaultValue="no">
          <Option value="se">Sweden</Option>
          <Option value="no">Norway</Option>
        </Dropdown>
      ),
      serverText: 'Norway',
      interact: async (user) => {
        const dropdown = screen.getByRole('combobox', { name: 'Country' });
        expect(dropdown).toHaveTextContent('Norway');
        await user.click(dropdown);
        await user.click(screen.getByRole('option', { name: 'Sweden' }));
        expect(dropdown).toHaveTextContent('Sweden');
      },
    }),
    ssrCase({
      name: 'Combobox (defaultValue)',
      parts: { Option: ComboboxOption },
      tree: ({ Option }) => (
        <Combobox aria-label="Country" defaultValue="no">
          <Option value="se">Sweden</Option>
          <Option value="no">Norway</Option>
        </Combobox>
      ),
      serverText: 'value="Norway"',
      interact: async (user) => {
        const combobox = screen.getByRole('combobox', { name: 'Country' });
        expect(combobox).toHaveValue('Norway');
        await user.clear(combobox);
        await user.type(combobox, 'swe');
        await user.click(screen.getByRole('option', { name: 'Sweden' }));
        expect(combobox).toHaveValue('Sweden');
      },
    }),
    ssrCase({
      name: 'DataGrid (row selection)',
      parts: {
        Header: DataGridHeader,
        HeaderCell: DataGridHeaderCell,
        Body: DataGridBody,
        Row: DataGridRow,
        Cell: DataGridCell,
      },
      tree: ({ Header, HeaderCell, Body, Row, Cell }) => (
        <DataGrid aria-label="People" selectionMode="multiple" defaultSelectedItems={['2']}>
          <Header>
            <tr>
              <HeaderCell>Name</HeaderCell>
              <HeaderCell>Role</HeaderCell>
            </tr>
          </Header>
          <Body>
            <Row rowId="1">
              <Cell>Alice</Cell>
              <Cell>Engineer</Cell>
            </Row>
            <Row rowId="2">
              <Cell>Bob</Cell>
              <Cell>Designer</Cell>
            </Row>
          </Body>
        </DataGrid>
      ),
      serverText: 'Alice',
      interact: async (user) => {
        expect(screen.getByRole('checkbox', { name: 'Bob' })).toBeChecked();
        const alice = screen.getByRole('checkbox', { name: 'Alice' });
        expect(alice).not.toBeChecked();
        await user.click(alice);
        expect(alice).toBeChecked();
        expect(screen.getByRole('row', { name: /Alice/ })).toHaveAttribute('aria-selected', 'true');
      },
    }),
    ssrCase({
      name: 'Toast (a title with an action, a body with a subtitle, a footer)',
      parts: { Title: ToastTitle, Body: ToastBody, Footer: ToastFooter, Close: ToastClose },
      tree: ({ Title, Body, Footer, Close }) => (
        <Toast status="success" onDismiss={toastDismiss}>
          <Title
            action={
              <Close>
                <Button>Undo</Button>
              </Close>
            }
          >
            Saved
          </Title>
          <Body subtitle="2 files">Your changes are saved.</Body>
          <Footer>
            <Button>View changes</Button>
          </Footer>
        </Toast>
      ),
      serverText: 'Your changes are saved.',
      interact: async (user) => {
        toastDismiss.mockClear();
        // Rendered by the app, not dispatched: its own live region (spec D10).
        const toast = screen.getByRole('status');
        expect(toast).toHaveTextContent(/^Success:\s*Saved/);
        expect(within(toast).getByText('2 files')).toHaveClass(toastBodyClassNames.subtitle);
        await user.click(button('Undo'));
        expect(toastDismiss).toHaveBeenCalledTimes(1);
      },
    }),
    ssrCase({
      name: 'MessageBar (a titled region with actions; no ResizeObserver, as in consumers’ jsdom)',
      parts: { Title: MessageBarTitle, Actions: MessageBarActions },
      tree: ({ Title, Actions }) => (
        <MessageBar status="warning" role="region">
          <Title>Update available</Title>A new version is ready to install.
          <Actions>
            <Button>Install</Button>
          </Actions>
        </MessageBar>
      ),
      serverText: 'Update available',
      interact: async (user) => {
        // The default layout="auto" with actions must not need a ResizeObserver (review focus).
        expect(globalThis.ResizeObserver).toBeUndefined();
        const bar = screen.getByRole('region', { name: 'Warning: Update available' });
        expect(bar).toHaveAttribute('data-layout', 'singleline');
        expect(within(bar).getByText('Update available')).toHaveClass(
          messageBarTitleClassNames.root,
        );
        await user.click(within(bar).getByRole('button', { name: 'Install' }));
        expect(bar).toHaveAttribute('data-layout', 'singleline');
      },
    }),
    ssrCase({
      name: 'ColorPicker (a custom layout of the preview, the hex field and the swatches)',
      parts: {
        HexField: ColorPickerHexField,
        Swatches: ColorPickerSwatches,
        Preview: ColorPickerPreview,
      },
      tree: ({ HexField, Swatches, Preview }) => (
        <ColorPicker aria-label="Accent" defaultValue="#0f6cbd">
          <Preview />
          <HexField />
          <Swatches />
        </ColorPicker>
      ),
      serverText: 'value="#0f6cbd"',
      interact: async (user) => {
        const hex = screen.getByRole('textbox', { name: 'Hex color value' });
        expect(hex).toHaveValue('#0f6cbd');
        await user.click(screen.getByRole('radio', { name: 'Red' }));
        expect(hex).toHaveValue('#d13438');
      },
    }),
    ssrCase({
      name: 'Tree (persona rows in a checkbox tree)',
      parts: { Item: TreeItem, ItemPersonaLayout: TreeItemPersonaLayout },
      tree: ({ Item, ItemPersonaLayout }) => (
        <Tree aria-label="People" selectionMode="multiple" defaultCheckedItems={['ada']}>
          <Item value="ada">
            <ItemPersonaLayout media={<Avatar name="Ada Lovelace" />} description="Engineer">
              Ada Lovelace
            </ItemPersonaLayout>
          </Item>
          <Item value="grace">
            <ItemPersonaLayout description="Admiral">Grace Hopper</ItemPersonaLayout>
          </Item>
        </Tree>
      ),
      serverText: 'aria-checked="true"',
      interact: async (user) => {
        const ada = screen.getByRole('treeitem', { name: 'Ada Lovelace' });
        expect(ada).toHaveAccessibleDescription('Engineer');
        expect(ada).toHaveAttribute('aria-checked', 'true');
        const grace = screen.getByRole('treeitem', { name: 'Grace Hopper' });
        expect(grace).toHaveAttribute('aria-checked', 'false');
        // The checkbox is named like its item: by the person's name, not the description (D25, D28).
        await user.click(screen.getByRole('checkbox', { name: 'Grace Hopper' }));
        expect(grace).toHaveAttribute('aria-checked', 'true');
      },
    }),
    ssrCase({
      name: 'Listbox (grouped options)',
      parts: { Option: ListboxOption, Group: ListboxOptionGroup },
      tree: ({ Option: Item, Group }) => (
        <Listbox aria-label="Fruit" defaultValue="banana">
          <Group label="Citrus">
            <Item value="orange">Orange</Item>
          </Group>
          <Group label="Other">
            <Item value="banana">Banana</Item>
            <Item value="cherry">Cherry</Item>
          </Group>
        </Listbox>
      ),
      serverText: 'Citrus',
      interact: async (user) => {
        const list = screen.getByRole('listbox', { name: 'Fruit' });
        const citrus = within(list).getByRole('group', { name: 'Citrus' });
        expect(within(citrus).getAllByRole('option')).toHaveLength(1);
        const other = within(list).getByRole('group', { name: 'Other' });
        expect(within(other).getAllByRole('option')).toHaveLength(2);
        expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await user.click(screen.getByRole('option', { name: 'Cherry' }));
        expect(screen.getByRole('option', { name: 'Cherry' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
      },
    }),
    ssrCase({
      name: 'SwatchPicker (grid layout: an explicit row, then loose swatches in an implicit row)',
      parts: { Row: SwatchPickerRow, Color: ColorSwatch, Image: ImageSwatch, Empty: EmptySwatch },
      tree: ({ Row, Color, Image: Picture, Empty }) => (
        <SwatchPicker layout="grid" aria-label="Palette" defaultValue="blue">
          <Row>
            <Color value="red" color="#d13438" aria-label="Red" />
            <Color value="blue" color="#0f6cbd" aria-label="Blue" />
          </Row>
          <Picture
            value="logo"
            src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
            aria-label="Logo"
          />
          <Empty aria-label="Add color" />
        </SwatchPicker>
      ),
      serverText: 'role="grid"',
      interact: async (user) => {
        expect(screen.getByRole('grid', { name: 'Palette' })).toBeInTheDocument();
        // The explicit row, and one implicit row for the loose swatches after it.
        expect(screen.getAllByRole('row')).toHaveLength(2);
        const cellOf = (name: string) => button(name).closest('[role="gridcell"]');
        expect(cellOf('Blue')).toHaveAttribute('aria-selected', 'true');
        await user.click(button('Logo'));
        expect(cellOf('Logo')).toHaveAttribute('aria-selected', 'true');
        expect(cellOf('Blue')).toHaveAttribute('aria-selected', 'false');
        expect(within(cellOf('Add color') as HTMLElement).getByRole('button')).toBeInTheDocument();
      },
    }),
    ssrCase({
      name: 'SwatchPicker (row layout: a row of swatches and an image swatch)',
      parts: { Row: SwatchPickerRow, Color: ColorSwatch, Image: ImageSwatch },
      tree: ({ Row, Color, Image: Picture }) => (
        <SwatchPicker aria-label="Palette" defaultValue="red">
          <Row>
            <Color value="red" color="#d13438" aria-label="Red" />
            <Color value="blue" color="#0f6cbd" aria-label="Blue" />
          </Row>
          <Picture
            value="logo"
            src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
            aria-label="Logo"
          />
        </SwatchPicker>
      ),
      serverText: 'role="radiogroup"',
      interact: async (user) => {
        expect(screen.getByRole('radio', { name: 'Red' })).toBeChecked();
        await user.click(screen.getByRole('radio', { name: 'Logo' }));
        expect(screen.getByRole('radio', { name: 'Logo' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Red' })).not.toBeChecked();
      },
    }),
    ssrCase({
      name: 'Calendar (a today prop, so the server and the client agree)',
      parts: {},
      tree: () => <Calendar aria-label="Date" locale="en-US" today={JUNE_12} />,
      serverText: 'June 2025',
      interact: async (user) => {
        const today = screen.getByRole('button', { name: 'Thursday, June 12, 2025' });
        expect(today).toHaveAttribute('aria-current', 'date');
        await user.click(screen.getByRole('button', { name: 'Friday, June 20, 2025' }));
        expect(screen.getByRole('button', { name: 'Friday, June 20, 2025' })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      },
    }),
  ];

  const hydrated: Array<{ root: Root; container: HTMLElement }> = [];
  afterEach(() => {
    for (const { root, container } of hydrated.splice(0)) {
      act(() => root.unmount());
      container.remove();
    }
  });

  it.each(cases)('$name: the server HTML is the same with lazy part types', (c) => {
    const plain = renderToString(c.tree(c.parts));
    expect(plain).toContain(c.serverText);
    expect(renderToString(c.tree(asClientReferences(c.parts)))).toBe(plain);
  });

  it.each(cases)(
    '$name: the lazy tree hydrates the server HTML without a mismatch and works',
    async (c) => {
      const tree = c.tree(asClientReferences(c.parts));
      const container = document.createElement('div');
      container.innerHTML = renderToString(tree);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const recoverable: unknown[] = [];
      await act(async () => {
        const root = hydrateRoot(container, tree, {
          onRecoverableError: (reason) => recoverable.push(reason),
        });
        hydrated.push({ root, container });
      });
      expect(recoverable).toEqual([]);
      expect(error).not.toHaveBeenCalled();

      await c.interact(userEvent.setup());
      expect(error).not.toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
// Image story placeholder (repo-level#32)
// ---------------------------------------------------------------------------

describe('Image story placeholder (repo-level#32)', () => {
  it('decodes, after one decode, to an SVG with literal #rrggbb paint', () => {
    const src = String(ImageStories.Default.args?.src ?? ImageStories.default.args.src);
    expect(src.startsWith('data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(src.slice('data:image/svg+xml,'.length));
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('<rect');
    expect(svg).toContain('<text');
    expect(svg).not.toContain('%23');
    const fills = Array.from(svg.matchAll(/fill="([^"]*)"/g), (match) => match[1]);
    expect(fills.length).toBeGreaterThanOrEqual(2);
    for (const fill of fills) expect(fill).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

// ---------------------------------------------------------------------------
// 0.8 (Fluent parity phase 3): toasts across components (spec §4.4 #1–#5)
// ---------------------------------------------------------------------------

/** The Toaster's region (`'Notifications'` unless the Toaster has its own `aria-label`). */
const toastRegion = (name = 'Notifications') => screen.getByRole('region', { name });
/** A toast's container: `role="group"`, named by its severity text and title (spec D10). */
const toastGroup = (name: string) => screen.getByRole('group', { name });
/** The Toaster's polite live region (0.7's `role="status"` region, one message per toast). */
const politeMessages = (name = 'Notifications') => within(toastRegion(name)).getByRole('status');

/** A MenuButton with a Menu, used as a toast's title action. */
function ToastFileMenu() {
  return (
    <Menu>
      <Menu.Trigger>
        <MenuButton size="small">More</MenuButton>
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item>Open file</Menu.Item>
        <Menu.Item>Copy link</Menu.Item>
      </Menu.Popover>
    </Menu>
  );
}

/** Dispatches a rich toast whose title action opens a Menu (spec §4.4 #1, #10). */
function UploadToastButton({ timeout }: { timeout?: number }) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast(
          <Toast status="success">
            <Toast.Title action={<ToastFileMenu />}>File uploaded</Toast.Title>
            <Toast.Body>report.pdf is ready.</Toast.Body>
          </Toast>,
          timeout === undefined ? undefined : { timeout },
        )
      }
    >
      Upload
    </Button>
  );
}

describe('a Menu in a dispatched toast (spec §4.4 #1)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function setup() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Toaster>
        <UploadToastButton timeout={3000} />
      </Toaster>,
    );
    await user.click(button('Upload'));
    expect(toastGroup('Success: File uploaded')).toBeInTheDocument();
    // Into the toast by keyboard: the pointer stays on Upload, outside the region, so only focus
    // can pause the timers.
    await user.tab();
    expect(button('More')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'More' })).toBeInTheDocument();
    expect(menuitem('Open file')).toHaveFocus();
    return { user };
  }

  it('keeps the timers paused while focus is in the menu, a portal opened from the toast', async () => {
    await setup();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(toastGroup('Success: File uploaded')).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });

  it('Escape closes only the menu first, then dismisses the toasts and returns focus to the origin', async () => {
    const { user } = await setup();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('More')).toHaveFocus();
    expect(toastGroup('Success: File uploaded')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Success: File uploaded' })).not.toBeInTheDocument();
    expect(button('Upload')).toHaveFocus();
  });

  it.each(['{Delete}', '{Backspace}'])(
    '%s on a menu item keeps the toast and the menu',
    async (key) => {
      const { user } = await setup();
      await user.keyboard(key);
      await act(async () => {});
      expect(toastGroup('Success: File uploaded')).toBeInTheDocument();
      expect(screen.getByRole('menu', { name: 'More' })).toBeInTheDocument();
    },
  );
});

describe('a rich toast over a modal Dialog (spec §4.4 #2)', () => {
  function DeleteRowButton({ onUndo }: { onUndo: () => void }) {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="success">
              <Toast.Title>Row deleted</Toast.Title>
              <Toast.Footer>
                <Toast.Close>
                  <Button onClick={onUndo}>Undo</Button>
                </Toast.Close>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Delete row
      </Button>
    );
  }

  function setup() {
    const onOpenChange = vi.fn();
    const onUndo = vi.fn();
    render(
      <Toaster>
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content title="Settings">
            <DeleteRowButton onUndo={onUndo} />
          </Dialog.Content>
        </Dialog>
      </Toaster>,
    );
    return { onOpenChange, onUndo, user: userEvent.setup() };
  }

  it('Tab reaches Undo while the Dialog is open; Escape dismisses the toasts and leaves the Dialog open', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Delete row'));
    expect(toastGroup('Success: Row deleted')).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
    await user.tab();
    expect(button('Undo')).toHaveFocus();
    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Success: Row deleted' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Delete row')).toHaveFocus();
  });

  it('Delete on a focused toast dismisses only that toast and focuses the next one', async () => {
    const { user, onOpenChange } = setup();
    await user.click(button('Delete row'));
    await user.click(button('Delete row'));
    expect(screen.getAllByRole('group', { name: 'Success: Row deleted' })).toHaveLength(2);
    await user.tab();
    const [firstUndo] = screen.getAllByRole('button', { name: 'Undo' });
    expect(firstUndo).toHaveFocus();
    await user.keyboard('{Delete}');
    await act(async () => {});
    expect(screen.getAllByRole('group', { name: 'Success: Row deleted' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  function RenameToastButton() {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="warning">
              <Toast.Title>Report ready</Toast.Title>
              <Toast.Footer>
                <Dialog>
                  <Dialog.Trigger>
                    <Button>Rename</Button>
                  </Dialog.Trigger>
                  <Dialog.Content title="Rename report">
                    <Input aria-label="File name" defaultValue="report.pdf" />
                  </Dialog.Content>
                </Dialog>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Export
      </Button>
    );
  }

  it('Delete in a Dialog opened from a toast keeps the toast', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <RenameToastButton />
      </Toaster>,
    );
    await user.click(button('Export'));
    await user.click(button('Rename'));
    const dialog = screen.getByRole('dialog', { name: 'Rename report' });
    const close = within(dialog).getByRole('button', { name: 'Close' });
    act(() => close.focus());
    await act(async () => {});
    await user.keyboard('{Delete}');
    await act(async () => {});
    expect(toastGroup('Warning: Report ready')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rename report' })).toBeInTheDocument();
  });
});

describe('a Tooltip and a Popover on a toast (spec §4.4 #3)', () => {
  function ArchiveToastButton() {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="info">
              <Toast.Title
                action={
                  <Tooltip content="Restores the message" openDelay={0}>
                    <Button>Undo</Button>
                  </Tooltip>
                }
              >
                Moved to Archive
              </Toast.Title>
              <Toast.Footer>
                <Popover>
                  <Popover.Trigger>
                    <Button>Details</Button>
                  </Popover.Trigger>
                  <Popover.Content title="Details">
                    <p>Moved by a rule.</p>
                    <Button>Edit rule</Button>
                  </Popover.Content>
                </Popover>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Archive
      </Button>
    );
  }

  function setup() {
    render(
      <Toaster>
        <ArchiveToastButton />
      </Toaster>,
    );
    return userEvent.setup();
  }

  it('with the tooltip shown, Escape hides only the tooltip; the next Escape dismisses the toasts', async () => {
    const user = setup();
    await user.click(button('Archive'));
    await user.tab();
    const undo = button('Undo');
    expect(undo).toHaveFocus();
    await waitFor(() => expect(tooltipSurface()).not.toBeNull());
    expect(undo).toHaveAccessibleDescription('Restores the message');

    await user.keyboard('{Escape}');
    expect(tooltipSurface()).toBeNull();
    expect(toastGroup('Info: Moved to Archive')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Info: Moved to Archive' })).not.toBeInTheDocument();
    expect(button('Archive')).toHaveFocus();
  });

  it('Escape in a Popover opened from a toast closes only the popover', async () => {
    const user = setup();
    await user.click(button('Archive'));
    await user.click(button('Details'));
    const popover = screen.getByRole('dialog', { name: 'Details' });
    act(() => within(popover).getByRole('button', { name: 'Edit rule' }).focus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Details' })).not.toBeInTheDocument();
    expect(toastGroup('Info: Moved to Archive')).toBeInTheDocument();
    expect(button('Details')).toHaveFocus();
  });
});

describe('Toast.Close around a Link and a Button (spec §4.4 #4)', () => {
  function MoveToastButton({
    onUndo,
    onKeep,
  }: {
    onUndo?: React.MouseEventHandler<HTMLAnchorElement>;
    onKeep?: React.MouseEventHandler<HTMLButtonElement>;
  }) {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="info">
              <Toast.Title
                action={
                  <Toast.Close>
                    <Link href="#undo" onClick={onUndo}>
                      Undo
                    </Link>
                  </Toast.Close>
                }
              >
                Moved
              </Toast.Title>
              <Toast.Footer>
                <Toast.Close>
                  <Button onClick={onKeep}>Keep</Button>
                </Toast.Close>
              </Toast.Footer>
            </Toast>,
          )
        }
      >
        Move
      </Button>
    );
  }

  it('a Link in the title action runs its handler and dismisses the toast', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster>
        <MoveToastButton onUndo={onUndo} />
      </Toaster>,
    );
    await user.click(button('Move'));
    await user.click(screen.getByRole('link', { name: 'Undo' }));
    await act(async () => {});
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Info: Moved' })).not.toBeInTheDocument();
  });

  it('a Button in the footer runs its handler and dismisses the toast', async () => {
    const onKeep = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster>
        <MoveToastButton onKeep={onKeep} />
      </Toaster>,
    );
    await user.click(button('Move'));
    await user.click(button('Keep'));
    await act(async () => {});
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Info: Moved' })).not.toBeInTheDocument();
  });

  it('preventDefault() in the Button’s onClick keeps the toast', async () => {
    const onKeep = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <Toaster>
        <MoveToastButton onKeep={onKeep} />
      </Toaster>,
    );
    await user.click(button('Move'));
    await user.click(button('Keep'));
    await act(async () => {});
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(toastGroup('Info: Moved')).toBeInTheDocument();
  });
});

// Created at module scope, as an app's toasts module creates them (P3-08).
const appToaster = createToaster();
const updatesToaster = createToaster();
/** Stands in for a router: the toast's link reads it from above the Toaster. */
const RouteContext = React.createContext('#/');

function DocumentLink() {
  const href = React.useContext(RouteContext);
  return <Link href={href}>Open</Link>;
}

/** A plain function outside React, as a query-cache callback or a server-event handler is. */
function notifySaved(): string {
  return appToaster.dispatchToast(
    <Toast status="success">
      <Toast.Title action={<DocumentLink />}>Saved</Toast.Title>
    </Toast>,
  );
}

describe('a module-scope toaster handle (spec §4.4 #5, P3-08)', () => {
  it('shows, announces once and dismisses a toast dispatched from a plain function; its content reads context from above the Toaster', async () => {
    render(
      <RouteContext.Provider value="#/documents/42">
        <Toaster toaster={appToaster}>
          <p>App</p>
        </Toaster>
      </RouteContext.Provider>,
    );
    let id = '';
    act(() => {
      id = notifySaved();
    });
    expect(id).not.toBe('');
    const group = toastGroup('Success: Saved');
    expect(within(group).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '#/documents/42',
    );
    const polite = politeMessages();
    expect(polite.children).toHaveLength(1);
    expect(polite).toHaveTextContent('Success: Saved Open');
    await expectNoA11yViolations(document.body);

    act(() => appToaster.dismissToast(id));
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Success: Saved' })).not.toBeInTheDocument();
  });

  it('a Toaster bound to a second handle stays independent', async () => {
    render(
      <>
        <Toaster toaster={appToaster}>
          <p>App</p>
        </Toaster>
        <Toaster toaster={updatesToaster} position="top-start" aria-label="Updates" />
      </>,
    );
    act(() => {
      updatesToaster.dispatchToast({ title: 'Update installed', timeout: 0 });
    });
    const updates = toastRegion('Updates');
    expect(
      within(updates).getByRole('group', { name: 'Info: Update installed' }),
    ).toBeInTheDocument();
    expect(within(toastRegion()).queryByRole('group')).toBeNull();

    act(() => appToaster.dismissAllToasts());
    await act(async () => {});
    expect(
      within(updates).getByRole('group', { name: 'Info: Update installed' }),
    ).toBeInTheDocument();

    act(() => updatesToaster.dismissAllToasts());
    await act(async () => {});
    expect(within(updates).queryByRole('group')).toBeNull();
  });
});

describe('toasts and a modal Dialog: the shortcut and a tooltip (Phase 3 review focus)', () => {
  it('the focus shortcut focuses the newest toast; Escape returns focus into the Dialog, which stays open', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster
        shortcuts={{
          focus: (event) => event.altKey && event.shiftKey && event.code === 'KeyN',
        }}
      >
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content title="Settings">
            <NotifyButton />
          </Dialog.Content>
        </Dialog>
      </Toaster>,
    );
    await user.click(button('Notify'));
    await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}');
    // The Dialog's focus trap decides about outside focus in a microtask.
    await act(async () => {});
    expect(toastGroup('Info: Saved')).toHaveFocus();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Info: Saved' })).not.toBeInTheDocument();
    expect(button('Notify')).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  function TooltipToastButton() {
    const { dispatchToast } = useToastController();
    return (
      <Button
        onClick={() =>
          dispatchToast(
            <Toast status="info">
              <Toast.Title
                action={
                  <Tooltip content="Restores the message" openDelay={0}>
                    <Button>Undo</Button>
                  </Tooltip>
                }
              >
                Moved to Archive
              </Toast.Title>
            </Toast>,
          )
        }
      >
        Archive
      </Button>
    );
  }

  it('over a modal Dialog, the first Escape hides only the tooltip, the next dismisses the toasts; the Dialog stays open', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Toaster>
        <Dialog open onOpenChange={onOpenChange}>
          <Dialog.Content title="Mail">
            <TooltipToastButton />
          </Dialog.Content>
        </Dialog>
      </Toaster>,
    );
    await user.click(button('Archive'));
    await user.tab();
    expect(button('Undo')).toHaveFocus();
    await waitFor(() => expect(tooltipSurface()).not.toBeNull());

    await user.keyboard('{Escape}');
    expect(tooltipSurface()).toBeNull();
    expect(toastGroup('Info: Moved to Archive')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.queryByRole('group', { name: 'Info: Moved to Archive' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Mail' })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(button('Archive')).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// 0.8: message bars, color and trees across components (spec §4.4 #6–#9)
// ---------------------------------------------------------------------------

describe('a MenuButton in MessageBar.Actions (spec §4.4 #6)', () => {
  it('reads the severity, the title and the body once, then the actions, and opens the menu from the action', async () => {
    const user = userEvent.setup();
    render(
      <MessageBar status="warning">
        <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
        <MessageBar.Actions>
          <Menu>
            <Menu.Trigger>
              <MenuButton>Options</MenuButton>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Install tonight</Menu.Item>
              <Menu.Item>Remind me later</Menu.Item>
            </Menu.Popover>
          </Menu>
        </MessageBar.Actions>
      </MessageBar>,
    );
    const bar = screen.getByRole('alert');
    // A live-region bar is not named by its title (spec D16): the title is read with the content.
    expect(bar).not.toHaveAttribute('aria-labelledby');
    expect(bar.textContent).toMatch(
      /^Warning: Update available A new version is ready to install\.\s*Options$/,
    );
    await user.click(within(bar).getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('menu', { name: 'Options' })).toBeInTheDocument();
    expect(menuitem('Install tonight')).toHaveFocus();
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('Options')).toHaveFocus();
  });
});

describe('a composed ColorPicker in a Field (spec §4.4 #7)', () => {
  function ThemeForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
    return (
      <form
        aria-label="Theme"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <Field label="Accent color" error="Pick a darker color">
          <ColorPicker name="accent" defaultValue="#808080">
            <ColorArea />
            <ColorSlider />
            <ColorPicker.HexField />
          </ColorPicker>
        </Field>
        <Button type="submit">Save</Button>
        <Button type="reset">Reset</Button>
      </form>
    );
  }

  it('names the picker by the Field label and describes its hex input by the Field error', async () => {
    render(<ThemeForm onSubmit={() => {}} />);
    const picker = screen.getByRole('group', { name: 'Accent color' });
    expect(
      within(picker).getByRole('group', { name: 'Saturation and brightness' }),
    ).toBeInTheDocument();
    const hex = within(picker).getByRole('textbox', { name: 'Hex color value' });
    expect(hex).toHaveAccessibleDescription(/Pick a darker color/);
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(within(picker).getByRole('slider', { name: 'Hue' })).toBeInTheDocument();
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('submits the hex color; a form reset restores the default and keeps the working hue', async () => {
    const onSubmit = vi.fn<(data: FormData) => void>();
    const user = userEvent.setup();
    render(<ThemeForm onSubmit={onSubmit} />);
    const hue = screen.getByRole('slider', { name: 'Hue' });
    const saturation = screen.getByRole('slider', { name: 'Saturation' });
    // The gray default has no hue of its own: the slider sets the working hue, the hex stays.
    fireEvent.change(hue, { target: { value: '120' } });
    await act(async () => {});
    fireEvent.change(saturation, { target: { value: '50' } });
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Hex color value' })).toHaveValue('#408040');

    await user.click(button('Save'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].get('accent')).toBe('#408040');

    await user.click(button('Reset'));
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Hex color value' })).toHaveValue('#808080');
    expect(hue).toHaveValue('120');
    expect(saturation).toHaveValue('0');
  });

  it('names a standalone ColorSlider by the Field label, not by its "Hue" default', () => {
    render(
      <Field label="Accent hue">
        <ColorSlider />
      </Field>,
    );
    expect(screen.getByRole('slider', { name: 'Accent hue' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Hue' })).toBeNull();
  });

  it('a required Field with an error: one control id, no duplicate ids, the area not described by the Field, one required input (review focus)', () => {
    render(
      <form aria-label="Theme">
        <Field label="Accent color" hint="Used for links" error="Pick a darker color" required>
          <ColorPicker name="accent">
            <ColorArea />
            <ColorSlider />
            <AlphaSlider />
            <ColorPicker.HexField />
          </ColorPicker>
        </Field>
      </form>,
    );
    const picker = screen.getByRole('group', { name: 'Accent color' });
    expect(duplicateIds()).toEqual([]);
    const label = screen.getByText(/Accent color/, { selector: 'label' });
    const controlId = label.getAttribute('for');
    if (controlId) {
      expect(document.querySelectorAll(`[id="${controlId}"]`)).toHaveLength(1);
      expect(picker.id).toBe(controlId);
    }
    const area = within(picker).getByRole('group', { name: 'Saturation and brightness' });
    for (const input of within(area).getAllByRole('slider', { hidden: true })) {
      expect(input).not.toHaveAccessibleDescription(/Pick a darker color|Used for links/);
    }
    const required = picker.querySelectorAll('input[required]');
    expect(required).toHaveLength(1);
    expect(required[0]).toHaveAttribute('name', 'accent');
    const form = screen.getByRole('form', { name: 'Theme' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });
});

/** jsdom has no pointer capture: a capture flag per test, restored afterwards. */
function stubPointerCapture() {
  const proto = Element.prototype;
  const names = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const;
  const previous = names.map((name) => Object.getOwnPropertyDescriptor(proto, name));
  let captured = false;
  const define = (name: (typeof names)[number], value: (...args: never[]) => unknown) =>
    Object.defineProperty(proto, name, { configurable: true, writable: true, value });
  define('setPointerCapture', () => {
    captured = true;
  });
  define('releasePointerCapture', () => {
    captured = false;
  });
  define('hasPointerCapture', () => captured);
  onTestFinished(() => {
    names.forEach((name, index) => {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else Reflect.deleteProperty(proto, name);
    });
  });
}

describe('a ColorPicker in a Popover (spec §4.4 #8)', () => {
  it('a drag on the area that ends outside the surface keeps the popover open; Escape closes it and returns focus', async () => {
    stubPointerCapture();
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger>
          <Button>Pick color</Button>
        </Popover.Trigger>
        <Popover.Content title="Color">
          <ColorPicker defaultValue="#0f6cbd" />
        </Popover.Content>
      </Popover>,
    );
    await user.click(button('Pick color'));
    const popover = screen.getByRole('dialog', { name: 'Color' });
    const area = within(popover).getByRole('group', { name: 'Saturation and brightness' });
    const field = area.querySelector<HTMLElement>(`.${colorAreaClassNames.field}`);
    expect(field).not.toBeNull();
    mockRect(area, { x: 0, y: 0, width: 200, height: 100 });
    mockRect(field!, { x: 0, y: 0, width: 200, height: 100 });

    // The press starts inside the surface; the move and the release happen far outside it (with
    // pointer capture the browser keeps targeting the area).
    await user.pointer([
      { keys: '[MouseLeft>]', target: field!, coords: { clientX: 50, clientY: 50 } },
      { target: field!, coords: { clientX: 500, clientY: 500 } },
      { keys: '[/MouseLeft]', target: field!, coords: { clientX: 500, clientY: 500 } },
    ]);
    expect(screen.getByRole('dialog', { name: 'Color' })).toBeInTheDocument();
    const saturation = within(area).getByRole('slider', { name: 'Saturation', hidden: true });
    // The input without the Tab stop is aria-hidden here, and testing-library computes its name as
    // '': match the raw aria-label instead.
    const brightness = within(area).getByRole('slider', {
      hidden: true,
      name: (_name, element) => element.getAttribute('aria-label') === 'Brightness',
    });
    expect(saturation).toHaveValue('100');
    expect(brightness).toHaveValue('0');
    expect(saturation).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Color' })).not.toBeInTheDocument();
    expect(button('Pick color')).toHaveFocus();
  });
});

describe('a Tree with a MenuButton in its actions (spec §4.4 #9)', () => {
  function FileActions({ name }: { name: string }) {
    return (
      <Menu>
        <Menu.Trigger>
          <MenuButton size="small" aria-label={`More actions for ${name}`} />
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popover>
      </Menu>
    );
  }

  function Files({ onItemSelect }: { onItemSelect?: (value: string) => void }) {
    return (
      <Tree aria-label="Files" navigationMode="treegrid" onItemSelect={onItemSelect}>
        <Tree.Item value="report" actions={<FileActions name="Report.docx" />}>
          Report.docx
        </Tree.Item>
        <Tree.Item value="notes">Notes.txt</Tree.Item>
      </Tree>
    );
  }

  it('ArrowRight reaches the action, ArrowDown opens its menu, Escape returns to it, ArrowLeft to the item', async () => {
    const onItemSelect = vi.fn();
    const user = userEvent.setup();
    render(<Files onItemSelect={onItemSelect} />);
    await user.tab();
    const report = screen.getByRole('treeitem', { name: 'Report.docx' });
    expect(report).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const more = button('More actions for Report.docx');
    expect(more).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { name: 'More actions for Report.docx' })).toBeInTheDocument();
    expect(menuitem('Rename')).toHaveFocus();
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(more).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(report).toHaveFocus();
    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('Enter on the action opens its menu and never activates the item', async () => {
    const onItemSelect = vi.fn();
    const user = userEvent.setup();
    render(<Files onItemSelect={onItemSelect} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'More actions for Report.docx' })).toBeInTheDocument();
    expect(onItemSelect).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(button('More actions for Report.docx')).toHaveFocus();
  });

  it('a checkbox Tree in a Dialog: Space toggles the item, Escape closes the Dialog', async () => {
    const onOpenChange = vi.fn();
    const onCheckedItemsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Choose folders">
          <Tree
            aria-label="Folders"
            selectionMode="multiple"
            onCheckedItemsChange={onCheckedItemsChange}
          >
            <Tree.Item value="docs">Documents</Tree.Item>
            <Tree.Item value="music">Music</Tree.Item>
          </Tree>
        </Dialog.Content>
      </Dialog>,
    );
    const docs = screen.getByRole('treeitem', { name: 'Documents' });
    act(() => docs.focus());
    await act(async () => {});
    await user.keyboard(' ');
    expect(docs).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    expect(onCheckedItemsChange).toHaveBeenCalledWith(['docs'], {
      value: 'docs',
      checked: true,
      event: expect.any(Event),
    });
    expect(screen.getByRole('dialog', { name: 'Choose folders' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });

  it('in a Dialog: Escape in the action’s menu closes only the menu; Space on the item toggles it; the next Escape closes the Dialog (review focus)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Files">
          <Tree aria-label="Files" selectionMode="multiple" navigationMode="treegrid">
            <Tree.Item value="report" actions={<FileActions name="Report.docx" />}>
              Report.docx
            </Tree.Item>
            <Tree.Item value="notes">Notes.txt</Tree.Item>
          </Tree>
        </Dialog.Content>
      </Dialog>,
    );
    const report = screen.getByRole('treeitem', { name: 'Report.docx' });
    act(() => report.focus());
    await act(async () => {});
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { name: 'More actions for Report.docx' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button('More actions for Report.docx')).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{ArrowLeft}');
    expect(report).toHaveFocus();
    await user.keyboard(' ');
    expect(report).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });
});

// ---------------------------------------------------------------------------
// 0.8: stable class names across compounds, server-safe exports (spec §4.4 #10–#11)
// ---------------------------------------------------------------------------

describe('stable class names across compounds (spec §4.4 #10)', () => {
  it('a Toolbar.ToggleButton carries the classes of Button, ToggleButton and its own, on its root and its icon', () => {
    render(
      <Toolbar aria-label="Formatting">
        <Toolbar.ToggleButton name="format" value="bold" icon={<svg data-testid="bold-icon" />}>
          Bold
        </Toolbar.ToggleButton>
      </Toolbar>,
    );
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toHaveClass(toolbarClassNames.root);
    expect(button('Bold')).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
      toolbarToggleButtonClassNames.root,
    );
    expect(screen.getByTestId('bold-icon').parentElement).toHaveClass(
      buttonClassNames.icon,
      toggleButtonClassNames.icon,
      toolbarToggleButtonClassNames.icon,
    );
  });

  it('a SplitButton’s halves carry the Button class and their part classes', () => {
    render(<SplitButton>Save</SplitButton>);
    expect(screen.getByRole('group')).toHaveClass(splitButtonClassNames.root);
    expect(button('Save')).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.primaryActionButton,
    );
    expect(button('More options')).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.menuButton,
    );
  });

  it('Dialog.Content’s close button and title heading carry their classes', () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Settings">Body</Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveClass(dialogContentClassNames.root);
    expect(within(dialog).getByRole('heading', { name: 'Settings' })).toHaveClass(
      dialogTitleClassNames.root,
    );
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveClass(
      buttonClassNames.root,
      dialogContentClassNames.closeButton,
    );
  });

  it('Persona’s built-in Avatar carries the Avatar classes and the Persona part class', () => {
    const { container } = render(<Persona name="Ada Lovelace" secondaryText="Engineer" />);
    expect(container.firstElementChild).toHaveClass(personaClassNames.root);
    const avatar = container.querySelector(`.${personaClassNames.avatar}`);
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveClass(avatarClassNames.root, avatarClassNames.visual);
  });

  it('a Menu in a toast carries both components’ classes', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <UploadToastButton />
      </Toaster>,
    );
    await user.click(button('Upload'));
    expect(toastRegion()).toHaveClass(toasterClassNames.root);
    const group = toastGroup('Success: File uploaded');
    expect(group).toHaveClass(toasterClassNames.toast);
    const label = within(group).getByText('File uploaded');
    expect(label).toHaveClass(toastTitleClassNames.label);
    expect(label.closest(`.${toastTitleClassNames.root}`)).not.toBeNull();
    expect(label.closest(`.${toastClassNames.root}`)).not.toBeNull();
    const more = button('More');
    expect(more).toHaveClass(buttonClassNames.root, menuButtonClassNames.root);
    expect(more.closest(`.${toastTitleClassNames.action}`)).not.toBeNull();
    await user.click(more);
    expect(screen.getByRole('menu', { name: 'More' })).toHaveClass(menuPopoverClassNames.root);
    expect(menuitem('Open file')).toHaveClass(menuItemClassNames.root);
  });
});

/** Created at module scope, as an app's toasts module creates it (P3-08). */
const pageToaster = createToaster();

describe('server-safe 0.8 exports in a server render (spec §4.4 #11)', () => {
  /** A Server Component that styles app markup with a class-name constant (no client code). */
  function StyleNote() {
    return <p data-selector={`.${buttonClassNames.root}`}>Buttons</p>;
  }

  it('a Server Component reads a class-name constant from the entry: a plain string that Button renders first', () => {
    const html = renderToString(
      <>
        <StyleNote />
        <Button>Save</Button>
      </>,
    );
    expect(typeof buttonClassNames.root).toBe('string');
    expect(html).toContain(`data-selector=".${buttonClassNames.root}"`);
    expect(html).toMatch(new RegExp(`<button[^>]* class="${buttonClassNames.root}[ "]`));
  });

  it('a page whose module created a toaster handle renders no toast on the server; the hydrated Toaster shows the handle’s toasts', async () => {
    const tree = (
      <Toaster toaster={pageToaster}>
        <p>Page</p>
      </Toaster>
    );
    const html = renderToString(tree);
    expect(html).toContain('Page');
    expect(html).not.toContain('role="group"');
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    let root: Root | undefined;
    const error = vi.spyOn(console, 'error');
    try {
      await act(async () => {
        root = hydrateRoot(container, tree);
      });
      expect(error).not.toHaveBeenCalled();
      act(() => {
        pageToaster.dispatchToast({ title: 'Welcome back', timeout: 0 });
      });
      expect(screen.getByRole('group', { name: 'Info: Welcome back' })).toBeInTheDocument();
      act(() => pageToaster.dismissAllToasts());
      await act(async () => {});
      expect(screen.queryByRole('group', { name: 'Info: Welcome back' })).toBeNull();
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// 0.10: listbox, multi-select pickers, swatches and the calendar (spec §4.4 #1–#8)
// ---------------------------------------------------------------------------

/** `form.checkValidity()` inside `act()`: an invalid required control focuses itself. */
function formIsValid(form: HTMLFormElement): boolean {
  let valid = false;
  act(() => {
    valid = form.checkValidity();
  });
  return valid;
}

const fruitListboxOptions = [
  <Listbox.Option key="apple" value="apple">
    Apple
  </Listbox.Option>,
  <Listbox.Option key="banana" value="banana">
    Banana
  </Listbox.Option>,
  <Listbox.Option key="cherry" value="cherry">
    Cherry
  </Listbox.Option>,
];

const accentSwatches = [
  { value: 'red', color: '#d13438', label: 'Red' },
  { value: 'blue', color: '#0f6cbd', label: 'Blue' },
  { value: 'green', color: '#107c10', label: 'Green' },
];

const JUNE_12 = new Date(2025, 5, 12);
const JUNE_15 = new Date(2025, 5, 15);

describe('the real Field around Listbox, Calendar and SwatchPicker (spec §4.4 #1)', () => {
  it('a Listbox takes the Field label, hint and error; a required Field blocks an empty submit', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <Field label="Fruit" hint="Pick one." error="Choose a fruit" required>
          <Listbox name="fruit">{fruitListboxOptions}</Listbox>
        </Field>
      </form>,
    );
    const list = screen.getByRole('listbox', { name: /Fruit/ });
    expect(list).toHaveAccessibleDescription(/Choose a fruit/);
    expect(list).toHaveAccessibleDescription(/Pick one\./);
    expect(list).toHaveAttribute('aria-invalid', 'true');
    expect(list).toHaveAttribute('aria-required', 'true');
    expect(duplicateIds()).toEqual([]);
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    expect(formIsValid(form)).toBe(false);
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(formIsValid(form)).toBe(true);
    expect(new FormData(form).getAll('fruit')).toEqual(['banana']);
    await expectNoA11yViolations(document.body);
  });

  it('a Listbox under a Field validation message in the warning state is described, not invalid', async () => {
    render(
      <Field label="Fruit" validationState="warning" validationMessage="Bananas are out of season">
        <Listbox>{fruitListboxOptions}</Listbox>
      </Field>,
    );
    const list = screen.getByRole('listbox', { name: /Fruit/ });
    expect(list).toHaveAccessibleDescription('Bananas are out of season');
    expect(list).not.toHaveAttribute('aria-invalid');
    await expectNoA11yViolations(document.body);
  });

  it('a Calendar is the Field’s labelled group: described by the error, hint and required hint', async () => {
    render(
      <Field label="Delivery date" hint="Pick a day." error="Choose a date" required>
        <Calendar locale="en-US" today={JUNE_12} />
      </Field>,
    );
    const group = screen.getByRole('group', { name: /Delivery date/ });
    expect(group).toHaveAccessibleDescription(/Choose a date/);
    expect(group).toHaveAccessibleDescription(/Pick a day\./);
    expect(group).toHaveAccessibleDescription(/Required/);
    expect(group).toHaveAttribute('aria-invalid', 'true');
    // A group cannot carry aria-required: the hidden hint says so.
    expect(group).not.toHaveAttribute('aria-required');
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });

  it('a required Field makes a Calendar natively required until a day is picked', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <Field label="Delivery date" required>
          <Calendar locale="en-US" today={JUNE_12} />
        </Field>
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
    expect(formIsValid(form)).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Friday, June 20, 2025' }));
    expect(formIsValid(form)).toBe(true);
  });

  it('a grid-layout SwatchPicker in a required Field is named, described as required and axe clean', async () => {
    render(
      <Field label="Accent color" required>
        <SwatchPicker layout="grid" items={accentSwatches} />
      </Field>,
    );
    const grid = screen.getByRole('grid', { name: /Accent color/ });
    expect(grid).toHaveAccessibleDescription(/Required/);
    expect(duplicateIds()).toEqual([]);
    await expectNoA11yViolations(document.body);
  });
});

describe('multi-select Dropdown and Combobox in a form (spec §4.4 #2)', () => {
  const pickers = [
    {
      name: 'Dropdown',
      picker: (props: { onValueChange: (value: string[]) => void }) => (
        <Dropdown aria-label="Fruit" multiselect name="fruit" defaultValue={['a', 'b']} {...props}>
          <Dropdown.Option value="a">Apple</Dropdown.Option>
          <Dropdown.Option value="b">Banana</Dropdown.Option>
          <Dropdown.Option value="c">Cherry</Dropdown.Option>
        </Dropdown>
      ),
    },
    {
      name: 'Combobox',
      picker: (props: { onValueChange: (value: string[]) => void }) => (
        <Combobox aria-label="Fruit" multiselect name="fruit" defaultValue={['a', 'b']} {...props}>
          <Combobox.Option value="a">Apple</Combobox.Option>
          <Combobox.Option value="b">Banana</Combobox.Option>
          <Combobox.Option value="c">Cherry</Combobox.Option>
        </Combobox>
      ),
    },
  ];

  it.each(pickers)(
    '$name: one entry per value; a reset restores defaultValue and reports nothing when unchanged',
    async ({ picker }) => {
      const user = userEvent.setup();
      const onValueChange = vi.fn<(value: string[]) => void>();
      render(
        <form aria-label="Order">
          {picker({ onValueChange })}
          <button type="reset">Reset</button>
        </form>,
      );
      const form = screen.getByRole('form', { name: 'Order' }) as HTMLFormElement;
      expect(new FormData(form).getAll('fruit')).toEqual(['a', 'b']);

      // Unchanged: a reset restores what is already there and reports nothing.
      await user.click(button('Reset'));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(new FormData(form).getAll('fruit')).toEqual(['a', 'b']);

      await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
      await user.click(screen.getByRole('option', { name: 'Cherry' }));
      expect(new FormData(form).getAll('fruit')).toEqual(['a', 'b', 'c']);
      expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b', 'c']);

      await user.click(button('Reset'));
      expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b']);
      expect(new FormData(form).getAll('fruit')).toEqual(['a', 'b']);
    },
  );
});

describe('a Listbox in a Dialog (spec §4.4 #3)', () => {
  it('takes focus from Tab, answers its keys, and leaves Escape to the Dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Order">
          <Listbox aria-label="Fruit" onValueChange={onValueChange}>
            {fruitListboxOptions}
          </Listbox>
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    const list = within(dialog).getByRole('listbox', { name: 'Fruit' });
    for (let presses = 0; presses < 4 && document.activeElement !== list; presses += 1) {
      await user.tab();
    }
    expect(list).toHaveFocus();
    const activeName = () =>
      document.getElementById(list.getAttribute('aria-activedescendant') ?? '')?.textContent;
    expect(activeName()).toBe('Apple');

    await user.keyboard('{ArrowDown}');
    expect(activeName()).toBe('Banana');
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('banana');
    expect(within(dialog).getByRole('option', { name: 'Banana' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(onOpenChange).not.toHaveBeenCalled();

    // The list consumes no Escape: it reaches the Dialog.
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
    await expectNoA11yViolations(document.body);
  });
});

describe('a Tooltip with relationship="label" around a ColorSwatch (spec §4.4 #4)', () => {
  it.each([
    ['the row layout', { layout: 'row', focusMode: 'arrow' }],
    ['the grid layout', { layout: 'grid', focusMode: 'arrow' }],
    ['tab mode in the row layout', { layout: 'row', focusMode: 'tab' }],
    ['tab mode in the grid layout', { layout: 'grid', focusMode: 'tab' }],
  ] as const)(
    '%s: the swatch is named by the tooltip, which shows on focus',
    async (_name, props) => {
      const user = userEvent.setup();
      render(
        <SwatchPicker {...props} aria-label="Palette">
          <Tooltip content="Ocean blue" relationship="label">
            <ColorSwatch value="blue" color="#0f6cbd" />
          </Tooltip>
          <ColorSwatch value="red" color="#d13438" aria-label="Red" />
        </SwatchPicker>,
      );
      const blue = screen.getByRole(
        props.layout === 'row' && props.focusMode !== 'tab' ? 'radio' : 'button',
        {
          name: 'Ocean blue',
        },
      );
      expect(blue).toBeInTheDocument();
      await user.tab();
      expect(blue).toHaveFocus();
      await waitFor(() => expect(tooltipSurface()).toHaveTextContent('Ocean blue'));
      await user.keyboard('{Escape}');
    },
  );
});

describe('a Popover opened from an EmptySwatch holding a ColorPicker (spec §4.4 #5)', () => {
  it('arrow keys inside the Popover do not move the grid’s focus; the ColorPicker keeps its own swatches', async () => {
    const user = userEvent.setup();
    const onOuterChange = vi.fn();
    render(
      <SwatchPicker
        layout="grid"
        aria-label="Palette"
        items={accentSwatches}
        defaultValue="red"
        onValueChange={onOuterChange}
      >
        <Popover>
          <Popover.Trigger>
            <EmptySwatch />
          </Popover.Trigger>
          <Popover.Content aria-label="Custom color">
            <ColorPicker aria-label="Custom" defaultValue="#0f6cbd" />
          </Popover.Content>
        </Popover>
      </SwatchPicker>,
    );
    await user.click(button('Add color'));
    const popup = await screen.findByRole('dialog', { name: 'Custom color' });
    const hex = within(popup).getByRole('textbox', { name: 'Hex color value' });
    act(() => hex.focus());
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
      expect(fireEvent.keyDown(hex, { key })).toBe(true);
    }
    expect(hex).toHaveFocus();

    // The picker's own swatches select and roam inside the popover.
    const red = within(popup).getByRole('radio', { name: 'Red' });
    await user.click(red);
    expect(hex).toHaveValue('#d13438');
    expect(red).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(popup).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(red);
    expect(onOuterChange).not.toHaveBeenCalled();
    const outerRed = screen
      .getByRole('button', { name: 'Red', hidden: true })
      .closest('[role="gridcell"]');
    expect(outerRed).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
  });
});

describe('a DatePicker in a Dialog (spec §4.4 #6)', () => {
  it('Escape leaves the month view, then closes the DatePicker and returns focus, then closes the Dialog', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Order">
          <DatePicker aria-label="Delivery date" locale="en-US" defaultValue={JUNE_15} />
        </Dialog.Content>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    const toggle = within(dialog).getByRole('button', { name: 'Open calendar' });
    await user.click(toggle);
    const calendar = screen.getAllByRole('dialog').find((el) => el !== dialog)!;
    expect(within(calendar).getByRole('grid')).toHaveAccessibleName('June 2025');

    await user.click(within(calendar).getByRole('button', { name: 'June 2025' }));
    expect(within(calendar).getByRole('grid')).toHaveAccessibleName('2025');
    await expectNoA11yViolations(document.body);

    // 1: the month view gives way to the day view; the DatePicker and the Dialog stay.
    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(within(calendar).getByRole('grid')).toHaveAccessibleName('June 2025');
    expect(calendar).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    // 2: the DatePicker closes and focus returns to its toggle.
    await user.keyboard('{Escape}');
    await act(async () => {});
    expect(screen.getAllByRole('dialog')).toEqual([dialog]);
    expect(toggle).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();

    // 3: the Dialog closes.
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });
});

describe('the custom picker of the Listbox story, on the package entry alone (spec §4.4 #8, R24)', () => {
  const FONTS = ['Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Courier New'] as const;

  const matchesFont = (item: ListboxItem, text: string) =>
    (item.textValue ?? item.label).toLowerCase().includes(text.toLowerCase());

  /** The story's editable font picker: `useListbox`, `useListboxPopup`, `ListboxSurface`, `Option`. */
  function FontPicker({ onSubmit }: { onSubmit: (font: string) => void }) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState('');
    const [draft, setDraft] = React.useState<string | null>(null);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listbox = useListbox({
      open,
      onOpenChange: (next) => {
        setOpen(next);
        if (!next) setDraft(null);
      },
      mode: 'editable',
      selectedValues: value ? [value] : [],
      onSelect: (next) => {
        setValue(next);
        setDraft(null);
      },
      filter: draft ? (item) => matchesFont(item, draft) : undefined,
      autoHighlight: draft ? 'first' : false,
    });
    const expanded = open && listbox.items.length > 0;
    const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
      open,
      surfaceOpen: expanded,
      onDismiss: () => {
        setOpen(false);
        setDraft(null);
      },
      rootRef,
      anchorRef: inputRef,
    });
    const inputMergedRef = useMergedRefs<HTMLInputElement>(inputRef, setReference);

    return (
      <form
        aria-label="Fonts form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(String(new FormData(event.currentTarget).get('font') ?? ''));
        }}
      >
        <div ref={rootRef}>
          <input
            type="text"
            aria-label="Font"
            autoComplete="off"
            {...listbox.getComboboxProps()}
            aria-expanded={expanded}
            ref={inputMergedRef}
            value={draft ?? value}
            onChange={(event) => {
              setDraft(event.target.value);
              if (!open) setOpen(true);
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && open && !expanded && !event.nativeEvent.isComposing) {
                setOpen(false);
                setDraft(null);
                return;
              }
              listbox.onKeyDown(event);
            }}
            onKeyUp={listbox.onKeyUp}
          />
          <ListboxSurface
            listbox={listbox}
            layerId={layerId}
            surfaceRef={surfaceRef}
            floatingProps={floatingProps}
            open={open}
            expanded={expanded}
            aria-label="Fonts"
          >
            {FONTS.map((font) => (
              <Option key={font} value={font}>
                {font}
              </Option>
            ))}
          </ListboxSurface>
        </div>
        <input type="hidden" name="font" value={value} />
        <button type="submit">Submit</button>
      </form>
    );
  }

  it('opens, filters, selects and submits through FormData', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(font: string) => void>();
    render(<FontPicker onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox', { name: 'Font' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Typing opens the list and filters the fonts.
    await user.click(input);
    await user.keyboard('a');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const fonts = () => screen.getAllByRole('option').map((option) => option.textContent);
    expect(fonts()).toEqual(['Arial', 'Georgia', 'Verdana', 'Times New Roman']);
    await user.keyboard('r');
    expect(fonts()).toEqual(['Arial']);

    // Enter selects the highlighted match, closes the list and shows the font.
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('Arial');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(button('Submit'));
    expect(onSubmit).toHaveBeenCalledWith('Arial');

    // Reopened by the keyboard, the whole list is back and the choice is selected; a click selects.
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    expect(fonts()).toHaveLength(FONTS.length);
    expect(screen.getByRole('option', { name: 'Arial' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'Verdana' }));
    expect(input).toHaveValue('Verdana');
    await user.click(button('Submit'));
    expect(onSubmit).toHaveBeenLastCalledWith('Verdana');
    await expectNoA11yViolations(document.body);
  });

  it('closes on Escape with options shown and restores the selected font’s name', async () => {
    const user = userEvent.setup();
    render(<FontPicker onSubmit={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Font' });
    await user.click(input);
    await user.keyboard('geo');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
