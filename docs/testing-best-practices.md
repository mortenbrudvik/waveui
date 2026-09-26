# Testing WaveUI Components

How tests are written in this repository, with the helpers of `src/test-utils.ts` and `src/test-utils-field.tsx`.

> **Source of truth.** The JSDoc of `src/test-utils.ts` defines the helper signatures and defaults; where this guide and the JSDoc disagree, the JSDoc wins. Earlier versions of this file were pre-0.4 research (an analysis of Mantine's test utilities) that proposed helpers with different signatures. Those proposals led to the helpers below, but do not follow the old examples.

## 1. Stack and commands

Vitest 5, React Testing Library, `@testing-library/user-event`, jsdom and vitest-axe. Tests live in `__tests__/` next to the module they test (`src/components/input/__tests__/Switch.test.tsx`) and import it from its module path (`../Switch`); repo-level suites live in `src/__tests__/`.

Each example below starts with a comment naming the test file it belongs in: the component's own `<Component>.test.tsx`, which exists for every component. The examples are condensed to show one pattern each; they are not copies of tests in those files.

```bash
npm test                                          # everything
npx vitest run src/components/input/__tests__/Switch.test.tsx
npx vitest run src/components/input -t "Switch"   # filter by test name
npx vitest run <files> --reporter=default         # also print console output of passing tests
npm run test:coverage                             # V8 coverage with thresholds
npx tsc -p tsconfig.dev.json --noEmit             # tests and stories are type-checked too
```

Vitest picks a quiet reporter when it runs under an AI agent, which hides the console output of passing tests. Use `--reporter=default` to see act() warnings and unasserted `[WaveUI]` warnings (see [section 9](#9-keep-the-output-clean)).

## 2. The test environment (`src/test-setup.ts`)

Evaluated before every test file:

- jest-dom matchers (registered from `@testing-library/jest-dom/matchers`) and vitest-axe's `toHaveNoViolations`. `src/vitest-axe.d.ts` types both on Vitest's `Matchers<R, T>` interface. jest-dom's `/vitest` entry is not used: its type augmentation does not merge with Vitest 5's `Assertion<R, T>`. A new custom matcher is registered with `expect.extend` in the setup and typed in the same interface.
- `Element.prototype.scrollIntoView` is a `vi.fn()` when jsdom lacks it (calls cleared after every test).
- `window.matchMedia` answers `false` for every query when jsdom lacks it; `mockMatchMedia()` changes the answers.
- **No global `ResizeObserver`**, as in a consumer's jsdom; call `installResizeObserverMock()` when a test needs one.
- After every test: RTL `cleanup()`, the warn-once registry is reset (so every test sees first-time development warnings and missing-context errors), the `mockMatchMedia` answers are reset, and then two assertions, reported together:
  - the **overlay-state release assertion** (`assertOverlayStateReleased`): if an open dismiss layer, a focus trap, a scroll lock, modal isolation (`inert`), a `useRestoreFocus` tracker user or an inline style of a scroll lock (`overflow`, `scrollbar-gutter` on `<html>`, `padding-inline-end` on `<body>`) outlived the unmounted trees, it is released and **the test fails** naming it;
  - the **body-cleanup assertion**: if `document.body` still has children (a leaked portal, live region or toast, or a node the test appended itself), they are removed and **the test fails** naming them.

  Tests that append nodes, register layers directly or set such styles themselves undo that in their own `afterEach` (it runs first), or in `try`/`finally` inside the test. Not in `onTestFinished`: its callbacks run after these assertions, so a container a test appended itself (for `renderToString` and `hydrateRoot`) would already have failed it. `onTestFinished` suits what the assertions do not check, such as a document listener or a prototype stub (`mockAnimations` restores `getAnimations` that way).

`vi.mock()` works as usual. Do not call `vi.resetModules()` at the top of a test file: importing `src/test-utils.ts` afterwards would evaluate the setup a second time.

Vitest 5 clears the call history of every mock before each test (its `clearMocks` default), before the `beforeEach` hooks run; implementations stay. A `vi.fn()` created at module level, in a `describe` body or in `beforeAll` starts every test with no calls, so a test cannot assert calls recorded there: record them in the test or in `beforeEach`.

## 3. `testSystemProps`: the cross-cutting contract

One call registers the tests every component needs:

```tsx
// src/components/input/__tests__/Switch.test.tsx
import { Switch } from '../Switch';
import { testNoImplicitSubmit, testSystemProps } from '../../../test-utils';

describe('Switch', () => {
  testSystemProps(Switch, {
    expectedTag: 'label',
    displayName: 'Switch',
    defaultProps: { label: 'Wi-Fi' },
    control: { role: 'switch' },
    conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
    a11yVariants: [
      { name: 'checked', props: { defaultChecked: true } },
      { name: 'disabled', props: { disabled: true } },
    ],
  });

  testNoImplicitSubmit(Switch, { defaultProps: { label: 'Wi-Fi' } });
});
```

`TestSystemPropsConfig<P>` (the props type `P` is inferred from the component, so `defaultProps` and `a11yVariants` are type-checked against the real props):

| Field | Default | Meaning |
|---|---|---|
| `expectedTag` | required | Tag of the element that receives `ref`, `data-testid` and `className`. |
| `displayName` | required | Expected `Component.displayName`. |
| `defaultProps` | `{}` | Props every render needs: representative, real content. |
| `polymorphic` | `false` | Also test `as="section"`. |
| `a11y` | `true` | Register the axe tests. |
| `a11yScope` | `'document'` | Audit `document.body` (portals included) or `'container'` only. |
| `a11yVariants` | `[]` | Extra axe runs `{ name, props }`, rendered with `{ ...defaultProps, ...props }`. |
| `control` | — | Composite controls: the role of the focusable element that `aria-label` must name. |
| `conflictingClass` | — | `{ className, overrides }`: a consumer class that must replace a default class. |
| `wrapper` | — | A component rendered around every render (a provider the component needs). |

It registers these building blocks, which are also exported for tests that need one on its own:

- `testForwardRef(Component, expectedTag, props?, options?)` — a `ref` receives the element that carries `data-testid`, and that element has `expectedTag`.
- `testRestSpread(Component, props?, options?)` — `data-testid` lands on the root. Without `control`, `aria-label` lands on the root too; with `control`, `getByRole(control.role, { name })` must find the focusable element, `aria-label` must not stay on the root, and `data-testid` must stay on the outermost element that contains the control.
- `testClassName(Component, props?, options?)` — every default class survives a consumer `className`; with `conflictingClass`, the consumer class wins and the default is gone.
- `testPolymorphicAs(Component, props?, options?)` — with `polymorphic`.
- `testDisplayName(Component, name)`.
- `testA11y(Component, props?, { scope?, wrapper? })` — plus one test per `a11yVariants` entry.

The helpers named `test*` register tests through the Vitest globals: call them at module or `describe` level, never inside a test.

## 4. Accessibility audits

- One shared axe instance, `axe` from `src/test-utils.ts`: `configureAxe({ rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } })`. Components are audited in isolation, so the page-level landmark rule `region` is off, and jsdom cannot compute color contrast, so `color-contrast` is off too; every other rule runs. The stories gate uses the same instance.
- `expectNoA11yViolations` (and so `testA11y`, `a11yVariants` and the stories gate) also fails on **dangling ARIA id references**: an id in `aria-describedby`, `aria-labelledby`, `aria-errormessage` or `aria-activedescendant` that no element carries (`aria-controls` is not checked, since a closed popup need not be rendered). axe misses most of them. `findDanglingIdRefs(root)` lists them for a direct assertion. A component that drops a hint or error element drops its id from `aria-describedby`/`aria-errormessage` in the same render, and a test that passes `aria-describedby="x"` only to check routing renders an element with that id before it audits.
- `findDanglingIdRefsInHtml(html, attributes?)` does the same for an HTML string, typically `renderToString` output. It parses the HTML into an inert `<template>` (nothing reaches `document`) and lists every id of an ARIA reference that no element **of that HTML** carries; by default it checks every ARIA id reference, `aria-controls` and `aria-owns` included. A `Portal` renders nothing on the server, so the server-rendering test of a popup rendered with `defaultOpen` or `open` asserts `expect(findDanglingIdRefsInHtml(html)).toEqual([])` next to the trigger's `aria-expanded="false"`, then hydrates that HTML with `hydrateRoot` (`console.error` spied) and checks that the surface opens without an `onOpenChange` call (Popover, Menu, Dialog, Drawer and the pickers do this).
- Audits scan **`document.body`**, so portaled content (Dialog, Drawer, Popover, listboxes, Tooltip) is audited too. `scope: 'container'` / `a11yScope: 'container'` audits only the render container.
- `expectNoA11yViolations(root = document.body)` first lets pending updates land inside `act()` (one macrotask and one animation frame: popup positioning, listbox registration, Spinner's announcement), so the audit sees the settled DOM and React logs no act() warning. Calling `axe(el)` directly settles nothing.
- axe-core waits on the global `setTimeout`: audit with real timers or with `vi.useFakeTimers({ shouldAdvanceTime: true })`.
- Audit important states, not only the default: `a11yVariants` for props, and an open-state audit for every popup:

```tsx
// src/components/overlays/__tests__/Popover.test.tsx
import { render } from '@testing-library/react';
import { Popover } from '../Popover';
import { expectNoA11yViolations } from '../../../test-utils';

it('has no accessibility violations while open', async () => {
  render(
    <Popover defaultOpen>
      <Popover.Trigger>
        <button type="button">Details</button>
      </Popover.Trigger>
      <Popover.Content title="Details">Opening hours: 9–17</Popover.Content>
    </Popover>,
  );
  await expectNoA11yViolations();
});
```

Color contrast is asserted per theme by `src/styles/__tests__/tokens.test.ts` instead, and component colors stay on those token pairs by using theme tokens only.

## 5. Other helpers

### `testNoImplicitSubmit(Component, { defaultProps?, getTargets?, wrapper? })`

Renders the component inside `<form onSubmit={spy}>`, checks that every `<button>` in `document.body` (portaled ones included) is `type="button"`, and clicks every target inside the form without submitting it. Open overlays so their buttons are checked:

```tsx
// src/components/overlays/__tests__/Dialog.test.tsx
import { Dialog } from '../Dialog';
import { testNoImplicitSubmit } from '../../../test-utils';

describe('Dialog', () => {
  testNoImplicitSubmit(Dialog, {
    defaultProps: { open: true, children: <Dialog.Content title="Edit">Body</Dialog.Content> },
  });
});
```

### `testComposedHandler(Component, { handler, defaultProps?, act, assertInternal, assertInternalSuppressed?, wrapper? })`

The C-COMPOSE contract: a consumer handler runs and the built-in behaviour still happens; with `assertInternalSuppressed`, a handler that calls `preventDefault()` suppresses it.

```tsx
// src/components/layout/__tests__/TabList.test.tsx
import { screen } from '@testing-library/react';
import { TabList } from '../TabList';
import { testComposedHandler } from '../../../test-utils';

const tabs = (
  <>
    <TabList.Tab value="one">One</TabList.Tab>
    <TabList.Tab value="two">Two</TabList.Tab>
  </>
);

describe('TabList', () => {
  testComposedHandler(TabList, {
    handler: 'onKeyDown',
    defaultProps: { 'aria-label': 'Sections', children: tabs },
    act: async ({ user }) => {
      await user.tab();
      await user.keyboard('{ArrowRight}');
    },
    assertInternal: () => {
      expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
    },
    assertInternalSuppressed: () => {
      expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();
    },
  });
});
```

### `testCompoundExposure(Parent, names)` and flat names

Asserts that each `Parent[name]` is a component with a non-empty `displayName`. Add one test that the flat exports are the dotted members (C-COMPOUND):

```tsx
// src/components/layout/__tests__/Card.test.tsx
import { Card, CardBody, CardFooter, CardHeader } from '../Card';
import { testCompoundExposure } from '../../../test-utils';

describe('Card', () => {
  testCompoundExposure(Card, ['Header', 'Body', 'Footer']);

  it('exports the sub-components under flat names', () => {
    expect(CardHeader).toBe(Card.Header);
    expect(CardBody).toBe(Card.Body);
    expect(CardFooter).toBe(Card.Footer);
  });
});
```

### `asClientReference(Part)`: parts written in a Server Component

A client component written in a React Server Component reaches the client as a lazy reference, so `element.type` is not the part. `asClientReference(Part)` returns the part the way Flight delivers it (a pre-resolved `React.lazy` with the part's own type, so JSX props stay checked). Render a compound once with the plain parts and once with the lazy ones, and assert the same server HTML and the same behaviour:

```tsx
// src/components/layout/__tests__/TabList.test.tsx
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { TabList } from '../TabList';
import { asClientReference } from '../../../test-utils';

it('recognises parts written in a Server Component', () => {
  const tree = (Tab: typeof TabList.Tab, Panel: typeof TabList.Panel) => (
    <TabList aria-label="Sections" defaultValue="b">
      <Tab value="a">A</Tab>
      <Tab value="b">B</Tab>
      <Panel value="b">Panel B</Panel>
    </TabList>
  );
  const lazy = tree(asClientReference(TabList.Tab), asClientReference(TabList.Panel));
  expect(renderToString(lazy)).toBe(renderToString(tree(TabList.Tab, TabList.Panel)));
  render(lazy);
  expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
});
```

`src/__tests__/integration.test.tsx` also guards Accordion, Carousel, Combobox, DataGrid, Drawer, Dropdown, Menu, Nav, TabList and Tree end to end ("compounds composed in a React Server Component"): `renderToString` is identical with the lazy parts, and `hydrateRoot` of that HTML reports no recoverable error and no `console.error` before the key interaction runs. Other compounds that classify their parts (List, Breadcrumb, Stepper, AvatarGroup, the dismiss slots of Tag, MessageBar and SearchBox) are covered only by `asClientReference` tests in their own unit files. Add a case to the integration suite for a new compound.

### `expectThrows(ui, message)`

Asserts that rendering `ui` throws exactly `new Error(message)` and that nothing reached `console.error` on the way: the throw is the whole report. It spies on `console.error` without silencing it (an unexpected message still shows) and restores the spy, also when an assertion fails. Use it for the development throw of a part outside its root (C-CONTEXT):

```tsx
// src/components/layout/__tests__/Tree.test.tsx
import { expectThrows } from '../../../test-utils';

it('throws when Tree.Item is used outside a Tree (C-CONTEXT)', () => {
  expectThrows(
    <Tree.Item value="a">Orphan</Tree.Item>,
    '[WaveUI] Tree.Item must be used within <Tree>',
  );
});
```

### `testFocusEvents(Component, defaultProps?, selector?, options?)`

Registers `calls onFocus` and `calls onBlur`: clicks the element matched by `selector` (default: the container's first element) and tabs away.

### `createOverlayTestWrapper(Root, rootProps)`

A wrapper that renders `Root` with `rootProps` around its children, for rendering overlay sub-components in isolation:

```tsx
// src/components/overlays/__tests__/Dialog.test.tsx
import { render, screen } from '@testing-library/react';
import { Dialog } from '../Dialog';
import { createOverlayTestWrapper } from '../../../test-utils';

const DialogWrapper = createOverlayTestWrapper(Dialog, { open: true, onOpenChange: () => {} });

it('renders its content in the open dialog', () => {
  render(<Dialog.Content title="Edit">Body</Dialog.Content>, { wrapper: DialogWrapper });
  expect(screen.getByRole('dialog', { name: 'Edit' })).toHaveTextContent('Body');
});
```

### `renderWithProviders(ui, { theme?, dir?, ...renderOptions })`

Renders inside `<WaveProvider theme dir>` (a `wrapper` option goes inside the provider; `rerender` keeps the providers). Every directional component has at least one RTL test:

```tsx
// src/components/input/__tests__/RadioGroup.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup } from '../RadioGroup';
import { renderWithProviders } from '../../../test-utils';

it('mirrors ArrowLeft in RTL', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <RadioGroup aria-label="Size" defaultValue="s">
      <RadioGroup.Item value="s" label="Small" />
      <RadioGroup.Item value="m" label="Medium" />
    </RadioGroup>,
    { dir: 'rtl' },
  );
  await user.tab();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
});
```

### `renderWithFieldContext(ui, value?, options?)` (`src/test-utils-field.tsx`)

Renders the control inside a `FieldContext` provider with what `Field` renders around it, in Field's order: a real `<label>` before it; after it the error (`<p id={errorId} role="alert">`), a validation message in any other state (`<p id={validationMessageId}>`, `role="alert"` for `error` and `warning`) and the hint. A control's Field integration is thus tested without depending on `Field` itself. `FIELD_TEST_IDS` and `FIELD_TEST_TEXT` hold the default ids and texts (`labelId`, `hintId`, `errorId`, `messageId`, `controlId`; `label`, `hint`, `error`, `message`); `value` is a partial `FieldContextValue` (`hintId`, `errorId`, `validationState`, `validationMessageId`, `required`, `invalid`, …), and `options` holds the RTL render options plus the `label`, `hint`, `error` and `message` contents.

How the context is resolved (`resolveFieldTestContext`; its JSDoc in `src/test-utils-field.tsx` is the reference):

- `validationState` is passed through when given, else `'error'` when an `errorId` is given, else absent. `validationMessageId` is passed through only when given, so a context with only an `errorId` keeps the shape of a Field before 0.6.
- `invalid` defaults to "the state is `'error'`", so a `'warning'` context is not invalid.
- `hasErrorMessage` defaults to "the state is `'error'` **and** a message renders" (an `errorId` or a `validationMessageId`), as Field sets it: `{ validationState: 'error' }` alone gives `invalid: true` but `hasErrorMessage: false` (Field's error state without a message has nothing a control would repeat). Pass `invalid` or `hasErrorMessage` explicitly to override either.

Field sets `validationMessageId` for a message in every state and `errorId` to the same id only in the error state. The recipes:

| Field state | `value` |
|---|---|
| Error with a message (the 0.5 shape) | `{ errorId: FIELD_TEST_IDS.errorId }` |
| Error, as Field renders it from 0.6 | `{ validationState: 'error', errorId: FIELD_TEST_IDS.errorId, validationMessageId: FIELD_TEST_IDS.errorId }` |
| Warning (announced, not invalid) | `{ validationState: 'warning', validationMessageId: FIELD_TEST_IDS.messageId }` |
| Success or neutral (not announced) | `{ validationState: 'success' \| 'none', validationMessageId: FIELD_TEST_IDS.messageId }` |

```tsx
// src/components/input/__tests__/Checkbox.test.tsx
import { screen } from '@testing-library/react';
import { Checkbox } from '../Checkbox';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';

it('is named and described by the surrounding Field', () => {
  renderWithFieldContext(<Checkbox />, { hintId: FIELD_TEST_IDS.hintId, required: true });
  const box = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
  expect(box).toHaveAccessibleDescription(FIELD_TEST_TEXT.hint);
  expect(box).toHaveAttribute('aria-required', 'true');
});

it('is described by a Field warning without becoming invalid', () => {
  renderWithFieldContext(<Checkbox />, {
    validationState: 'warning',
    validationMessageId: FIELD_TEST_IDS.messageId,
    hintId: FIELD_TEST_IDS.hintId,
  });
  const box = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
  expect(box).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.message} ${FIELD_TEST_TEXT.hint}`);
  expect(box).not.toHaveAttribute('aria-invalid');
});
```

The real `Field` around every control is covered by `src/__tests__/integration.test.tsx`.

### `mockAnimations(options?)`: presence phases

jsdom has no `Element.prototype.getAnimations`, so an element that mounts through the presence core (`usePresence`, `Presence`, every `Menu.Popover`) ends its `entering` and `exiting` phases at once there, as it does in a browser without motion. `mockAnimations()` installs `getAnimations` for the current test: an element that carries `data-test-motion` and whose `data-presence` is `entering` or `exiting` reports one running animation, so the phase waits until `finishAll()` (or `cancelAll()`, a cancelled animation, which also ends it). Call it in the test or in a `beforeEach` (it restores the previous `getAnimations` through `onTestFinished`, which a `beforeAll` cannot use), and call `finishAll`/`cancelAll` inside `act`. `animated: (el) => boolean` replaces the default predicate.

```tsx
// src/components/navigation/__tests__/Menu.presence.test.tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from '../Menu';
import { mockAnimations } from '../../../test-utils';

it('stays mounted, inert and closed while it exits', async () => {
  const motion = mockAnimations();
  const user = userEvent.setup();
  render(
    <Menu>
      <Menu.Trigger>
        <button type="button">Actions</button>
      </Menu.Trigger>
      <Menu.Popover data-test-motion="">
        <Menu.Item>Edit</Menu.Item>
      </Menu.Popover>
    </Menu>,
  );
  await user.click(screen.getByRole('button', { name: 'Actions' }));
  await act(async () => {
    await motion.finishAll(); // ends the enter phase
  });
  const surface = screen.getByRole('menu', { name: 'Actions' });

  await user.keyboard('{Escape}');
  expect(surface).toHaveAttribute('data-presence', 'exiting');
  expect(surface).toHaveAttribute('data-state', 'closed');
  expect(surface).toHaveAttribute('inert');
  expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus(); // focus is back already

  await act(async () => {
    await motion.finishAll();
  });
  expect(surface).not.toBeInTheDocument();
});
```

- Testing Library does not treat `inert` as hidden, and jsdom lets an inert element take focus: assert the `inert` attribute and where focus is, and keep a reference from before the close (as above) to check that the element leaves the document after the exit.
- Test reduced motion both ways with `mockMatchMedia({ '(prefers-reduced-motion: reduce)': true })`: the phase then ends at once although an animation runs.
- Without `mockAnimations`, the core falls back to the element's computed `animation-*` and `transition-*` times: with inline `animationName`/`animationDuration` styles and fake timers the phase ends at the duration plus 50 ms, or at the element's own end event. jsdom has no `AnimationEvent`: dispatch an `Event('animationend')` with an `animationName` property.
- The hook adds no `style` and no `class`: assert `data-presence`, `inert` and `hidden`, never computed styles.

### The Menu item harness: `renderInMenuList(ui, options?)`

`src/components/navigation/__tests__/menuHarness.tsx` renders item kinds (`Menu.ItemCheckbox`, `Menu.ItemLink`, `Menu.Group`, …) inside the Menu and list contexts, with a real checked-values state and the list's roving keys, but without the Menu root, trigger and popover modules: a `role="menu"` list named "Test menu". Options: `isStatic` (a static list ignores close requests), `closeFromItem` (a spy by default, returned as `closeFromItem`: assert that an activation closes a popup menu), `checkedValues`, `defaultCheckedValues`, `onCheckedValuesChange`, `persistOnItemClick`, `submenuTrigger`, `dir` (`'rtl'` renders the list inside `<WaveProvider dir="rtl">`) and `renderOptions` (passed on to `render`). `MenuListHarness` is the same tree as an element, for `renderToString` and `hydrateRoot` and for a controlled parent. Cases that need a real popup menu (focus returning to the trigger, submenus, the server HTML of a real static `Menu`) are in the Menu suites and `src/__tests__/integration.test.tsx`.

```tsx
// src/components/navigation/__tests__/Menu.selectable.test.tsx
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuItemCheckbox } from '../Menu.selectable';
import { renderInMenuList } from './menuHarness';

it('Space toggles and keeps the menu open; Enter toggles and closes it', async () => {
  const user = userEvent.setup();
  const { closeFromItem } = renderInMenuList(
    <MenuItemCheckbox name="view" value="grid">
      Grid
    </MenuItemCheckbox>,
  );
  const item = screen.getByRole('menuitemcheckbox', { name: 'Grid' });
  act(() => item.focus());
  await user.keyboard(' ');
  expect(item).toHaveAttribute('aria-checked', 'true');
  expect(closeFromItem).not.toHaveBeenCalled();
  await user.keyboard('{Enter}');
  expect(item).toHaveAttribute('aria-checked', 'false');
  expect(closeFromItem).toHaveBeenCalledTimes(1);
});
```

- The column alignment is CSS `:has()`, which jsdom does not lay out: assert the placeholder spans and their `group-has-[…]/menu:` classes, not their visibility.
- After a `rerender` that changes item attributes inside a roving container, flush with `await act(async () => {})` before pressing keys (the roving hook restamps from a MutationObserver).
- jsdom joins a row's shortcut text to its accessible name (`RulerCtrl+R`): query such an item by a regular expression (`{ name: /^Ruler/ }`).

### Browser API mocks

- `installResizeObserverMock()` installs a controllable `ResizeObserver` and returns `{ trigger(target?), restore() }`; `trigger` calls the observers inside `act()`.
- `mockRect(el, { x, y, width, height })` gives an element a layout box (`getBoundingClientRect`, `offsetWidth`/`clientWidth`, `offsetHeight`/`clientHeight`); stub `scrollWidth`/`scrollHeight` yourself to simulate overflowing content.
- `mockMatchMedia({ query: boolean })` answers `matchMedia` queries and notifies mounted listeners. The answers last one test: call it in the test or in `beforeEach`, never in `beforeAll`.
- jsdom 30 has `CSS.escape()` and `CSS.supports()`, and `CSS.supports('scrollbar-gutter', 'stable')` answers `true`. So a scroll lock (Dialog, Drawer) on a page given a scrollbar (`clientWidth` of `document.documentElement` below `window.innerWidth`) sets `scrollbar-gutter: stable` on `<html>`, not `padding-inline-end` on `<body>`. A test of either path replaces `CSS` on `globalThis` and puts the old descriptor back afterwards (`mockGutterSupport` in `useScrollLock.test.tsx`).
- A measured size reaches a component through its `ResizeObserver` callback: give the element a box with `mockRect`, then call `trigger(element)`. `Dialog.Footer` reports its height this way, and the test reads `body.style.getPropertyValue('--wave-dialog-footer-height')` on the dialog body.
- A test that asserts that nothing is measured needs the mock too: without a `ResizeObserver` nothing measures anyway, so the assertion proves nothing. "`Dialog.Footer` inside a Drawer" (`Drawer.test.tsx`) installs the mock, gives the footer a height, triggers it and then asserts that the drawer body has no style; it restores the mock and its console spy in `finally`.

```tsx
// src/components/layout/__tests__/Overflow.test.tsx
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { useIsOverflowing } from '../Overflow';
import { installResizeObserverMock, mockRect } from '../../../test-utils';
import type { ResizeObserverMock } from '../../../test-utils';

function Probe() {
  const ref = React.useRef<HTMLDivElement>(null);
  const overflowing = useIsOverflowing(ref);
  return (
    <div ref={ref} data-testid="box">
      {overflowing ? 'overflowing' : 'fits'}
    </div>
  );
}

describe('useIsOverflowing', () => {
  let resizeObserver: ResizeObserverMock;
  beforeEach(() => {
    resizeObserver = installResizeObserverMock();
  });
  afterEach(() => {
    resizeObserver.restore();
  });

  it('re-checks overflow when the element resizes', () => {
    render(<Probe />);
    const box = screen.getByTestId('box');
    mockRect(box, { width: 100, height: 20 });
    Object.defineProperty(box, 'scrollWidth', { configurable: true, value: 180 });
    resizeObserver.trigger(box);
    expect(box).toHaveTextContent('overflowing');
  });
});
```

```tsx
// src/components/layout/__tests__/Carousel.test.tsx
import { render, screen } from '@testing-library/react';
import { Carousel } from '../Carousel';
import { mockMatchMedia } from '../../../test-utils';

it('starts auto-rotation stopped for reduced motion', () => {
  mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
  render(
    <Carousel autoPlay aria-label="Highlights">
      <Carousel.Item>One</Carousel.Item>
      <Carousel.Item>Two</Carousel.Item>
    </Carousel>,
  );
  expect(screen.getByRole('button', { name: 'Start slide rotation' })).toBeEnabled();
});
```

## 6. Controlled components and callbacks

- **One call per interaction.** Every stateful component has a StrictMode test that its value callback fires exactly once per interaction.
- **Separate interactions.** When a controlled component's parent ignores the callback, repeated interactions must be separate tasks: use `userEvent`, or `await act(async () => {})` between `fireEvent` calls. Back-to-back `fireEvent` calls run in one task and chain like uncontrolled updates (two clicks on `<ToggleButton pressed={false}>` would emit `true`, then `false`).
- **Change-only vs every activation.** Value callbacks (`onValueChange`, `onCheckedChange`, `onOpenChange`) fire only on change; event callbacks (`onPageChange`, `onStepChange`, `Tree` `onItemSelect`, the deprecated `onTabSelect`/`onNavItemSelect`/`onOptionSelect`) fire on every activation. Test re-selection for both kinds.
- **Checked values.** Menu and Toolbar call `onCheckedValuesChange(checkedValues, details)` once per change (a re-selected radio calls nothing) with a new object, then `details = { name, checkedItems, event }`: assert both arguments, `details.checkedItems` being `checkedValues[name]` and `details.event` the click (`toHaveBeenCalledWith({ view: ['grid'] }, expect.objectContaining({ name: 'view', checkedItems: ['grid'] }))`, or the exact `event` captured in the item's `onClick` through `event.nativeEvent`), once per change in StrictMode, and that a controlled parent that ignores the callback keeps its value.
- **A second `details` argument.** Dialog and Drawer call `onOpenChange(open, details)` with `{ reason, event }`, so `toHaveBeenCalledWith(false)` no longer matches. When the reason is not the point of the test, write `toHaveBeenCalledWith(false, expect.anything())`; when it is, `toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }))`, or the exact object in the component's own tests: `{ reason: 'outside-press', event: expect.any(Event) }`. A controlled dialog that refuses a reason is tested by asserting that it stays open after that interaction and closes after another (Escape).

```tsx
// src/components/button/__tests__/ToggleButton.test.tsx
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleButton } from '../ToggleButton';

it('emits true on every click while the parent keeps pressed={false}', async () => {
  const onPressedChange = vi.fn();
  const user = userEvent.setup();
  render(
    <ToggleButton pressed={false} onPressedChange={onPressedChange}>
      Bold
    </ToggleButton>,
  );
  const button = screen.getByRole('button', { name: 'Bold' });
  await user.click(button);
  await user.click(button);
  expect(onPressedChange.mock.calls).toEqual([[true], [true]]);
});

it('fires once per click in StrictMode', async () => {
  const onPressedChange = vi.fn();
  const user = userEvent.setup();
  render(
    <React.StrictMode>
      <ToggleButton onPressedChange={onPressedChange}>Bold</ToggleButton>
    </React.StrictMode>,
  );
  await user.click(screen.getByRole('button', { name: 'Bold' }));
  expect(onPressedChange).toHaveBeenCalledTimes(1);
});
```

## 7. Timers

Use fake timers that still advance with real time, and give `userEvent` the fake clock (with plain `vi.useFakeTimers()`, `userEvent` hangs):

```tsx
// src/components/overlays/__tests__/Tooltip.test.tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../Tooltip';

describe('Tooltip openDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the visual surface after the delay', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Tooltip content="Save changes" openDelay={300}>
        <button type="button">Save</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAccessibleDescription('Save changes');

    await user.hover(button);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.querySelector('[data-wave-tooltip-surface]')).not.toBeNull();
  });
});
```

- Wrap direct `vi.advanceTimersByTime(…)` calls in `act()`: timers that set state outside `act()` log warnings.
- `queueMicrotask` stays real (never add it to `toFake`). Focus moves that run in a microtask (a removed toast moving focus on, a focus trap returning focus that landed outside it) are asserted after `await act(async () => {})` or a `userEvent` action: after `act(() => el.focus())` on an element outside an open Dialog, Drawer or DatePicker calendar, flush before asserting where focus ended up. Focus-outside dismissal is decided in a microtask too: after focusing an element outside an open Menu, listbox popup, AvatarGroup popup or InfoLabel popup with a synchronous `act(() => el.focus())`, flush (or write `await act(async () => el.focus())`) before asserting that it closed.
- Switch back to real timers (or keep `shouldAdvanceTime`) before an axe audit.
- Tooltip's 0.6 `delay` prop is deprecated and warns: write `openDelay` (and `closeDelay`); keep `delay` only in a test that asserts the deprecation warning.

### Hover and the safe zone

Hover opening (Menu submenus, `openOnHover` on Menu and Popover) follows the mouse only. Simulate it with `user.hover`/`user.unhover`, or with `user.pointer({ target, coords: { clientX, clientY } })` for a path, under the fake timers above; touch and pen are pointer events you dispatch inside `act` (`new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' })`, then `pointermove`), which must open nothing and move no focus. The triangle safe zone is computed from rectangles, which jsdom does not lay out: give the trigger items and the surface boxes with `mockRect` after they render, then move the pointer through points inside and outside the triangle. Keep 50–100 ms of margin around every delay (assert "still closed" at `openDelay - 100` and "open" at `openDelay + 100`), so a busy machine's real time, which `shouldAdvanceTime` adds, cannot flip the result.

```tsx
// After src/components/navigation/__tests__/Menu.hover.test.tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from '../Menu';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

/** A click-opened File menu with an "Open recent" submenu. */
function FileMenu() {
  return (
    <Menu>
      <Menu.Trigger>
        <button type="button">File</button>
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item>New</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Open recent</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item>report.docx</Menu.Item>
          </Menu.Popover>
        </Menu>
      </Menu.Popover>
    </Menu>
  );
}

it('opens a submenu openDelay after its item is hovered, without taking focus', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<FileMenu />);
  await user.click(screen.getByRole('button', { name: 'File' }));
  const item = screen.getByRole('menuitem', { name: 'Open recent' });
  await user.hover(item);
  expect(item).toHaveFocus(); // focus follows the mouse inside the menu, not into the submenu
  act(() => {
    vi.advanceTimersByTime(150);
  });
  expect(screen.queryByRole('menu', { name: 'Open recent' })).not.toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(screen.getByRole('menu', { name: 'Open recent' })).toBeInTheDocument();
  expect(item).toHaveFocus();
});
```

- Focus follows the mouse inside a focused menu tree: a test that hovers an item and then presses Enter activates the hovered item. Hover into a menu that focus is not in moves no focus; test both.
- The "dismissed stays dismissed" rule needs the pointer on the trigger at the dismissal: hover, press Escape, move within the trigger past `openDelay` (nothing opens), then `unhover` and hover again (it opens).
- A close by hover moves no focus: open a menu or hover card by hover with nothing focused, `unhover` past `closeDelay`, and assert `expect(document.body).toHaveFocus()` (a Tooltip on the trigger, with `openDelay={0}`, must stay hidden too). Also test that the other closes still return focus: Escape on the same hover-opened surface focuses the trigger.

## 8. Development warnings

Warnings go through `src/lib/dev.ts` as `console.warn('[WaveUI] …')` and are deduplicated per test (the registry is reset after every test). A test that spies on `console.warn` or `console.error` asserts the message(s) it provokes and that nothing else was logged (the exact call count or call list), never only silences them, and restores the spy:

```tsx
// src/components/input/__tests__/Switch.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../Switch';

it('still calls the deprecated onChange and warns once', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const onChange = vi.fn();
  const user = userEvent.setup();
  try {
    render(<Switch label="Wi-Fi" onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Wi-Fi' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[WaveUI] Switch: `onChange` is deprecated');
  } finally {
    warn.mockRestore();
  }
});
```

Assert the exact messages (`expect(warn.mock.calls).toEqual([[message]])`), not a filtered subset: a filter hides a second, unexpected warning. A file whose tests provoke warnings in many places can keep one silenced spy for the whole file, provided nothing goes unasserted: a `takeWarnings()` helper returns the calls so far and clears them, each test asserts what it took, and an `afterEach` asserts, inside `try`/`finally`, that the spy was not called since (see `src/hooks/__tests__/useControllable.test.ts`). Otherwise restore spies in an `afterEach` (`vi.restoreAllMocks()`), so a test that fails midway does not leave its spy on. A spy that only asserts "not called" does not silence. Throw tests use [`expectThrows`](#expectthrowsui-message).

### Production mode

A compound part outside its root throws in development and logs its `console.error` once per message in production (`reportMissingContext`). It reads `process.env.NODE_ENV` when it is called, so a module mock of `isDev` does not reach it: stub the environment with `vi.stubEnv('NODE_ENV', 'production')` and undo it with `vi.unstubAllEnvs()` in `afterEach`, then render the part several times and assert the exact `console.error` calls. The dev helpers' own tests stub a missing `process` with `vi.stubGlobal('process', undefined)` and restore it with `vi.unstubAllGlobals()`.

```tsx
// src/components/layout/__tests__/TabList.test.tsx
import { render } from '@testing-library/react';
import { TabList } from '../TabList';

afterEach(() => {
  vi.unstubAllEnvs();
});

it('logs a part outside a TabList once in production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const orphan = <TabList.Tab value="a">Orphan</TabList.Tab>;
  const { rerender } = render(orphan);
  rerender(orphan);
  expect(error.mock.calls).toEqual([['[WaveUI] TabList.Tab must be used within <TabList>']]);
});
```

## 9. Keep the output clean

A passing test prints nothing, the stories gate (`src/__tests__/stories.a11y.test.tsx`) included. Check with `--reporter=default`, and fix the cause of anything printed:

- **act() warnings**: a bare `element.focus()` or `form.checkValidity()` that makes a component update state belongs in `act(() => …)`, or use `userEvent` (`await user.tab()`, `await user.click(…)`). Timer advances go in `act()` too.
- **Unasserted `[WaveUI]` warnings**: spy on `console.warn` and assert the message (section 8), or change the test so it no longer provokes the warning.
- **React DOM warnings**: keep elements that exist only for a type test (`// @ts-expect-error` props) out of the rendered tree.

## 10. Writing good assertions

- Query by role and accessible name (`getByRole('switch', { name: 'Wi-Fi' })`), and relationships (`toHaveAccessibleDescription`, `toHaveAttribute('aria-controls', …)`), not by class or DOM structure.
- No presence-only variant tests (`toBeInTheDocument()` as the only assertion); assert the observable difference (a class, an attribute, a state).
- No hex-color class assertions; components use tokens (`toHaveClass('bg-primary')` when a class is the contract).
- Never write expectations against a literal React id: ids from `useId` are opaque.
- Popups: open-state axe, dismissal (Escape, outside press) and focus-return tests. Portaled content is not in `container`: query it with `screen`.
- A click on a link inside a `<label>` (a rich Checkbox, Switch or Radio `label`): user-event forwards every click inside a label to the label's control, which browsers do not do for interactive content. Test "clicking the link does not toggle" with `fireEvent.click(link)` (jsdom's own label activation skips interactive descendants, as browsers do) and say why in a comment; click the label text with `userEvent`.
- Shift+Tab from the browser's own controls (the Popover and TeachingPopover keyboard order): dispatch the window's `blur` and `focus` events before focusing the element (`window.dispatchEvent(new FocusEvent('blur'))`, then `'focus'`); a focus from nothing without that window focus counts as a focus restore in the page and keeps the order after the trigger.
- **Context menus** (`openOnContext`). A pointer gesture is `fireEvent.contextMenu(el, { button: 2, clientX, clientY })`, and a macOS Ctrl+click `{ button: 0, ctrlKey: true, clientX, clientY }`; `fireEvent` returns `false` when the component prevented the browser's menu, so assert it (`true` in a text field of the region). A keyboard gesture is the key press on the focused element (`await user.keyboard('{Shift>}{F10}{/Shift}')` or `'{ContextMenu}'`), optionally followed by the `fireEvent.contextMenu(el, { button: 0 })` the browser dispatches for it, which must not move the menu. A position needs a viewport and rectangles: set `clientWidth`/`clientHeight` on `document.documentElement` (remove them after the test) and give the row a box with `mockRect`, then assert the surface's `transform` inside `waitFor`. A second right click while the menu is open, as Chromium and Firefox report it, is `fireEvent.pointerDown(row, { button: 2, … })`, the row's focus (`act(() => row.focus())`, then `await act(async () => {})`) and `fireEvent.contextMenu(row, …)`: the menu must move without an `onOpenChange` call. A scroll closes a pointer-opened surface when it moves the region or the row under the pointer: give both a box with `mockRect`, change one, and `fireEvent.scroll` an element outside the surface.
- **Link navigation** (`Menu.ItemLink`). jsdom logs "Not implemented: navigation" for a followed `href` other than a hash. Use hash hrefs (`#settings`) where the case allows; otherwise add a bubble-phase `click` listener on `document` (it runs after React's root listener) that records `event.defaultPrevented` and then calls `preventDefault()` itself, and remove it with `onTestFinished`. A capture listener would run before React and see nothing. user-event's Enter on a focused `<a href>` dispatches the click, as a browser does; `fireEvent.keyDown` does not.
- **What jsdom cannot show.** jsdom has no `inert` behaviour (an inert element still takes focus, and React's post-commit focus restore can land in it), no `getAnimations`, no `:has()` layout, no hit testing, no real transition timing, and it cannot tell how an engine dispatches the keyboard `contextmenu`. Assert attributes, classes and the events the component handles; a test that depends on browser `inert` semantics can model them (the local `focusSkipsInert()` of `Menu.contextMenu.test.tsx` spies on `HTMLElement.prototype.focus` to skip elements inside `[inert]`). The rest is the real-browser checklist of the phase spec (Storybook in Chrome, Firefox and Safari).
- Type-level contracts go in `__tests__` too; `tsconfig.dev.json` type-checks them:

```tsx
// src/components/button/__tests__/Button.test.tsx
import { expectTypeOf } from 'vitest';
import type { ButtonProps } from '../Button';

it('types anchor props when rendered as a link', () => {
  expectTypeOf<ButtonProps<'a'>['href']>().toEqualTypeOf<string | undefined>();
  // @ts-expect-error formAction is a button-only attribute
  const invalid: ButtonProps<'a'> = { as: 'a', formAction: '/save' };
  expect(invalid.as).toBe('a');
});
```

## 11. Repo-level suites

- `src/__tests__/conventions.test.ts` — the conventions gate: one test per source file of `src/components` (raw colors also in `stories/`), reporting `file:line [rule]` for raw colors, physical utilities, `translate-x` without a `wave-rtl:` counterpart, Tailwind's bare `rtl:`/`ltr:` variants (use `wave-rtl:`), `focus:outline-none`, arbitrary animations, `forwardRef`, `enabled:` variants, `<button>` without `type`, and transitions or animations without a `motion-reduce:` variant. `src/hooks` and `src/lib` are not scanned. Filter with `-t "<path>"`.
- `src/__tests__/stories.a11y.test.tsx` — renders every story with the Storybook preview (WaveProvider, light theme) and audits it with the shared axe instance. Opt-out only with `parameters: { a11y: { test: 'todo' } }` and a comment explaining why.
- `src/__tests__/integration.test.tsx` — compositions across components with the real public API (Menu + MenuButton/SplitButton, Tooltip on triggers, Field around every control, toasts over modals, pickers inside dialogs, stacked dialogs with `autoFocus`, Tab from a shown Tooltip or open InfoLabel inside a dialog's focus trap, a Popover inside a `Menu.Item`), and the Server Component regression suite (see [`asClientReference`](#asclientreferencepart-parts-written-in-a-server-component)). When a release is built in parallel work packages with disjoint files (see `docs/ROADMAP.md`, "Process per release"), a component's own tests use only the shared foundation and its own files: a stand-in with the same attributes (`renderWithFieldContext` for a Field state, a plain `<button aria-disabled="true">` for a focusable disabled button inside `Menu.Trigger`). Every case that needs the real components of two packages at once goes here, once both have landed: in 0.6, a Toolbar with a `disabledFocusable` Button and its Tooltip, `Menu.Trigger` around a `disabledFocusable` MenuButton and SplitButton, a Field warning around Input, Checkbox, Combobox, ColorPicker and a native `<input>`, ProgressBar in a Field, an alert Dialog with a Toaster, a long form with a sticky `Dialog.Footer`, and a SpinButton in a Dialog and in a Drawer whose typed value a backdrop press commits (the component files keep the same mechanism with a plain `<input onBlur>`). In 0.7 the Menu item kinds were tested through the harness of section 5, and the integration suite holds the real popup menus: checkable items in a submenu sharing the root's `checkedValues`, links closing the chain, a context menu with checkable items and a submenu, a Toolbar with a radio group, an Input, a Combobox and a MenuButton, a Popover or Dialog opened from a menu item (a root menu of its own), an exiting `Menu.Popover` inside a Dialog, and a hover-opened submenu inside a click-opened root.
- `src/__tests__/public-types.test.ts` — every named type that a public declaration refers to (a prop type, an `extends` base, a parameter or return type) is exported from `src/index.ts`. Export a new component's prop types from the entry; only the structural helpers in its `INTERNAL_HELPERS` list may stay internal, and that list must stay current.
- `src/__tests__/test-utils.test.tsx` — tests of the helpers themselves.
- `src/styles/__tests__/tokens.test.ts` — every theme declares every token, and every contrast pair meets its WCAG threshold (unrounded); it also pins `base.css` and the style entries and tests `scripts/build-css.mjs`. It runs in the node environment (`// @vitest-environment node`): it needs no DOM, and under jsdom Vite's client transform could not load the gate scripts.

## 12. What to avoid

- **Snapshot tests**: brittle for a UI library, high maintenance cost, low signal.
- **Testing implementation details**: prefer roles, names and user-visible behaviour over internal state or DOM structure.
- **Over-mocking**: render the real components; mock only browser APIs jsdom lacks (`installResizeObserverMock`, `mockMatchMedia`, `mockRect`).
- **Hard-coded test counts** in docs: they go stale with every added test.
