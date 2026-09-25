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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as ImageStories from '../../stories/Image.stories';
import * as Wave from '../index';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Button,
  Card,
  Carousel,
  CarouselItem,
  Checkbox,
  ColorPicker,
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
  Field,
  InfoLabel,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuPopover,
  MenuTrigger,
  Nav,
  NavCategory,
  NavItem,
  NavSubItem,
  Overflow,
  OverflowItem,
  Popover,
  Portal,
  RadioGroup,
  Rating,
  SearchBox,
  Select,
  Slider,
  SpinButton,
  SplitButton,
  Stack,
  SwatchPicker,
  Switch,
  Table,
  TabList,
  TabListPanel,
  TabListTab,
  TagPicker,
  TeachingPopover,
  Textarea,
  TimePicker,
  Toaster,
  Toolbar,
  Tooltip,
  Tree,
  TreeItem,
  useOverflowMenu,
  useToastController,
} from '../index';
import { asClientReference, expectNoA11yViolations } from '../test-utils';

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
        if (!(flat in barrel)) missing.push(flat);
        else if (barrel[flat] !== (value as Record<string, unknown>)[member]) different.push(flat);
      }
    }
    expect(compounds).toBeGreaterThanOrEqual(19);
    expect(missing).toEqual([]);
    expect(different).toEqual([]);
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
      'useListbox',
      'collectOptionLabels',
      'markListboxElement',
      'useListboxPopup',
      'ListboxSurface',
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
        <Tooltip content="Opens the settings" delay={0}>
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
          <Tooltip content="Opens the project" delay={0}>
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
              <Tooltip content="Deletes Report.pdf" delay={0}>
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
                <Tooltip content="Actions for Report.pdf" delay={0}>
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
            <Tooltip content="Share this project" delay={0}>
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
          <Tooltip content="Bold (Ctrl+B)" delay={0}>
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
        <Tooltip content="Clears every filter" delay={0}>
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
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
              <Tooltip content="Bold text" delay={0}>
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
            <Tooltip content="First" delay={0}>
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
// A Popover opened inside a Menu.Item (portal events bubbling through the menu)
// ---------------------------------------------------------------------------

// React bubbles the events of the portaled Popover.Content through the Menu.Item and the menu
// surface. The menu leaves them alone: no activation, no typeahead, no close, no focus move.
describe('a Popover inside a persistOnClick Menu.Item', () => {
  function RenameMenu({ onRename }: { onRename?: () => void }) {
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
          <Menu.Item>Delete</Menu.Item>
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
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
