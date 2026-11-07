import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as registry from '../../../src/lib/classNames';
import { getCatalog, type ComponentEntry } from '../catalog/catalog';
import { createDocsExtractor, extractDocs, type ComponentDocs, type PropDoc } from './props';

const FIXTURE = resolve(dirname(fileURLToPath(import.meta.url)), '__fixtures__/deprecated.tsx');

/**
 * Entries whose description may be empty, with the reason. Empty: every entry of the catalog has a
 * component (or hook) JSDoc today. Add a row only for an export that truly has none, never to hide
 * an extraction bug.
 */
const NO_DESCRIPTION: Readonly<Record<string, string>> = {};

/** Creating the program parses the whole library: give the first extraction room. */
const PROGRAM_TIMEOUT = 60_000;

const catalog = getCatalog();

function entry(exportName: string): ComponentEntry {
  const found = catalog.find((candidate) => candidate.exportName === exportName);
  if (!found) throw new Error(`no catalog entry exports ${exportName}`);
  return found;
}

function prop(docs: ComponentDocs, name: string): PropDoc {
  const found = docs.props.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no prop ${name} in ${docs.props.map((p) => p.name).join(', ')}`);
  return found;
}

const names = (docs: ComponentDocs) => docs.props.map((p) => p.name);

/** The members of a printed union, sorted. */
const unionMembers = (type: string) =>
  type
    .split('|')
    .map((member) => member.trim())
    .sort();

describe('extractDocs', () => {
  let button: ComponentDocs;
  beforeAll(() => {
    button = extractDocs(entry('Button'));
  }, PROGRAM_TIMEOUT);

  it('Button: description from JSDoc, appearance is a union of primary|outline|subtle|transparent, disabledFocusable documented', () => {
    expect(button.description).toMatch(/^A button with Fluent appearances and sizes\.\n/);
    expect(button.description).toContain(
      '`disabledFocusable` keeps an unavailable button focusable',
    );
    // The tags are not part of the description.
    expect(button.description).not.toContain('@example');
    expect(button.description).not.toContain('<Button appearance="primary"');

    const appearance = prop(button, 'appearance');
    expect(unionMembers(appearance.type)).toEqual([
      "'outline'",
      "'primary'",
      "'subtle'",
      "'transparent'",
    ]);
    expect(appearance.required).toBe(false);
    expect(appearance.description).toBe('Visual style variant.');

    const disabledFocusable = prop(button, 'disabledFocusable');
    expect(disabledFocusable.type).toBe('boolean');
    expect(disabledFocusable.description).toMatch(
      /^Marks the button unavailable but keeps it focusable and in the tab order/,
    );
    expect(disabledFocusable.default).toBe('false');
    expect(disabledFocusable.deprecated).toBeUndefined();
  });

  it('a prop with @default carries it', () => {
    expect(prop(button, 'appearance').default).toBe("'outline'");
    expect(prop(button, 'size').default).toBe("'medium'");
    expect(prop(button, 'iconPosition').default).toBe("'before'");
    const switchDocs = extractDocs(entry('Switch'));
    expect(prop(switchDocs, 'labelPosition').default).toBe("'after'");
    // No tag, no default (not even an undefined key).
    expect(prop(switchDocs, 'checked')).not.toHaveProperty('default');
    // A one-line comment with an inline tag: the tag is the default, the rest the description.
    const initialFocus = prop(extractDocs(entry('useModalLayer')), 'initialFocus');
    expect(initialFocus.default).toBe("'first'");
    expect(initialFocus.description).toBe(
      "What the focus trap (or a non-modal surface's initial focus) focuses first.",
    );
  });

  it('a @deprecated prop carries its note', () => {
    const docs = createDocsExtractor({ entryFile: FIXTURE })('LegacyBadge');
    expect(docs.description).toBe('A badge with a renamed prop.');
    expect(names(docs)).toEqual(['kind', 'tone', 'legacy']);
    const kind = prop(docs, 'kind');
    expect(kind.deprecated).toBe('Use `tone`.');
    expect(kind.description).toBe("The badge's look.");
    expect(unionMembers(kind.type)).toEqual(["'brand'", "'danger'"]);
    // A bare tag still marks the prop.
    expect(prop(docs, 'legacy').deprecated).toBe('Deprecated.');
    // A prop without the tag has no note (not even an undefined key).
    expect(prop(docs, 'tone')).not.toHaveProperty('deprecated');
    expect(prop(docs, 'tone').default).toBe("'brand'");
    // The fixture has no class-name registry.
    expect(docs.classNames).toBeNull();
  });

  it('Menu (compound): parts are listed (Menu.Item, Menu.Popover…)', () => {
    const menu = extractDocs(entry('Menu'));
    expect(menu.parts).toEqual([
      'Menu.Item',
      'Menu.Divider',
      'Menu.Trigger',
      'Menu.Popover',
      'Menu.ItemCheckbox',
      'Menu.ItemRadio',
      'Menu.ItemSwitch',
      'Menu.ItemLink',
      'Menu.Group',
      'Menu.GroupHeader',
      'Menu.SplitGroup',
    ]);
    // The compound's JSDoc sits on its exported `Object.assign(…)` const, not on the root.
    expect(menu.description).toMatch(/^A menu of actions \(`role="menu"`\), in one of two forms:/);
    // The props are the root's.
    expect(names(menu)).toEqual(
      expect.arrayContaining(['open', 'defaultOpen', 'onOpenChange', 'checkedValues']),
    );
    // A compound whose cast type adds its members (`as ComboboxComponent`) lists them too.
    expect(extractDocs(entry('Combobox')).parts).toEqual(
      expect.arrayContaining(['Combobox.Option', 'Combobox.OptionGroup']),
    );
  });

  it('a polymorphic component documents as and the element props are not dumped into the table', () => {
    expect(names(button)).toEqual([
      'appearance',
      'size',
      'shape',
      'icon',
      'iconPosition',
      'disabled',
      'disabledFocusable',
      'as',
    ]);
    const as = prop(button, 'as');
    expect(as.type).toBe('React.ElementType');
    expect(as.default).toBe("'button'");
    expect(as.required).toBe(false);
    expect(as.description).toBe(
      'Render as a different element or component (its props are type-checked).',
    );
    // The element's own attributes are named once, not listed.
    expect(button.nativeElement).toBe('HTMLButtonElement');
    for (const native of ['onClick', 'type', 'className', 'style', 'id', 'aria-label', 'ref']) {
      expect(names(button)).not.toContain(native);
    }
    // Text renders a <span> unless told otherwise.
    const text = extractDocs(entry('Text'));
    expect(prop(text, 'as').default).toBe("'span'");
    expect(text.nativeElement).toBe('HTMLSpanElement');
  });

  it('props the library declares are kept even where they shadow a native attribute; inherited native attributes are left out', () => {
    const switchDocs = extractDocs(entry('Switch'));
    // Switch re-declares the handlers it routes to its control, and `ref`.
    expect(names(switchDocs)).toEqual(expect.arrayContaining(['onClick', 'onFocus', 'ref']));
    expect(prop(switchDocs, 'onClick').description).toBe(
      'Click handler of the switch control (the `role="switch"` button).',
    );
    for (const native of ['onMouseDown', 'className', 'style', 'id', 'title', 'children']) {
      expect(names(switchDocs)).not.toContain(native);
    }
    expect(switchDocs.nativeElement).toBe('HTMLLabelElement');
    // A required prop.
    expect(prop(extractDocs(entry('Tooltip')), 'content').required).toBe(true);
  });

  it('types read as written: aliases kept, callbacks bare, literal unions written out in declared order', () => {
    // A union of literals is written out in the order of its declaration (`Size`), not the
    // checker's.
    expect(prop(button, 'size').type).toBe(
      "'extra-small' | 'small' | 'medium' | 'large' | 'extra-large'",
    );
    // Other types keep their source spelling: an alias stays an alias, a callback is not wrapped
    // in parentheses, `undefined` is not added to an optional prop.
    expect(prop(button, 'icon').type).toBe("Slot<'span'>");
    expect(prop(extractDocs(entry('ToggleButton')), 'onPressedChange').type).toBe(
      '(pressed: boolean) => void',
    );
    expect(prop(extractDocs(entry('Drawer')), 'backdrop').type).toBe(
      "Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance })",
    );
    expect(prop(extractDocs(entry('Switch')), 'label').type).toBe('React.ReactNode');
    // An inline object type is one line, without the JSDoc of its members.
    const breadcrumbParts = prop(extractDocs(entry('Breadcrumb')), 'slotProps').type;
    expect(breadcrumbParts).toMatch(/^\{ list\?: SlotPartWithRef<'ol', HTMLElement>; listItem\?: /);
    expect(breadcrumbParts).not.toMatch(/\n|\/\*/);
  });

  it('props of several forms are merged: a union of props, several call signatures', () => {
    // SpinButton's props are `SpinButtonProps | SpinButtonAllowEmptyProps`.
    const spinButton = extractDocs(entry('SpinButton'));
    expect(prop(spinButton, 'allowEmpty')).toMatchObject({
      type: 'boolean',
      required: false,
      default: 'false',
    });
    expect(prop(spinButton, 'allowEmpty').description).toMatch(/^Allows an empty value/);
    expect(prop(spinButton, 'value').type).toBe('number | null');
    // Combobox has a multi-select and a single-select signature.
    const combobox = extractDocs(entry('Combobox'));
    expect(prop(combobox, 'multiselect').type).toBe('boolean');
    // Required by the multi-select signature only: not required.
    expect(prop(combobox, 'multiselect').required).toBe(false);
    expect(unionMembers(prop(combobox, 'value').type)).toEqual(['readonly string[]', 'string']);
    // A member typed `never` in one form (Accordion's `openItems` in single mode) adds nothing to
    // the type, and its JSDoc (which says it is not taken there) is not the prop's description.
    const openItems = prop(extractDocs(entry('Accordion')), 'openItems');
    expect(openItems.type).toBe('readonly V[]');
    // A generic component's type parameter stays as written, so the source's spelling holds.
    expect(prop(extractDocs(entry('Accordion')), 'onOpenItemChange').type).toBe(
      '(openItem: V | null, details?: AccordionToggleDetails<V>) => void',
    );
    expect(openItems.description).toBe(
      'Controlled array of open item values (a readonly array is accepted).',
    );
    // The same for a form that takes `items?: undefined` (DataGrid without data).
    const items = prop(extractDocs(entry('DataGrid')), 'items');
    expect(items.type).toBe('readonly T[]');
    expect(items.description).toMatch(/^The grid's data, one body row per item/);
  });

  it('slotProps keys are listed as parts', () => {
    const switchDocs = extractDocs(entry('Switch'));
    expect(switchDocs.parts).toEqual(['root', 'track', 'thumb', 'label']);
    expect(prop(switchDocs, 'slotProps').type).toContain("track?: SlotPart<'button'>");
    // No slotProps and no compound members: no parts.
    expect(button.parts).toEqual([]);
  });

  it('classNames come from src/lib/classNames.ts (buttonClassNames.root is wave-button)', () => {
    expect(button.classNames).toEqual({ root: 'wave-button', icon: 'wave-button__icon' });
    expect(button.classNames).toEqual(registry.buttonClassNames);
    expect(extractDocs(entry('Switch')).classNames).toEqual(registry.switchClassNames);
    expect(extractDocs(entry('DataGrid')).classNames).toEqual(registry.dataGridClassNames);
    // Dialog's root renders no element of its own, so the registry has no `dialogClassNames`.
    expect('dialogClassNames' in registry).toBe(false);
    expect(extractDocs(entry('Dialog')).classNames).toBeNull();
  });

  it('hook entries: description from the JSDoc, options as props, no parts or classes', () => {
    const features = extractDocs(entry('useTableFeatures'));
    expect(features.description).toMatch(
      /^Headless table state for a table built from the static `Table` parts/,
    );
    expect(features.description).not.toContain('@example');
    expect(names(features)).toEqual(expect.arrayContaining(['items', 'columns', 'getRowId']));
    expect(prop(features, 'items').required).toBe(true);
    expect(features.parts).toEqual([]);
    expect(features.classNames).toBeNull();

    const modalLayer = extractDocs(entry('useModalLayer'));
    expect(modalLayer.description).toMatch(
      /^Everything a modal surface \(Dialog, Drawer\) needs, composed in the order that works:/,
    );
    const container = prop(modalLayer, 'container');
    expect(container.required).toBe(true);
    expect(container.type).toBe('HTMLElement | null');
    expect(container.description).toBe('The modal surface, held in state via a callback ref.');
    const modalType = prop(modalLayer, 'modalType');
    expect(unionMembers(modalType.type)).toEqual(["'alert'", "'modal'", "'non-modal'"]);
    expect(modalType.default).toBe("'modal'");
    expect(modalLayer.parts).toEqual([]);
    expect(modalLayer.classNames).toBeNull();
  });

  it(
    'every one of the 80 entries yields a non-empty description',
    () => {
      expect(catalog).toHaveLength(80);
      const empty: string[] = [];
      for (const item of catalog) {
        const docs = extractDocs(item);
        if (!docs.description.trim() && !(item.exportName in NO_DESCRIPTION)) {
          empty.push(item.exportName);
        }
        // Every entry documents some props (a hook its options), and every one has a description.
        expect(docs.props.length, item.exportName).toBeGreaterThan(0);
        for (const p of docs.props) {
          expect(p.type, `${item.exportName}.${p.name}`).not.toBe('');
          // Never cut short by the printer (`… 4 more …`).
          expect(p.type, `${item.exportName}.${p.name}`).not.toMatch(/\.\.\. \d+ more \.\.\./);
        }
        // classNames is the registry's constant for the export, when there is one.
        const constant = `${item.exportName[0]!.toLowerCase()}${item.exportName.slice(1)}ClassNames`;
        expect(docs.classNames, item.exportName).toEqual(
          (registry as Record<string, unknown>)[constant] ?? null,
        );
      }
      expect(empty).toEqual([]);
    },
    PROGRAM_TIMEOUT,
  );

  it('an export the entry module does not have throws a clear error', () => {
    expect(() => extractDocs({ ...entry('Button'), exportName: 'NoSuchComponent' })).toThrow(
      /"NoSuchComponent" is not exported by .*src\/index\.ts/,
    );
  });
});
