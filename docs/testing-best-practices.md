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
- `testClassName(Component, props?, options?)` — every default class survives a consumer `className`; with `conflictingClass`, the consumer class wins and the default is gone; and, for a component with a stable class-name constant, the element that received the consumer class also carries the component's root class and the base classes of a variant (a ToggleButton: `wave-button` and `wave-toggle-button`). The last case is registered only when `getStableClassNames(displayName)` finds a constant (see [Stable class names](#stable-class-names-getstableclassnamesdisplayname)), and it looks the element up by the consumer class, so a component whose `className` lands on a wrapper or a portaled element (`RadioGroup.Item`'s label, a Dialog surface) needs no config change.
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

Color contrast is asserted per theme by `src/styles/__tests__/tokens.test.ts` instead (the pairs are listed in `tokensHarness.ts`: [Tokens: the contrast matrix and brand seeds](#tokens-the-contrast-matrix-and-brand-seeds)), and component colors stay on those token pairs by using theme tokens only.

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

### `renderWithProviders(ui, { theme?, dir?, inputDefaults?, motion?, ...renderOptions })`

Renders inside `<WaveProvider theme dir inputDefaults motion>` (a `wrapper` option goes inside the provider; `rerender` keeps the providers). `inputDefaults` (`{ size?, appearance? }`) is the provider's default for the text controls and pickers; `motion: 'none'` turns every default motion below it off (see [Motion](#motion-recipes-slots-and-the-provider)). Every directional component has at least one RTL test:

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

#### Resolution-order tests (size and appearance)

A text control or picker resolves `size` as its own prop, then the Field's `size`, then `WaveProvider inputDefaults.size`, then `medium`, and `appearance` as its own prop, then `inputDefaults.appearance`, then `outline` (`useInputLook`). Test each link with the helper that supplies it, and assert the resolved value through the always-rendered `data-size` and `data-appearance`, with a class check for the look:

- The Field link: `renderWithFieldContext(<Input />, { size: 'large' })`, then `rerender(<Input size="small" />)` and assert that the own prop wins. The context's `size` is the Field's own prop; leave it out to test the fall-through.
- The provider link: `renderWithProviders(<Input aria-label="Name" />, { inputDefaults: { size: 'small', appearance: 'underline' } })`, then `rerender` with own props.
- A control with a smaller union (TagPicker has no `small`) skips a Field or provider size outside it: assert the fallback `medium`.
- The order between the Field and the provider needs the real `Field` inside a `WaveProvider`, so it belongs in `src/__tests__/integration.test.tsx` (a Field without `size` shows the provider's size; a Field `size` wins; a nested provider merges its keys over the enclosing one).
- Choice controls (Checkbox, Switch, Slider) read neither source: test that a Field `size` or `inputDefaults` leaves them at their own default.

```tsx
it('takes the Field size; its own size wins', () => {
  const { rerender } = renderWithFieldContext(<Input />, { size: 'large' });
  expect(screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label })).toHaveAttribute('data-size', 'large');
  rerender(<Input size="small" />);
  expect(screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label })).toHaveAttribute('data-size', 'small');
});
```

### `mockAnimations(options?)`: presence phases

jsdom has no `Element.prototype.getAnimations`, so an element that mounts through the presence core (`usePresence`, `Presence`, and every overlay and disclosure with motion, which is all of them but the listbox popups of Combobox, Dropdown, TagPicker and TimePicker, the DatePicker calendar and the AvatarGroup popover: see [Motion](#motion-recipes-slots-and-the-provider) for where each one's presence element is) ends its `entering` and `exiting` phases at once there, as it does in a browser without motion. `mockAnimations()` installs `getAnimations` for the current test: an element that carries `data-test-motion` and whose `data-presence` is `entering` or `exiting` reports one running animation, so the phase waits until `finishAll()` (or `cancelAll()`, a cancelled animation, which also ends it). Call it in the test or in a `beforeEach` (it restores the previous `getAnimations` through `onTestFinished`, which a `beforeAll` cannot use), and call `finishAll`/`cancelAll` inside `act`. `animated: (el) => boolean` replaces the default predicate.

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

### Motion: recipes, slots and the provider

Since 0.15 the overlays and disclosures have a default motion, except the listbox popups of Combobox, Dropdown, TagPicker and TimePicker, the DatePicker calendar and the AvatarGroup popover ([ROADMAP §8.5](ROADMAP.md#85-follow-ups-outside-the-gap-list)): class strings from `src/lib/motion.ts` on its `data-presence` phases. Vitest loads no CSS, so in jsdom every phase still ends at once unless `mockAnimations` holds it; the tests assert classes, attributes and focus, and the motion itself is a real-browser check (the phase spec's §14).

- **The presence element.** `mockAnimations({ animated })` must accept the element the core waits for: the surface for a Dialog (`(el) => el.getAttribute('role') === 'dialog'`), a menu, a popover, the InfoButton note, the Tooltip surface and the TeachingPopover surface; the panel of an overlay Drawer or NavDrawer; the collapse element of Accordion, Tree, Nav and an inline drawer, by its class constant (`(el) => el.classList.contains(accordionPanelClassNames.collapse)`, `treeItemClassNames.collapse`, `navCategoryClassNames.collapse`, `drawerClassNames.collapse`); the toast container (`(el) => el.hasAttribute('data-wave-toast')`); a MessageBarGroup bar's element (`messageBarGroupClassNames.item`). A `data-test-motion` attribute works where it lands on that element (`Menu.Popover`, `Dialog.Content`), not on an inline drawer's `<aside>`, whose collapse element is the presence element (unless a 0.14 `className` with `data-[presence=…]` classes moves it back to the `<aside>`).
- **Recipes.** Import the recipe constants from `src/lib/motion.ts` (internal, so only tests and components do) and assert them with `motionClasses(recipe)`, which splits a class string into its words: `expect(surface).toHaveClass(...motionClasses(popupMotion))`. Never copy a recipe's classes into a test.
- **The slot table**, for every motion prop, on the element the recipe animates: unset → every word of the recipe; `null` → no word of it, and `data-presence` still rendered; `'my-motion'` and `{ className: 'my-motion' }` → `my-motion` and no word of the recipe; `renderWithProviders(ui, { motion: 'none' })` → no word of the recipe, and with the part's own `motion="my-motion"` → `my-motion`. (`my-motion` is a test class; tests are no CSS source.)
- **The presence pair:** with `mockAnimations` holding the phase, a close keeps the element, `data-presence="exiting"`, `inert` (on it or its presence ancestor) and its layers, trap and focus already released; `await act(async () => { await motion.finishAll(); })` removes it. With `mockMatchMedia({ '(prefers-reduced-motion: reduce)': true })` too, the same close removes it in the same `act`. Test reduced motion both ways.
- **`inert` in jsdom.** Testing Library's role queries read `hidden`, `aria-hidden` and the computed display, not `inert`, so `queryByRole('dialog')` still finds an exiting surface: assert `el.closest('[inert]')` (the presence element or its ancestor), and find a kept element with `{ hidden: true }`. jsdom also focuses elements inside `inert`, and after a commit React DOM focuses again the element that had focus before it when that element is still in the document, which an exiting surface is: that restore can undo a focus move out of the surface, or hide a missing one. Call `honourInert()` (`src/test-utils.ts`) at the start of a focus test of an exiting surface: it makes `focus()` skip `inert` elements, as a browser does, for that test, so a test that expects focus out of a closing surface fails when the component does not move it. Check such a test by mutation once: remove the focus move and see it fail.
- **Collapse elements.** The part (the `role="region"`, the `role="group"`, the `<ul>`, the `<aside>`) is the collapse element's only child: an assertion that walks `parentElement` or `nextElementSibling` across it goes one level deeper, or better, finds it by its class constant. Server HTML of an open part has the element `data-presence="entered"` around exactly one part, and hydrates without warnings.
- **The TabList slide.** The FLIP properties are written in a layout effect and cleared in the next animation frame: stub `requestAnimationFrame` (or use the fake timers) and `mockRect` the tabs, then assert `--wave-tab-indicator-offset` and `--wave-tab-indicator-scale` on the selected tab's `style` after a selection change, and gone after the frame; none on mount, with `motion={null}`, under `motion: 'none'` and under reduced motion.
- **Recipe checks** live in `src/lib/__tests__/motion.test.ts` (`// @vitest-environment node`): every class compiles with `@tailwindcss/node` against the real tokens and variants, the tokens and the same-element reductions, the gated starts, no `transform` transition on a positioned surface, the backdrop durations, and the zero-minimum, aligned grid structures. A new recipe or structure is added to its lists (`GRID_STRUCTURES`, `POSITIONED_RECIPES`, …) with a failing fixture for each new check.

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
- The Dialog's title-actions area reports its width the same way: `mockRect` on `.wave-dialog-content__title-actions`, `trigger(area)`, and the surface's `--wave-dialog-title-end-padding` (see [Tags, drawers and the app shell](#tags-drawers-and-the-app-shell)).
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

### Stable class names: `getStableClassNames(displayName)`

`getStableClassNames(displayName)` (`src/test-utils.ts`) returns `{ constant, root, carries }` for a component with a registry constant, else `undefined`: the constant's name (`toggleButtonClassNames`), its root class and every root class the element must carry, the base classes of a variant included (`VARIANT_BASES`). A display name that differs from its flat name is looked up through `DISPLAY_NAME_ALIASES` (`RadioItem` → `radioGroupItemClassNames`). `testClassName` uses it; assert part classes yourself, reading the constant:

```tsx
// src/components/button/__tests__/stableClassNames.test.tsx
import { render, screen } from '@testing-library/react';
import { ToggleButton } from '../ToggleButton';
import { buttonClassNames, toggleButtonClassNames } from '../../../lib/classNames';

it('puts both icon classes on the icon span', () => {
  render(<ToggleButton icon={<svg />} aria-label="Bold" />);
  const icon = screen.getByRole('button', { name: 'Bold' }).querySelector('span[aria-hidden]');
  expect(icon).toHaveClass(buttonClassNames.icon, toggleButtonClassNames.icon);
});
```

### Toasts

- **Dispatching content.** Render a Toaster and a button that dispatches (`useToastController()` inside it), or a handle from `createToaster()` created in the test (never at module scope of a test file, which would share it between tests). The toast's container is `getByRole('group', { name: 'Success: Email sent' })`; its parts carry their stable classes.
- **Announcements.** The Toaster's two permanent live regions receive each toast's text once: assert that text there (the severity, title, body and action labels, never "Dismiss"), and that an `error` toast lands in the assertive one. Nothing needs a provider.
- **Presence.** A toast's container mounts through the presence core: `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })` keeps a dismissed toast `exiting` (and `inert`) until `motion.finishAll()`, so a test can check that focus moved to the next toast before the exit ends and that the exiting toast no longer counts toward `limit`.
- **The shortcut.** `shortcuts={{ focus: (event) => event.altKey && event.shiftKey && event.code === 'KeyN' }}` and `await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}')` from anywhere in the page; Escape and Delete go to the focused container (`act(() => container.focus())`).
- **Timers.** The fake-timer recipe of section 7. A toast with an action gets no timer unless the dispatch passes `timeout`: assert `vi.getTimerCount()` or that the toast is still there after the default 5 seconds.
- **Server rendering.** A test file with `// @vitest-environment node` can dispatch through a handle created at module scope of the test file (the rule above is about sharing a bound handle between tests; here no Toaster ever binds it, so nothing is shared, and the dispatch returns an id and does nothing) and `renderToString` a page with a bound Toaster (no toast in the HTML).

### ResizeObserver layout: the MessageBar reflow

`layout="auto"` with `MessageBar.Actions` observes the bar and measures it one animation frame after a resize. Install the mock, give the bar and its text column the widths of a real layout (jsdom lays nothing out), report the resize and let the frame land:

```tsx
// src/components/feedback/__tests__/MessageBar.reflow.test.tsx
import { act, render, screen } from '@testing-library/react';
import { Button } from '../../button/Button';
import { MessageBar } from '../MessageBar';
import { messageBarClassNames } from '../../../lib/classNames';
import { installResizeObserverMock, mockRect } from '../../../test-utils';

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

it('switches to the multiline layout while the text overflows', async () => {
  const ro = installResizeObserverMock();
  try {
    render(
      <MessageBar>
        Your session expires in five minutes.
        <MessageBar.Actions>
          <Button>Retry</Button>
        </MessageBar.Actions>
      </MessageBar>,
    );
    const bar = screen.getByRole('status');
    const column = bar.querySelector(`.${messageBarClassNames.body}`) as HTMLElement;
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    mockRect(bar, { width: 400 });
    mockRect(column, { width: 200 });
    Object.defineProperty(column, 'scrollWidth', { configurable: true, value: 350 });
    ro.trigger(bar);
    await act(async () => {
      await nextFrame();
    });
    expect(bar).toHaveAttribute('data-layout', 'multiline');
  } finally {
    ro.restore();
  }
});
```

To prove that a bar observes nothing (`'auto'` without actions, an explicit layout), spy on `ResizeObserver.prototype.observe` after `installResizeObserverMock()` and expect no call; without the mock nothing observes anyway, and the assertion would prove nothing.

### Pointer drags: the color parts

jsdom has no pointer capture. Stub the three methods in a `beforeEach` (and restore them afterwards), give the field a box, and dispatch pointer events with their `pointerType` and `isPrimary`:

```tsx
// src/components/input/__tests__/ColorArea.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { ColorArea } from '../ColorArea';
import { colorAreaClassNames } from '../../../lib/classNames';
import { mockRect } from '../../../test-utils';

const CAPTURE_METHODS = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const;
let saved: Array<[string, PropertyDescriptor | undefined]> = [];

beforeEach(() => {
  const captured = new WeakMap<Element, Set<number>>();
  saved = CAPTURE_METHODS.map((name) => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)]);
  Object.defineProperties(Element.prototype, {
    setPointerCapture: {
      configurable: true,
      writable: true,
      value(this: Element, pointerId: number) {
        const ids = captured.get(this) ?? new Set<number>();
        ids.add(pointerId);
        captured.set(this, ids);
      },
    },
    releasePointerCapture: {
      configurable: true,
      writable: true,
      value(this: Element, pointerId: number) {
        captured.get(this)?.delete(pointerId);
      },
    },
    hasPointerCapture: {
      configurable: true,
      writable: true,
      value(this: Element, pointerId: number) {
        return captured.get(this)?.has(pointerId) ?? false;
      },
    },
  });
});

afterEach(() => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
    else Reflect.deleteProperty(Element.prototype, name);
  }
});

it('jumps to a touch press', () => {
  const onValueChange = vi.fn();
  render(<ColorArea aria-label="Accent" defaultValue={{ h: 100, s: 0.5, v: 0.5 }} onValueChange={onValueChange} />);
  const area = screen.getByRole('group', { name: 'Accent' });
  mockRect(area.querySelector(`.${colorAreaClassNames.field}`) as Element, {
    left: 0,
    top: 0,
    width: 200,
    height: 100,
  });
  fireEvent.pointerDown(area, {
    pointerId: 1,
    button: 0,
    isPrimary: true,
    pointerType: 'touch',
    clientX: 50,
    clientY: 25,
  });
  expect(onValueChange).toHaveBeenLastCalledWith({ h: 100, s: 0.25, v: 0.75 });
});
```

Test RTL with `renderWithProviders(ui, { dir: 'rtl' })` (the x axis mirrors), and the pointer type with `mockMatchMedia({ '(pointer: coarse)': true })`: on a coarse pointer both inputs stay exposed (without it the mock matches nothing, which is the desktop model the server renders).

### ColorArea: one exposed slider, found by its raw `aria-label`

Where the primary pointer is not coarse, the input without the Tab stop is `aria-hidden`. Testing Library computes the accessible name of a self-`aria-hidden` element as `''` even with `hidden: true` (the name computation never sees that option, which only lifts the later accessibility-tree filter), so a string `name` finds nothing. Match the raw attribute instead; it holds the same text while the input is exposed:

```tsx
// src/components/input/__tests__/ColorArea.test.tsx
const sliderNamed = (label: string) =>
  screen.getByRole('slider', {
    hidden: true,
    name: (_accessibleName, element) => element.getAttribute('aria-label') === label,
  });
const saturationInput = () => sliderNamed('Saturation');
const brightnessInput = () => sliderNamed('Brightness');
```

### Strict fake timers and awaited user-event

The toast suites use strict fake timers (`vi.useFakeTimers()` without `shouldAdvanceTime`) to assert exact 1 ms boundaries. Under them an awaited `userEvent` call hangs: Testing Library's async `act` wrapper awaits a `setTimeout(0)` that it advances only for Jest's fake timers, and `userEvent.setup({ delay: null })` does not help. Use `fireEvent` and a synchronous `act(() => el.focus())`. If an awaited `userEvent` call is unavoidable, switch to `vi.useFakeTimers({ shouldAdvanceTime: true })` for that call only, and only when no timer is pending at either switch: calling `vi.useFakeTimers()` again keeps the clock's time but installs a new clock and discards the pending timers.

### Watching a `useSyncExternalStore` store: a pass-through `vi.mock('react')`

To learn which listeners a `useSyncExternalStore` store was given (the MessageBar reflow test asserts that none is notified), wrap the hook in a module mock of `react` that records each listener and otherwise changes nothing:

```tsx
const storeListeners = vi.hoisted(() => [] as Array<ReturnType<typeof vi.fn>>);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const useSyncExternalStore: typeof actual.useSyncExternalStore = (subscribe, ...rest) =>
    actual.useSyncExternalStore(
      (listener) => {
        const spy = vi.fn(listener);
        storeListeners.push(spy);
        return subscribe(spy);
      },
      ...rest,
    );
  return { ...actual, default: { ...actual, useSyncExternalStore }, useSyncExternalStore };
});
```

Keep it a pure pass-through: the mock replaces React for the whole test file.

### Pure models: the tree cascade

The cascade is pure functions: `computeCheckStates` and `toggleCheck` in `src/lib/treeCascade.ts` (since 0.16; `Tree.selection.ts` re-exports them and keeps `collectItems`, which builds the nodes from JSX children), shared by Tree and `useFlatTree`. Test them without rendering: build the node tree (from JSX children with `collectItems`, or as literal `TreeNode`s, as `src/lib/__tests__/treeCascade.test.ts` does), then assert the state map and the emitted arrays (tree order, fully checked parents included, unmatched values kept at the end). `src/lib/flatTree.ts` (the flat index, the visible rows, the forest for the cascade) is tested the same way, with table tests over issues (duplicates, unknown parents, cycles) and a chain thousands of levels deep, since every walk there is iterative. Render only for what the model cannot show: the attributes, the keys and the callback.

### Tokens: the contrast matrix and brand seeds

The token tests read `src/styles/tokens.css` as text, since jsdom has no cascade, through `src/styles/__tests__/tokensHarness.ts` (0.17): `themeDecls(theme)` and `rootConstants()` are the declarations of a theme group and of the `:root` constants, `resolveToken` follows a token's `var()` chain through a list of scopes, `resolved(theme, token)` does it for the file's own values, and `contrastRatio` gives the unrounded WCAG ratio (a 4.499:1 pair fails). The harness also holds the contrast matrix that `tokens.test.ts` asserts in all three themes: `CONTRAST_PAIRS` (`[foreground, background, threshold]`: 4.5 for text, 3 for strokes, focus rings and graphics), the text matrix (each `SURFACE_TEXT_TOKENS` entry on every `TEXT_SURFACES` surface, and `BOUND_TEXT_SURFACES` for text bound to its own fill or tint) and `NOT_TEXT_TOKENS` (color tokens that are never text, each with its reason).

- **Adding a color token.** Declare it in every theme group of `tokens.css` and map it in `@theme inline`, add its light, dark and high-contrast values to `TOKENS` in `tokens.test.ts`, and classify it in the harness: a text token in `SURFACE_TEXT_TOKENS` or `BOUND_TEXT_SURFACES` (with the surfaces it sits on), a surface in `TEXT_SURFACES` or as the bound surface of its text, a stroke or graphic in `NOT_TEXT_TOKENS` with its reason and a 3:1 row in `CONTRAST_PAIRS`. `tokens.test.ts` fails on a declaration of a theme group that `TOKENS` lacks (the shadows aside) and on a token of `TOKENS` that no list classifies, so a new token cannot skip the matrix. Add the name to `WAVE_TOKEN_NAMES` in `src/lib/waveTokens.ts` too: the parity test of `src/lib/__tests__/waveTokens.test.ts` fails on any `--wave-*` variable the tuple lacks.
- **Running the matrix on other values.** `forEachContrastPair(theme, scopes, callback)` walks a theme's whole matrix, every `CONTRAST_PAIRS` row and then every text token on each of its surfaces at 4.5:1, resolving each token in the theme group and then in `scopes`, and calls `callback` with the resolved colors and the ratio. `[rootConstants()]` gives the file's own values; other constants run the same pairs on other values.
- **A brand-seed test.** `tokens.brand.test.ts` merges a seed's ramp (`createBrandTokens(seed)`, each `brandN` written as `--wave-brand-N`) over `rootConstants()` and asserts that no pair of the light and dark matrix falls below its threshold, and that every high-contrast token resolves unchanged. To cover a new kind of seed, add it to `BRAND_SEEDS` in the harness: that runs it through the whole matrix there and through `src/lib/__tests__/brand.test.ts` (each stop at the default ramp's luminance, in order, rounded on its safe side). The sweep over many more seeds checks only the pairs that read a brand stop: `brandPairs()` finds them by resolving the matrix with a marker color per stop (`brandMarker`), which no token resolves to. `brand.test.ts` derives `ROUNDS_DARKER` from the same pairs and checks `BRAND_CONTRAST_PAIRS` against `tokens.css`, so a theme token that starts reading another stop fails there until `src/lib/brand.ts` follows.

### Active-descendant widgets: `aria-activedescendant` and `data-active`

Listbox, the listbox pickers (Dropdown, Combobox, TagPicker, TimePicker) and composites on `useActiveDescendant` keep DOM focus on one element, the combobox or the list, and point its `aria-activedescendant` at the active option. Assert that reference and the option's `data-active`, never DOM focus on an option: an option never has focus.

```tsx
// src/components/input/__tests__/Listbox.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Listbox } from '../Listbox';
import { Option } from '../Option';

const list = () => screen.getByRole('listbox', { name: 'Fruits' });
const option = (name: string) => screen.getByRole('option', { name });

/** The option the list's `aria-activedescendant` points at. */
const active = () => {
  const id = list().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};

it('has an active option only while focused, and the keys move it', async () => {
  const user = userEvent.setup();
  render(
    <Listbox aria-label="Fruits" defaultValue="banana">
      <Option value="apple">Apple</Option>
      <Option value="banana">Banana</Option>
      <Option value="cherry">Cherry</Option>
    </Listbox>,
  );
  expect(active()).toBeNull();
  await user.tab();
  expect(active()).toHaveTextContent('Banana');
  expect(option('Banana')).toHaveAttribute('data-active');
  await user.keyboard('{ArrowDown}');
  expect(active()).toHaveTextContent('Cherry');
  expect(option('Banana')).not.toHaveAttribute('data-active');
  expect(list()).toHaveFocus();
});
```

- **Resolve the reference.** Read `aria-activedescendant` and look the element up (`document.getElementById`), then assert it by its text, or compare it with `option(name).id`. Option ids are generated (`useId`): never write a literal one. A closed popup and an unfocused list carry none (`not.toHaveAttribute('aria-activedescendant')`).
- **Focus stays put.** After the keys, assert `toHaveFocus()` on the combobox or the list, never on the option.
- **Pointer moves.** `user.hover(option)` or `fireEvent.pointerMove(option)` makes the option active without scrolling the list; a keyboard move scrolls it into view (`{ block: 'nearest' }`). To assert scrolling, spy on `Element.prototype.scrollIntoView`: in a suite whose `afterEach` calls `vi.restoreAllMocks()`, `vi.spyOn(Element.prototype, 'scrollIntoView')` is enough (`Listbox.test.tsx`); otherwise replace the method with a spy and put the original back in `finally`, as the hook tests do (`useActiveDescendant.test.tsx`, `useListbox.test.tsx`). `src/test-setup.ts` installs its `vi.fn()` stub only where jsdom has none.
- **Callbacks.** `onActiveOptionChange` (and the hooks' `onActiveValueChange`) report every change after the commit, `null` included when the list closes or loses focus: assert the whole sequence (`expect(onActiveOptionChange.mock.calls).toEqual([['apple'], ['cherry'], [null]])`), and once per change in StrictMode.
- **The hook alone.** `useActiveDescendant.test.tsx` renders a probe component that hands the hook's result out through `useImperativeHandle` (`resultRef`) and calls its methods in `act()`, as `useListbox.test.tsx`'s `Picker` does.
- **Server HTML.** A closed picker or an unfocused Listbox renders no `aria-activedescendant`; `findDanglingIdRefsInHtml(renderToString(…))` fails on one that points at no element.

### Windowed components: a window without layout

DataGrid, List, Listbox, Combobox, Dropdown and FlatTree with a `virtualWindow` render the items of `useVirtualWindow`'s `layout`, which jsdom cannot drive by itself: it has no layout, so every `clientHeight` and `scrollHeight` is 0 (the window then lays out its `initialViewportSize`, 480 pixels), and the window reads a scroll in an animation frame. The suites (`DataGrid.virtual.test.tsx`, `List.virtual.test.tsx`, `FlatTree.virtual.test.tsx`, the three `*.data.test.tsx` picker suites on `src/components/input/__tests__/windowHarness.tsx`, `useVirtualWindow.test.tsx`) stub the scroller and run the frames by hand:

```tsx
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
const isScroller = (el: Element) => el.classList.contains(dataGridClassNames.container);

beforeEach(() => {
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return isScroller(this) ? 480 : 0;
  });
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    return isScroller(this) ? 44 + 10_000 * 44 : 0; // the header and every row
  });
});
afterEach(() => vi.restoreAllMocks());

/** Runs the frames requested so far (the window reads a scroll in a frame), inside `act`. */
function runFrames() {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  });
}

/** Sets the scroller's `scrollTop`, fires `scroll` and runs the window's frame. */
function scrollTo(scroller: HTMLElement, top: number) {
  act(() => {
    scroller.scrollTop = top;
    fireEvent.scroll(scroller);
  });
  runFrames();
}
```

- **Stub the scroller only.** Match it by its stable class (`dataGridClassNames.container`), its role (`role="listbox"` for the pickers) or the element you render, and return 0 for every other element. A `scrollHeight` that follows the content (the picker harness sums the inline heights of the list's children) bounds `scrollToIndex` as a browser does; without one only the start bounds it.
- **Count the mounted items against the budget** (spec §11 of Phase 11): `rows.length` `toBeLessThanOrEqual(30)` for a DataGrid of 10,000 rows (body rows are `tr[data-row-index]`, spacers `[data-virtual-spacer]`), 30 options for a picker, 40 items for a List or a tree, at the top, in the middle and with a kept item outside the window. Assert the order of items and spacers (`['spacer', ...range(9987, 10001)]`) and that the sizes add up to `count * itemSize`.
- **Never mount all 10,000.** A test that does not need the window still renders few items (the axe cases of the data suites audit `ITEMS.slice(0, 20)`), and a windowed test always passes the window: 10,000 mounted rows make a suite slow and an axe run time out.
- **`keep`.** Scroll a focused item away and back and assert it stays mounted (one extra entry between two spacers) and keeps focus and the Tab stop. To prove what a component does when an adapter ignores `keep`, wrap the real window and drop the option (`useTestWindow({ keep: false })` in the picker harness); to see the scroll requests, wrap `scrollToIndex` with a spy (`onScrollToIndex`) and assert the exact `[index, { align }]` list.
- **Keys to an item that is not rendered** move the window in the key's own update: assert `scrollTop`, the mounted order and focus (or `aria-activedescendant`) right after the key, with no simulated scroll event in between. Keys pressed with `fireEvent` in one task land before the commit; separate them with `await act(async () => {})` or use `userEvent`.
- **Positions:** assert `aria-rowcount`/`aria-rowindex`, `aria-setsize`/`aria-posinset` and `data-row-index`/`data-index` from the data (sorted order, filtered count), never from the DOM position.
- **One render per row boundary.** Count the host's renders across scroll events inside one row (no render) and across a boundary (one), as `useVirtualWindow.test.tsx` does; the stories' readouts ("Mounted rows: N of 10,000") follow the DOM with a `MutationObserver` through `useSyncExternalStore`.
- **Server HTML** of a windowed component holds the first window of the 480-pixel default viewport; render it with `renderToString`, hydrate it in a container you append and remove yourself, and assert that hydration logs nothing.
- **What jsdom cannot show** (row heights, the sticky header, scroll anchoring, blank frames, the timings of §11) belongs to the phase spec's real-browser checklist. jsdom's `scrollIntoView` is the setup's no-op stub: a test of the least scroll a List makes before focusing a rendered target stubs it with a function that sets `scrollTop`.

### Tags, drawers and the app shell

**Focus after a removal.** A TagGroup moves focus when the focused tag unmounts: it records the target in a layout cleanup and moves focus in a microtask (docs/WAVE-UI-GUIDE.md, Pattern 14). Assert after `await act(async () => {})`, and assert both where focus is and that the removed control is gone. A dismissal the test refuses (a controlled parent that keeps the tag) moves no focus.

```tsx
fireEvent.keyDown(dismissButton('Red'), { key: 'Delete' });
await act(async () => {});
expect(dismissButton('Blue')).toHaveFocus();
```

- **Key repeat.** A held key is `fireEvent.keyDown(el, { key: 'Delete', repeat: true })`: it dismisses nothing after the first press (Delete, Backspace and Enter on a Dismiss control). Test the modifiers too (`ctrlKey`, `altKey`, `metaKey`, `shiftKey`, `isComposing`), which leave the key to the browser.
- **A control disabled while focused** (Tag's Dismiss button, InteractionTag's buttons, TagPicker's remove and clear buttons) keeps focus: focus it, `rerender` with `disabled`, assert focus, `aria-disabled="true"` and no native `disabled`, that a click calls nothing, then Tab away (or `act(() => other.focus())`) and assert the native `disabled`.
- **Toolbar × TagGroup.** TagGroup takes Toolbar's arrow-axis rule (`Toolbar.navigation.ts`): one `it.each` over both components, both orientations, both directions and every key (Left, Right, Up, Down, Home, End) from every control, against one `expected(orientation, dir, key, from)` function, keeps them from drifting apart ("one arrow-axis rule with Toolbar" in `TagGroup.test.tsx`).
- **Pointer versus keyboard removals** in a TagPicker: a click on a remove button focuses the input, a keyboard activation the next tag. user-event's `click` has `detail: 1`; a keyboard (or screen-reader) click is `fireEvent.click(button, { detail: 0 })`.
- **The status region after every `act`.** The create option registers in its own commit, so a status that read "No matches" for one render would be announced. Observe the `role="status"` region with a `MutationObserver` and record its text after every `act` (synchronous and `await act(async () => {})`), then assert every recorded text (`TagPicker.freeTagging.test.tsx`).
- **Count mode** (`overflow="count"`) is measured: `installResizeObserverMock()`, give the field and each tag a width with `mockRect` (stub `scrollWidth`/`clientWidth` where the code reads them), `trigger` the observer, then assert `data-collapsed`, the "+N" text and which tags are hidden. Focus inside the picker expands it; the tags are measured by position, so render your own tags in `value` order.
- **Parts-form `testSystemProps`.** A part that needs its root passes a `wrapper` that renders the root around it (`testSystemProps(TagPickerControl, { expectedTag: 'div', displayName: 'TagPickerControl', wrapper: ControlWrapper })`).
- **Backdrops by constant.** The backdrop is the surface's sibling: query it by its constant, ``document.querySelector(`.${dialogContentClassNames.backdrop}`)`` (or `drawerClassNames.backdrop`), never through `surface.parentElement`. A transparent stacked backdrop renders `data-appearance="transparent"`.
- **Drawer scroll state.** jsdom has no layout: stub `scrollHeight`, `clientHeight` and `scrollTop` on the body with `Object.defineProperty` (configurable), then `fireEvent.scroll(body)` inside `act`, and assert `data-scroll-state` on the body, the header and the footer (`Drawer.scroll.test.tsx`'s `stubMetrics`). A sub-pixel overflow (`scrollHeight` 300.6 on 300) is no scroll.
- **Kept-mounted surfaces** (`unmountOnClose={false}`): a closed Dialog or Drawer is `hidden` and `inert`, so query it with `{ hidden: true }`. An `autoFocus` inside a kept surface never applies: don't assert it; assert that each open focuses the first focusable element.
- **`mockAnimations` on a Dialog or Drawer**: put `data-test-motion=""` on `Dialog.Content` (the surface) or on an overlay Drawer (its panel); the surface then stays `exiting` and `inert` until `motion.finishAll()`, while focus is already back on the trigger and the layer gone. `{ hidden: true }` finds it while it exits. An inline drawer's presence element is its collapse element: `mockAnimations({ animated: (el) => el.classList.contains(drawerClassNames.collapse) })`.
- **The title-actions measurement** sits next to the `Dialog.Footer` recipe above: `installResizeObserverMock()`, `mockRect(area, { width: 40, height: 32 })` on `.wave-dialog-content__title-actions`, `trigger(area)`, then read `--wave-dialog-title-end-padding` on the surface (`48px`: the width plus the gap). It is measured only while the dialog is open.
- **An arrow-key NavDrawer body** (`focusMode="arrow"`): the roving stamps (`tabindex`) are written after mount, so assert them after `render` (or after `hydrateRoot` in `act`), never in `renderToString` output; `data-roving-value` is rendered by React, so it is in the server HTML. Switching back to `focusMode="tab"` hands every item its own Tab stop back (assert `tabindex` is gone).
- **Nav lists.** Render only Nav parts or `<li>` elements in a Nav, a category or a NavDrawer body or footer: anything else logs the list-child warning, which a `console.warn` spy must then assert (`Nav.listChild.test.tsx`).
- **The App shell** (`NavDrawer.appShell.test.tsx`) composes the story with `composeStories` from `@storybook/react`. `mockMatchMedia({ '(max-width: 767px)': true })` before `render` gives the narrow layout; to cross the breakpoint in a mounted shell, call `mockMatchMedia` (and later its `restore`) inside `act`, then assert the new `type`, the open states and focus.

### Dates: a fixed clock

The Calendar and DatePicker suites fix the clock with `vi.setSystemTime(NOW)` in a `beforeEach` and undo it with `vi.useRealTimers()` in the `afterEach` (it mocks `Date` without fake timers). They pass `locale="en-US"`, so headings and day names are known, and a fixed `today` where the case is about today (`Calendar` and `DatePicker` take one; a Calendar without it marks no day as today in the server HTML and the hydration render). Compare dates by their local fields (each suite's `fields(date)`, `[year, month, day]`), never by `toISOString()`, so the suites pass in every time zone. The day buttons are named by their full date (`dayButton('Sunday, June 15, 2025')`).

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

### Press-and-hold (SpinButton step buttons)

A hold is timer-driven (a 300 ms first delay, then an easing schedule down to 80 ms), so test it under the fake timers above. Dispatch the pointer events yourself: `fireEvent.pointerDown(button, { button: 0, pointerId: 1, pointerType, isPrimary: true })` (a jsdom `PointerEvent` is not primary by default, and a second finger is not), `act(() => vi.advanceTimersByTime(ms))` to move time, and `pointerUp` followed by `fireEvent.click(button, { detail: 1 })` to end the press as a browser does. Run the hold cases over the three pointer types with `it.each(['mouse', 'touch', 'pen'])`.

```tsx
const press = (target: Element, pointerType = 'mouse') =>
  fireEvent.pointerDown(target, { button: 0, pointerId: 1, pointerType, isPrimary: true });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

it.each(['mouse', 'touch', 'pen'])('a %s press steps only after the first delay', (pointerType) => {
  render(<SpinButton aria-label="Quantity" />);
  press(screen.getByRole('button', { name: 'Increment' }), pointerType);
  advance(250); // 50-100 ms of margin around the 300 ms delay
  expect(screen.getByRole('spinbutton')).toHaveValue('0');
  advance(100);
  expect(screen.getByRole('spinbutton')).toHaveValue('1');
});
```

Cover, besides the schedule: a press released before the delay steps once, on its `click`; `pointercancel`, `pointerleave` of the button and a window blur stop a hold; the `click` that ends a hold adds no step; a `click` with `detail: 0` steps once. The step buttons are named by `labels.increment` and `labels.decrement` ("Increment", "Decrement").

### Pointer positions for half stars

A Rating with `step={0.5}` chooses the half or the whole from where the pointer lands on the star, which jsdom does not lay out. Give the star element a rectangle with `mockRect` after it renders (the star is the parent of its radios), then dispatch the pointer event with `clientX` inside that rectangle and `detail: 1` (a pointer click; `detail: 0` is how a keyboard or screen-reader click arrives, and it must choose the radio's own value instead). `pointerMove` with `pointerType: 'mouse'` drives the hover preview. Mirror the expectation under `renderWithProviders(ui, { dir: 'rtl' })`: the start half is then on the right.

```tsx
const star3 = () => screen.getByRole('radio', { name: '3 stars' }).parentElement as HTMLElement;

it('a click on the first half of a star chooses the half value', () => {
  render(<Rating aria-label="Service" step={0.5} max={5} />);
  mockRect(star3(), { left: 100, right: 124, top: 0, bottom: 24, width: 24, height: 24 });
  fireEvent.click(star3(), { clientX: 104, clientY: 12, detail: 1 });
  expect(screen.getByRole('radio', { name: '2.5 stars' })).toBeChecked();
});
```

### InfoButton's Tab path

The note is portaled but keeps its place in the Tab order after the button, and opening it never moves focus. Test it with `userEvent` (`user.tab()` and `user.tab({ shift: true })`) and a button after it, with a link in `info`: the first `tab` focuses the button, which opens the note (keyboard focus opens it); the second enters the link; `tab({ shift: true })` returns to the button; two `tab`s from the button reach the following button and close the note (flush with `await act(async () => {})` before asserting that it closed, as focus-outside decisions run in a microtask). Also assert that Escape from the link focuses the button and does not reopen the note, and that with `openOnHover={false}` keyboard focus opens nothing.

```tsx
it('Tab enters the note and Shift+Tab returns', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <>
      <InfoButton info={<a href="#rules">Rules</a>} />
      <button type="button">After</button>
    </>,
  );
  await user.tab();
  await user.tab();
  expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Information' })).toHaveFocus();
});
```

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

Assert the exact messages (`expect(warn.mock.calls).toEqual([[message]])`), not a filtered subset (a Nav whose list holds a `<div>` logs the list-child warning, which the spy must assert too): a filter hides a second, unexpected warning. A file whose tests provoke warnings in many places can keep one silenced spy for the whole file, provided nothing goes unasserted: a `takeWarnings()` helper returns the calls so far and clears them, each test asserts what it took, and an `afterEach` asserts, inside `try`/`finally`, that the spy was not called since (see `src/hooks/__tests__/useControllable.test.ts`). Otherwise restore spies in an `afterEach` (`vi.restoreAllMocks()`), so a test that fails midway does not leave its spy on. A spy that only asserts "not called" does not silence. Throw tests use [`expectThrows`](#expectthrowsui-message).

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

- `src/__tests__/conventions.test.ts` — the conventions gate: one test per source file of `src/components` and for `src/lib/motion.ts` (raw colors also in `stories/`), reporting `file:line [rule]` for raw colors, physical utilities, `translate-x` without a `wave-rtl:` counterpart, Tailwind's bare `rtl:`/`ltr:` variants (use `wave-rtl:`), `focus:outline-none`, arbitrary animations, `forwardRef`, `enabled:` variants, `<button>` without `type`, transitions or animations without a `motion-reduce:` variant, a `data-[presence=…]` class outside `src/lib/motion.ts` (`presence-class`), a `starting:` class not gated on `data-[presence=entering]` (`starting-gate`), and a module that sets a registered component's `displayName` without applying its class-name constant's `root` (`class-names`). The rest of `src/hooks` and `src/lib` is not scanned. Filter with `-t "<path>"`.
- `src/__tests__/stories.a11y.test.tsx` — renders every story with the Storybook preview (WaveProvider, light theme) and audits it with the shared axe instance. Opt-out only with `parameters: { a11y: { test: 'todo' } }` and a comment explaining why.
- `src/__tests__/integration.test.tsx` — compositions across components with the real public API (Menu + MenuButton/SplitButton, Tooltip on triggers, Field around every control, toasts over modals, pickers inside dialogs, stacked dialogs with `autoFocus`, Tab from a shown Tooltip or open InfoLabel inside a dialog's focus trap, a Popover inside a `Menu.Item`), and the Server Component regression suite (see [`asClientReference`](#asclientreferencepart-parts-written-in-a-server-component)). When a release is built in parallel work packages with disjoint files (see `docs/ROADMAP.md`, "Process per release"), a component's own tests use only the shared foundation and its own files: a stand-in with the same attributes (`renderWithFieldContext` for a Field state, a plain `<button aria-disabled="true">` for a focusable disabled button inside `Menu.Trigger`). Every case that needs the real components of two packages at once goes here, once both have landed: in 0.6, a Toolbar with a `disabledFocusable` Button and its Tooltip, `Menu.Trigger` around a `disabledFocusable` MenuButton and SplitButton, a Field warning around Input, Checkbox, Combobox, ColorPicker and a native `<input>`, ProgressBar in a Field, an alert Dialog with a Toaster, a long form with a sticky `Dialog.Footer`, and a SpinButton in a Dialog and in a Drawer whose typed value a backdrop press commits (the component files keep the same mechanism with a plain `<input onBlur>`). In 0.7 the Menu item kinds were tested through the harness of section 5, and the integration suite holds the real popup menus: checkable items in a submenu sharing the root's `checkedValues`, links closing the chain, a context menu with checkable items and a submenu, a Toolbar with a radio group, an Input, a Combobox and a MenuButton, a Popover or Dialog opened from a menu item (a root menu of its own), an exiting `Menu.Popover` inside a Dialog, and a hover-opened submenu inside a click-opened root.
- `src/__tests__/public-types.test.ts` — every named type that a public declaration refers to (a prop type, an `extends` base, a parameter or return type) is exported from `src/index.ts`. Export a new component's prop types from the entry; only the structural helpers in its `INTERNAL_HELPERS` list may stay internal, and that list must stay current.
- `src/__tests__/classNames.test.ts` — the class-name registry: every component-like export of the entry (and every compound member) has a constant or is on `NO_ELEMENT`; every constant follows the formula (`wave-<kebab name>`, `__<kebab part>`, no repeated string, no reserved scope class); every export is exported by the entry with the same value; the registry imports nothing; every value is applied as `<constant>.<key>` in some module of `src/components`, except the entries of `PENDING_CLASS_NAMES`, which a phase fills for the parts its parallel packages add and INTEGRATION empties. `public-types.test.ts` has the same kind of bridge, `PENDING_PUBLIC_TYPES`, for public types that become reachable before the barrels export them.
- `src/__tests__/test-utils.test.tsx` — tests of the helpers themselves.
- `src/styles/__tests__/tokens.test.ts` — every theme declares every token, and every contrast pair of the matrix in `tokensHarness.ts` meets its WCAG threshold (unrounded; see [Tokens: the contrast matrix and brand seeds](#tokens-the-contrast-matrix-and-brand-seeds), with `tokens.brand.test.ts` for generated brand ramps); it also pins `base.css` and the style entries and tests `scripts/build-css.mjs`. It runs in the node environment (`// @vitest-environment node`): it needs no DOM, and under jsdom Vite's client transform could not load the gate scripts.

## 12. What to avoid

- **Snapshot tests**: brittle for a UI library, high maintenance cost, low signal.
- **Testing implementation details**: prefer roles, names and user-visible behaviour over internal state or DOM structure.
- **Over-mocking**: render the real components; mock only browser APIs jsdom lacks (`installResizeObserverMock`, `mockMatchMedia`, `mockRect`).
- **Hard-coded test counts** in docs: they go stale with every added test.
