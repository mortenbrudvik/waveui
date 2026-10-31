/**
 * The 1.0 inventory (Phase 13, §6.3, R18 to R22): `src/lib/deprecations.ts` lists every change
 * that 1.0 makes, and this test keeps it in step with the code, the CHANGELOG and
 * `docs/UPGRADING-TO-1.0.md`, so the inventory cannot rot:
 *
 * - **CHANGELOG.** Each row's `changelogAnchor` is text of the CHANGELOG section of its
 *   `sinceVersion` (the release that announced it). Each row's `group` is the bold title of a line
 *   of the 0.18.0 "Deprecated" list, and that line names the row's `sinceVersion`; every line of
 *   that list is the group of a row (one line per group).
 * - **Guide.** Each row is a line of the table under its kind's heading in
 *   `docs/UPGRADING-TO-1.0.md` (Before, After, Announced in, Warns), and each line of those tables
 *   is a row.
 * - **Files.** Each row's `file` exists.
 * - **Warnings.** Each row that warns has a minimal case below. Rendered in StrictMode, and again,
 *   it logs its row's message once, the messages listed with it (`also`) and nothing else, under
 *   the row's `warningKey`. A key that is not `warnDeprecated`'s (a `warnOnce` of the component's
 *   own) is also found in the sources.
 * - **Call sites (the counting rule).** A call site is a call expression whose callee is the
 *   identifier `warnDeprecated` or `resolveDeprecatedProp` (with or without a type argument) in a
 *   module of `src` that is not a test (`__tests__`, `*.test.*`), a test helper (`src/test-*`) or
 *   `src/lib/dev.ts`, which defines both (and calls `warnDeprecated` inside
 *   `resolveDeprecatedProp`). The modules are parsed with the TypeScript compiler, so comments,
 *   JSDoc examples, strings and import lines never count; an aliased import or a reference that is
 *   not a call fails the test, so a call cannot hide behind another name. Each call announces one
 *   row: a row whose `warningKey` starts with `deprecated:` (the key `warnDeprecated` builds) and
 *   whose `file` is the call's module. A call that warns for several values (Text's numeric
 *   weights, PresenceBadge's `dnd` and `oof`) is one row, keyed by the value its case renders. So,
 *   exactly, the calls in each module equal the `deprecated:` rows that name it, and the calls in
 *   `src` equal the rows with `warns: true`, `kind: 'removed'` and a `deprecated:` key: a new alias
 *   without a row fails here. The other warnings of the inventory (`warnOnce` with keys of their
 *   own: Badge and CounterBadge `important`, the presence className rule, the button-object
 *   dismiss slots of MessageBar and SearchBox, a numeric Slider `size`, a missing `Image.alt`) are
 *   outside the count; their cases prove them.
 */
import * as React from 'react';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import ts from 'typescript';
import changelog from '../../CHANGELOG.md?raw';
import upgradingGuide from '../../docs/UPGRADING-TO-1.0.md?raw';
import * as entry from '../index';
import {
  Accordion,
  Badge,
  Checkbox,
  ColorPicker,
  Combobox,
  CounterBadge,
  DataGrid,
  DatePicker,
  Dialog,
  Drawer,
  Dropdown,
  EmptySwatch,
  Image,
  InfoLabel,
  Input,
  Link,
  List,
  Menu,
  MessageBar,
  Nav,
  NavDrawer,
  Option,
  PresenceBadge,
  RadioGroup,
  Rating,
  SearchBox,
  Select,
  Skeleton,
  Slider,
  SpinButton,
  Stack,
  Switch,
  SwatchPicker,
  TabList,
  Table,
  Tag,
  TagPicker,
  TeachingPopover,
  Text,
  TimePicker,
  Tooltip,
  useRovingTabIndex,
} from '../index';
import { hasWarned } from '../lib/dev';
import * as deprecations from '../lib/deprecations';
import { DEPRECATIONS, type Deprecation, type DeprecationKind } from '../lib/deprecations';

/** The repository root. */
const ROOT = join(import.meta.dirname, '..', '..');

/** Every module of `src` but the tests and test helpers, by repository path (`src/…`). */
const SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>(
      ['../**/*.{ts,tsx}', '!../**/__tests__/**', '!../**/*.test.{ts,tsx}', '!../test-*'],
      { query: '?raw', import: 'default', eager: true },
    ),
  ).map(([path, source]) => [path.replace(/^\.\.\//, 'src/'), source]),
);

/** The module that defines `warnDeprecated` and `resolveDeprecatedProp`. */
const DEV_MODULE = 'src/lib/dev.ts';

/** The inventory, which names every warning key itself. */
const INVENTORY_MODULE = 'src/lib/deprecations.ts';

/** The prefix of the warn-once keys that `warnDeprecated` builds. */
const DEPRECATED_KEY = 'deprecated:';

const CALLEES = new Set(['warnDeprecated', 'resolveDeprecatedProp']);

// ---------------------------------------------------------------------------
// Call sites
// ---------------------------------------------------------------------------

interface CallScan {
  /** The calls of `warnDeprecated` and `resolveDeprecatedProp`. */
  readonly calls: number;
  /** References that are neither such a call nor a plain import (an alias, a value passed on). */
  readonly evasions: readonly string[];
}

/** Counts a module's calls of the two helpers by the rule of the file header. */
function scanCalls(path: string, source: string): CallScan {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let calls = 0;
  const evasions: string[] = [];
  const where = (node: ts.Node) =>
    `${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
  const visit = (node: ts.Node): void => {
    if (ts.isImportSpecifier(node)) {
      const imported = (node.propertyName ?? node.name).text;
      if (CALLEES.has(imported) && node.name.text !== imported) {
        evasions.push(`${where(node)}: ${imported} imported as ${node.name.text}`);
      }
      return;
    }
    if (ts.isIdentifier(node) && CALLEES.has(node.text)) {
      const { parent } = node;
      const isCallee = ts.isCallExpression(parent) && parent.expression === node;
      const isDeclaration = ts.isFunctionDeclaration(parent) && parent.name === node;
      if (isCallee) calls++;
      else if (!isDeclaration) evasions.push(`${where(node)}: ${node.text} used as a value`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { calls, evasions };
}

/** The call sites per module (modules without any are left out), `src/lib/dev.ts` excluded. */
function callSitesByModule(sources: Readonly<Record<string, string>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [path, source] of Object.entries(sources)) {
    if (path === DEV_MODULE) continue;
    const { calls } = scanCalls(path, source);
    if (calls > 0) counts[path] = calls;
  }
  return counts;
}

/** The rows a call site announces, counted per module (`file`). */
function deprecatedKeyRowsByModule(rows: readonly Deprecation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.warns && row.warningKey.startsWith(DEPRECATED_KEY)) {
      counts[row.file] = (counts[row.file] ?? 0) + 1;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// CHANGELOG and guide
// ---------------------------------------------------------------------------

/** The section of a minor release (`'0.5'` is `## [0.5.0] - …`), up to the next release. */
function changelogSection(text: string, version: string): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## [${version}.0] - `));
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## ['));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

/** The lines of a `### <name>` subsection of a section, up to the next heading. */
function subsection(section: string, name: string): string[] {
  const lines = section.split('\n');
  const start = lines.indexOf(`### ${name}`);
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^#{2,3} /.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** `'0.6'` as a whole version in `text` (not `0.16` or `0.6.1`). */
function namesVersion(text: string, version: string): boolean {
  return new RegExp(`(?<![\\d.])${version.replace('.', '\\.')}(?![\\d]|\\.\\d)`).test(text);
}

/** The groups of the 0.18.0 "Deprecated" list: the bold title of each line, with the line. */
function deprecatedGroups(text: string): Map<string, string> {
  const groups = new Map<string, string>();
  for (const line of subsection(changelogSection(text, '0.18'), 'Deprecated')) {
    const title = /^- \*\*(.+?)\*\*/.exec(line);
    if (title) groups.set(title[1], line);
  }
  return groups;
}

/** The guide's heading for each kind. */
const GUIDE_HEADINGS: Record<DeprecationKind, string> = {
  removed: 'Removed in 1.0',
  'default-changes': 'Defaults and meanings that change',
  required: 'Arguments and props that become required',
  decided: 'Decided: no change',
};

const GUIDE_TABLE_HEADER = '| Before | After | Announced in | Warns |';

/** The cells of the inventory tables of the guide, by the `##` heading above them. */
function guideTables(text: string): Map<string, string[][]> {
  const tables = new Map<string, string[][]>();
  let heading = '';
  let inTable = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      heading = line.slice(3).trim();
      inTable = false;
    } else if (line.trim() === GUIDE_TABLE_HEADER) {
      inTable = true;
      tables.set(heading, tables.get(heading) ?? []);
    } else if (inTable && line.startsWith('|')) {
      if (/^\|[\s|:-]+\|$/.test(line.trim())) continue;
      tables.get(heading)?.push(
        line
          .trim()
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim()),
      );
    } else {
      inTable = false;
    }
  }
  return tables;
}

/** A row as a line of the guide's tables. */
const guideCells = (row: Deprecation): string[] => [
  row.item,
  row.replacement,
  row.sinceVersion,
  row.warns ? 'yes' : 'no',
];

// ---------------------------------------------------------------------------
// The warning cases
// ---------------------------------------------------------------------------

/** The message of `warnDeprecated` (`src/lib/dev.ts`). */
const deprecated = (component: string, oldName: string, newName: string, extra?: string) =>
  `[WaveUI] ${component}: \`${oldName}\` is deprecated and will be removed in 1.0. Use \`${newName}\` instead.` +
  (extra ? ` ${extra}` : '');

const legacyMotion = (part: string) =>
  `[WaveUI] ${part}: a className containing "[presence=" turns the default motion off; this compatibility rule is removed in 1.0 - pass the motion prop instead.`;

const importantColor = (name: string) =>
  `[WaveUI] ${name}: color="important" changes meaning in 1.0 (neutral, high emphasis); pass color="severe" to keep the orange look.`;

/** A presence variant in a `className` (0.14's motion compatibility rule). */
const LEGACY_MOTION_CLASS = 'p-4 data-[presence=exiting]:opacity-0';

const noop = () => {};

interface WarningCase {
  /** The smallest rendering that uses the row's item. */
  readonly ui: React.ReactElement;
  /** The row's own warning. */
  readonly message: string;
  /** Every other message the rendering logs (exact). */
  readonly also?: readonly string[];
}

function RovingPositional() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { handleKeyDown } = useRovingTabIndex(ref, { items: ['a'], activeValue: 'a' });
  return <div ref={ref} role="group" aria-label="Group" onKeyDown={handleKeyDown} />;
}

const tabs = <TabList.Tab value="a">A</TabList.Tab>;
const navItems = <Nav.Item value="a">A</Nav.Item>;
const accordionItems = (
  <Accordion.Item value="a">
    <Accordion.Trigger>A</Accordion.Trigger>
    <Accordion.Panel>Panel</Accordion.Panel>
  </Accordion.Item>
);
const gridContent = (
  <>
    <DataGrid.Header>
      <DataGrid.Row>
        <DataGrid.HeaderCell columnId="name" sortable>
          Name
        </DataGrid.HeaderCell>
      </DataGrid.Row>
    </DataGrid.Header>
    <DataGrid.Body>
      <DataGrid.Row rowId="1">
        <DataGrid.Cell>Alice</DataGrid.Cell>
      </DataGrid.Row>
    </DataGrid.Body>
  </>
);
const tableBody = (
  <Table.Body>
    <Table.Row>
      <Table.Cell>Cell</Table.Cell>
    </Table.Row>
  </Table.Body>
);
const steps = [{ title: 'Welcome', body: 'Step one.' }];

/** A minimal case per row that warns, by row id. */
const WARNING_CASES: Readonly<Record<string, WarningCase>> = {
  'checkbox-onchange': {
    ui: <Checkbox aria-label="Accept" onChange={noop} />,
    message: deprecated('Checkbox', 'onChange', 'onCheckedChange'),
  },
  'switch-onchange': {
    ui: <Switch aria-label="Wi-Fi" onChange={noop} />,
    message: deprecated('Switch', 'onChange', 'onCheckedChange'),
  },
  'radiogroup-onchange': {
    ui: (
      <RadioGroup aria-label="Size" onChange={noop}>
        <RadioGroup.Item value="s" label="Small" />
      </RadioGroup>
    ),
    message: deprecated('RadioGroup', 'onChange', 'onValueChange'),
  },
  'rating-onchange': {
    ui: <Rating aria-label="Rating" onChange={noop} />,
    message: deprecated('Rating', 'onChange', 'onValueChange'),
  },
  'searchbox-onchange': {
    ui: <SearchBox aria-label="Search" onChange={noop} />,
    message: deprecated('SearchBox', 'onChange', 'onValueChange'),
  },
  'spinbutton-onchange': {
    ui: <SpinButton aria-label="Amount" onChange={noop} />,
    message: deprecated('SpinButton', 'onChange', 'onValueChange'),
  },
  'colorpicker-onchange': {
    ui: <ColorPicker aria-label="Color" onChange={noop} />,
    message: deprecated('ColorPicker', 'onChange', 'onValueChange'),
  },
  'swatchpicker-onchange': {
    ui: (
      <SwatchPicker aria-label="Colors" onChange={noop}>
        <EmptySwatch value="none" aria-label="None" />
      </SwatchPicker>
    ),
    message: deprecated('SwatchPicker', 'onChange', 'onValueChange'),
  },
  'tagpicker-onchange': {
    ui: <TagPicker aria-label="Tags" options={[{ value: 'a', label: 'A' }]} onChange={noop} />,
    message: deprecated('TagPicker', 'onChange', 'onValueChange'),
  },
  'timepicker-onchange': {
    ui: <TimePicker aria-label="Time" onChange={noop} />,
    message: deprecated('TimePicker', 'onChange', 'onValueChange'),
  },
  'datepicker-onchange': {
    ui: <DatePicker aria-label="Date" onChange={noop} />,
    message: deprecated('DatePicker', 'onChange', 'onValueChange'),
  },
  'combobox-onoptionselect': {
    ui: (
      <Combobox aria-label="Fruit" onOptionSelect={noop}>
        <Option value="apple">Apple</Option>
      </Combobox>
    ),
    message: deprecated('Combobox', 'onOptionSelect', 'onValueChange'),
  },
  'dropdown-onoptionselect': {
    ui: (
      <Dropdown aria-label="Fruit" onOptionSelect={noop}>
        <Option value="apple">Apple</Option>
      </Dropdown>
    ),
    message: deprecated('Dropdown', 'onOptionSelect', 'onValueChange'),
  },
  'tablist-selectedvalue': {
    ui: <TabList selectedValue="a">{tabs}</TabList>,
    message: deprecated('TabList', 'selectedValue', 'value'),
  },
  'tablist-defaultselectedvalue': {
    ui: <TabList defaultSelectedValue="a">{tabs}</TabList>,
    message: deprecated('TabList', 'defaultSelectedValue', 'defaultValue'),
  },
  'tablist-vertical': {
    ui: <TabList vertical>{tabs}</TabList>,
    message: deprecated('TabList', 'vertical', 'orientation'),
  },
  'tablist-ontabselect': {
    ui: <TabList onTabSelect={noop}>{tabs}</TabList>,
    message: deprecated(
      'TabList',
      'onTabSelect',
      'onValueChange',
      '`onValueChange` is called only when the selected tab changes.',
    ),
  },
  'nav-selectedvalue': {
    ui: (
      <Nav aria-label="Main" selectedValue="a">
        {navItems}
      </Nav>
    ),
    message: deprecated('Nav', 'selectedValue', 'value'),
  },
  'nav-defaultselectedvalue': {
    ui: (
      <Nav aria-label="Main" defaultSelectedValue="a">
        {navItems}
      </Nav>
    ),
    message: deprecated('Nav', 'defaultSelectedValue', 'defaultValue'),
  },
  'nav-onnavitemselect': {
    ui: (
      <Nav aria-label="Main" onNavItemSelect={noop}>
        {navItems}
      </Nav>
    ),
    message: deprecated('Nav', 'onNavItemSelect', 'onValueChange'),
  },
  'nav-category-text-label': {
    ui: (
      <Nav aria-label="Main">
        <Nav.Category value="reports">
          Reports
          <Nav.SubItem value="sales">Sales</Nav.SubItem>
        </Nav.Category>
      </Nav>
    ),
    message: deprecated(
      'Nav.Category',
      'text children as the label',
      'label',
      'Pass the category label in `label` and only the sub-items as children.',
    ),
  },
  'teachingpopover-currentstep': {
    ui: <TeachingPopover steps={steps} currentStep={0} />,
    message: deprecated('TeachingPopover', 'currentStep', 'activeStep'),
  },
  'teachingpopover-defaultcurrentstep': {
    ui: <TeachingPopover steps={steps} defaultCurrentStep={0} />,
    message: deprecated('TeachingPopover', 'defaultCurrentStep', 'defaultActiveStep'),
  },
  'list-selectionmode-multi': {
    ui: (
      <List aria-label="Fruits" selectionMode="multi">
        <List.Item value="a">Apple</List.Item>
      </List>
    ),
    message: deprecated('List', 'selectionMode="multi"', 'selectionMode="multiple"'),
  },
  'datagrid-selectedkeys': {
    ui: (
      <DataGrid aria-label="People" selectionMode="multiple" selectedKeys={new Set(['1'])}>
        {gridContent}
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'selectedKeys', 'selectedItems'),
  },
  'datagrid-defaultselectedkeys': {
    ui: (
      <DataGrid aria-label="People" selectionMode="multiple" defaultSelectedKeys={new Set(['1'])}>
        {gridContent}
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'defaultSelectedKeys', 'defaultSelectedItems'),
  },
  'datagrid-onselectionchange': {
    ui: (
      <DataGrid aria-label="People" selectionMode="multiple" onSelectionChange={noop}>
        {gridContent}
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'onSelectionChange', 'onSelectedItemsChange'),
  },
  // Each half of the 0.4 controlled sort alone also warns about mixed control: both are given.
  'datagrid-sortcolumn': {
    ui: (
      <DataGrid aria-label="People" sortColumn="name" sortDirection="ascending">
        {gridContent}
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'sortColumn', 'sort'),
    also: [deprecated('DataGrid', 'sortDirection', 'sort')],
  },
  'datagrid-sortdirection': {
    ui: (
      <DataGrid aria-label="People" sortColumn="name" sortDirection="ascending">
        {gridContent}
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'sortDirection', 'sort'),
    also: [deprecated('DataGrid', 'sortColumn', 'sort')],
  },
  'datagrid-defaultsortcolumn': {
    ui: (
      <DataGrid aria-label="People" defaultSortColumn="name">
        {gridContent}
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'defaultSortColumn', 'defaultSort'),
  },
  'datagrid-defaultsortdirection': {
    ui: (
      <DataGrid aria-label="People" defaultSortDirection="descending">
        {gridContent}
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'defaultSortDirection', 'defaultSort'),
  },
  'table-head': {
    ui: (
      <Table aria-label="People">
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        {tableBody}
      </Table>
    ),
    message: deprecated('Table', 'Table.Head', 'Table.Header'),
  },
  'table-headcell': {
    ui: (
      <Table aria-label="People">
        <Table.Header>
          <Table.Row>
            <Table.HeadCell>Name</Table.HeadCell>
          </Table.Row>
        </Table.Header>
        {tableBody}
      </Table>
    ),
    message: deprecated('Table', 'Table.HeadCell', 'Table.HeaderCell'),
  },
  'stack-direction': {
    ui: <Stack direction="horizontal">Item</Stack>,
    message: deprecated('Stack', 'direction', 'orientation'),
  },
  'skeleton-variant': {
    ui: <Skeleton variant="circular" />,
    message: deprecated('Skeleton', 'variant', 'shape'),
  },
  'text-numeric-weight': {
    ui: <Text weight={400}>Text</Text>,
    message: deprecated('Text', 'weight={400}', 'weight="regular"'),
  },
  'link-variant': {
    ui: (
      <Link href="#a" variant="subtle">
        Link
      </Link>
    ),
    message: deprecated('Link', 'variant', 'appearance'),
  },
  'tooltip-variant': {
    ui: (
      <Tooltip content="Tip" variant="dark">
        <button type="button">Button</button>
      </Tooltip>
    ),
    message: deprecated('Tooltip', 'variant', 'appearance'),
  },
  'accordion-openitems': {
    ui: <Accordion openItems={['a']}>{accordionItems}</Accordion>,
    message: deprecated(
      'Accordion',
      'openItems',
      'openItem',
      'In single mode the Accordion takes one value.',
    ),
  },
  'accordion-defaultopenitems': {
    ui: <Accordion defaultOpenItems={['a']}>{accordionItems}</Accordion>,
    message: deprecated(
      'Accordion',
      'defaultOpenItems',
      'defaultOpenItem',
      'In single mode the Accordion takes one value.',
    ),
  },
  'accordion-onopenitemschange': {
    ui: <Accordion onOpenItemsChange={noop}>{accordionItems}</Accordion>,
    message: deprecated(
      'Accordion',
      'onOpenItemsChange',
      'onOpenItemChange',
      'In single mode the Accordion reports one value.',
    ),
  },
  'messagebar-dismiss-button-object': {
    ui: <MessageBar dismiss={{ as: 'button', onClick: noop }}>Saved</MessageBar>,
    message:
      '[WaveUI] MessageBar: the button-object form of `dismiss` is deprecated and will be removed in 1.0; its button props were merged into the built-in dismiss button. Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.',
  },
  'searchbox-dismiss-button-object': {
    ui: (
      <SearchBox
        aria-label="Search"
        defaultValue="query"
        dismiss={{ as: 'button', type: 'button', onClick: noop }}
      />
    ),
    message:
      '[WaveUI] SearchBox: `dismiss` with button props (`as: "button"`, `onClick`, `type`, …) is deprecated and will be removed in 1.0; the props were merged into the built-in clear button. Pass icon content instead, e.g. `dismiss={<MyIcon />}`.',
  },
  'tag-dismissicon-button-object': {
    ui: (
      <Tag dismissible dismissIcon={{ onClick: noop }}>
        Cherry
      </Tag>
    ),
    message: deprecated(
      'Tag',
      'dismissIcon={{ onClick, type, disabled, … }} (button props on the slot object)',
      'onDismiss and icon content in dismissIcon',
      'Its props are merged onto the built-in dismiss button, which is named by `dismissLabel` and the tag content.',
    ),
  },
  'badge-important': {
    ui: <Badge color="important">New</Badge>,
    message: importantColor('Badge'),
  },
  'counterbadge-important': {
    ui: <CounterBadge count={3} color="important" />,
    message: importantColor('CounterBadge'),
  },
  'tooltip-delay': {
    ui: (
      <Tooltip content="Tip" delay={100}>
        <button type="button">Button</button>
      </Tooltip>
    ),
    message: deprecated('Tooltip', 'delay', 'openDelay'),
  },
  'input-numeric-size': {
    ui: <Input aria-label="Name" size={20} />,
    message: deprecated('Input', 'size={number}', 'htmlSize'),
  },
  'select-numeric-size': {
    ui: (
      <Select aria-label="Fruit" size={3}>
        <option>Apple</option>
      </Select>
    ),
    message: deprecated('Select', 'size={number}', 'htmlSize'),
  },
  'slider-numeric-size': {
    ui: <Slider aria-label="Volume" size={3} />,
    message:
      '[WaveUI] Slider: a numeric `size` has no effect (a range input ignores the native attribute) and is removed in 1.0; remove it.',
  },
  'infolabel-label': {
    ui: <InfoLabel label="Name" info="Your full name" />,
    message: deprecated('InfoLabel', 'label', 'children'),
  },
  'presencebadge-dnd-oof': {
    ui: <PresenceBadge status="dnd" />,
    message: deprecated('PresenceBadge', "status 'dnd'", "status 'do-not-disturb'"),
  },
  'datagridcolumn-id': {
    ui: (
      <DataGrid aria-label="People" columns={[{ id: 'name', label: 'Name' }]}>
        <DataGrid.Body>
          <DataGrid.Row rowId="1">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>
    ),
    message: deprecated('DataGrid', 'columns[].id', 'columns[].columnId'),
  },
  'userovingtabindex-positional': {
    ui: <RovingPositional />,
    message: deprecated(
      'useRovingTabIndex',
      'useRovingTabIndex(containerRef, options)',
      'useRovingTabIndex(options)',
      'Attach the returned `containerProps` to the container.',
    ),
  },
  'datagrid-positional-onsortchange': {
    ui: (
      <DataGrid aria-label="People" onSortChange={noop}>
        {gridContent}
      </DataGrid>
    ),
    message: deprecated(
      'DataGrid',
      'onSortChange(columnId, direction)',
      'onSortChange(sort, details?)',
      'Pass `items`, `sort` or `defaultSort` to receive the sort object.',
    ),
  },
  'menu-popover-legacy-motion': {
    ui: (
      <Menu>
        <Menu.Trigger>
          <button type="button">File</button>
        </Menu.Trigger>
        <Menu.Popover className={LEGACY_MOTION_CLASS}>
          <Menu.Item>New</Menu.Item>
        </Menu.Popover>
      </Menu>
    ),
    message: legacyMotion('Menu.Popover'),
  },
  'dialog-content-legacy-motion': {
    ui: (
      <Dialog>
        <Dialog.Trigger>
          <button type="button">Open</button>
        </Dialog.Trigger>
        <Dialog.Content className={LEGACY_MOTION_CLASS}>
          <Dialog.Title>Title</Dialog.Title>
        </Dialog.Content>
      </Dialog>
    ),
    message: legacyMotion('Dialog.Content'),
  },
  'drawer-legacy-motion': {
    ui: (
      <Drawer className={LEGACY_MOTION_CLASS}>
        <Drawer.Trigger>
          <button type="button">Open</button>
        </Drawer.Trigger>
        <Drawer.Title>Title</Drawer.Title>
      </Drawer>
    ),
    message: legacyMotion('Drawer'),
  },
  'navdrawer-legacy-motion': {
    ui: (
      <NavDrawer aria-label="Main" open={false} onOpenChange={noop} className={LEGACY_MOTION_CLASS}>
        <NavDrawer.Body>{navItems}</NavDrawer.Body>
      </NavDrawer>
    ),
    message: legacyMotion('NavDrawer'),
  },
  'image-alt-required': {
    ui: <Image src="photo.png" />,
    message:
      '[WaveUI] Image: `alt` is missing. Describe the image, or pass alt="" when it is decorative.',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const WARNING_ROWS = DEPRECATIONS.filter(
  (row): row is Extract<Deprecation, { warns: true }> => row.warns,
);

describe('the 1.0 inventory: the data', () => {
  it('gives every row a unique kebab-case id, a minor version and one-line texts', () => {
    const ids = DEPRECATIONS.map((row) => row.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    const wrong = DEPRECATIONS.filter(
      (row) =>
        !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.id) ||
        !/^0\.\d+$/.test(row.sinceVersion) ||
        [row.group, row.item, row.replacement, row.changelogAnchor, row.file].some(
          (text) => text.trim() === '' || /\n/.test(text),
        ) ||
        // The guide's table cells: no pipe in what it shows.
        [row.item, row.replacement].some((text) => text.includes('|')),
    ).map((row) => row.id);
    expect(wrong).toEqual([]);
  });

  it('names an existing file in every row', () => {
    const missing = DEPRECATIONS.filter((row) => !existsSync(join(ROOT, row.file))).map(
      (row) => `${row.id}: ${row.file}`,
    );
    expect(missing).toEqual([]);
  });

  it('marks every warnDeprecated row as a removal that warns', () => {
    const wrong = DEPRECATIONS.filter(
      (row) => row.warningKey?.startsWith(DEPRECATED_KEY) && row.kind !== 'removed',
    ).map((row) => row.id);
    expect(wrong).toEqual([]);
  });

  it('is data for this test only: the package entry does not export it', () => {
    expect(Object.keys(deprecations).filter((name) => Reflect.has(entry, name))).toEqual([]);
  });

  it('imports nothing and has no client directive, so it stays server-safe', () => {
    const source = SOURCES[INVENTORY_MODULE];
    expect(source).toBeTypeOf('string');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/^\s*import\b/m);
    expect(code).not.toMatch(/\bfrom\s*['"]/);
    expect(code).not.toMatch(/['"]use client['"]/);
  });
});

describe('the 1.0 inventory: the CHANGELOG', () => {
  it('finds every row announced in the CHANGELOG section of its version', () => {
    const missing = DEPRECATIONS.filter(
      (row) => !changelogSection(changelog, row.sinceVersion).includes(row.changelogAnchor),
    ).map((row) => `${row.id} (${row.sinceVersion}): ${row.changelogAnchor}`);
    expect(missing).toEqual([]);
  });

  it('restates every group in one line of the 0.18.0 "Deprecated" list, with its versions', () => {
    const groups = deprecatedGroups(changelog);
    const wrong = DEPRECATIONS.filter((row) => {
      const line = groups.get(row.group);
      return line === undefined || !namesVersion(line, row.sinceVersion);
    }).map((row) => `${row.id}: ${row.group} (${row.sinceVersion})`);
    expect(wrong).toEqual([]);
  });

  it('has no line in the 0.18.0 "Deprecated" list that is not a group', () => {
    const groups = new Set(DEPRECATIONS.map((row) => row.group));
    expect([...deprecatedGroups(changelog).keys()].filter((title) => !groups.has(title))).toEqual(
      [],
    );
  });
});

describe('the 1.0 inventory: docs/UPGRADING-TO-1.0.md', () => {
  const tables = guideTables(upgradingGuide);

  it('lists every row in the table of its kind', () => {
    const missing = DEPRECATIONS.filter((row) => {
      const lines = tables.get(GUIDE_HEADINGS[row.kind]) ?? [];
      const cells = guideCells(row);
      return !lines.some((line) => line.join('\u0000') === cells.join('\u0000'));
    }).map((row) => row.id);
    expect(missing).toEqual([]);
  });

  it('lists nothing that is not a row', () => {
    const rows = new Set(DEPRECATIONS.map((row) => guideCells(row).join('\u0000')));
    const extra = [...tables.values()]
      .flat()
      .filter((line) => !rows.has(line.join('\u0000')))
      .map((line) => line.join(' | '));
    expect(extra).toEqual([]);
  });
});

describe('the 1.0 inventory: the call sites of warnDeprecated and resolveDeprecatedProp', () => {
  it('reads the library sources', () => {
    expect(Object.keys(SOURCES)).toContain(DEV_MODULE);
    expect(Object.keys(SOURCES)).toContain('src/components/input/Checkbox.tsx');
    expect(Object.keys(SOURCES).some((path) => path.includes('__tests__'))).toBe(false);
  });

  it('has one deprecated: row per call site, in the module of the call', () => {
    expect(deprecatedKeyRowsByModule(DEPRECATIONS)).toEqual(callSitesByModule(SOURCES));
  });

  it('counts as many call sites as removals that warn through warnDeprecated', () => {
    const calls = Object.values(callSitesByModule(SOURCES)).reduce((sum, n) => sum + n, 0);
    const rows = DEPRECATIONS.filter(
      (row) => row.warns && row.kind === 'removed' && row.warningKey.startsWith(DEPRECATED_KEY),
    ).length;
    expect(calls).toBe(rows);
  });

  it('finds no aliased import and no reference that is not a call', () => {
    const evasions = Object.entries(SOURCES)
      .filter(([path]) => path !== DEV_MODULE)
      .flatMap(([path, source]) => scanCalls(path, source).evasions);
    expect(evasions).toEqual([]);
  });

  it('counts by the rule: calls with a type argument, not comments, strings or imports', () => {
    const source = [
      "import { resolveDeprecatedProp, warnDeprecated } from '../../lib/dev';",
      '/** @example warnDeprecated("X", "a", "b") */',
      "// resolveDeprecatedProp('X', a, b, 'a', 'b')",
      'const text = \'warnDeprecated("X")\';',
      "warnDeprecated('X', 'a', 'b');",
      "const v = resolveDeprecatedProp<number>('X', 1, undefined, 'a', 'b');",
    ].join('\n');
    expect(scanCalls('src/components/x/X.tsx', source)).toEqual({ calls: 2, evasions: [] });
    const evasive = [
      "import { warnDeprecated as announce } from '../../lib/dev';",
      "import { resolveDeprecatedProp } from '../../lib/dev';",
      'const resolve = resolveDeprecatedProp;',
    ].join('\n');
    expect(scanCalls('src/components/x/X.ts', evasive).evasions).toEqual([
      'src/components/x/X.ts:1: warnDeprecated imported as announce',
      'src/components/x/X.ts:3: resolveDeprecatedProp used as a value',
    ]);
  });
});

describe('the 1.0 inventory: the development warnings', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has a case for every row that warns, and none for another', () => {
    expect(Object.keys(WARNING_CASES).sort()).toEqual(WARNING_ROWS.map((row) => row.id).sort());
  });

  it('finds every warnOnce key of the inventory in the sources', () => {
    // The library's modules, without the inventory, which names every key itself.
    const library = Object.entries(SOURCES)
      .filter(([path]) => path !== INVENTORY_MODULE)
      .map(([, source]) => source);
    const literal = (key: string) =>
      library.some((source) =>
        ['"', "'", '`'].some((quote) => source.includes(`${quote}${key}${quote}`)),
      );
    // A key built from a name (`${name}:color:important`): the template in a module, and the
    // name as a literal in the row's module, which passes it.
    const templated = (key: string, file: string) => {
      const [name, ...rest] = key.split(':');
      const tail = rest.join(':');
      return (
        library.some((source) => source.includes(`}:${tail}\``)) &&
        ["'", '"'].some((quote) => (SOURCES[file] ?? '').includes(`${quote}${name}${quote}`))
      );
    };
    const missing = WARNING_ROWS.filter(
      (row) =>
        !row.warningKey.startsWith(DEPRECATED_KEY) &&
        !literal(row.warningKey) &&
        !templated(row.warningKey, row.file),
    ).map((row) => `${row.id}: ${row.warningKey}`);
    expect(missing).toEqual([]);
  });

  it.each(WARNING_ROWS.map((row) => [row.id, row] as const))(
    '%s: logs its warning once',
    (id, row) => {
      const testCase = WARNING_CASES[id];
      expect(testCase).toBeDefined();
      const ui = <React.StrictMode>{testCase.ui}</React.StrictMode>;
      const { rerender } = render(ui);
      rerender(ui);
      expect(hasWarned(row.warningKey)).toBe(true);
      expect(warn.mock.calls.map(([message]: unknown[]) => message).sort()).toEqual(
        [testCase.message, ...(testCase.also ?? [])].sort(),
      );
      expect(error).not.toHaveBeenCalled();
    },
  );
});
