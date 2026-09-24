# Testing WaveUI Components

How tests are written in this repository, with the helpers of `src/test-utils.ts` and `src/test-utils-field.tsx`.

> **Source of truth.** The JSDoc of `src/test-utils.ts` defines the helper signatures and defaults; where this guide and the JSDoc disagree, the JSDoc wins. Earlier versions of this file were pre-0.4 research (an analysis of Mantine's test utilities) that proposed helpers with different signatures. Those proposals led to the helpers below, but do not follow the old examples.

## 1. Stack and commands

Vitest 4, React Testing Library, `@testing-library/user-event`, jsdom and vitest-axe. Tests live in `__tests__/` next to the module they test (`src/components/input/__tests__/Switch.test.tsx`) and import it from its module path (`../Switch`); repo-level suites live in `src/__tests__/`.

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

- jest-dom matchers and vitest-axe's `toHaveNoViolations`.
- `Element.prototype.scrollIntoView` is a `vi.fn()` when jsdom lacks it (calls cleared after every test).
- `window.matchMedia` answers `false` for every query when jsdom lacks it; `mockMatchMedia()` changes the answers.
- **No global `ResizeObserver`**, as in a consumer's jsdom; call `installResizeObserverMock()` when a test needs one.
- After every test: RTL `cleanup()`, the warn-once registry is reset (so every test sees first-time development warnings), the `mockMatchMedia` answers are reset, and then the **body-cleanup assertion**: if `document.body` still has children (a leaked portal, live region or toast, or a node the test appended itself), they are removed and **the test fails** naming them. Tests that append nodes themselves remove them in their own `afterEach` (it runs first).

`vi.mock()` works as usual. Do not call `vi.resetModules()` at the top of a test file: importing `src/test-utils.ts` afterwards would evaluate the setup a second time.

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

- One shared axe instance, `axe` from `src/test-utils.ts`: `configureAxe({ rules: { region: { enabled: false } } })`. Components are audited in isolation, so the page-level landmark rule `region` is off; every other rule runs. The stories gate uses the same instance.
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

jsdom cannot compute color contrast: contrast is asserted per theme by `src/styles/__tests__/tokens.test.ts`, and component colors stay on those token pairs by using theme tokens only.

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

Renders the control inside a `FieldContext` provider with a real `<label>`, hint and error, the way `Field` does, so a control's Field integration is tested without depending on `Field` itself. `FIELD_TEST_IDS` and `FIELD_TEST_TEXT` hold the default ids and texts; `value` is a partial `FieldContextValue` (`hintId`, `errorId`, `required`, `invalid`, …).

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
```

The real `Field` around every control is covered by `src/__tests__/integration.test.tsx`.

### Browser API mocks

- `installResizeObserverMock()` installs a controllable `ResizeObserver` and returns `{ trigger(target?), restore() }`; `trigger` calls the observers inside `act()`.
- `mockRect(el, { x, y, width, height })` gives an element a layout box (`getBoundingClientRect`, `offsetWidth`/`clientWidth`, `offsetHeight`/`clientHeight`); stub `scrollWidth`/`scrollHeight` yourself to simulate overflowing content.
- `mockMatchMedia({ query: boolean })` answers `matchMedia` queries and notifies mounted listeners. The answers last one test: call it in the test or in `beforeEach`, never in `beforeAll`.

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

describe('Tooltip delay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the visual surface after the delay', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Tooltip content="Save changes" delay={300}>
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
- `queueMicrotask` stays real (never add it to `toFake`). Focus moves that run in a microtask (a removed toast moving focus on) are asserted after `await act(async () => {})` or a `userEvent` action.
- Switch back to real timers (or keep `shouldAdvanceTime`) before an axe audit.

## 8. Development warnings

Warnings go through `src/lib/dev.ts` as `console.warn('[WaveUI] …')` and are deduplicated per test (the registry is reset after every test). Assert the ones a test provokes, and restore the spy:

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

## 9. Keep the output clean

A passing test prints nothing, apart from two harmless jsdom notices that axe-core audits trigger: `Not implemented: HTMLCanvasElement's getContext()` (its color checks) and `Not implemented: Window's getComputedStyle() method: with pseudo-elements`. Component test files with audits print some of them, and the stories gate (`src/__tests__/stories.a11y.test.tsx`), which audits every story, prints hundreds. Check with `--reporter=default`, and fix the cause of anything else:

- **act() warnings**: a bare `element.focus()` or `form.checkValidity()` that makes a component update state belongs in `act(() => …)`, or use `userEvent` (`await user.tab()`, `await user.click(…)`). Timer advances go in `act()` too.
- **Unasserted `[WaveUI]` warnings**: spy on `console.warn` and assert the message (section 8), or change the test so it no longer provokes the warning.
- **React DOM warnings**: keep elements that exist only for a type test (`// @ts-expect-error` props) out of the rendered tree.

## 10. Writing good assertions

- Query by role and accessible name (`getByRole('switch', { name: 'Wi-Fi' })`), and relationships (`toHaveAccessibleDescription`, `toHaveAttribute('aria-controls', …)`), not by class or DOM structure.
- No presence-only variant tests (`toBeInTheDocument()` as the only assertion); assert the observable difference (a class, an attribute, a state).
- No hex-color class assertions; components use tokens (`toHaveClass('bg-primary')` when a class is the contract).
- Never write expectations against a literal React id: ids from `useId` are opaque.
- Popups: open-state axe, dismissal (Escape, outside press) and focus-return tests. Portaled content is not in `container`: query it with `screen`.
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

- `src/__tests__/conventions.test.ts` — the conventions gate: one test per source file of `src/components` (raw colors also in `stories/`), reporting `file:line [rule]` for raw colors, physical utilities, unmirrored `translate-x`, `focus:outline-none`, arbitrary animations, `forwardRef`, `enabled:` variants, `<button>` without `type`, and transitions or animations without a `motion-reduce:` variant. Filter with `-t "<path>"`.
- `src/__tests__/stories.a11y.test.tsx` — renders every story with the Storybook preview (WaveProvider, light theme) and audits it with the shared axe instance. Opt-out only with `parameters: { a11y: { test: 'todo' } }` and a comment explaining why.
- `src/__tests__/integration.test.tsx` — compositions across components with the real public API (Menu + MenuButton/SplitButton, Tooltip on triggers, Field around every control, toasts over modals, pickers inside dialogs).
- `src/__tests__/test-utils.test.tsx` — tests of the helpers themselves.
- `src/styles/__tests__/tokens.test.ts` — every theme declares every token, and every contrast pair meets its WCAG threshold (unrounded).

## 12. What to avoid

- **Snapshot tests**: brittle for a UI library, high maintenance cost, low signal.
- **Testing implementation details**: prefer roles, names and user-visible behaviour over internal state or DOM structure.
- **Over-mocking**: render the real components; mock only browser APIs jsdom lacks (`installResizeObserverMock`, `mockMatchMedia`, `mockRect`).
- **Hard-coded test counts** in docs: they go stale with every added test.
