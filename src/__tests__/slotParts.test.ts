/**
 * The completeness gate of `slotProps` (Phase 13, R2, R4, R7): every part key of the class-name
 * registry (`src/lib/classNames.ts`, each key of a constant but `root`) is exactly one of a
 * `slotProps` key of its component, a named slot, an exclusion with a reason, or pending, as the
 * lists of `src/lib/slotParts.ts` say. The gate also fails on a list entry that names no registry
 * constant or part key (an exclusion whose part was renamed, say), on a key listed twice, on an
 * empty or `undefined` entry and on an exclusion without a one-line reason. Each check is a
 * function run on the real lists and, to prove its messages, on small fixtures.
 *
 * Owners: a type test (checked by `npm run typecheck`) requires `SlotPropsOwners` below to name
 * the same constants as `SLOT_PROPS_KEYS`, and each owner's `slotProps` to declare exactly the
 * keys listed for it (and `root` exactly for the owners `SLOT_PROPS_ROOT_OWNERS` names), so a
 * rollout task can neither move a key without declaring it nor declare one without moving it; a
 * failure names the constant and the key. The registry and this gate supersede the part list of
 * the Phase 3 spec's Appendix A (R4).
 */
import { expectTypeOf } from 'vitest';
import * as registry from '../lib/classNames';
import * as entry from '../index';
import type {
  AccordionTriggerProps,
  AlphaSliderProps,
  AvatarGroupItemProps,
  AvatarGroupProps,
  AvatarProps,
  BreadcrumbProps,
  CalendarProps,
  CardHeaderProps,
  CardProps,
  CarouselProps,
  CheckboxProps,
  ColorAreaProps,
  ColorPickerHexFieldProps,
  ColorPickerProps,
  ColorSliderProps,
  ComboboxProps,
  CompoundButtonProps,
  DataGridHeaderCellProps,
  DataGridHeaderProps,
  DataGridRowProps,
  DatePickerProps,
  DialogContentProps,
  DividerProps,
  DrawerHeaderTitleProps,
  DrawerProps,
  DropdownProps,
  FieldProps,
  FlatTreeProps,
  InfoButtonProps,
  InfoLabelProps,
  InputProps,
  InteractionTagPrimaryProps,
  InteractionTagSecondaryProps,
  LabelProps,
  ListItemProps,
  MenuItemCheckboxProps,
  MenuItemLinkProps,
  MenuItemProps,
  MenuItemRadioProps,
  MenuItemSwitchProps,
  MessageBarProps,
  NavAppItemProps,
  NavAppItemStaticProps,
  NavCategoryProps,
  NavDrawerBodyProps,
  NavDrawerFooterProps,
  NavDrawerProps,
  NavItemProps,
  NavProps,
  NavSectionHeaderProps,
  NavSubItemProps,
  OptionGroupProps,
  OptionProps,
  OverflowProps,
  PaginationProps,
  PopoverContentProps,
  PresenceBadgeProps,
  ProgressBarProps,
  RadioGroupItemProps,
  RatingDisplayProps,
  SearchBoxProps,
  SpinButtonProps,
  SpinnerProps,
  StepperProps,
  StepProps,
  SwitchProps,
  TableCellLayoutProps,
  TableHeaderCellProps,
  TableSelectionCellProps,
  TagPickerProps,
  TagProps,
  TeachingPopoverCarouselNavProps,
  TeachingPopoverProps,
  TimePickerProps,
  ToastBodyProps,
  ToasterProps,
  ToastProps,
  ToastTitleProps,
  TooltipProps,
  TreeItemPersonaLayoutProps,
  TreeItemProps,
} from '../index';
import * as slotParts from '../lib/slotParts';
import {
  NAMED_SLOT_PARTS,
  PENDING_SLOT_PARTS,
  SLOT_PART_EXCLUSIONS,
  SLOT_PROPS_KEYS,
  type SLOT_PROPS_ROOT_OWNERS,
} from '../lib/slotParts';

type Registry = Readonly<Record<string, Readonly<Record<string, string>>>>;
type PartLists = Readonly<Record<string, readonly string[] | undefined>>;
type ListName = 'a slotProps key' | 'a named slot' | 'an exclusion' | 'pending';

/** The four lists of `src/lib/slotParts.ts`, or a fixture of them. */
interface SlotPartData {
  readonly slotProps: PartLists;
  readonly named: PartLists;
  readonly exclusions: readonly { component: string; key: string; reason: unknown }[];
  readonly pending: PartLists;
}

const MAP_NAMES = {
  slotProps: 'SLOT_PROPS_KEYS',
  named: 'NAMED_SLOT_PARTS',
  pending: 'PENDING_SLOT_PARTS',
} as const;

/** `[list, constant, key]` for every entry of the four lists, in list order. */
function listEntries(data: SlotPartData): [ListName, string, string][] {
  const fromMap = (list: ListName, map: PartLists): [ListName, string, string][] =>
    Object.entries(map).flatMap(([constant, keys]) =>
      (keys ?? []).map((key): [ListName, string, string] => [list, constant, key]),
    );
  return [
    ...fromMap('a slotProps key', data.slotProps),
    ...fromMap('a named slot', data.named),
    ...data.exclusions.map(({ component, key }): [ListName, string, string] => [
      'an exclusion',
      component,
      key,
    ]),
    ...fromMap('pending', data.pending),
  ];
}

/** Every part key of every constant in exactly one list (R2: never a slotProps key and named). */
function resolutionErrors(parts: Registry, data: SlotPartData): string[] {
  const lists = new Map<string, Set<ListName>>();
  for (const [list, constant, key] of listEntries(data)) {
    const id = `${constant}.${key}`;
    lists.set(id, (lists.get(id) ?? new Set()).add(list));
  }
  const wrong: string[] = [];
  for (const [constant, value] of Object.entries(parts)) {
    for (const key of Object.keys(value)) {
      if (key === 'root') continue;
      const id = `${constant}.${key}`;
      const found = [...(lists.get(id) ?? [])];
      if (found.length === 0) {
        wrong.push(`${id}: neither a slotProps key, a named slot, an exclusion nor pending`);
      } else if (found.includes('a slotProps key') && found.includes('a named slot')) {
        wrong.push(
          `${id}: both a slotProps key and a named slot (R2: a named slot is not repeated)`,
        );
      } else if (found.includes('pending') && found.length > 1) {
        const resolved = found.filter((list) => list !== 'pending').join(' and ');
        wrong.push(`${id}: pending, but already ${resolved}`);
      } else if (found.length > 1) {
        wrong.push(`${id}: both ${found.join(' and ')}`);
      }
    }
  }
  return wrong;
}

/** List entries that name no registry constant, or no part key of their constant. */
function unknownEntryErrors(parts: Registry, data: SlotPartData): string[] {
  const wrong = listEntries(data).flatMap(([list, constant, key]) => {
    if (!Object.hasOwn(parts, constant)) {
      return [`${constant}: no constant of the class-name registry (${list})`];
    }
    return key !== 'root' && Object.hasOwn(parts[constant], key)
      ? []
      : [`${constant}.${key}: no part key of ${constant} (${list})`];
  });
  return [...new Set(wrong)];
}

/** Keys listed twice in one list, and entries that are empty or `undefined`. */
function listShapeErrors(data: SlotPartData): string[] {
  const seen = new Set<string>();
  const wrong: string[] = [];
  for (const [list, constant, key] of listEntries(data)) {
    const id = `${list}: ${constant}.${key}`;
    if (seen.has(id)) wrong.push(`${constant}.${key}: listed twice as ${list}`);
    seen.add(id);
  }
  for (const [field, name] of Object.entries(MAP_NAMES) as [keyof typeof MAP_NAMES, string][]) {
    for (const [constant, keys] of Object.entries(data[field])) {
      if (!keys || keys.length === 0) {
        wrong.push(`${constant}: an empty or undefined entry of ${name} (remove it)`);
      }
    }
  }
  return wrong;
}

/** Exclusions whose reason is not one non-blank line. */
function reasonErrors(data: SlotPartData): string[] {
  return data.exclusions
    .filter(
      ({ reason }) => typeof reason !== 'string' || reason.trim() === '' || /[\r\n]/.test(reason),
    )
    .map(({ component, key }) => `${component}.${key}: an exclusion without a one-line reason`);
}

/**
 * What keeps a module from being server-safe data: a value import or a value re-export (only
 * `import type` and `export type … from` may name another module), a client directive or a
 * `require()`. Comments are ignored. A re-export is `export *` or `export { … }` followed by
 * `from` and a module name, so a data literal whose strings say "from" is none.
 */
function serverSafetyErrors(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const statements = (pattern: RegExp) => (code.match(pattern) ?? []).map((s) => s.trim());
  return [
    ...statements(/^\s*import\b[^;]*;/gm)
      .filter((s) => !/^import\s+type\b/.test(s))
      .map((s) => `a value import: ${s}`),
    ...statements(
      /^\s*export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*['"][^'"]*['"];?/gm,
    )
      .filter((s) => !/^export\s+type\b/.test(s))
      .map((s) => `a value re-export: ${s}`),
    ...(/['"]use client['"]/.test(code) ? ['a client directive'] : []),
    ...(/\brequire\s*\(/.test(code) ? ['a require() call'] : []),
  ];
}

const REGISTRY = registry as unknown as Registry;
const DATA: SlotPartData = {
  slotProps: SLOT_PROPS_KEYS,
  named: NAMED_SLOT_PARTS,
  exclusions: SLOT_PART_EXCLUSIONS,
  pending: PENDING_SLOT_PARTS,
};

describe('slotProps completeness gate (R7)', () => {
  it('resolves every part key of every registry constant through exactly one list', () => {
    expect(resolutionErrors(REGISTRY, DATA)).toEqual([]);
  });

  it('names only registry constants and their part keys', () => {
    expect(unknownEntryErrors(REGISTRY, DATA)).toEqual([]);
  });

  it('lists each part key once per list, with no empty or undefined entry', () => {
    expect(listShapeErrors(DATA)).toEqual([]);
  });

  it('gives every exclusion a one-line reason', () => {
    expect(reasonErrors(DATA)).toEqual([]);
  });
});

describe('slotProps completeness gate: the checks on fixtures', () => {
  const PARTS: Registry = {
    switchClassNames: {
      root: 'wave-switch',
      track: 'wave-switch__track',
      thumb: 'wave-switch__thumb',
    },
    buttonClassNames: { root: 'wave-button', icon: 'wave-button__icon' },
    listClassNames: { root: 'wave-list', spacer: 'wave-list__spacer' },
  };
  const COMPLETE: SlotPartData = {
    slotProps: { switchClassNames: ['track'] },
    named: { buttonClassNames: ['icon'] },
    exclusions: [{ component: 'listClassNames', key: 'spacer', reason: 'a spacer' }],
    pending: { switchClassNames: ['thumb'] },
  };

  it('passes complete data', () => {
    expect(resolutionErrors(PARTS, COMPLETE)).toEqual([]);
    expect(unknownEntryErrors(PARTS, COMPLETE)).toEqual([]);
    expect(listShapeErrors(COMPLETE)).toEqual([]);
    expect(reasonErrors(COMPLETE)).toEqual([]);
  });

  it('names a part key that no list holds', () => {
    expect(resolutionErrors(PARTS, { ...COMPLETE, pending: {} })).toEqual([
      'switchClassNames.thumb: neither a slotProps key, a named slot, an exclusion nor pending',
    ]);
  });

  it('fails a key that is both a slotProps key and a named slot (R2)', () => {
    const data = { ...COMPLETE, slotProps: { ...COMPLETE.slotProps, buttonClassNames: ['icon'] } };
    expect(resolutionErrors(PARTS, data)).toEqual([
      'buttonClassNames.icon: both a slotProps key and a named slot (R2: a named slot is not repeated)',
    ]);
  });

  it('fails a pending key that is already resolved, and a key in two other lists', () => {
    const data: SlotPartData = {
      ...COMPLETE,
      named: { ...COMPLETE.named, listClassNames: ['spacer'] },
      pending: { switchClassNames: ['track', 'thumb'] },
    };
    expect(resolutionErrors(PARTS, data)).toEqual([
      'switchClassNames.track: pending, but already a slotProps key',
      'listClassNames.spacer: both a named slot and an exclusion',
    ]);
  });

  it('fails an unknown constant and an unknown key, a stale exclusion included', () => {
    const data: SlotPartData = {
      ...COMPLETE,
      exclusions: [
        ...COMPLETE.exclusions,
        { component: 'switchClassNames', key: 'knob', reason: 'x' },
      ],
      pending: { ...COMPLETE.pending, fooClassNames: ['bar'], buttonClassNames: ['root'] },
    };
    expect(unknownEntryErrors(PARTS, data)).toEqual([
      'switchClassNames.knob: no part key of switchClassNames (an exclusion)',
      'fooClassNames: no constant of the class-name registry (pending)',
      'buttonClassNames.root: no part key of buttonClassNames (pending)',
    ]);
  });

  it('fails a key listed twice, and an empty or undefined entry instead of crashing (H1)', () => {
    const data: SlotPartData = {
      ...COMPLETE,
      named: { ...COMPLETE.named, listClassNames: undefined },
      pending: { switchClassNames: ['thumb', 'thumb'], badgeClassNames: [] },
    };
    expect(listShapeErrors(data)).toEqual([
      'switchClassNames.thumb: listed twice as pending',
      'listClassNames: an empty or undefined entry of NAMED_SLOT_PARTS (remove it)',
      'badgeClassNames: an empty or undefined entry of PENDING_SLOT_PARTS (remove it)',
    ]);
  });

  it('fails an exclusion without a one-line reason', () => {
    const data: SlotPartData = {
      ...COMPLETE,
      exclusions: [
        { component: 'listClassNames', key: 'spacer', reason: ' ' },
        { component: 'switchClassNames', key: 'thumb', reason: 'one\ntwo' },
        { component: 'buttonClassNames', key: 'icon', reason: undefined },
      ],
    };
    expect(reasonErrors(data)).toEqual([
      'listClassNames.spacer: an exclusion without a one-line reason',
      'switchClassNames.thumb: an exclusion without a one-line reason',
      'buttonClassNames.icon: an exclusion without a one-line reason',
    ]);
  });

  it('fails a value import, a value re-export (H2), a client directive and require()', () => {
    const fine = [
      "import type * as ClassNames from './classNames';",
      "export type { SlotPart } from './slotProps';",
      '// import { cn } from "./cn"; export { x } from "./y";',
      'export const A = {} as const;',
      "export const B = ['generated from `max`; written', 'from { a } here'];",
    ].join('\n');
    expect(serverSafetyErrors(fine)).toEqual([]);
    const wrong = [
      "'use client';",
      "import { cn } from './cn';",
      "export { buttonClassNames as reexport } from './classNames';",
      "export * from './classNames';",
      "const fs = require('node:fs');",
    ].join('\n');
    expect(serverSafetyErrors(wrong)).toEqual([
      "a value import: import { cn } from './cn';",
      "a value re-export: export { buttonClassNames as reexport } from './classNames';",
      "a value re-export: export * from './classNames';",
      'a client directive',
      'a require() call',
    ]);
  });
});

describe('slotParts module', () => {
  it('is data for the gate only: the package entry does not export it', () => {
    const exported = Object.keys(slotParts).filter((name) => Reflect.has(entry, name));
    expect(exported).toEqual([]);
  });

  it('imports and re-exports types only, so it stays server-safe', () => {
    const [source] = Object.values(
      import.meta.glob<string>('../lib/slotParts.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    );
    expect(source).toBeTypeOf('string');
    expect(serverSafetyErrors(source)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Owners of the slotProps keys (type-level: `npm run typecheck` checks it)
// ---------------------------------------------------------------------------

/**
 * The props type of the component that declares each constant's `slotProps` keys, by registry
 * constant. Each rollout task adds its owners as it moves their keys to `SLOT_PROPS_KEYS`. Where
 * another component draws a part (TeachingPopover's `closeButton` in TeachingPopover.Header,
 * AvatarGroup's `surface` in AvatarGroup.Popover), the owner is the component that declares the
 * key.
 */
type SlotPropsOwners = {
  inputClassNames: InputProps;
  fieldClassNames: FieldProps;
  labelClassNames: LabelProps;
  checkboxClassNames: CheckboxProps;
  radioGroupItemClassNames: RadioGroupItemProps;
  switchClassNames: SwitchProps;
  spinButtonClassNames: SpinButtonProps;
  ratingDisplayClassNames: RatingDisplayProps;
  searchBoxClassNames: SearchBoxProps;
  optionClassNames: OptionProps;
  optionGroupClassNames: OptionGroupProps;
  comboboxClassNames: ComboboxProps;
  dropdownClassNames: DropdownProps;
  // Every TagPicker key is declared on the root and read by the parts through its context.
  tagPickerClassNames: TagPickerProps;
  timePickerClassNames: TimePickerProps;
  // The calendar view draws the parts of both, each under its own constant's keys.
  datePickerClassNames: DatePickerProps;
  calendarClassNames: CalendarProps;
  colorPickerClassNames: ColorPickerProps;
  colorPickerHexFieldClassNames: ColorPickerHexFieldProps;
  colorAreaClassNames: ColorAreaProps;
  colorSliderClassNames: ColorSliderProps;
  alphaSliderClassNames: AlphaSliderProps;
  // The button and its `icon` are Button's; CompoundButton declares only the parts it draws.
  compoundButtonClassNames: CompoundButtonProps;
  dialogContentClassNames: DialogContentProps;
  // Drawer and NavDrawer share the panel, which draws neither part: the header row is Drawer's,
  // the landmark NavDrawer's.
  drawerClassNames: DrawerProps;
  drawerHeaderTitleClassNames: DrawerHeaderTitleProps;
  navDrawerClassNames: NavDrawerProps;
  navDrawerBodyClassNames: NavDrawerBodyProps;
  navDrawerFooterClassNames: NavDrawerFooterProps;
  popoverContentClassNames: PopoverContentProps;
  // The item kinds share the item row: each declares the parts it draws, under its own constant.
  menuItemClassNames: MenuItemProps;
  menuItemCheckboxClassNames: MenuItemCheckboxProps;
  menuItemRadioClassNames: MenuItemRadioProps;
  menuItemSwitchClassNames: MenuItemSwitchProps;
  menuItemLinkClassNames: MenuItemLinkProps;
  tooltipClassNames: TooltipProps;
  // Every TeachingPopover key is declared on the root and read by its parts through its context.
  teachingPopoverClassNames: TeachingPopoverProps;
  teachingPopoverCarouselNavClassNames: TeachingPopoverCarouselNavProps;
  infoButtonClassNames: InfoButtonProps;
  // InfoLabel's `infoButton` and `info` are drawn by the InfoButton it renders.
  infoLabelClassNames: InfoLabelProps;
  toastClassNames: ToastProps;
  toastTitleClassNames: ToastTitleProps;
  toastBodyClassNames: ToastBodyProps;
  // The container of each toast is drawn by the Toaster.
  toasterClassNames: ToasterProps;
  treeItemClassNames: TreeItemProps;
  treeItemPersonaLayoutClassNames: TreeItemPersonaLayoutProps;
  // FlatTree.Item is the tree's own row, never written by hand: FlatTree declares its parts and
  // hands them to every item.
  flatTreeItemClassNames: FlatTreeProps;
  // NavDrawer shares the Nav state, not the Nav's list: its lists are NavDrawer.Body's and
  // NavDrawer.Footer's.
  navClassNames: NavProps;
  navCategoryClassNames: NavCategoryProps;
  navItemClassNames: NavItemProps;
  navSubItemClassNames: NavSubItemProps;
  navSectionHeaderClassNames: NavSectionHeaderProps;
  navAppItemClassNames: NavAppItemProps;
  navAppItemStaticClassNames: NavAppItemStaticProps;
  // With overflow="auto" the trail's list is the Overflow it renders, which takes the part as its
  // own props; the Overflow's button wrapper is the Overflow's own part.
  breadcrumbClassNames: BreadcrumbProps;
  paginationClassNames: PaginationProps;
  stepperClassNames: StepperProps;
  stepperStepClassNames: StepProps;
  // The Item draws the heading around a wrapper of the Trigger, with the Trigger's part.
  accordionTriggerClassNames: AccordionTriggerProps;
  overflowClassNames: OverflowProps;
  // Card and Card.Header are polymorphic: their keys are in CardOwnProps and CardHeaderOwnProps.
  cardClassNames: CardProps;
  cardHeaderClassNames: CardHeaderProps;
  // Without a badge the visual is the root itself; the part applies to it.
  avatarClassNames: AvatarProps;
  // AvatarGroup.Popover, built in or yours, reads the popup's parts from the group's context.
  avatarGroupClassNames: AvatarGroupProps;
  // AvatarGroup.Item omits Avatar's parts and declares the name of its overflow row.
  avatarGroupItemClassNames: AvatarGroupItemProps;
  presenceBadgeClassNames: PresenceBadgeProps;
  // The built-in Previous and Next buttons take the parts; a Carousel.Button takes its own props.
  carouselClassNames: CarouselProps;
  listItemClassNames: ListItemProps;
  // Divider is polymorphic: its keys are in DividerOwnProps.
  dividerClassNames: DividerProps;
  // Tag is polymorphic: its keys are in TagOwnProps.
  tagClassNames: TagProps;
  interactionTagPrimaryClassNames: InteractionTagPrimaryProps;
  interactionTagSecondaryClassNames: InteractionTagSecondaryProps;
  tableHeaderCellClassNames: TableHeaderCellProps;
  tableSelectionCellClassNames: TableSelectionCellProps;
  tableCellLayoutClassNames: TableCellLayoutProps;
  // The select-all checkbox, wherever a header row draws it, reads the header's part.
  dataGridHeaderClassNames: DataGridHeaderProps;
  // `resizeHandle` reaches the handle the cell draws with resizable columns; a Table.ResizeHandle
  // you render takes its props directly.
  dataGridHeaderCellClassNames: DataGridHeaderCellProps;
  // The control of the row's selection cell, the automatic one or a DataGrid.SelectionCell child.
  dataGridRowClassNames: DataGridRowProps;
  // `dismissButton` is the bar's own Dismiss button, which a `dismiss` button merges into.
  messageBarClassNames: MessageBarProps;
  progressBarClassNames: ProgressBarProps;
  spinnerClassNames: SpinnerProps;
};

/** The `slotProps` keys of a props type (all of them, `root` included). */
type DeclaredSlotPropsKeys<Props> = Props extends { slotProps?: infer S }
  ? keyof NonNullable<S> & string
  : never;

/** The keys a `SLOT_PROPS_KEYS`-shaped object lists for constant `C`. */
type ListedSlotPropsKeys<Keys, C> = C extends keyof Keys
  ? Keys[C] extends readonly (infer K)[]
    ? K & string
    : never
  : never;

/**
 * Every disagreement between the owners and the listed keys, one message per constant and key
 * (`never` when they agree). `Roots` are the constants whose owner declares `root` too (no part
 * key), and must.
 */
type SlotPropsOwnerErrors<Owners, Keys, Roots> = {
  [C in (keyof Owners | keyof Keys) & string]: C extends keyof Owners
    ? | (C extends keyof Keys ? never : `${C}: an owner, but SLOT_PROPS_KEYS lists no key for it`)
      | `${C}.${Exclude<DeclaredSlotPropsKeys<Owners[C]>, ListedSlotPropsKeys<Keys, C> | 'root'>}: declared by the owner's slotProps, not listed in SLOT_PROPS_KEYS`
      | `${C}.${Exclude<ListedSlotPropsKeys<Keys, C>, DeclaredSlotPropsKeys<Owners[C]>>}: listed in SLOT_PROPS_KEYS, not declared by the owner's slotProps`
      | (C extends Roots
          ? 'root' extends DeclaredSlotPropsKeys<Owners[C]>
            ? never
            : `${C}.root: a root owner whose slotProps declares no root`
          : 'root' extends DeclaredSlotPropsKeys<Owners[C]>
            ? `${C}.root: declared, but only the owners of SLOT_PROPS_ROOT_OWNERS declare root`
            : never)
    : `${C}: listed in SLOT_PROPS_KEYS, but no owner in SlotPropsOwners`;
}[(keyof Owners | keyof Keys) & string];

/**
 * `T` itself, which compiles only while `T` is `never`: a failure reads "Type '"<constant>.<key>:
 * …"' does not satisfy the constraint 'never'", where `expectTypeOf` alone would print only
 * "Expected 1 arguments, but got 0".
 */
type MustBeNever<T extends never> = T;

describe('slotProps owners (type-level)', () => {
  it("gives each owner's slotProps exactly the keys SLOT_PROPS_KEYS lists for it", () => {
    expectTypeOf<
      MustBeNever<
        SlotPropsOwnerErrors<
          SlotPropsOwners,
          typeof SLOT_PROPS_KEYS,
          (typeof SLOT_PROPS_ROOT_OWNERS)[number]
        >
      >
    >().toEqualTypeOf<never>();
  });

  it('bites on fixtures, naming the constant and the key', () => {
    type Listed = { readonly switchClassNames: readonly ['track', 'thumb'] };
    type SwitchOwner = { slotProps?: { track?: { className?: string }; thumb?: object } };
    type WithRoot = { slotProps?: { root?: object; track?: object; thumb?: object } };
    expectTypeOf<
      SlotPropsOwnerErrors<{ switchClassNames: SwitchOwner }, Listed, never>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      SlotPropsOwnerErrors<
        { switchClassNames: SwitchOwner },
        { readonly switchClassNames: readonly ['track'] },
        never
      >
    >().toEqualTypeOf<"switchClassNames.thumb: declared by the owner's slotProps, not listed in SLOT_PROPS_KEYS">();
    expectTypeOf<
      SlotPropsOwnerErrors<{ switchClassNames: { className?: string } }, Listed, never>
    >().toEqualTypeOf<
      | "switchClassNames.track: listed in SLOT_PROPS_KEYS, not declared by the owner's slotProps"
      | "switchClassNames.thumb: listed in SLOT_PROPS_KEYS, not declared by the owner's slotProps"
    >();
    expectTypeOf<
      SlotPropsOwnerErrors<Record<never, never>, Listed, never>
    >().toEqualTypeOf<'switchClassNames: listed in SLOT_PROPS_KEYS, but no owner in SlotPropsOwners'>();
    expectTypeOf<
      SlotPropsOwnerErrors<{ switchClassNames: SwitchOwner }, Record<never, never>, never>
    >().toEqualTypeOf<
      | 'switchClassNames: an owner, but SLOT_PROPS_KEYS lists no key for it'
      | "switchClassNames.track: declared by the owner's slotProps, not listed in SLOT_PROPS_KEYS"
      | "switchClassNames.thumb: declared by the owner's slotProps, not listed in SLOT_PROPS_KEYS"
    >();
    expectTypeOf<
      SlotPropsOwnerErrors<{ switchClassNames: WithRoot }, Listed, 'switchClassNames'>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      SlotPropsOwnerErrors<{ switchClassNames: WithRoot }, Listed, never>
    >().toEqualTypeOf<'switchClassNames.root: declared, but only the owners of SLOT_PROPS_ROOT_OWNERS declare root'>();
    expectTypeOf<
      SlotPropsOwnerErrors<{ switchClassNames: SwitchOwner }, Listed, 'switchClassNames'>
    >().toEqualTypeOf<'switchClassNames.root: a root owner whose slotProps declares no root'>();
  });
});
