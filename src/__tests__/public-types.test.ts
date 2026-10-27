// @vitest-environment node
/**
 * The public type surface (`button-provider#27`): every named type that a public declaration
 * refers to must be importable from the package entry (`src/index.ts`). A prop type, an `extends`
 * base, a parameter or return type — also one reached through an inferred type, such as a compound
 * component's `Object.assign` result or a hook's inferred return type — that the entry does not
 * export is declared without `export` in the rolled-up `dist/index.d.ts`, so consumers have to
 * spell it as an indexed access (`ToasterProps['position']`).
 *
 * {@link findUnexportedPublicTypes} walks the library program (`tsconfig.json`) with the
 * TypeScript compiler API, starting at the entry's exports. Only the structural helpers of
 * {@link INTERNAL_HELPERS} may stay internal; that list must stay current as well.
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ComponentProps,
  Dispatch,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  KeyboardEventHandler,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler,
  PointerEventHandler,
  ReactElement,
  ReactNode,
  Ref,
  RefCallback,
  RefObject,
  SetStateAction,
} from 'react';
import ts from 'typescript';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  AccordionBaseProps,
  AccordionMultipleProps,
  AccordionSingleProps,
  addDays,
  addMonths,
  AlphaSliderLabels,
  AlphaSliderProps,
  BackdropAppearance,
  BadgeColor,
  BreadcrumbItemAnchorProps,
  BreadcrumbItemButtonProps,
  BreadcrumbItemOwnProps,
  BreadcrumbProps,
  buttonClassNames,
  ButtonProps,
  CalendarLabels,
  CalendarProps,
  CalendarValueChangeDetails,
  CheckboxLabelPosition,
  CheckboxProps,
  CheckboxShape,
  CheckboxSize,
  CheckedValues,
  CheckedValuesChangeDetails,
  CheckedValuesChangeHandler,
  collectOptionLabels,
  ColorAreaLabels,
  ColorAreaProps,
  ColorPickerHexFieldProps,
  ColorPickerLabels,
  ColorPickerPreviewProps,
  ColorPickerProps,
  ColorPickerShape,
  ColorPickerSwatchesProps,
  ColorSliderLabels,
  ColorSliderProps,
  ColorSwatchProps,
  Combobox,
  ComboboxComponent,
  ComboboxLabels,
  ComboboxProps,
  CompoundButtonProps,
  CoreSize,
  CounterBadgeProps,
  CreateTableColumnOptions,
  DataGridBaseProps,
  DataGridBodyProps,
  DataGridColumn,
  DataGridItemsProps,
  DataGridItemsSortProps,
  DataGridRowProps,
  DataGridRowSelectionCellProps,
  DataGridSelectedItemsChangeDetails,
  DataGridSelectionAppearance,
  DataGridSelectionCellProps,
  DataGridSort,
  DataGridSortChangeDetails,
  DatePickerLabels,
  DatePickerProps,
  DayOfWeek,
  DialogModalType,
  DialogOpenChangeDetails,
  DialogOpenChangeReason,
  DialogProps,
  DialogSize,
  DismissReason,
  DrawerBodyProps,
  DrawerFooterProps,
  DrawerHeaderNavigationProps,
  DrawerHeaderProps,
  DrawerHeaderTitleProps,
  DrawerModalType,
  DrawerOpenChangeDetails,
  DrawerOpenChangeReason,
  DrawerPosition,
  DrawerProps,
  DrawerSize,
  DrawerTriggerRenderProps,
  DrawerType,
  Dropdown,
  DropdownComponent,
  DropdownLabels,
  DropdownProps,
  EmptySwatchProps,
  FieldContextValue,
  FieldControlIdClaim,
  FieldProps,
  FirstWeekOfYear,
  FocusMode,
  getWeekNumber,
  GetWeekNumberOptions,
  HamburgerProps,
  HeadingLevel,
  HsvColor,
  IconPosition,
  ImageSwatchProps,
  InfoButtonProps,
  InfoLabelProps,
  InputAppearance,
  InputDefaults,
  InputProps,
  InteractionTag,
  InteractionTagPrimaryProps,
  InteractionTagProps,
  InteractionTagSecondaryProps,
  isSameDay,
  LabelPosition,
  LabelProps,
  LinkProps,
  Listbox,
  ListboxComboboxProps,
  ListboxComponent,
  ListboxContextValue,
  ListboxElementKind,
  ListboxItem,
  ListboxLabels,
  ListboxListProps,
  ListboxOpenChangeReason,
  ListboxOptionElementProps,
  ListboxProps,
  ListboxProvider,
  ListboxProviderProps,
  ListboxSelectDetails,
  ListboxStore,
  ListboxSurface,
  ListboxSurfaceListProps,
  ListboxSurfaceProps,
  ListItemActionEvent,
  ListItemProps,
  ListNavigationMode,
  ListProps,
  markListboxElement,
  Menu,
  MenuButtonProps,
  MenuGroupHeaderProps,
  MenuGroupProps,
  MenuItemCheckbox,
  MenuItemCheckboxProps,
  MenuItemLink,
  MenuItemLinkProps,
  MenuItemProps,
  MenuItemRadioProps,
  MenuItemSelectableProps,
  MenuItemSwitchProps,
  MenuPopoverProps,
  MenuProps,
  MenuSplitGroup,
  MenuSplitGroupProps,
  MenuTriggerProps,
  MessageBarActionsProps,
  MessageBarProps,
  MessageBarTitleProps,
  ModalOpenChangeReason,
  ModalType,
  NavAppItemAnchorProps,
  NavAppItemButtonProps,
  NavAppItemDynamicProps,
  NavAppItemOwnProps,
  NavAppItemProps,
  NavAppItemStaticProps,
  NavDividerProps,
  NavDrawer,
  NavDrawerBodyProps,
  NavDrawerFooterProps,
  NavDrawerHeaderProps,
  NavDrawerProps,
  NavItemAnchorProps,
  NavItemButtonProps,
  NavItemOwnProps,
  NavProps,
  NavSectionHeaderProps,
  NavSubItemAnchorProps,
  NavSubItemButtonProps,
  NavSubItemOwnProps,
  OpenChangeDetails,
  OptionGroupProps,
  Orientation,
  OverflowChangeDetails,
  OverflowDirection,
  OverflowDividerProps,
  OverflowGroupVisibility,
  OverflowItemBaseProps,
  OverflowItemPriorityProps,
  OverflowItemProps,
  OverflowProps,
  PartitionBreadcrumbItemsOptions,
  PartitionBreadcrumbItemsResult,
  PopoverProps,
  PopoverTriggerChildProps,
  PopupRect,
  PopupTarget,
  PopupTargetInput,
  PresencePhase,
  PresenceProps,
  ProgressBarColor,
  ProgressBarProps,
  RadioItemProps,
  Rating,
  RatingColor,
  RatingDisplay,
  RatingDisplayItem,
  RatingDisplayLabels,
  RatingDisplayProps,
  RatingItem,
  RatingProps,
  SearchBoxInputProps,
  SearchBoxProps,
  SelectProps,
  SelectionMode,
  CalendarSelectionRange,
  Size,
  SliderProps,
  SliderSize,
  Slot,
  SortDirection,
  SpinButton,
  SpinButtonAllowEmptyProps,
  SpinButtonBaseProps,
  SpinButtonInputProps,
  SpinButtonProps,
  SpinnerAppearance,
  SpinnerProps,
  SplitButtonMenuButtonProps,
  SplitButtonProps,
  startOfWeek,
  Status,
  SurfaceSize,
  SwatchPickerLabels,
  SwatchPickerProps,
  SwatchPickerRowProps,
  SwatchPickerSize,
  SwitchLabelPosition,
  SwitchProps,
  SwitchSize,
  TableCellActionsProps,
  TableCellLayoutProps,
  TableHeaderCellProps,
  TableSelectionCellCheckedChangeDetails,
  TableSelectionCellProps,
  TabListProps,
  TagAppearance,
  TagGroupProps,
  TagPicker,
  TagPickerButtonProps,
  TagPickerControlProps,
  TagPickerGroupProps,
  TagPickerInputProps,
  TagPickerLabels,
  TagPickerListProps,
  TagPickerOption,
  TagPickerOptionProps,
  TagPickerProps,
  TagPickerSize,
  TagProps,
  TagShape,
  TagSize,
  TeachingPopoverAction,
  TeachingPopoverBodyProps,
  TeachingPopoverCarouselFooterProps,
  TeachingPopoverCarouselNavProps,
  TeachingPopoverCarouselPageCountProps,
  TeachingPopoverCarouselProps,
  TeachingPopoverFooterProps,
  TeachingPopoverHeaderProps,
  TeachingPopoverProps,
  TeachingPopoverStep,
  TeachingPopoverSurfaceProps,
  TeachingPopoverTitleOwnProps,
  TeachingPopoverTitleProps,
  TeachingPopoverTriggerChildProps,
  TeachingPopoverTriggerProps,
  TextareaProps,
  TimePickerInvalidReason,
  TimePickerLabels,
  TimePickerProps,
  ToastBodyProps,
  ToastCloseProps,
  ToastCloseRenderProps,
  ToastController,
  ToastDispatchOptions,
  ToasterHandle,
  ToasterProps,
  ToasterShortcuts,
  ToastFooterProps,
  ToastOptions,
  ToastPosition,
  ToastProps,
  ToastTitleProps,
  toggleButtonClassNames,
  ToggleButtonProps,
  Toolbar,
  ToolbarButton,
  ToolbarButtonOwnProps,
  ToolbarButtonProps,
  ToolbarDividerProps,
  ToolbarGroupProps,
  ToolbarProps,
  ToolbarRadioButtonProps,
  ToolbarRadioGroupProps,
  ToolbarToggleButton,
  ToolbarToggleButtonProps,
  TooltipAppearance,
  TooltipProps,
  TreeCheckedItemsChangeDetails,
  TreeItemPersonaLayoutProps,
  TreeItemProps,
  TreeProps,
  useActiveDescendant,
  UseActiveDescendantOptions,
  UseActiveDescendantResult,
  useListbox,
  useListboxOption,
  UseListboxOptionProps,
  UseListboxOptionResult,
  UseListboxOptions,
  useListboxPopup,
  UseListboxPopupOptions,
  UseListboxPopupResult,
  UseListboxResult,
  UsePresenceOptions,
  UsePresenceResult,
  UseRovingTabIndexOptions,
  ValidationState,
  VirtualElement,
  WaveContextValue,
  WaveDir,
  WaveProviderProps,
  waveProviderClassNames,
} from '../index';

const srcDir = fileURLToPath(new URL('..', import.meta.url));

/** Named types (and classes/enums, which are types as well). */
const NAMED_TYPE =
  ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface | ts.SymbolFlags.Enum | ts.SymbolFlags.Class;

/**
 * The named types declared under `ownDir` that the exports of `entry` refer to (transitively) but
 * that `entry` does not export, as sorted `path/relative/to/ownDir#Name` labels.
 *
 * - Written types are read from the declarations (so an alias in an optional prop is not lost to
 *   the `| undefined` the checker adds); function and method bodies are skipped.
 * - Inferred types (an exported `const` without annotation, a function without a return type) are
 *   read from the checker: an alias or interface is followed to its declaration, a function type
 *   to its declaration, an anonymous object type (an object literal) member by member.
 * - Types declared outside `ownDir` (React, the DOM lib) are not walked; only their type arguments.
 *
 * Limit: the checker interns literal types, so an alias of a single literal (`type A = 'a'`) that
 * is reached only through an inferred type has no name left to report. Written types (the prop
 * interfaces and parameters) have no such limit.
 */
function findUnexportedPublicTypes(program: ts.Program, entry: string, ownDir: string): string[] {
  const checker = program.getTypeChecker();
  const entryFile = program.getSourceFile(entry);
  if (!entryFile) throw new Error(`${entry} is not part of the program`);
  const moduleSymbol = checker.getSymbolAtLocation(entryFile);
  if (!moduleSymbol) throw new Error(`${entry} is not a module`);

  const resolveAlias = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const exported = new Set(checker.getExportsOfModule(moduleSymbol).map(resolveAlias));

  const pathOf = (node: ts.Node): string => relative(ownDir, node.getSourceFile().fileName);
  const isOwn = (node: ts.Node): boolean => {
    const path = pathOf(node);
    return !path.startsWith('..') && !isAbsolute(path) && !path.includes('node_modules');
  };

  const found = new Set<string>();
  const seenSymbols = new Set<ts.Symbol>();
  const seenTypes = new Set<ts.Type>();

  function visitSymbol(raw: ts.Symbol | undefined): void {
    if (!raw) return;
    const symbol = resolveAlias(raw);
    if (seenSymbols.has(symbol)) return;
    seenSymbols.add(symbol);
    const declarations = (symbol.declarations ?? []).filter(isOwn);
    if (declarations.length === 0) return;
    if (symbol.flags & NAMED_TYPE && !exported.has(symbol)) {
      found.add(`${pathOf(declarations[0]).split(sep).join('/')}#${symbol.name}`);
    }
    for (const declaration of declarations) visitNode(declaration);
  }

  function visitSignature(node: ts.SignatureDeclaration): void {
    node.typeParameters?.forEach(visitNode);
    for (const parameter of node.parameters) {
      if (parameter.type) visitNode(parameter.type);
      else visitType(checker.getTypeAtLocation(parameter));
    }
    if (node.type) {
      visitNode(node.type);
    } else {
      const signature = checker.getSignatureFromDeclaration(node);
      if (signature) visitType(checker.getReturnTypeOfSignature(signature));
    }
  }

  function nameOf(node: ts.EntityName | ts.Expression): ts.Node {
    if (ts.isQualifiedName(node)) return node.right;
    if (ts.isPropertyAccessExpression(node)) return node.name;
    return node;
  }

  function visitNode(node: ts.Node): void {
    // The signature only: parameters, type parameters and the (written or inferred) return type.
    if (ts.isFunctionLike(node)) {
      visitSignature(node);
      return;
    }
    // The written type, else the inferred one; never the initializer.
    if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
      if (node.type) visitNode(node.type);
      else visitType(checker.getTypeAtLocation(node.name));
      return;
    }
    if (ts.isTypeReferenceNode(node)) {
      visitSymbol(checker.getSymbolAtLocation(nameOf(node.typeName)));
    } else if (ts.isExpressionWithTypeArguments(node)) {
      visitSymbol(checker.getSymbolAtLocation(nameOf(node.expression)));
    } else if (ts.isTypeQueryNode(node)) {
      visitSymbol(checker.getSymbolAtLocation(nameOf(node.exprName)));
    }
    ts.forEachChild(node, visitNode);
  }

  function visitType(type: ts.Type): void {
    if (seenTypes.has(type)) return;
    seenTypes.add(type);
    if (type.aliasSymbol) {
      visitSymbol(type.aliasSymbol);
      type.aliasTypeArguments?.forEach(visitType);
      return;
    }
    if (type.isUnionOrIntersection()) {
      type.types.forEach(visitType);
      return;
    }
    if (!(type.flags & ts.TypeFlags.Object)) return;
    const symbol = type.getSymbol();
    if ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
      checker.getTypeArguments(type as ts.TypeReference).forEach(visitType);
      visitSymbol(symbol);
      return;
    }
    if (symbol && symbol.flags & NAMED_TYPE) {
      visitSymbol(symbol);
      return;
    }
    const own = (symbol?.declarations ?? []).filter(isOwn);
    if (own.some((node) => ts.isFunctionLike(node) || ts.isTypeLiteralNode(node))) {
      visitSymbol(symbol);
      return;
    }
    // An anonymous object type (an object literal, a library mapped type): its members.
    for (const property of checker.getPropertiesOfType(type)) {
      visitType(checker.getTypeOfSymbol(property));
    }
    for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
      for (const signature of checker.getSignaturesOfType(type, kind)) {
        for (const parameter of signature.getParameters()) {
          visitType(checker.getTypeOfSymbol(parameter));
        }
        visitType(signature.getReturnType());
      }
    }
  }

  for (const symbol of exported) visitSymbol(symbol);
  return [...found].sort();
}

/**
 * Named types that public declarations refer to but that are deliberately not public API: they
 * name no concept of their own, and exporting them would make every rename a breaking change.
 * Each is a key union for an `Omit` (the handlers a composite routes to its focusable control) or
 * a mask whose members are all `undefined`/`never` (it only makes other props a type error).
 */
const INTERNAL_HELPERS: Record<string, string> = {
  'components/input/Checkbox.tsx#CheckboxControlHandlers':
    'handler keys omitted from the root props (routed to the checkbox control)',
  'components/input/routedHandlers.ts#RoutedHandlers':
    'handler keys omitted from the root props of Combobox, Dropdown, TagPicker, DatePicker and TimePicker (routed to their focusable control)',
  'components/input/Switch.tsx#SwitchControlHandlers':
    'handler keys omitted from the root props (routed to the switch control)',
  'components/navigation/Breadcrumb.tsx#NoAnchorOnlyAttributes':
    'mask: link-only attributes are a type error on items without `href`',
  'components/navigation/Nav.context.ts#NoAnchorOnlyAttributes':
    'mask: link-only attributes are a type error on items without `href`',
  'components/table/DataGrid.tsx#NoDeprecatedSortProps':
    'mask: the 0.4 sort props are a type error next to the 0.5 sort API',
};

/**
 * Public type names that a prop refers to before the barrels export them (spec §0.2 rule 24,
 * §1.5), matched against the name after `#` of the walk's labels. Empty since wave D of 0.11.
 */
const PENDING_PUBLIC_TYPES: readonly string[] = [];

/** `components/feedback/Toaster.tsx#ToastDispatchOptions` → `ToastDispatchOptions`. */
const typeNameOf = (label: string): string => label.slice(label.indexOf('#') + 1);

/** A program over virtual files (plus the default lib), for testing the walker itself. */
function createVirtualProgram(files: Record<string, string>, root: string): ts.Program {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    types: [],
  };
  const key = (path: string): string => path.replace(/\\/g, '/').toLowerCase();
  const virtual = new Map(
    Object.entries(files).map(([name, text]) => [key(resolve(root, name)), text] as const),
  );
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile, directoryExists } = host;
  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const text = virtual.get(key(fileName));
    return text === undefined
      ? getSourceFile.call(host, fileName, languageVersion, ...rest)
      : ts.createSourceFile(fileName, text, languageVersion, true);
  };
  host.fileExists = (fileName) => virtual.has(key(fileName)) || fileExists.call(host, fileName);
  host.readFile = (fileName) => virtual.get(key(fileName)) ?? readFile.call(host, fileName);
  // Module resolution looks for the directory before it asks for `./widget.ts`.
  host.directoryExists = (path) =>
    key(path) === key(root) || (directoryExists?.call(host, path) ?? true);
  return ts.createProgram({ rootNames: [resolve(root, 'index.ts')], options, host });
}

describe('findUnexportedPublicTypes (the walker)', () => {
  // 60 s, as for the program tests below, instead of Vitest's 5 s default: type-checking even this
  // small program against TypeScript's default lib takes about 1 s alone, a few seconds in the
  // full suite and more than 5 s under `npm run test:coverage` (V8 instruments the compiler).
  it('finds unexported names in written, heritage, parameter and inferred positions', () => {
    const root = resolve(srcDir, '__virtual_public_types__');
    const program = createVirtualProgram(
      {
        'index.ts': [
          "export { Widget, Compound, useWidget, makeThing } from './widget';",
          "export type { WidgetProps, PublicName } from './widget';",
        ].join('\n'),
        'widget.ts': [
          "type OptionalAlias = 'a' | 'b';",
          'interface HiddenBase { hidden?: boolean }',
          'type ParamAlias = { x: number };',
          'type ReturnAlias = { y: string };',
          "type QueryTarget = 'q' | 'r';",
          "type BodyOnly = 'body';",
          "type Unreached = 'u';",
          "export type PublicName = 'p';",
          'const queried = { value: 1 as unknown as QueryTarget };',
          'export interface WidgetProps extends HiddenBase {',
          '  kind?: OptionalAlias;',
          '  name?: PublicName;',
          '  query?: typeof queried;',
          '}',
          "export function Widget(props: WidgetProps) { const local: BodyOnly = 'body'; return local + String(props.kind); }",
          'function Item(props: ParamAlias) { return props.x; }',
          'export const Compound = Object.assign(Widget, { Item });',
          "function makeReturn(): ReturnAlias { return { y: '' }; }",
          'export function useWidget() { return makeReturn(); }',
          'export const makeThing = () => ({ nested: makeReturn() });',
          'export type Unused = Unreached extends string ? 1 : 0;',
        ].join('\n'),
      },
      root,
    );

    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    expect(diagnostics).toEqual([]);
    expect(findUnexportedPublicTypes(program, resolve(root, 'index.ts'), root)).toEqual([
      'widget.ts#HiddenBase',
      'widget.ts#OptionalAlias',
      'widget.ts#ParamAlias',
      'widget.ts#QueryTarget',
      'widget.ts#ReturnAlias',
    ]);
  }, 60_000);
});

describe('public type surface (src/index.ts)', () => {
  // One program for both tests (building it takes a few seconds, more under coverage: hence their
  // 60 s timeouts).
  let unexported: string[] | undefined;
  const getUnexported = (): string[] => {
    if (!unexported) {
      const config = ts.readConfigFile(resolve(srcDir, '../tsconfig.json'), ts.sys.readFile);
      if (config.error) {
        throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
      }
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(srcDir, '..'));
      const entry = resolve(srcDir, 'index.ts');
      const program = ts.createProgram({
        rootNames: [entry],
        options: { ...parsed.options, noEmit: true },
      });
      unexported = findUnexportedPublicTypes(program, entry, srcDir);
    }
    return unexported;
  };

  it('exports every named type that a public declaration refers to', () => {
    expect(
      getUnexported().filter(
        (label) =>
          !(label in INTERNAL_HELPERS) && !PENDING_PUBLIC_TYPES.includes(typeNameOf(label)),
      ),
    ).toEqual([]);
  }, 60_000);

  it('keeps PENDING_PUBLIC_TYPES sorted and free of duplicates', () => {
    expect(PENDING_PUBLIC_TYPES).toEqual([...new Set(PENDING_PUBLIC_TYPES)].sort());
  });

  it('lists only internal helpers that a public declaration still refers to', () => {
    const current = getUnexported();
    expect(Object.keys(INTERNAL_HELPERS).filter((label) => !current.includes(label))).toEqual([]);
  }, 60_000);

  // The compile-time half (`npm run typecheck`, tsconfig.dev.json): the names import from the
  // entry and are the types of the props that use them.
  it('the exported names are the types of the props that use them', () => {
    expectTypeOf<NonNullable<UseRovingTabIndexOptions['dir']>>().toEqualTypeOf<WaveDir>();
    expectTypeOf<
      NonNullable<FieldContextValue['controlIdClaim']>
    >().toEqualTypeOf<FieldControlIdClaim>();
    expectTypeOf<NonNullable<TooltipProps['appearance']>>().toEqualTypeOf<TooltipAppearance>();
    expectTypeOf<NonNullable<ToasterProps['position']>>().toEqualTypeOf<ToastPosition>();

    expectTypeOf<SearchBoxProps>().toExtend<SearchBoxInputProps>();
    expectTypeOf<SpinButtonProps>().toExtend<SpinButtonInputProps>();
    expectTypeOf<AccordionSingleProps>().toExtend<AccordionBaseProps>();
    expectTypeOf<AccordionMultipleProps>().toExtend<AccordionBaseProps>();
    expectTypeOf<BreadcrumbItemAnchorProps>().toExtend<BreadcrumbItemOwnProps>();
    expectTypeOf<BreadcrumbItemButtonProps>().toExtend<BreadcrumbItemOwnProps>();
    expectTypeOf<NavItemAnchorProps>().toExtend<NavItemOwnProps>();
    expectTypeOf<NavItemButtonProps>().toExtend<NavItemOwnProps>();
    expectTypeOf<NavSubItemAnchorProps>().toExtend<NavSubItemOwnProps>();
    expectTypeOf<NavSubItemButtonProps>().toExtend<NavSubItemOwnProps>();
    expectTypeOf<NavAppItemAnchorProps>().toExtend<NavAppItemOwnProps>();
    expectTypeOf<NavAppItemButtonProps>().toExtend<NavAppItemOwnProps>();
  });
});

// The 0.6 additions, imported from the package entry (compile-time, `tsconfig.dev.json`).
describe('0.6 props and unions from the package entry', () => {
  it('buttons: iconPosition, disabledFocusable, the CompoundButton icon and the SplitButton glyphs', () => {
    expectTypeOf<ButtonProps['iconPosition']>().toEqualTypeOf<IconPosition | undefined>();
    expectTypeOf<ButtonProps<'a'>['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ToggleButtonProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ToggleButtonProps['iconPosition']>().toEqualTypeOf<IconPosition | undefined>();
    expectTypeOf<MenuButtonProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<LinkProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<CompoundButtonProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<CompoundButtonProps['iconPosition']>().toEqualTypeOf<IconPosition | undefined>();
    expectTypeOf<CompoundButtonProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<SplitButtonProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<SplitButtonProps['iconPosition']>().toEqualTypeOf<IconPosition | undefined>();
    expectTypeOf<SplitButtonProps['menuIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<SplitButtonProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<SplitButtonMenuButtonProps['disabledFocusable']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<IconPosition>().toEqualTypeOf<'before' | 'after'>();

    // @ts-expect-error iconPosition is 'before' | 'after'
    const iconPosition: ButtonProps['iconPosition'] = 'end';
    expect(iconPosition).toBe('end');
  });

  it('forms: Field validation and orientation, rich choice labels and labelPosition', () => {
    expectTypeOf<FieldProps['validationState']>().toEqualTypeOf<ValidationState | undefined>();
    expectTypeOf<FieldProps['validationMessage']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<FieldProps['validationMessageIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<FieldProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    expectTypeOf<ValidationState>().toEqualTypeOf<'none' | 'error' | 'warning' | 'success'>();
    expectTypeOf<FieldContextValue['validationState']>().toEqualTypeOf<
      ValidationState | undefined
    >();
    expectTypeOf<FieldContextValue['validationMessageId']>().toEqualTypeOf<string | undefined>();

    expectTypeOf<ReactNode>().toExtend<CheckboxProps['label']>();
    expectTypeOf<ReactNode>().toExtend<SwitchProps['label']>();
    expectTypeOf<ReactNode>().toExtend<RadioItemProps['label']>();
    expectTypeOf<CheckboxLabelPosition>().toEqualTypeOf<'before' | 'after'>();
    expectTypeOf<SwitchLabelPosition>().toEqualTypeOf<'before' | 'after' | 'above'>();
    expectTypeOf<CheckboxLabelPosition>().toExtend<LabelPosition>();
    expectTypeOf<LabelPosition>().toEqualTypeOf<'before' | 'after' | 'above' | 'below'>();
    expectTypeOf<CheckboxProps['labelPosition']>().toEqualTypeOf<
      CheckboxLabelPosition | undefined
    >();
    expectTypeOf<SwitchProps['labelPosition']>().toEqualTypeOf<SwitchLabelPosition | undefined>();
    expectTypeOf<CheckboxProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<SwitchProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();

    expectTypeOf<RatingDisplayProps['labels']>().toEqualTypeOf<RatingDisplayLabels | undefined>();
    expectTypeOf<RatingDisplayProps['count']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<RatingDisplayProps['showValue']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<RatingDisplayProps['compact']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<RatingDisplayProps['locale']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<RatingDisplayLabels['rating']>>().toEqualTypeOf<
      (value: number, max: number, formattedValue: string) => string
    >();
    expectTypeOf<NonNullable<RatingDisplayLabels['count']>>().toEqualTypeOf<
      (count: number, formattedCount: string) => string
    >();

    // @ts-expect-error a Checkbox label is before or after its box
    const checkboxAbove: CheckboxProps['labelPosition'] = 'above';
    // @ts-expect-error a Switch label is never below it
    const switchBelow: SwitchProps['labelPosition'] = 'below';
    expect([checkboxAbove, switchBelow]).toEqual(['above', 'below']);
  });

  it('pickers: clearable, expandIcon, Dropdown labels and TimePicker invalid input', () => {
    expectTypeOf<ComboboxProps['clearable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ComboboxProps['expandIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<ComboboxLabels['clear']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ComboboxLabels['expand']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DropdownProps['clearable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DropdownProps['labels']>().toEqualTypeOf<DropdownLabels | undefined>();
    expectTypeOf<DropdownLabels['clear']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TimePickerProps['expandIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TimePickerInvalidReason>().toEqualTypeOf<'unparseable' | 'out-of-range'>();
    expectTypeOf<NonNullable<TimePickerProps['onInvalidInput']>>().toEqualTypeOf<
      (text: string, reason: TimePickerInvalidReason) => void
    >();
    expectTypeOf<NonNullable<TimePickerLabels['outOfRange']>>().toEqualTypeOf<
      (min: string | undefined, max: string | undefined) => string
    >();
    expectTypeOf<TimePickerLabels['expand']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<TimePickerLabels['invalidTime']>>().toEqualTypeOf<
      (format: string) => string
    >();
  });

  it('display and feedback: CounterBadge, Spinner, ProgressBar and the Toaster', () => {
    expectTypeOf<CounterBadgeProps['count']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<CounterBadgeProps['color']>().toEqualTypeOf<BadgeColor | undefined>();
    expectTypeOf<CounterBadgeProps['dot']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<CounterBadgeProps['showZero']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<'severe' | 'subtle'>().toExtend<BadgeColor>();

    expectTypeOf<SpinnerAppearance>().toEqualTypeOf<'primary' | 'inverted'>();
    expectTypeOf<SpinnerProps['appearance']>().toEqualTypeOf<SpinnerAppearance | undefined>();
    expectTypeOf<SpinnerProps['delay']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ProgressBarColor>().toEqualTypeOf<'brand' | 'success' | 'warning' | 'error'>();
    expectTypeOf<ProgressBarProps['color']>().toEqualTypeOf<ProgressBarColor | undefined>();

    expectTypeOf<ToastController['dismissAllToasts']>().toEqualTypeOf<() => void>();
    expectTypeOf<ToasterProps['limit']>().toEqualTypeOf<number | undefined>();
  });

  it('overlays: modalType, onOpenChange details and the controlled Tooltip', () => {
    expectTypeOf<DialogModalType>().toEqualTypeOf<ModalType>();
    expectTypeOf<ModalType>().toEqualTypeOf<'modal' | 'alert' | 'non-modal'>();
    expectTypeOf<DialogProps['modalType']>().toEqualTypeOf<DialogModalType | undefined>();
    expectTypeOf<DialogOpenChangeReason>().toEqualTypeOf<ModalOpenChangeReason>();
    expectTypeOf<ModalOpenChangeReason>().toEqualTypeOf<
      'trigger' | 'close' | 'close-button' | 'escape' | 'outside-press'
    >();
    expectTypeOf<DialogOpenChangeDetails['reason']>().toEqualTypeOf<ModalOpenChangeReason>();
    expectTypeOf<DialogOpenChangeDetails>().toEqualTypeOf<
      OpenChangeDetails<ModalOpenChangeReason>
    >();
    expectTypeOf<DrawerOpenChangeReason>().toEqualTypeOf<ModalOpenChangeReason>();
    expectTypeOf<DrawerOpenChangeDetails>().toEqualTypeOf<DialogOpenChangeDetails>();

    // A 0.5 handler still fits, and code that calls the prop may pass the value only.
    const handler = (open: boolean) => void open;
    expectTypeOf(handler).toExtend<NonNullable<DialogProps['onOpenChange']>>();
    expectTypeOf(handler).toExtend<NonNullable<DrawerProps['onOpenChange']>>();
    expectTypeOf<NonNullable<DialogProps['onOpenChange']>>().toBeCallableWith(false);
    expectTypeOf<NonNullable<DrawerProps['onOpenChange']>>().toBeCallableWith(false);
    expectTypeOf<NonNullable<DialogProps['onOpenChange']>>()
      .parameter(1)
      .toEqualTypeOf<DialogOpenChangeDetails | undefined>();

    expectTypeOf<TooltipProps['open']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<TooltipProps['defaultOpen']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<NonNullable<TooltipProps['onOpenChange']>>().toEqualTypeOf<
      (open: boolean) => void
    >();

    const nonModal: DialogProps['modalType'] = 'non-modal';
    expect(nonModal).toBe('non-modal');
  });

  it('navigation: Nav currentCategory and TabList selectTabOnFocus', () => {
    expectTypeOf<NavProps['currentCategory']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TabListProps['selectTabOnFocus']>().toEqualTypeOf<boolean | undefined>();
  });
});

// The 0.7 presence core, imported from the package entry (compile-time, `tsconfig.dev.json`).
describe('0.7 presence core from the package entry', () => {
  it('PresencePhase, the Presence visible prop and the unmountOnExit option', () => {
    expectTypeOf<PresencePhase>().toEqualTypeOf<'entering' | 'entered' | 'exiting' | 'exited'>();
    expectTypeOf<PresenceProps['visible']>().toEqualTypeOf<boolean>();
    expectTypeOf<UsePresenceOptions['unmountOnExit']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<UsePresenceResult['phase']>().toEqualTypeOf<PresencePhase>();

    // @ts-expect-error `visible` is required
    const props: PresenceProps = { children: null as unknown as PresenceProps['children'] };
    expect(props).toBeDefined();
  });
});

// The 0.7 menus and commands, imported from the package entry (compile-time, `tsconfig.dev.json`).
describe('0.7 menus, popovers and toolbars from the package entry', () => {
  it('checked values: the Menu props, the details and a handler that takes the values only', () => {
    expectTypeOf<MenuProps['checkedValues']>().toEqualTypeOf<CheckedValues | undefined>();
    expectTypeOf<MenuProps['defaultCheckedValues']>().toEqualTypeOf<CheckedValues | undefined>();
    expectTypeOf<MenuProps['onCheckedValuesChange']>().toEqualTypeOf<
      CheckedValuesChangeHandler | undefined
    >();
    expectTypeOf<CheckedValues>().toEqualTypeOf<Readonly<Record<string, readonly string[]>>>();
    expectTypeOf<CheckedValuesChangeDetails>().toEqualTypeOf<{
      name: string;
      checkedItems: string[];
      event: Event;
    }>();

    // `details` is optional until 1.0: a handler of the values alone fits, a state setter too,
    // and code that calls the prop may pass the values only.
    type Handler = NonNullable<MenuProps['onCheckedValuesChange']>;
    const valuesOnly = (values: Record<string, string[]>) => void values;
    expectTypeOf(valuesOnly).toExtend<Handler>();
    expectTypeOf<Dispatch<SetStateAction<CheckedValues>>>().toExtend<Handler>();
    expectTypeOf<Dispatch<SetStateAction<Record<string, string[]>>>>().toExtend<Handler>();
    expectTypeOf<Handler>().toBeCallableWith({ view: ['grid'] });
    expectTypeOf<Handler>().parameter(1).toEqualTypeOf<CheckedValuesChangeDetails | undefined>();
    expectTypeOf<NonNullable<ToolbarProps['onCheckedValuesChange']>>().toEqualTypeOf<Handler>();
    // A readonly literal is a valid controlled value.
    expectTypeOf<{ readonly view: readonly ['grid'] }>().toExtend<CheckedValues>();
  });

  it('Menu: the popup props, the item kinds, the trigger props and the target', () => {
    expectTypeOf<
      Pick<
        MenuProps,
        'openOnHover' | 'openDelay' | 'closeDelay' | 'openOnContext' | 'persistOnItemClick'
      >
    >().toEqualTypeOf<{
      openOnHover?: boolean;
      openDelay?: number;
      closeDelay?: number;
      openOnContext?: boolean;
      persistOnItemClick?: boolean;
    }>();
    expectTypeOf<MenuPopoverProps['target']>().toEqualTypeOf<PopupTargetInput | undefined>();
    expectTypeOf<PopupTarget>().toEqualTypeOf<HTMLElement | VirtualElement | null>();
    expectTypeOf<DOMRect>().toExtend<PopupRect>();
    expectTypeOf<ReturnType<VirtualElement['getBoundingClientRect']>>().toEqualTypeOf<PopupRect>();

    // A label-less item (the submenu half of a split row) compiles.
    expectTypeOf<Pick<MenuItemProps, 'children'>>().toEqualTypeOf<{ children?: ReactNode }>();
    expectTypeOf<Pick<MenuItemCheckboxProps, 'name' | 'value'>>().toEqualTypeOf<{
      name: string;
      value: string;
    }>();
    expectTypeOf<MenuItemCheckboxProps>().toExtend<MenuItemProps>();
    expectTypeOf<MenuItemRadioProps>().toExtend<MenuItemSelectableProps>();
    expectTypeOf<MenuItemSwitchProps>().toExtend<MenuItemSelectableProps>();
    expectTypeOf<MenuItemCheckboxProps['checkmark']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<MenuItemLinkProps<'a'>['href']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MenuItemLinkProps['disabled']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<MenuGroupProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<MenuGroupHeaderProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<MenuSplitGroupProps['children']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<typeof Menu.ItemCheckbox>().toEqualTypeOf<typeof MenuItemCheckbox>();
    expectTypeOf<typeof Menu.ItemLink>().toEqualTypeOf<typeof MenuItemLink>();
    expectTypeOf<typeof Menu.SplitGroup>().toEqualTypeOf<typeof MenuSplitGroup>();

    // The trigger props keep every 0.6 member and type; the handler members are optional.
    expectTypeOf<MenuTriggerProps['aria-expanded']>().toEqualTypeOf<boolean>();
    expectTypeOf<MenuTriggerProps['aria-haspopup']>().toEqualTypeOf<'menu'>();
    expectTypeOf<MenuTriggerProps['onClick']>().toEqualTypeOf<MouseEventHandler<HTMLElement>>();
    expectTypeOf<MenuTriggerProps['onContextMenu']>().toEqualTypeOf<
      MouseEventHandler<HTMLElement> | undefined
    >();
    expectTypeOf<MenuTriggerProps['onPointerEnter']>().toEqualTypeOf<
      PointerEventHandler<HTMLElement> | undefined
    >();

    // @ts-expect-error a radio item needs its group's `name`
    const radio: MenuItemRadioProps = { value: 'date', children: 'Date' };
    // @ts-expect-error a VirtualElement reads its rectangle through getBoundingClientRect
    const anchor: VirtualElement = {};
    expect([radio, anchor]).toHaveLength(2);
  });

  it('Popover, TeachingPopover and Tooltip: hover, context, target and the delay vocabulary', () => {
    expectTypeOf<
      Pick<PopoverProps, 'openOnHover' | 'openDelay' | 'closeDelay' | 'openOnContext'>
    >().toEqualTypeOf<{
      openOnHover?: boolean;
      openDelay?: number;
      closeDelay?: number;
      openOnContext?: boolean;
    }>();
    expectTypeOf<PopoverProps['target']>().toEqualTypeOf<PopupTargetInput | undefined>();
    // TeachingPopover's target also takes a VirtualElement since 0.12; the 0.6 forms still fit.
    expectTypeOf<TeachingPopoverProps['target']>().toEqualTypeOf<
      RefObject<HTMLElement | null> | HTMLElement | VirtualElement | null | undefined
    >();
    // Unchanged: its optional handler members are filled in hover and context modes.
    expectTypeOf<PopoverTriggerChildProps>().toEqualTypeOf<
      Omit<HTMLAttributes<HTMLElement>, 'children'> & {
        id: string;
        'aria-haspopup': 'dialog';
        'aria-expanded': boolean;
        'aria-controls': string | undefined;
        onClick: MouseEventHandler<HTMLElement>;
        onKeyDown: KeyboardEventHandler<HTMLElement>;
        ref: RefCallback<HTMLElement>;
      }
    >();

    expectTypeOf<Pick<TooltipProps, 'openDelay' | 'closeDelay' | 'delay'>>().toEqualTypeOf<{
      openDelay?: number;
      closeDelay?: number;
      delay?: number;
    }>();
  });

  it('Toolbar and ToggleButton: size, the bound parts and isAccessible', () => {
    expectTypeOf<ToolbarProps['size']>().toEqualTypeOf<Size | undefined>();
    expectTypeOf<ToolbarProps['checkedValues']>().toEqualTypeOf<CheckedValues | undefined>();
    expectTypeOf<Pick<ToolbarToggleButtonProps, 'name' | 'value'>>().toEqualTypeOf<{
      name: string;
      value: string;
    }>();
    expectTypeOf<Pick<ToolbarRadioButtonProps, 'name' | 'value'>>().toEqualTypeOf<{
      name: string;
      value: string;
    }>();
    expectTypeOf<ToolbarButtonProps<'a'>['href']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ToolbarButtonOwnProps['vertical']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ToolbarRadioGroupProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<ToolbarGroupProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<ToolbarDividerProps>().not.toHaveProperty('children');
    expectTypeOf<typeof Toolbar.Button>().toEqualTypeOf<typeof ToolbarButton>();
    expectTypeOf<typeof Toolbar.ToggleButton>().toEqualTypeOf<typeof ToolbarToggleButton>();
    expectTypeOf<ToggleButtonProps['isAccessible']>().toEqualTypeOf<boolean | undefined>();

    // @ts-expect-error Toolbar sizes are the five Wave sizes
    const huge: ToolbarProps = { size: 'huge' };
    // @ts-expect-error a toolbar radio is always role="radio"
    const checkbox: ToolbarRadioButtonProps = { name: 'align', value: 'start', role: 'checkbox' };
    // @ts-expect-error the pressed state of a toolbar toggle is the Toolbar's checkedValues
    const pressed: ToolbarToggleButtonProps = { name: 'format', value: 'bold', pressed: true };
    expect([huge, checkbox, pressed]).toHaveLength(3);
  });
});

// The 0.10 listbox primitives, useActiveDescendant and the date types, imported from the package
// entry (compile-time, `tsconfig.dev.json`).
describe('0.10 listbox primitives, useActiveDescendant and the date types from the package entry', () => {
  it('useActiveDescendant: its options and result', () => {
    expectTypeOf<UseActiveDescendantResult['activeDescendantId']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<typeof useActiveDescendant>()
      .parameter(0)
      .toEqualTypeOf<UseActiveDescendantOptions>();
    expectTypeOf<typeof useActiveDescendant>().returns.toEqualTypeOf<UseActiveDescendantResult>();
  });

  it('useListbox: its modes, callbacks, element props, context and store', () => {
    expectTypeOf<UseListboxOptions['mode']>().toEqualTypeOf<
      'editable' | 'select-only' | 'standalone'
    >();
    expectTypeOf<ListboxListProps['tabIndex']>().toEqualTypeOf<0 | -1>();
    expectTypeOf<typeof useListbox>().parameter(0).toEqualTypeOf<UseListboxOptions>();
    expectTypeOf<typeof useListbox>().returns.toEqualTypeOf<UseListboxResult>();
    expectTypeOf<ListboxOpenChangeReason>().toEqualTypeOf<
      'keyboard' | 'select' | 'escape' | 'tab'
    >();
    expectTypeOf<NonNullable<UseListboxOptions['onOpenChange']>>()
      .parameter(1)
      .toEqualTypeOf<OpenChangeDetails<ListboxOpenChangeReason> | undefined>();
    expectTypeOf<UseListboxOptions['onSelect']>()
      .parameter(1)
      .toEqualTypeOf<ListboxSelectDetails | undefined>();
    expectTypeOf<ListboxSelectDetails['item']>().toEqualTypeOf<ListboxItem>();
    expectTypeOf<
      ReturnType<UseListboxResult['getComboboxProps']>
    >().toEqualTypeOf<ListboxComboboxProps>();
    expectTypeOf<
      ReturnType<UseListboxResult['getListboxProps']>
    >().toEqualTypeOf<ListboxListProps>();
    expectTypeOf<UseListboxResult['context']>().toEqualTypeOf<ListboxContextValue>();
    expectTypeOf<ListboxContextValue['mode']>().toEqualTypeOf<UseListboxOptions['mode']>();
    // The store's members that option components of your own build on.
    expectTypeOf<ListboxContextValue['store']>().toEqualTypeOf<ListboxStore>();
    expectTypeOf<ListboxStore['getIndex']>().toEqualTypeOf<(value: string) => number>();
    expectTypeOf<ListboxStore['register']>().toEqualTypeOf<
      (item: ListboxItem, element: RefObject<HTMLElement | null>) => () => void
    >();
  });

  it('useListboxOption, markListboxElement and collectOptionLabels', () => {
    expectTypeOf<typeof useListboxOption>().parameter(0).toEqualTypeOf<UseListboxOptionProps>();
    expectTypeOf<typeof useListboxOption>().returns.toEqualTypeOf<UseListboxOptionResult>();
    expectTypeOf<
      UseListboxOptionResult['optionProps']
    >().toEqualTypeOf<ListboxOptionElementProps>();
    expectTypeOf<ListboxOptionElementProps<HTMLLIElement>['ref']>().toEqualTypeOf<
      RefCallback<HTMLLIElement>
    >();
    expectTypeOf<ListboxElementKind>().toEqualTypeOf<'option' | 'group'>();
    expectTypeOf<typeof markListboxElement>().parameter(1).toEqualTypeOf<ListboxElementKind>();
    expectTypeOf<typeof collectOptionLabels>().parameter(0).toEqualTypeOf<ReactNode>();
    expectTypeOf<typeof collectOptionLabels>().returns.toEqualTypeOf<Map<string, string>>();
  });

  it('ListboxProvider, ListboxSurface, useListboxPopup and DismissReason', () => {
    expectTypeOf<typeof ListboxProvider>().parameter(0).toEqualTypeOf<ListboxProviderProps>();
    expectTypeOf<ListboxProviderProps['value']>().toEqualTypeOf<ListboxContextValue>();
    expectTypeOf<typeof ListboxSurface>().parameter(0).toEqualTypeOf<ListboxSurfaceProps>();
    expectTypeOf<ListboxSurfaceProps['listbox']>().toEqualTypeOf<UseListboxResult>();
    expectTypeOf<ListboxSurfaceProps['listProps']>().toEqualTypeOf<
      ListboxSurfaceListProps | undefined
    >();
    expectTypeOf<ListboxSurfaceProps['floatingProps']>().toEqualTypeOf<
      UseListboxPopupResult['floatingProps']
    >();
    expectTypeOf<typeof useListboxPopup>().parameter(0).toEqualTypeOf<UseListboxPopupOptions>();
    expectTypeOf<typeof useListboxPopup>().returns.toEqualTypeOf<UseListboxPopupResult>();
    expectTypeOf<DismissReason>().toEqualTypeOf<'escape' | 'outside-press' | 'focus-outside'>();
    expectTypeOf<UseListboxPopupOptions['onDismiss']>().toEqualTypeOf<
      (reason: DismissReason) => void
    >();
  });

  it('DayOfWeek and FirstWeekOfYear', () => {
    expectTypeOf<DayOfWeek>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5 | 6>();
    expectTypeOf<FirstWeekOfYear>().toEqualTypeOf<
      'first-day' | 'first-full-week' | 'first-four-day-week'
    >();
  });

  it('Dropdown, Combobox and Listbox: the single-select shape is the default, multiselect a literal', () => {
    expectTypeOf<ComponentProps<typeof Dropdown>>().toEqualTypeOf<DropdownProps>();
    expectTypeOf<ComponentProps<typeof Combobox>>().toEqualTypeOf<ComboboxProps>();
    expectTypeOf<ComponentProps<typeof Listbox>>().toEqualTypeOf<ListboxProps>();
    expectTypeOf<typeof Dropdown>().toExtend<DropdownComponent>();
    expectTypeOf<typeof Combobox>().toExtend<ComboboxComponent>();
    expectTypeOf<typeof Listbox>().toExtend<ListboxComponent>();
    expectTypeOf<DropdownProps['value']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DropdownProps<true>['value']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<ListboxProps['value']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ListboxProps<true>['value']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<ComboboxProps['freeform']>().toEqualTypeOf<boolean | undefined>();
    // A `never`-typed member (not an absent key), so ComboboxProps stays an extendable interface.
    expectTypeOf<ComboboxProps<true>['freeform']>().toEqualTypeOf<undefined>();
    // freeform is not available with multiselect.
    expectTypeOf<{ freeform: true }>().not.toExtend<ComboboxProps<true>>();
    // A boolean variable matches neither call signature.
    expectTypeOf<{ multiselect: boolean }>().not.toExtend<DropdownProps>();
    expectTypeOf<{ multiselect: boolean }>().not.toExtend<ComboboxProps>();
    expectTypeOf<{ multiselect: boolean }>().not.toExtend<ListboxProps>();
    expectTypeOf<{ multiselect: boolean }>().not.toExtend<
      DropdownProps<true> & { multiselect: true }
    >();
    expectTypeOf<{ multiselect: boolean }>().not.toExtend<
      ComboboxProps<true> & { multiselect: true }
    >();
    expectTypeOf<{ multiselect: boolean }>().not.toExtend<
      ListboxProps<true> & { multiselect: true }
    >();
    // A generic interface can extend ComboboxProps, as DropdownProps does.
    interface WrappedComboboxProps<M extends boolean = false> extends ComboboxProps<M> {
      wrapperLabel?: string;
    }
    expectTypeOf<WrappedComboboxProps['freeform']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<WrappedComboboxProps<true>['freeform']>().toEqualTypeOf<undefined>();
    expectTypeOf<ListboxLabels['added']>().toEqualTypeOf<
      ((label: string, count: number) => string) | undefined
    >();
  });

  it('SwatchPicker: the extra-small size, optional items and the swatch props', () => {
    expectTypeOf<'extra-small'>().toExtend<SwatchPickerSize>();
    expectTypeOf<SwatchPickerSize>().toEqualTypeOf<'extra-small' | 'small' | 'medium' | 'large'>();
    expectTypeOf<Partial<Pick<SwatchPickerProps, 'items'>>>().toEqualTypeOf<
      Pick<SwatchPickerProps, 'items'>
    >();
    expectTypeOf<SwatchPickerProps['layout']>().toEqualTypeOf<'row' | 'grid' | undefined>();
    expectTypeOf<SwatchPickerProps['focusMode']>().toEqualTypeOf<'arrow' | 'tab' | undefined>();
    expectTypeOf<SwatchPickerProps['labels']>().toEqualTypeOf<SwatchPickerLabels | undefined>();
    expectTypeOf<SwatchPickerLabels['required']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<SwatchPickerRowProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<ColorSwatchProps['color']>().toEqualTypeOf<string>();
    expectTypeOf<ImageSwatchProps['src']>().toEqualTypeOf<string>();
    expectTypeOf<EmptySwatchProps['size']>().toEqualTypeOf<SwatchPickerSize | undefined>();
  });

  it('OptionGroup: the label is an optional ReactNode', () => {
    expectTypeOf<OptionGroupProps['label']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<Partial<Pick<OptionGroupProps, 'label'>>>().toEqualTypeOf<
      Pick<OptionGroupProps, 'label'>
    >();
  });

  it('Calendar: the value callback, the labels DatePicker extends and the selection range', () => {
    expectTypeOf<NonNullable<CalendarProps['onValueChange']>>().parameters.toEqualTypeOf<
      [date: Date | null, details?: CalendarValueChangeDetails]
    >();
    expectTypeOf<DatePickerLabels>().toExtend<CalendarLabels>();
    expectTypeOf<CalendarProps['firstDayOfWeek']>().toEqualTypeOf<DayOfWeek | undefined>();
    expectTypeOf<
      NonNullable<CalendarProps['selectionRange']>
    >().toEqualTypeOf<CalendarSelectionRange>();
    expectTypeOf<CalendarSelectionRange>().toEqualTypeOf<'day' | 'week' | 'work-week' | 'month'>();
  });

  it('the date helpers: their signatures', () => {
    expectTypeOf<typeof addDays>().toEqualTypeOf<(date: Date, amount: number) => Date>();
    expectTypeOf<typeof addMonths>().toEqualTypeOf<(date: Date, amount: number) => Date>();
    expectTypeOf<typeof isSameDay>().toEqualTypeOf<
      (a: Date | null | undefined, b: Date | null | undefined) => boolean
    >();
    expectTypeOf<typeof startOfWeek>().toEqualTypeOf<
      (date: Date, firstDayOfWeek?: DayOfWeek) => Date
    >();
    expectTypeOf<typeof getWeekNumber>().toEqualTypeOf<
      (date: Date, options?: GetWeekNumberOptions) => number
    >();
    expectTypeOf<GetWeekNumberOptions['firstDayOfWeek']>().toEqualTypeOf<DayOfWeek | undefined>();
    expectTypeOf<GetWeekNumberOptions['firstWeekOfYear']>().toEqualTypeOf<
      FirstWeekOfYear | undefined
    >();
  });
});

// The 0.9 input defaults, imported from the package entry (compile-time, tsconfig.dev.json).
describe('0.9 input defaults from the package entry (Phase 4 D7)', () => {
  it('InputDefaults, and the WaveProviderProps/WaveContextValue members that use it', () => {
    expectTypeOf<InputDefaults>().toEqualTypeOf<{
      size?: CoreSize;
      appearance?: InputAppearance;
    }>();
    expectTypeOf<WaveProviderProps['inputDefaults']>().toEqualTypeOf<InputDefaults | undefined>();
    expectTypeOf<WaveContextValue['inputDefaults']>().toEqualTypeOf<InputDefaults>();
  });
});

// Phase 4: sizes, appearances, SpinButton's value union, Rating and the label components,
// imported from the package entry (compile-time, tsconfig.dev.json).
describe('Phase 4 public types', () => {
  it('sizes and appearances', () => {
    expectTypeOf<InputProps['size']>().toEqualTypeOf<CoreSize | number | undefined>();
    expectTypeOf<InputProps['htmlSize']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SelectProps['size']>().toEqualTypeOf<CoreSize | number | undefined>();
    expectTypeOf<TextareaProps['size']>().toEqualTypeOf<CoreSize | undefined>();
    for (const appearance of [
      {} as InputProps['appearance'],
      {} as TextareaProps['appearance'],
      {} as SelectProps['appearance'],
      {} as SearchBoxProps['appearance'],
      {} as ComboboxProps['appearance'],
      {} as DropdownProps['appearance'],
      {} as DatePickerProps['appearance'],
      {} as TimePickerProps['appearance'],
      {} as TagPickerProps['appearance'],
      {} as SpinButtonBaseProps['appearance'],
    ]) {
      expectTypeOf(appearance).toEqualTypeOf<InputAppearance | undefined>();
    }
    expectTypeOf<TagPickerProps['size']>().toEqualTypeOf<TagPickerSize | undefined>();
    expectTypeOf<CheckboxProps['size']>().toEqualTypeOf<CheckboxSize | undefined>();
    expectTypeOf<CheckboxProps['shape']>().toEqualTypeOf<CheckboxShape | undefined>();
    expectTypeOf<SwitchProps['size']>().toEqualTypeOf<SwitchSize | undefined>();
    expectTypeOf<SliderProps['size']>().toEqualTypeOf<SliderSize | number | undefined>();
    expectTypeOf<FieldProps['size']>().toEqualTypeOf<CoreSize | undefined>();
    expectTypeOf<FieldContextValue['size']>().toEqualTypeOf<CoreSize | undefined>();
  });

  it('SpinButton, Rating, labels', () => {
    expectTypeOf<SpinButtonProps['value']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<SpinButtonAllowEmptyProps['value']>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<ComponentProps<typeof SpinButton>>().toEqualTypeOf<
      SpinButtonProps | SpinButtonAllowEmptyProps
    >();
    expectTypeOf<RatingProps['step']>().toEqualTypeOf<0.5 | 1 | undefined>();
    expectTypeOf<RatingProps['color']>().toEqualTypeOf<RatingColor | undefined>();
    expectTypeOf<typeof Rating.Item>().toEqualTypeOf<typeof RatingItem>();
    expectTypeOf<typeof RatingDisplay.Item>().toEqualTypeOf<typeof RatingItem>();
    expectTypeOf<typeof RatingDisplayItem>().toEqualTypeOf<typeof RatingItem>();
    expectTypeOf<InfoLabelProps['info']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<InfoLabelProps['openOnHover']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<InfoButtonProps['openOnHover']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<LabelProps['required']>().toEqualTypeOf<boolean | ReactNode | undefined>();
    expectTypeOf<InfoLabelProps['label']>().toEqualTypeOf<ReactNode>();
    // Optional (the deprecated alias of `children`): a label-less pick accepts `{}`.
    expectTypeOf<{}>().toExtend<Pick<InfoLabelProps, 'label'>>(); // eslint-disable-line @typescript-eslint/no-empty-object-type -- the empty object is the point
    expectTypeOf<InfoLabelProps['htmlFor']>().toEqualTypeOf<LabelProps['htmlFor']>();
    expectTypeOf<InfoLabelProps['required']>().toEqualTypeOf<LabelProps['required']>();
    expectTypeOf<InfoLabelProps['size']>().toEqualTypeOf<LabelProps['size']>();
    expectTypeOf<InfoLabelProps['weight']>().toEqualTypeOf<LabelProps['weight']>();
    expectTypeOf<InfoLabelProps['disabled']>().toEqualTypeOf<LabelProps['disabled']>();
    // `never` on an optional member reads as `undefined`: the deprecated alias is unavailable
    // with `allowEmpty`, and still readable on the component's union of props.
    expectTypeOf<SpinButtonAllowEmptyProps['onChange']>().toEqualTypeOf<undefined>();
    expectTypeOf<ComponentProps<typeof SpinButton>['onChange']>().toEqualTypeOf<
      ((value: number) => void) | undefined
    >();
  });

  it('rejects invalid values', () => {
    // @ts-expect-error not a size
    const inputSize: InputProps['size'] = 'huge';
    // @ts-expect-error TagPicker has no small size
    const tagPicker: TagPickerProps['size'] = 'small';
    // @ts-expect-error Checkbox has no small size
    const checkbox: CheckboxProps['size'] = 'small';
    // @ts-expect-error Switch has no large size
    const switchSize: SwitchProps['size'] = 'large';
    // @ts-expect-error quarter stars
    const step: RatingProps['step'] = 0.25;
    // @ts-expect-error info is required
    const infoButton: InfoButtonProps = {};
    // @ts-expect-error not one of neutral, brand and marigold
    const ratingColor: RatingProps['color'] = 'red';
    // @ts-expect-error a null value needs `allowEmpty`
    const nullValue: ComponentProps<typeof SpinButton> = { value: null };
    void [inputSize, tagPicker, checkbox, switchSize, step, infoButton, ratingColor, nullValue];
  });

  it('class-name constants of the Phase 4 parts (P3-00)', () => {
    expectTypeOf<Entry['infoButtonClassNames']['root']>().toEqualTypeOf<'wave-info-button'>();
    expectTypeOf<Entry['infoButtonClassNames']['beak']>().toEqualTypeOf<'wave-info-button__beak'>();
    expectTypeOf<Entry['infoButtonClassNames']['info']>().toEqualTypeOf<'wave-info-button__info'>();
    expectTypeOf<Entry['infoButtonClassNames']>().not.toHaveProperty('surface');
    expectTypeOf<Entry['infoLabelClassNames']['label']>().toEqualTypeOf<'wave-info-label__label'>();
    expectTypeOf<Entry['ratingItemClassNames']['root']>().toEqualTypeOf<'wave-rating-item'>();
    expectTypeOf<Entry['ratingItemClassNames']['icon']>().toEqualTypeOf<'wave-rating-item__icon'>();
    const classes = {} as Entry['ratingItemClassNames'];
    // @ts-expect-error the registry constants are readonly
    classes.icon = 'wave-custom';
    expect(classes.icon).toBe('wave-custom');
  });
});

describe('0.8 stable class names from the package entry', () => {
  it('the registry constants are readonly objects of string literal types', () => {
    expectTypeOf<(typeof buttonClassNames)['root']>().toEqualTypeOf<'wave-button'>();
    expectTypeOf<(typeof buttonClassNames)['icon']>().toEqualTypeOf<'wave-button__icon'>();
    expectTypeOf<typeof toggleButtonClassNames>().toHaveProperty('icon');
    expectTypeOf<(typeof waveProviderClassNames)['root']>().toEqualTypeOf<'wave-root'>();
    const assignRoot = (constants: typeof buttonClassNames) => {
      // @ts-expect-error: the constants are `as const`, so their keys are readonly.
      constants.root = 'wave-button';
    };
    expectTypeOf(assignRoot).toBeFunction();
  });
});

// The 0.8 notifications, color, trees and class names, imported from the package entry
// (compile-time, `tsconfig.dev.json`). Values are read as types from the entry's namespace, so
// the file imports no runtime value.
type Entry = typeof import('../index');

describe('0.8 notifications, color, trees and class names from the package entry', () => {
  it('toasts: the dispatchToast overloads, the content options, the parts and the handle', () => {
    type DispatchToast = ToastController['dispatchToast'];
    expectTypeOf<DispatchToast>()
      .toBeCallableWith({ title: 'Saved' })
      .returns.toEqualTypeOf<string>();
    expectTypeOf<DispatchToast>()
      .toBeCallableWith({} as ReactElement, { timeout: 0, status: 'error' })
      .returns.toEqualTypeOf<string>();
    expectTypeOf<DispatchToast>().toBeCallableWith('Saved').returns.toEqualTypeOf<string>();
    // Types derived from the member keep 0.7's shape: TypeScript reads the last overload.
    expectTypeOf<Parameters<DispatchToast>>().toEqualTypeOf<[options: ToastOptions]>();
    expectTypeOf<ReturnType<DispatchToast>>().toEqualTypeOf<string>();
    expectTypeOf<ToastDispatchOptions>().toEqualTypeOf<{
      toastId?: string;
      timeout?: number;
      status?: Status;
      statusLabel?: string;
      announcement?: string;
    }>();

    expectTypeOf<ToastProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<ToastProps['title']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ToastTitleProps['action']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<ToastTitleProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<ToastBodyProps['subtitle']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<ToastFooterProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<ToastCloseProps['asChild']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ToastCloseProps['children']>().toEqualTypeOf<
      ReactNode | ((props: ToastCloseRenderProps) => ReactNode)
    >();
    expectTypeOf<ToastCloseRenderProps['onClick']>().toEqualTypeOf<
      MouseEventHandler<HTMLElement>
    >();
    expectTypeOf<ToastCloseRenderProps['ref']>().toEqualTypeOf<RefCallback<HTMLElement>>();
    expectTypeOf<ToastCloseRenderProps>().toExtend<HTMLAttributes<HTMLElement>>();
    expectTypeOf<Entry['Toast']['Title']>().toEqualTypeOf<Entry['ToastTitle']>();
    expectTypeOf<Entry['Toast']['Body']>().toEqualTypeOf<Entry['ToastBody']>();
    expectTypeOf<Entry['Toast']['Footer']>().toEqualTypeOf<Entry['ToastFooter']>();
    expectTypeOf<Entry['Toast']['Close']>().toEqualTypeOf<Entry['ToastClose']>();

    expectTypeOf<ToasterProps['shortcuts']>().toEqualTypeOf<ToasterShortcuts | undefined>();
    expectTypeOf<ToasterShortcuts>().toEqualTypeOf<{
      focus?: (event: KeyboardEvent) => boolean;
    }>();
    expectTypeOf<ToasterProps['toaster']>().toEqualTypeOf<ToasterHandle | undefined>();
    // The handle is the controller and nothing more (spec D33).
    expectTypeOf<ToasterHandle>().toEqualTypeOf<ToastController>();
    expectTypeOf<Entry['createToaster']>().toEqualTypeOf<() => ToasterHandle>();
  });

  it('MessageBar: layout and the parts', () => {
    expectTypeOf<MessageBarProps['layout']>().toEqualTypeOf<
      'auto' | 'singleline' | 'multiline' | undefined
    >();
    expectTypeOf<MessageBarTitleProps>().toExtend<HTMLAttributes<HTMLSpanElement>>();
    expectTypeOf<MessageBarActionsProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<Entry['MessageBar']['Title']>().toEqualTypeOf<Entry['MessageBarTitle']>();
    expectTypeOf<Entry['MessageBar']['Actions']>().toEqualTypeOf<Entry['MessageBarActions']>();
  });

  it('color: HsvColor, ColorPickerShape, the helpers, the standalone parts and the picker', () => {
    expectTypeOf<HsvColor>().toEqualTypeOf<{ h: number; s: number; v: number; a?: number }>();
    expectTypeOf<ColorPickerShape>().toEqualTypeOf<'rounded' | 'square'>();
    expectTypeOf<Entry['hsvToHex']>().toEqualTypeOf<(color: HsvColor) => string>();
    expectTypeOf<Entry['hexToHsv']>().toEqualTypeOf<(hex: string) => HsvColor | null>();

    expectTypeOf<ColorAreaProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorAreaProps['defaultValue']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorAreaProps['onValueChange']>().toEqualTypeOf<
      ((value: HsvColor) => void) | undefined
    >();
    expectTypeOf<ColorAreaProps['shape']>().toEqualTypeOf<ColorPickerShape | undefined>();
    expectTypeOf<ColorAreaProps['labels']>().toEqualTypeOf<ColorAreaLabels | undefined>();
    expectTypeOf<ColorAreaProps['controlRef']>().toEqualTypeOf<Ref<HTMLInputElement> | undefined>();
    expectTypeOf<ColorAreaLabels['colorName']>().toEqualTypeOf<
      ((color: HsvColor) => string) | undefined
    >();
    expectTypeOf<ColorAreaLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, channel: 'saturation' | 'value') => string) | undefined
    >();

    expectTypeOf<ColorSliderProps['channel']>().toEqualTypeOf<
      'hue' | 'saturation' | 'value' | undefined
    >();
    expectTypeOf<ColorSliderProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    expectTypeOf<ColorSliderProps['value']>().toEqualTypeOf<HsvColor | undefined>();
    expectTypeOf<ColorSliderLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, channel: 'hue' | 'saturation' | 'value') => string) | undefined
    >();

    expectTypeOf<AlphaSliderProps['transparency']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<AlphaSliderProps['labels']>().toEqualTypeOf<AlphaSliderLabels | undefined>();
    expectTypeOf<AlphaSliderProps>().not.toHaveProperty('channel');
    expectTypeOf<AlphaSliderLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, transparency: boolean) => string) | undefined
    >();

    expectTypeOf<ColorPickerProps['shape']>().toEqualTypeOf<ColorPickerShape | undefined>();
    expectTypeOf<ColorPickerProps['children']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<ColorPickerLabels['area']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ColorPickerLabels['colorName']>().toEqualTypeOf<
      ((color: HsvColor) => string) | undefined
    >();
    expectTypeOf<ColorPickerLabels['valueText']>().toEqualTypeOf<
      ((color: HsvColor, channel: 'hue' | 'saturation' | 'value' | 'alpha') => string) | undefined
    >();
    expectTypeOf<ColorPickerHexFieldProps['controlRef']>().toEqualTypeOf<
      Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<ColorPickerSwatchesProps>().not.toHaveProperty('items');
    expectTypeOf<ColorPickerPreviewProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<Entry['ColorPicker']['HexField']>().toEqualTypeOf<Entry['ColorPickerHexField']>();
    expectTypeOf<Entry['ColorPicker']['Swatches']>().toEqualTypeOf<Entry['ColorPickerSwatches']>();
    expectTypeOf<Entry['ColorPicker']['Preview']>().toEqualTypeOf<Entry['ColorPickerPreview']>();
  });

  it('trees: selection modes, checked items with details, row content, persona rows and tabStop', () => {
    expectTypeOf<TreeProps['selectionMode']>().toEqualTypeOf<'none' | SelectionMode | undefined>();
    expectTypeOf<TreeProps['checkedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TreeProps['defaultCheckedItems']>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<TreeCheckedItemsChangeDetails>().toEqualTypeOf<{
      value: string;
      checked: boolean;
      event: Event;
    }>();
    // `details` is optional until 1.0: a handler of the items alone fits, a state setter too,
    // and code that calls the prop may pass the items only.
    type Handler = NonNullable<TreeProps['onCheckedItemsChange']>;
    const itemsOnly = (items: string[]) => void items;
    expectTypeOf(itemsOnly).toExtend<Handler>();
    expectTypeOf<Dispatch<SetStateAction<string[]>>>().toExtend<Handler>();
    expectTypeOf<Dispatch<SetStateAction<readonly string[]>>>().toExtend<Handler>();
    expectTypeOf<Handler>().toBeCallableWith(['docs']);
    expectTypeOf<Handler>().parameter(1).toEqualTypeOf<TreeCheckedItemsChangeDetails | undefined>();

    expectTypeOf<TreeProps['navigationMode']>().toEqualTypeOf<'tree' | 'treegrid' | undefined>();
    expectTypeOf<TreeItemProps['actions']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemProps['aside']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemProps['iconAfter']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TreeItemProps['expandIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TreeItemPersonaLayoutProps['media']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps['description']>().toEqualTypeOf<ReactNode>();
    expectTypeOf<TreeItemPersonaLayoutProps>().toExtend<HTMLAttributes<HTMLSpanElement>>();
    expectTypeOf<Entry['Tree']['ItemPersonaLayout']>().toEqualTypeOf<
      Entry['TreeItemPersonaLayout']
    >();
    expectTypeOf<UseRovingTabIndexOptions['tabStop']>().toEqualTypeOf<
      'active' | 'last-focused' | 'none' | undefined
    >();
  });

  it('class-name constants have literal, readonly types; the new unions refuse other values', () => {
    expectTypeOf<
      Entry['toastTitleClassNames']['label']
    >().toEqualTypeOf<'wave-toast-title__label'>();
    expectTypeOf<Entry['toasterClassNames']['toast']>().toEqualTypeOf<'wave-toaster__toast'>();
    expectTypeOf<Entry['colorAreaClassNames']['thumb']>().toEqualTypeOf<'wave-color-area__thumb'>();
    expectTypeOf<
      Entry['treeItemClassNames']['actions']
    >().toEqualTypeOf<'wave-tree-item__actions'>();
    expectTypeOf<
      Entry['treeItemPersonaLayoutClassNames']['main']
    >().toEqualTypeOf<'wave-tree-item-persona-layout__main'>();

    // @ts-expect-error the MessageBar layouts are auto, singleline and multiline
    const wrap: MessageBarProps['layout'] = 'wrap';
    // @ts-expect-error opacity has its own slider (AlphaSlider)
    const alpha: ColorSliderProps['channel'] = 'alpha';
    // @ts-expect-error Fluent's 'multiselect' is 'multiple' in WaveUI
    const multiselect: TreeProps['selectionMode'] = 'multiselect';
    // @ts-expect-error the navigation modes are tree and treegrid
    const grid: TreeProps['navigationMode'] = 'grid';
    // @ts-expect-error a ColorPicker is rounded or square
    const circular: ColorPickerProps['shape'] = 'circular';
    const classes = {} as Entry['buttonClassNames'];
    // @ts-expect-error the registry constants are readonly
    classes.root = 'wave-custom';
    expect([wrap, alpha, multiselect, grid, circular, classes.root]).toEqual([
      'wrap',
      'alpha',
      'multiselect',
      'grid',
      'circular',
      'wave-custom',
    ]);
  });
});

// The 0.11 additions (spec §4.7), imported from the package entry (compile-time, `tsconfig.dev.json`).
describe('0.11 tags, drawers and the app shell from the package entry', () => {
  it('Tag, TagGroup and InteractionTag: size, appearance, shape, selection and dismissal', () => {
    expectTypeOf<TagProps['size']>().toEqualTypeOf<TagSize | undefined>();
    expectTypeOf<TagProps['appearance']>().toEqualTypeOf<TagAppearance | undefined>();
    expectTypeOf<TagProps['shape']>().toEqualTypeOf<TagShape | undefined>();
    expectTypeOf<TagGroupProps['size']>().toEqualTypeOf<TagSize | undefined>();
    expectTypeOf<TagGroupProps['appearance']>().toEqualTypeOf<TagAppearance | undefined>();
    expectTypeOf<TagGroupProps['shape']>().toEqualTypeOf<TagShape | undefined>();
    expectTypeOf<InteractionTagProps['size']>().toEqualTypeOf<TagSize | undefined>();
    expectTypeOf<InteractionTagProps['appearance']>().toEqualTypeOf<TagAppearance | undefined>();
    expectTypeOf<InteractionTagProps['shape']>().toEqualTypeOf<TagShape | undefined>();

    expectTypeOf<NonNullable<TagGroupProps['onValueChange']>>()
      .parameter(0)
      .toEqualTypeOf<string[]>();
    expectTypeOf<readonly string[]>().toExtend<NonNullable<TagGroupProps['value']>>();
    expectTypeOf<TagGroupProps['onDismiss']>().toEqualTypeOf<
      ((value: string) => void) | undefined
    >();

    expectTypeOf<TagGroupProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<InteractionTagProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<InteractionTagPrimaryProps['ref']>().toEqualTypeOf<
      Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<InteractionTagSecondaryProps['ref']>().toEqualTypeOf<
      Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<
      ComponentProps<typeof InteractionTag.Primary>
    >().toEqualTypeOf<InteractionTagPrimaryProps>();
  });

  it('TagPicker: the root props, the labels, the parts and TagPickerOption', () => {
    expectTypeOf<ComponentProps<typeof TagPicker>>().toEqualTypeOf<TagPickerProps>();
    expectTypeOf<TagPickerProps['options']>().toEqualTypeOf<
      readonly TagPickerOption[] | undefined
    >();
    expectTypeOf<TagPickerLabels['create']>().toEqualTypeOf<
      ((text: string) => string) | undefined
    >();
    expectTypeOf<TagPickerLabels['clear']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TagPickerLabels['expand']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TagPickerLabels['overflowCount']>().toEqualTypeOf<
      ((count: number) => string) | undefined
    >();

    // TagPickerOption is both the interface of an `options` entry and the `TagPicker.Option` part.
    expectTypeOf<TagPickerOption>().toHaveProperty('value').toEqualTypeOf<string>();
    expectTypeOf<TagPickerOption>().toHaveProperty('label').toEqualTypeOf<string>();
    expectTypeOf<typeof TagPicker.Option>().toEqualTypeOf<typeof TagPickerOption>();
    expectTypeOf<ComponentProps<typeof TagPickerOption>>().toEqualTypeOf<TagPickerOptionProps>();

    expectTypeOf<TagPickerControlProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<TagPickerGroupProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<TagPickerInputProps['ref']>().toEqualTypeOf<Ref<HTMLInputElement> | undefined>();
    expectTypeOf<TagPickerButtonProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>();
    expectTypeOf<TagPickerListProps['ref']>().toEqualTypeOf<Ref<HTMLUListElement> | undefined>();

    // The parts take the root's size and appearance; they have none of their own.
    // @ts-expect-error TagPicker.Control takes no size
    const controlSize: TagPickerControlProps['size'] = 'large';
    // @ts-expect-error TagPicker.Input takes no appearance
    const inputAppearance: TagPickerInputProps['appearance'] = 'underline';
    // @ts-expect-error TagPicker.Button takes no size
    const buttonSize: TagPickerButtonProps['size'] = 'large';
    // @ts-expect-error TagPicker.List takes no appearance
    const listAppearance: TagPickerListProps['appearance'] = 'outline';
    expect([controlSize, inputAppearance, buttonSize, listAppearance]).toEqual([
      'large',
      'underline',
      'large',
      'outline',
    ]);
  });

  it('Dialog and Drawer: sizes, positions, types, modal types, the trigger and the parts', () => {
    expectTypeOf<'bottom'>().toExtend<DrawerPosition>();
    expectTypeOf<DrawerSize>().toEqualTypeOf<SurfaceSize>();
    expectTypeOf<DialogSize>().toEqualTypeOf<SurfaceSize>();
    expectTypeOf<DrawerModalType>().toEqualTypeOf<ModalType>();
    expectTypeOf<DrawerType>().toEqualTypeOf<'overlay' | 'inline'>();
    expectTypeOf<DrawerProps['size']>().toEqualTypeOf<DrawerSize | undefined>();
    expectTypeOf<DrawerProps['type']>().toEqualTypeOf<DrawerType | undefined>();
    expectTypeOf<DrawerProps['modalType']>().toEqualTypeOf<DrawerModalType | undefined>();
    expectTypeOf<DialogProps['modalType']>().toEqualTypeOf<ModalType | undefined>();
    expectTypeOf<DrawerTriggerRenderProps['aria-haspopup']>().toEqualTypeOf<'dialog' | undefined>();
    expectTypeOf<DrawerProps['ref']>().toEqualTypeOf<Ref<HTMLElement> | undefined>();
    expectTypeOf<DrawerHeaderProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<DrawerHeaderTitleProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<DrawerHeaderTitleProps['headingLevel']>().toEqualTypeOf<
      HeadingLevel | undefined
    >();
    expectTypeOf<DrawerHeaderNavigationProps['ref']>().toEqualTypeOf<
      Ref<HTMLElement> | undefined
    >();
    expectTypeOf<DrawerBodyProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<DrawerFooterProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<
      NonNullable<Extract<DrawerProps['backdrop'], { appearance?: unknown }>['appearance']>
    >().toEqualTypeOf<BackdropAppearance>();
  });

  it('Nav parts, NavDrawer and Hamburger', () => {
    expectTypeOf<NavAppItemProps>().toEqualTypeOf<NavAppItemAnchorProps | NavAppItemButtonProps>();
    expectTypeOf<NavAppItemDynamicProps['ref']>().toEqualTypeOf<
      Ref<HTMLAnchorElement | HTMLButtonElement> | undefined
    >();
    expectTypeOf<NavAppItemStaticProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<NavSectionHeaderProps['ref']>().toEqualTypeOf<
      Ref<HTMLHeadingElement> | undefined
    >();
    expectTypeOf<NavDividerProps['ref']>().toEqualTypeOf<Ref<HTMLLIElement> | undefined>();

    expectTypeOf<NonNullable<NavDrawerBodyProps['focusMode']>>().toEqualTypeOf<FocusMode>();
    expectTypeOf<NonNullable<NavDrawerProps['modalType']>>().toEqualTypeOf<'modal' | 'non-modal'>();
    expectTypeOf<NavDrawerProps['size']>().toEqualTypeOf<DrawerSize | undefined>();
    expectTypeOf<NavDrawerProps['type']>().toEqualTypeOf<DrawerType | undefined>();
    expectTypeOf<NavDrawerProps['onItemSelect']>().toEqualTypeOf<
      ((value: string) => void) | undefined
    >();
    expectTypeOf<NavDrawerProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<NavDrawerHeaderProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<NavDrawerFooterProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>();
    expectTypeOf<ComponentProps<typeof NavDrawer.Body>>().toEqualTypeOf<NavDrawerBodyProps>();

    expectTypeOf<HamburgerProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>();
    // @ts-expect-error an alert NavDrawer is not supported
    const alert: NavDrawerProps['modalType'] = 'alert';
    expect(alert).toBe('alert');
  });

  it('ListboxSurface listProps (wave A)', () => {
    expectTypeOf<ListboxSurfaceProps['listProps']>().toEqualTypeOf<
      ListboxSurfaceListProps | undefined
    >();
  });
});

// The 0.14 additions (Phase 9), imported from the package entry (compile-time, `tsconfig.dev.json`).
describe('0.14 collections, data grids and tours from the package entry', () => {
  it('Overflow: direction, orientation, groups, the change details and the item props', () => {
    expectTypeOf<OverflowDirection>().toEqualTypeOf<'end' | 'start'>();
    expectTypeOf<OverflowGroupVisibility>().toEqualTypeOf<'visible' | 'hidden' | 'overflow'>();
    expectTypeOf<OverflowProps['overflowDirection']>().toEqualTypeOf<
      OverflowDirection | undefined
    >();
    expectTypeOf<OverflowProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    expectTypeOf<OverflowProps['minimumVisible']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<OverflowProps['hasHiddenItems']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<OverflowProps['buttonPosition']>().toEqualTypeOf<
      'end' | 'before-hidden' | undefined
    >();
    expectTypeOf<OverflowChangeDetails>().toEqualTypeOf<{
      visibleItems: string[];
      groupVisibility: Record<string, OverflowGroupVisibility>;
    }>();
    // A handler of the hidden ids alone fits.
    type OnOverflowChange = NonNullable<OverflowProps['onOverflowChange']>;
    expectTypeOf<OnOverflowChange>().parameter(0).toEqualTypeOf<string[]>();
    const hiddenOnly = (hiddenItems: string[]) => void hiddenItems;
    expectTypeOf(hiddenOnly).toExtend<OnOverflowChange>();

    expectTypeOf<OverflowItemProps>().toEqualTypeOf<
      OverflowItemBaseProps & OverflowItemPriorityProps
    >();
    expectTypeOf<OverflowItemBaseProps['groupId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<OverflowItemBaseProps['asChild']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<{ priority: number }>().toExtend<OverflowItemPriorityProps>();
    expectTypeOf<{ pinned: boolean }>().toExtend<OverflowItemPriorityProps>();
    // An item has a priority or is pinned, never both.
    expectTypeOf<{ priority: number; pinned: boolean }>().not.toExtend<OverflowItemPriorityProps>();
    expectTypeOf<OverflowDividerProps['groupId']>().toEqualTypeOf<string>();
    expectTypeOf<OverflowDividerProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<Entry['useIsOverflowGroupVisible']>().toEqualTypeOf<
      (groupId: string) => OverflowGroupVisibility
    >();
    expectTypeOf<Entry['useHasHiddenItems']>().toEqualTypeOf<() => boolean>();
    expectTypeOf<Entry['Overflow']['Divider']>().toEqualTypeOf<Entry['OverflowDivider']>();
  });

  it('Breadcrumb: the collapse, size, focus mode and divider props and the helpers', () => {
    expectTypeOf<BreadcrumbProps['maxDisplayedItems']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BreadcrumbProps['overflowIndex']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BreadcrumbProps['overflow']>().toEqualTypeOf<'none' | 'auto' | undefined>();
    expectTypeOf<BreadcrumbProps['overflowLabel']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<BreadcrumbProps['size']>().toEqualTypeOf<CoreSize | undefined>();
    expectTypeOf<BreadcrumbProps['focusMode']>().toEqualTypeOf<FocusMode | undefined>();
    expectTypeOf<BreadcrumbProps['divider']>().toEqualTypeOf<Slot<'span'> | undefined>();

    expectTypeOf<Entry['partitionBreadcrumbItems']>().toEqualTypeOf<
      <T>(options: PartitionBreadcrumbItemsOptions<T>) => PartitionBreadcrumbItemsResult<T>
    >();
    expectTypeOf<PartitionBreadcrumbItemsOptions<number>>().toEqualTypeOf<{
      items: readonly number[];
      maxDisplayedItems?: number;
      overflowIndex?: number;
    }>();
    expectTypeOf<PartitionBreadcrumbItemsResult<number>>().toEqualTypeOf<{
      startDisplayedItems: number[];
      overflowItems?: number[];
      endDisplayedItems?: number[];
    }>();
    expectTypeOf<Entry['truncateBreadcrumbLongName']>().toEqualTypeOf<
      (content: string, maxLength?: number) => string
    >();
    expectTypeOf<Entry['truncateBreadcrumbLongTooltip']>().toEqualTypeOf<
      (content: string, maxLength?: number) => string
    >();
    expectTypeOf<Entry['isTruncatableBreadcrumbContent']>().toEqualTypeOf<
      (content: string, maxLength: number) => boolean
    >();
  });

  it('DataGrid: typed columns, items, the callback details, selection and the SelectionCell', () => {
    interface Person {
      id: string;
      name: string;
    }
    expectTypeOf<Entry['createTableColumn']>().toEqualTypeOf<
      <T>(options: CreateTableColumnOptions<T>) => DataGridColumn<T>
    >();
    expectTypeOf<CreateTableColumnOptions<Person>['columnId']>().toEqualTypeOf<string>();
    expectTypeOf<CreateTableColumnOptions<Person>['compare']>().toEqualTypeOf<
      ((a: Person, b: Person) => number) | undefined
    >();
    expectTypeOf<DataGridColumn<Person>['renderCell']>().toEqualTypeOf<
      ((item: Person) => ReactNode) | undefined
    >();
    expectTypeOf<DataGridItemsProps<Person>['items']>().toEqualTypeOf<
      readonly Person[] | undefined
    >();
    expectTypeOf<DataGridItemsSortProps<Person>['items']>().toEqualTypeOf<readonly Person[]>();
    expectTypeOf<DataGridBaseProps<Person>['getRowId']>().toEqualTypeOf<
      ((item: Person) => string) | undefined
    >();
    expectTypeOf<DataGridBaseProps<Person>['columns']>().toEqualTypeOf<
      readonly DataGridColumn<Person>[] | undefined
    >();
    expectTypeOf<DataGridBodyProps<Person>['children']>().toEqualTypeOf<
      ReactNode | ((item: Person, index: number) => ReactNode)
    >();

    expectTypeOf<DataGridBaseProps['selectOnRowClick']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DataGridBaseProps['subtleSelection']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<DataGridBaseProps['selectionAppearance']>().toEqualTypeOf<
      DataGridSelectionAppearance | undefined
    >();
    expectTypeOf<DataGridSelectionAppearance>().toEqualTypeOf<'brand' | 'neutral' | 'none'>();
    expectTypeOf<DataGridSortChangeDetails>().toEqualTypeOf<{ event: Event }>();
    expectTypeOf<DataGridSelectedItemsChangeDetails>().toEqualTypeOf<{ event: Event }>();
    expectTypeOf<NonNullable<DataGridItemsSortProps['onSortChange']>>().toEqualTypeOf<
      (sort: DataGridSort, details?: DataGridSortChangeDetails) => void
    >();
    expectTypeOf<NonNullable<DataGridBaseProps['onSelectedItemsChange']>>().toEqualTypeOf<
      (selectedItems: string[], details?: DataGridSelectedItemsChangeDetails) => void
    >();

    expectTypeOf<DataGridRowProps['selectionCellProps']>().toEqualTypeOf<
      DataGridRowSelectionCellProps | undefined
    >();
    expectTypeOf<DataGridSelectionCellProps>().toExtend<DataGridRowSelectionCellProps>();
    expectTypeOf<DataGridSelectionCellProps['controlRef']>().toEqualTypeOf<
      Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<Entry['DataGrid']['SelectionCell']>().toEqualTypeOf<
      Entry['DataGridSelectionCell']
    >();
  });

  it('Table: sortable headers, the selection cell, the cell layout and the cell actions', () => {
    expectTypeOf<SortDirection>().toEqualTypeOf<'ascending' | 'descending'>();
    expectTypeOf<TableHeaderCellProps['sortable']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<TableHeaderCellProps['sortDirection']>().toEqualTypeOf<
      SortDirection | undefined
    >();
    expectTypeOf<TableHeaderCellProps['onSortClick']>().toEqualTypeOf<
      MouseEventHandler<HTMLButtonElement> | undefined
    >();
    expectTypeOf<TableHeaderCellProps['sortIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TableHeaderCellProps['aside']>().toEqualTypeOf<Slot<'span'> | undefined>();

    expectTypeOf<TableSelectionCellProps['type']>().toEqualTypeOf<
      'checkbox' | 'radio' | undefined
    >();
    expectTypeOf<TableSelectionCellProps['checked']>().toEqualTypeOf<
      boolean | 'mixed' | undefined
    >();
    expectTypeOf<NonNullable<TableSelectionCellProps['onCheckedChange']>>().toEqualTypeOf<
      (checked: boolean, details?: TableSelectionCellCheckedChangeDetails) => void
    >();
    expectTypeOf<TableSelectionCellCheckedChangeDetails>().toEqualTypeOf<{ event: Event }>();
    expectTypeOf<TableSelectionCellProps['controlRef']>().toEqualTypeOf<
      Ref<HTMLInputElement> | undefined
    >();
    expectTypeOf<TableCellLayoutProps['media']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TableCellLayoutProps['description']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TableCellLayoutProps['appearance']>().toEqualTypeOf<'primary' | undefined>();
    expectTypeOf<TableCellActionsProps['visible']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<Entry['Table']['SelectionCell']>().toEqualTypeOf<Entry['TableSelectionCell']>();
    expectTypeOf<Entry['Table']['CellLayout']>().toEqualTypeOf<Entry['TableCellLayout']>();
    expectTypeOf<Entry['Table']['CellActions']>().toEqualTypeOf<Entry['TableCellActions']>();

    // @ts-expect-error a sortable header is sorted ascending or descending, or not at all (absent)
    const none: TableHeaderCellProps['sortDirection'] = 'none';
    expect(none).toBe('none');
  });

  it('List: the navigation modes, onAction, disabledSelection and the check marks', () => {
    expectTypeOf<ListNavigationMode>().toEqualTypeOf<'none' | 'items' | 'composite'>();
    expectTypeOf<ListProps['navigationMode']>().toEqualTypeOf<ListNavigationMode | undefined>();
    expectTypeOf<ListProps['checkmark']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ListItemActionEvent>().toEqualTypeOf<
      ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>
    >();
    expectTypeOf<NonNullable<ListItemProps['onAction']>>().toEqualTypeOf<
      (event: ListItemActionEvent) => void
    >();
    expectTypeOf<ListItemProps['disabledSelection']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ListItemProps['checkmark']>().toEqualTypeOf<Slot<'span'> | undefined>();
  });

  it('TeachingPopover: the footer actions, onFinish, the footer layout and the parts', () => {
    expectTypeOf<TeachingPopoverProps['primaryAction']>().toEqualTypeOf<
      TeachingPopoverAction | undefined
    >();
    expectTypeOf<TeachingPopoverProps['secondaryAction']>().toEqualTypeOf<
      TeachingPopoverAction | undefined
    >();
    expectTypeOf<TeachingPopoverStep['primaryAction']>().toEqualTypeOf<
      TeachingPopoverAction | undefined
    >();
    expectTypeOf<TeachingPopoverStep['secondaryAction']>().toEqualTypeOf<
      TeachingPopoverAction | undefined
    >();
    expectTypeOf<ReactNode>().toExtend<TeachingPopoverAction>();
    expectTypeOf<{ as: 'a'; href: string; children: string }>().toExtend<TeachingPopoverAction>();
    expectTypeOf<TeachingPopoverProps['onFinish']>().toEqualTypeOf<(() => void) | undefined>();
    expectTypeOf<TeachingPopoverProps['footerLayout']>().toEqualTypeOf<
      'horizontal' | 'vertical' | undefined
    >();

    expectTypeOf<TeachingPopoverTriggerProps['children']>().toEqualTypeOf<
      ReactNode | ((props: TeachingPopoverTriggerChildProps) => ReactNode)
    >();
    expectTypeOf<TeachingPopoverTriggerProps['asChild']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<TeachingPopoverTriggerChildProps['aria-haspopup']>().toEqualTypeOf<'dialog'>();
    expectTypeOf<TeachingPopoverTriggerChildProps['aria-expanded']>().toEqualTypeOf<boolean>();
    expectTypeOf<TeachingPopoverSurfaceProps['ref']>().toEqualTypeOf<
      Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<TeachingPopoverHeaderProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TeachingPopoverHeaderProps['dismissButton']>().toEqualTypeOf<
      Slot<'span'> | undefined
    >();
    expectTypeOf<TeachingPopoverTitleProps>().toExtend<TeachingPopoverTitleOwnProps>();
    expectTypeOf<TeachingPopoverTitleProps<'p'>['ref']>().toEqualTypeOf<
      Ref<HTMLParagraphElement> | undefined
    >();
    expectTypeOf<TeachingPopoverBodyProps['media']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TeachingPopoverFooterProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<TeachingPopoverCarouselProps>().toExtend<HTMLAttributes<HTMLDivElement>>();
    expectTypeOf<TeachingPopoverCarouselNavProps>().not.toHaveProperty('children');
    expectTypeOf<TeachingPopoverCarouselPageCountProps['children']>().toEqualTypeOf<
      ((current: number, total: number) => ReactNode) | undefined
    >();
    expectTypeOf<TeachingPopoverCarouselFooterProps['layout']>().toEqualTypeOf<
      'offset' | 'centered' | undefined
    >();
    expectTypeOf<TeachingPopoverCarouselFooterProps['initialStepText']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<TeachingPopoverCarouselFooterProps['finalStepText']>().toEqualTypeOf<
      string | undefined
    >();

    type Popover = Entry['TeachingPopover'];
    expectTypeOf<Popover['Trigger']>().toEqualTypeOf<Entry['TeachingPopoverTrigger']>();
    expectTypeOf<Popover['Surface']>().toEqualTypeOf<Entry['TeachingPopoverSurface']>();
    expectTypeOf<Popover['Header']>().toEqualTypeOf<Entry['TeachingPopoverHeader']>();
    expectTypeOf<Popover['Title']>().toEqualTypeOf<Entry['TeachingPopoverTitle']>();
    expectTypeOf<Popover['Body']>().toEqualTypeOf<Entry['TeachingPopoverBody']>();
    expectTypeOf<Popover['Footer']>().toEqualTypeOf<Entry['TeachingPopoverFooter']>();
    expectTypeOf<Popover['Carousel']>().toEqualTypeOf<Entry['TeachingPopoverCarousel']>();
    expectTypeOf<Popover['CarouselNav']>().toEqualTypeOf<Entry['TeachingPopoverCarouselNav']>();
    expectTypeOf<Popover['CarouselPageCount']>().toEqualTypeOf<
      Entry['TeachingPopoverCarouselPageCount']
    >();
    expectTypeOf<Popover['CarouselFooter']>().toEqualTypeOf<
      Entry['TeachingPopoverCarouselFooter']
    >();
  });
});
