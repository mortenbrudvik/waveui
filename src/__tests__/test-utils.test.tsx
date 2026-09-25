import * as React from 'react';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { axe as defaultVitestAxe, configureAxe } from 'vitest-axe';
import { Button } from '../components/button/Button';
import { useWaveTheme } from '../components/provider/WaveProvider';
import { Portal } from '../components/portal/Portal';
import { DismissLayerProvider, useDismiss } from '../hooks/useDismiss';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalIsolation } from '../hooks/useModalIsolation';
import { useRestoreFocus } from '../hooks/useRestoreFocus';
import { useScrollLock } from '../hooks/useScrollLock';
import { getElementType } from '../lib/children';
import { cn } from '../lib/cn';
import { composeEventHandlers } from '../lib/composeEventHandlers';
import { warnOnce } from '../lib/dev';
import { getOpenLayers, registerLayer } from '../lib/layers';
import type { LayerKind, LayerRecord } from '../lib/layers';
import type { PolymorphicComponent } from '../lib/polymorphic';
import {
  asClientReference,
  assertEmptyBody,
  assertOverlayStateReleased,
  axe,
  createOverlayTestWrapper,
  expectNoA11yViolations,
  findDanglingIdRefs,
  installResizeObserverMock,
  mockMatchMedia,
  mockRect,
  renderWithProviders,
  resetMatchMediaMock,
  testA11y,
  testClassName,
  testComposedHandler,
  testCompoundExposure,
  testDisplayName,
  testFocusEvents,
  testNoImplicitSubmit,
  testRestSpread,
  testSystemProps,
} from '../test-utils';
import type { TestSystemPropsConfig } from '../test-utils';
import * as setup from '../test-setup';

/**
 * The `window.matchMedia` the setup file installed (jsdom has none), taken before any test runs.
 * If importing `../test-utils` or `../test-setup` evaluated the setup module a second time, that
 * instance's `mockMatchMedia()` would replace it (see "module graph" below).
 */
const setupMatchMedia = window.matchMedia;

// ---------------------------------------------------------------------------
// Harness: the helpers register `it`/`describe` blocks. `collect` captures what a helper
// registers (instead of adding it to this file's suite) so each registered test can be run
// inside a real test here and asserted to pass or fail.
// ---------------------------------------------------------------------------

interface RegisteredTest {
  name: string;
  fn: () => unknown;
}

function collect(register: () => void): RegisteredTest[] {
  const tests: RegisteredTest[] = [];
  const prefix: string[] = [];
  vi.stubGlobal('it', (name: string, fn: () => unknown) => {
    tests.push({ name: [...prefix, name].join(' > '), fn });
  });
  vi.stubGlobal('describe', (name: string, fn: () => void) => {
    prefix.push(name);
    try {
      fn();
    } finally {
      prefix.pop();
    }
  });
  try {
    register();
  } finally {
    vi.unstubAllGlobals();
  }
  return tests;
}

function pick(tests: RegisteredTest[], name: string | RegExp): RegisteredTest {
  const found = tests.filter((t) =>
    typeof name === 'string' ? t.name === name : name.test(t.name),
  );
  if (found.length !== 1) {
    throw new Error(
      `expected exactly one registered test matching ${String(name)}, got: ${tests.map((t) => t.name).join(' | ')}`,
    );
  }
  return found[0];
}

async function run(test: RegisteredTest): Promise<void> {
  try {
    await test.fn();
  } finally {
    cleanup();
  }
}

async function runAll(tests: RegisteredTest[]): Promise<void> {
  for (const test of tests) {
    try {
      await run(test);
    } catch (error) {
      throw new Error(`registered test "${test.name}" failed: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Fixture components
// ---------------------------------------------------------------------------

interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

/** Correct merge: defaults first, consumer last (`cn`). */
const GoodBox = ({ className, ...rest }: BoxProps) => (
  <div className={cn('flex p-4', className)} {...rest} />
);
GoodBox.displayName = 'GoodBox';

/** Bug: a consumer className replaces every default class. */
const ReplacingBox = ({ className, ...rest }: BoxProps) => (
  <div className={className ?? 'flex p-4'} {...rest} />
);

/** Bug: the consumer class goes first, so tailwind-merge drops a conflicting user class. */
const UserFirstBox = ({ className, ...rest }: BoxProps) => (
  <div className={cn(className, 'flex p-4')} {...rest} />
);

interface CheckProps extends React.HTMLAttributes<HTMLSpanElement> {
  ref?: React.Ref<HTMLSpanElement>;
}

/** Bug: aria-label stays on the role-less wrapper instead of the checkbox. */
const WrapperLabelledCheck = ({ ...rest }: CheckProps) => (
  <span {...rest}>
    <button type="button" role="checkbox" aria-checked="false" />
  </span>
);

/** C-ROUTING: aria-label is routed to the focusable control, the rest stays on the root. */
const RoutedCheck = ({ 'aria-label': ariaLabel, ...rest }: CheckProps) => (
  <span {...rest}>
    <button type="button" role="checkbox" aria-checked="false" aria-label={ariaLabel} />
  </span>
);

/** Bug: every rest prop, data-testid included, is routed to the control (not the root). */
const AllPropsToControlCheck = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <span>
    <button type="button" role="checkbox" aria-checked="false" {...props} />
  </span>
);

/** Bug: data-testid lands on an inner element beside the control, not on the root. */
const SiblingTestIdCheck = ({ 'aria-label': ariaLabel, ...rest }: CheckProps) => (
  <span>
    <span {...rest} />
    <button type="button" role="checkbox" aria-checked="false" aria-label={ariaLabel} />
  </span>
);

/** A control that is its own root (everything lands on it legitimately). */
const RootControl = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" role="checkbox" aria-checked="false" {...props} />
);

/** A wrapper that renders DOM of its own around the component. */
const SectionWrapper = ({ children }: { children: React.ReactNode }) => (
  <section aria-label="Wrapper section">{children}</section>
);

type SettleStep = 'microtask' | 'macrotask' | 'frame';

/**
 * Updates its state after mounting the way open popups and Spinner do: in a microtask
 * (useListbox's publish), in a macrotask (a floating-ui position resolving) and in the next
 * animation frame (Spinner's deferred announce). With `breaksLater`, the frame update adds an
 * unnamed button, so only an audit of the settled DOM reports `button-name`.
 */
const DeferredUpdates = ({ breaksLater = false }: { breaksLater?: boolean }) => {
  const [done, setDone] = React.useState<SettleStep[]>([]);
  React.useEffect(() => {
    let active = true;
    const mark = (step: SettleStep) => {
      if (active) setDone((steps) => [...steps, step]);
    };
    queueMicrotask(() => mark('microtask'));
    const timer = setTimeout(() => mark('macrotask'), 0);
    const frame = requestAnimationFrame(() => mark('frame'));
    return () => {
      active = false;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, []);
  const settled = (['microtask', 'macrotask', 'frame'] as const).filter((s) => done.includes(s));
  return (
    <div>
      <p>Settled: {settled.join(' ') || 'nothing'}</p>
      {breaksLater && done.includes('frame') && <button type="button" />}
    </div>
  );
};
DeferredUpdates.displayName = 'DeferredUpdates';

/**
 * Runs `audit` and returns every console.error message logged during it and in the moment after
 * (an update still pending when the audit returns would land then, with React's "not wrapped in
 * act(...)" warning).
 */
async function consoleErrorsDuring(audit: () => Promise<unknown>): Promise<string[]> {
  const error = vi.spyOn(console, 'error');
  try {
    await audit();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return error.mock.calls.map(([message]) => String(message));
  } finally {
    error.mockRestore();
  }
}

/** A dismiss layer registered directly, as `useDismiss` registers one. */
function layerRecord(id: string, kind: LayerKind): LayerRecord {
  return {
    id,
    parentId: null,
    kind,
    order: 0,
    getElements: () => [],
    getAnchor: () => null,
    escape: true,
    outsidePress: false,
    focusOutside: false,
    onDismiss: () => {},
  };
}

/** Renders an unnamed button into a portal: invisible to a `container` audit. */
const PortaledUnnamedButton = ({ open = true }: { open?: boolean }) =>
  open ? createPortal(<button type="button" />, document.body) : <span>closed</span>;

const ChipContext = React.createContext<string | null>(null);

interface ChipProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
}

/** A well-behaved component that needs a provider (exercises `wrapper`). */
const Chip = ({ as: Component = 'span', className, ...rest }: ChipProps) => {
  const tone = React.useContext(ChipContext);
  if (tone === null) throw new Error('Chip must be used within ChipContext');
  return <Component className={cn('inline-flex px-2', className)} data-tone={tone} {...rest} />;
};
Chip.displayName = 'Chip';

const ChipProvider = ({ children }: { children: React.ReactNode }) => (
  <ChipContext.Provider value="neutral">{children}</ChipContext.Provider>
);

interface ToggleProps {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children?: React.ReactNode;
}

/** Bug: `{...rest}` after the internal handler silently replaces it (layout#10). */
const OverwrittenToggle = (props: ToggleProps) => {
  const [on, setOn] = React.useState(false);
  return (
    <button type="button" aria-pressed={on} onClick={() => setOn((v) => !v)} {...props}>
      Toggle
    </button>
  );
};

/** C-COMPOSE: consumer first, internal unless prevented. */
const ComposedToggle = ({ onClick, ...rest }: ToggleProps) => {
  const [on, setOn] = React.useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      {...rest}
      onClick={composeEventHandlers(onClick, () => setOn((v) => !v))}
    >
      Toggle
    </button>
  );
};

/** Bug: runs the internal behaviour even when the consumer called preventDefault(). */
const IgnoresPreventDefaultToggle = ({ onClick, ...rest }: ToggleProps) => {
  const [on, setOn] = React.useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        setOn((v) => !v);
      }}
    >
      Toggle
    </button>
  );
};

const toggleComposition = {
  handler: 'onClick',
  act: async ({ user }: { user: UserEvent }) => {
    await user.click(screen.getByRole('button', { name: 'Toggle' }));
  },
  assertInternal: () => {
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('aria-pressed', 'true');
  },
  assertInternalSuppressed: () => {
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('aria-pressed', 'false');
  },
} as const;

/** Bug (button-provider#1): an internal `<button>` without `type` submits an enclosing form. */
const ImplicitSubmitMenu = () => (
  <span>
    <button type="button">Primary</button>
    <button>More</button>
  </span>
);

const ExplicitTypeMenu = () => (
  <span>
    <button type="button">Primary</button>
    <button type="button">More</button>
  </span>
);

/**
 * Bug (button-provider#1, the Dialog/Drawer close buttons): a portaled `<button>` without
 * `type`. It has no form owner in the test, so clicking it can never submit the test's form.
 */
const PortaledTypelessClose = () =>
  createPortal(<button aria-label="Close">×</button>, document.body);

const PortaledTypedClose = ({ onClick }: { onClick?: () => void }) =>
  createPortal(
    <button type="button" aria-label="Close" onClick={onClick}>
      ×
    </button>,
    document.body,
  );

/** Bug: typeless; its click handler cancels the submission, so only the type check sees it. */
const PreventingTypelessButton = () => (
  <button onClick={(event) => event.preventDefault()}>Menu</button>
);

/** Bug: a role="button" element that submits its form by script. */
const ScriptSubmitter = () => (
  <span
    role="button"
    tabIndex={0}
    onClick={(event) => event.currentTarget.closest('form')?.requestSubmit()}
    onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.closest('form')?.requestSubmit();
    }}
  >
    Send
  </span>
);

// ---------------------------------------------------------------------------
// Shared axe instance (table-core#20)
// ---------------------------------------------------------------------------

describe('axe (shared instance)', () => {
  it('disables `region`, which the default vitest-axe instance reports on document.body', async () => {
    render(<p>Hello</p>);
    // color-contrast off here too: it cannot run in jsdom and would print jsdom's canvas notice.
    const defaults = await defaultVitestAxe(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(defaults.violations.map((v) => v.id)).toContain('region');

    const shared = await axe(document.body);
    expect(shared.violations).toEqual([]);
  });

  it('disables color-contrast, which jsdom cannot evaluate (tokens.test.ts guards contrast)', async () => {
    // Enabled, the rule's canvas probe fails in jsdom (which prints "Not implemented:
    // HTMLCanvasElement's getContext()" on every audit) and axe files it under `incomplete`,
    // having checked nothing.
    render(<p>Hello</p>);
    const results = await axe(document.body);
    const ran = [
      ...results.violations,
      ...results.incomplete,
      ...results.passes,
      ...results.inapplicable,
    ].map((result) => result.id);
    expect(ran).toContain('button-name'); // the audit ran the other rules
    expect(ran).not.toContain('color-contrast');
    expect(results.incomplete).toEqual([]);
  });

  it('passes a bare <button> on document.body', async () => {
    render(<button type="button">Save</button>);
    await expectNoA11yViolations();
  });

  it('passes <div><p>Hello</p><Button/></div> on document.body', async () => {
    render(
      <div>
        <p>Hello</p>
        <Button>Save</Button>
      </div>,
    );
    await expectNoA11yViolations(document.body);
  });

  it('still reports real violations (unnamed button)', async () => {
    render(<button type="button" />);
    const results = await axe(document.body);
    expect(results.violations.map((v) => v.id)).toContain('button-name');
    await expect(expectNoA11yViolations()).rejects.toThrow(/button-name/);
  });

  it('is typed as a configureAxe instance', () => {
    expectTypeOf(axe).toEqualTypeOf<ReturnType<typeof configureAxe>>();
  });
});

// ---------------------------------------------------------------------------
// Dangling ARIA id references (axe files them under `incomplete` or accepts a partial list)
// ---------------------------------------------------------------------------

describe('dangling ARIA id references', () => {
  it.each([
    ['aria-describedby', <input aria-label="Email" aria-describedby="missing-hint" />],
    ['aria-labelledby', <input aria-label="Email" aria-labelledby="missing-label" />],
    [
      'aria-errormessage',
      <input aria-label="Email" aria-invalid aria-errormessage="missing-error" />,
    ],
  ])('expectNoA11yViolations fails on an %s that points at no element', async (attr, ui) => {
    render(ui);
    // axe itself reports no violation for these: it files them under `incomplete`.
    expect((await axe(document.body)).violations).toEqual([]);
    await expect(expectNoA11yViolations()).rejects.toThrow(new RegExp(`${attr}="missing-`));
  });

  it('fails on one dangling id of a list whose other ids resolve (axe accepts that)', async () => {
    render(
      <>
        <p id="email-hint">We never share it.</p>
        <input aria-label="Email" aria-describedby="email-hint email-error" />
      </>,
    );
    const results = await axe(document.body);
    expect([...results.violations, ...results.incomplete]).toEqual([]);
    await expect(expectNoA11yViolations()).rejects.toThrow(/"email-error"/);
  });

  it('passes references that resolve, also into a portal when only the container is audited', async () => {
    const { container } = render(
      <>
        <span id="field-label">Email</span>
        <input aria-labelledby="field-label" aria-describedby="field-hint" />
        {createPortal(<p id="field-hint">We never share it.</p>, document.body)}
      </>,
    );
    await expectNoA11yViolations();
    await expectNoA11yViolations(container);
  });

  it('leaves aria-controls alone (a closed popup may not be rendered)', async () => {
    render(
      <button type="button" aria-expanded="false" aria-controls="menu-list">
        Menu
      </button>,
    );
    await expectNoA11yViolations();
  });

  it('testA11y and the a11yVariants loop fail on a dangling reference', async () => {
    const Described = ({ hint = true }: { hint?: boolean }) => (
      <div>
        <input aria-label="Email" aria-describedby="email-hint" />
        {hint && <p id="email-hint">We never share it.</p>}
      </div>
    );
    Described.displayName = 'Described';
    await expect(run(collect(() => testA11y(Described))[0])).resolves.toBeUndefined();
    await expect(run(collect(() => testA11y(Described, { hint: false }))[0])).rejects.toThrow(
      /aria-describedby="email-hint"/,
    );
    const variants = collect(() =>
      testSystemProps(Described, {
        expectedTag: 'div',
        displayName: 'Described',
        a11yVariants: [{ name: 'without hint', props: { hint: false } }],
      }),
    );
    await expect(
      run(pick(variants, 'has no accessibility violations (without hint)')),
    ).rejects.toThrow(/aria-describedby="email-hint"/);
  });

  describe('findDanglingIdRefs', () => {
    it('lists every dangling id of aria-activedescendant/-describedby/-errormessage/-labelledby', () => {
      render(
        <div role="listbox" aria-label="Fruit" aria-activedescendant="missing-option" tabIndex={0}>
          <span id="present">Present</span>
          <div role="option" aria-selected="false" aria-labelledby="present gone">
            Apple
          </div>
        </div>,
      );
      expect(findDanglingIdRefs()).toEqual([
        'div[role="listbox"] "Fruit": aria-activedescendant="missing-option" (no element with id "missing-option")',
        'div[role="option"] "Apple": aria-labelledby="present gone" (no element with id "gone")',
      ]);
    });

    it('checks `root` itself and its descendants only, resolving ids in the whole document', () => {
      const { container } = render(
        <>
          <input aria-label="Outside" aria-describedby="nowhere" />
          <section aria-label="Scope" aria-describedby="outside-hint">
            <input aria-label="Inside" aria-describedby="also-nowhere" />
          </section>
          <p id="outside-hint">Hint</p>
        </>,
      );
      const scope = container.querySelector('section') as HTMLElement;
      expect(findDanglingIdRefs(scope)).toEqual([
        'input "Inside": aria-describedby="also-nowhere" (no element with id "also-nowhere")',
      ]);
    });

    it('ignores empty and whitespace-only values', () => {
      render(<input aria-label="Email" aria-describedby=" " aria-labelledby="" />);
      expect(findDanglingIdRefs()).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Audits settle pending updates inside act() first (no act() warnings, settled DOM)
// ---------------------------------------------------------------------------

describe('audits settle pending updates first', () => {
  it('expectNoA11yViolations lets microtask, macrotask and animation-frame updates land inside act()', async () => {
    render(<DeferredUpdates />);
    const warnings = await consoleErrorsDuring(async () => {
      await expectNoA11yViolations();
      expect(screen.getByText('Settled: microtask macrotask frame')).toBeInTheDocument();
    });
    expect(warnings).toEqual([]);
  });

  it('expectNoA11yViolations audits the settled DOM (a violation added in the next frame)', async () => {
    render(<DeferredUpdates breaksLater />);
    await expect(expectNoA11yViolations()).rejects.toThrow(/button-name/);
  });

  it('does not stall on a requestAnimationFrame stub that holds a frame back', async () => {
    // As a test auditing the state before a deferred update does (Spinner's empty region).
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    try {
      render(<DeferredUpdates breaksLater />);
      await expectNoA11yViolations();
      expect(screen.getByText('Settled: microtask macrotask')).toBeInTheDocument();
    } finally {
      raf.mockRestore();
    }
  });

  it('testA11y audits after the pending updates landed inside act()', async () => {
    const [test] = collect(() => testA11y(DeferredUpdates));
    expect(await consoleErrorsDuring(() => run(test))).toEqual([]);
  });

  it('testA11y audits the settled DOM', async () => {
    const [test] = collect(() => testA11y(DeferredUpdates, { breaksLater: true }));
    await expect(run(test)).rejects.toThrow(/button-name/);
  });

  describe('the a11yVariants loop of testSystemProps', () => {
    const tests = () =>
      collect(() =>
        testSystemProps(DeferredUpdates, {
          expectedTag: 'div',
          displayName: 'DeferredUpdates',
          a11yVariants: [
            { name: 'quiet', props: { breaksLater: false } },
            { name: 'late violation', props: { breaksLater: true } },
          ],
        }),
      );

    it('audits after the pending updates landed inside act()', async () => {
      const variant = pick(tests(), 'has no accessibility violations (quiet)');
      expect(await consoleErrorsDuring(() => run(variant))).toEqual([]);
    });

    it('audits the settled DOM', async () => {
      const variant = pick(tests(), 'has no accessibility violations (late violation)');
      await expect(run(variant)).rejects.toThrow(/button-name/);
    });
  });
});

// ---------------------------------------------------------------------------
// testA11y / a11yVariants scope (table-core#20)
// ---------------------------------------------------------------------------

describe('testA11y', () => {
  it('audits document.body by default, so portaled content is included', async () => {
    const [test] = collect(() => testA11y(PortaledUnnamedButton));
    await expect(run(test)).rejects.toThrow(/button-name/);
  });

  it("scope: 'container' limits the audit to the render container", async () => {
    const [test] = collect(() => testA11y(PortaledUnnamedButton, {}, { scope: 'container' }));
    await expect(run(test)).resolves.toBeUndefined();
  });

  it('passes an accessible component', async () => {
    const [test] = collect(() => testA11y(GoodBox, { children: 'Content' }));
    await expect(run(test)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// testSystemProps
// ---------------------------------------------------------------------------

describe('testSystemProps', () => {
  it('runs a11yVariants against document.body (portals included)', async () => {
    const tests = collect(() =>
      testSystemProps(PortaledUnnamedButton, {
        expectedTag: 'span',
        displayName: 'PortaledUnnamedButton',
        defaultProps: { open: false },
        a11yVariants: [{ name: 'open', props: { open: true } }],
      }),
    );
    await expect(run(pick(tests, 'has no accessibility violations'))).resolves.toBeUndefined();
    await expect(run(pick(tests, 'has no accessibility violations (open)'))).rejects.toThrow(
      /button-name/,
    );
  });

  it("honours a11yScope: 'container' for the variants", async () => {
    const tests = collect(() =>
      testSystemProps(PortaledUnnamedButton, {
        expectedTag: 'span',
        displayName: 'PortaledUnnamedButton',
        defaultProps: { open: false },
        a11yScope: 'container',
        a11yVariants: [{ name: 'open', props: { open: true } }],
      }),
    );
    await expect(
      run(pick(tests, 'has no accessibility violations (open)')),
    ).resolves.toBeUndefined();
  });

  it('passes every registered test for a well-behaved component rendered through `wrapper`', async () => {
    const tests = collect(() =>
      testSystemProps(Chip, {
        expectedTag: 'span',
        displayName: 'Chip',
        polymorphic: true,
        wrapper: ChipProvider,
        defaultProps: { children: 'Label' },
        conflictingClass: { className: 'px-4', overrides: 'px-2' },
        a11yVariants: [{ name: 'titled', props: { title: 'Chip title' } }],
      }),
    );
    expect(tests.map((t) => t.name)).toEqual([
      'forwards ref to DOM element',
      'spreads rest props to DOM element',
      'keeps its default classes when a className is added',
      'lets a conflicting consumer className win over the default',
      'renders as a different element via `as` prop',
      'has displayName "Chip"',
      'has no accessibility violations',
      'has no accessibility violations (titled)',
    ]);
    await runAll(tests);
  });

  it('fails without the wrapper when the component needs a provider', async () => {
    const tests = collect(() =>
      testSystemProps(Chip, { expectedTag: 'span', displayName: 'Chip', a11y: false }),
    );
    const consoleError = vi.spyOn(console, 'error');
    try {
      await expect(run(pick(tests, 'forwards ref to DOM element'))).rejects.toThrow(/ChipContext/);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('forwards `control` to testRestSpread', async () => {
    const tests = collect(() =>
      testSystemProps(WrapperLabelledCheck, {
        expectedTag: 'span',
        displayName: 'WrapperLabelledCheck',
        a11y: false,
        control: { role: 'checkbox' },
      }),
    );
    await expect(run(pick(tests, /spreads rest props/))).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// testClassName (table-core#26)
// ---------------------------------------------------------------------------

describe('testClassName', () => {
  it('fails when a consumer className replaces the default classes', async () => {
    const [test] = collect(() => testClassName(ReplacingBox));
    await expect(run(test)).rejects.toThrow(/flex|p-4/);
  });

  it('passes when the defaults survive next to the consumer class', async () => {
    const [test] = collect(() => testClassName(GoodBox));
    await expect(run(test)).resolves.toBeUndefined();
  });

  it('conflictingClass: fails when tailwind-merge drops the consumer class', async () => {
    const tests = collect(() =>
      testClassName(UserFirstBox, {}, { conflictingClass: { className: 'p-8', overrides: 'p-4' } }),
    );
    await expect(
      run(pick(tests, 'keeps its default classes when a className is added')),
    ).resolves.toBeUndefined();
    await expect(
      run(pick(tests, 'lets a conflicting consumer className win over the default')),
    ).rejects.toThrow();
  });

  it('conflictingClass: passes when the consumer class wins and the default is gone', async () => {
    const tests = collect(() =>
      testClassName(GoodBox, {}, { conflictingClass: { className: 'p-8', overrides: 'p-4' } }),
    );
    await runAll(tests);
  });

  it('conflictingClass: reports a misconfigured `overrides` that is not a default class', async () => {
    const tests = collect(() =>
      testClassName(GoodBox, {}, { conflictingClass: { className: 'gap-8', overrides: 'gap-2' } }),
    );
    await expect(
      run(pick(tests, 'lets a conflicting consumer className win over the default')),
    ).rejects.toThrow(/gap-2/);
  });
});

// ---------------------------------------------------------------------------
// testRestSpread `control` (input-basic#1)
// ---------------------------------------------------------------------------

describe('testRestSpread', () => {
  it('without control: asserts data-testid and aria-label on the root', async () => {
    const [test] = collect(() => testRestSpread(GoodBox));
    await expect(run(test)).resolves.toBeUndefined();
  });

  it('with control: fails when aria-label stays on the wrapper', async () => {
    const [test] = collect(() =>
      testRestSpread(WrapperLabelledCheck, {}, { control: { role: 'checkbox' } }),
    );
    await expect(run(test)).rejects.toThrow();
  });

  it('with control: passes when aria-label names the control and data-testid stays on the root', async () => {
    const [test] = collect(() =>
      testRestSpread(RoutedCheck, {}, { control: { role: 'checkbox' } }),
    );
    await expect(run(test)).resolves.toBeUndefined();
  });

  it('with control: fails when data-testid is routed to the control with the other rest props', async () => {
    const [test] = collect(() =>
      testRestSpread(AllPropsToControlCheck, {}, { control: { role: 'checkbox' } }),
    );
    await expect(run(test)).rejects.toThrow(/data-testid must land on the component's root/);
  });

  it('with control: fails when data-testid lands on an element that does not contain the control', async () => {
    const [test] = collect(() =>
      testRestSpread(SiblingTestIdCheck, {}, { control: { role: 'checkbox' } }),
    );
    await expect(run(test)).rejects.toThrow(/root that contains the checkbox/);
  });

  it('with control: passes when the control is the root element', async () => {
    const [test] = collect(() =>
      testRestSpread(RootControl, {}, { control: { role: 'checkbox' } }),
    );
    await expect(run(test)).resolves.toBeUndefined();
  });

  it('with control and a DOM-rendering wrapper: checks containment only', async () => {
    const [routed] = collect(() =>
      testRestSpread(RoutedCheck, {}, { control: { role: 'checkbox' }, wrapper: SectionWrapper }),
    );
    await expect(run(routed)).resolves.toBeUndefined();
    const [sibling] = collect(() =>
      testRestSpread(
        SiblingTestIdCheck,
        {},
        { control: { role: 'checkbox' }, wrapper: SectionWrapper },
      ),
    );
    await expect(run(sibling)).rejects.toThrow(/root that contains the checkbox/);
  });
});

// ---------------------------------------------------------------------------
// testCompoundExposure / testDisplayName (input-pickers#1)
// ---------------------------------------------------------------------------

describe('testCompoundExposure', () => {
  const Item = () => null;
  const NamedItem = () => null;
  NamedItem.displayName = 'Parent.NamedItem';
  const Parent = Object.assign(() => null, { Item, NamedItem, notAComponent: 42 });

  it('accepts a function component with statics (typed `object`)', () => {
    expect(collect(() => testCompoundExposure(Parent, ['NamedItem']))).toHaveLength(1);
  });

  it('passes for a sub-component with a displayName', async () => {
    await runAll(collect(() => testCompoundExposure(Parent, ['NamedItem'])));
  });

  it('fails for a sub-component without a displayName', async () => {
    const [test] = collect(() => testCompoundExposure(Parent, ['Item']));
    await expect(run(test)).rejects.toThrow(/displayName/);
  });

  it('fails for a missing or non-component member', async () => {
    const tests = collect(() => testCompoundExposure(Parent, ['Missing', 'notAComponent']));
    for (const test of tests) await expect(run(test)).rejects.toThrow();
  });

  it('accepts memo components', async () => {
    const Memo = React.memo(() => null);
    Memo.displayName = 'Memo';
    await runAll(collect(() => testCompoundExposure({ Memo }, ['Memo'])));
  });
});

describe('testDisplayName', () => {
  it('compares the displayName', async () => {
    await runAll(collect(() => testDisplayName(GoodBox, 'GoodBox')));
    const [failing] = collect(() => testDisplayName(GoodBox, 'Other'));
    await expect(run(failing)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// testFocusEvents / createOverlayTestWrapper (typed, behaviour unchanged)
// ---------------------------------------------------------------------------

describe('testFocusEvents', () => {
  it('passes for a focusable element', async () => {
    const Focusable = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input aria-label="Name" {...props} />
    );
    await runAll(collect(() => testFocusEvents(Focusable, {}, 'input')));
  });
});

describe('createOverlayTestWrapper', () => {
  it('renders children inside the root with the given props', () => {
    const Root = ({ tone, children }: { tone: string; children: React.ReactNode }) => (
      <section aria-label={tone}>{children}</section>
    );
    const Wrapper = createOverlayTestWrapper(Root, { tone: 'Overlay' });
    render(<p>Inside</p>, { wrapper: Wrapper });
    expect(screen.getByRole('region', { name: 'Overlay' })).toContainElement(
      screen.getByText('Inside'),
    );
  });
});

// ---------------------------------------------------------------------------
// testNoImplicitSubmit (button-provider#1)
// ---------------------------------------------------------------------------

describe('testNoImplicitSubmit', () => {
  it('fails when an internal <button> has no type (implicit submit)', async () => {
    const [test] = collect(() => testNoImplicitSubmit(ImplicitSubmitMenu));
    await expect(run(test)).rejects.toThrow(/More/);
  });

  it('passes when every internal <button> is type="button"', async () => {
    const [test] = collect(() => testNoImplicitSubmit(ExplicitTypeMenu));
    await expect(run(test)).resolves.toBeUndefined();
  });

  it('clicks only the targets returned by getTargets', async () => {
    const [test] = collect(() =>
      testNoImplicitSubmit(ImplicitSubmitMenu, {
        getTargets: () => [screen.getByRole('button', { name: 'Primary' })],
      }),
    );
    await expect(run(test)).resolves.toBeUndefined();
  });

  it('fails when there is nothing to check', async () => {
    const [test] = collect(() => testNoImplicitSubmit(GoodBox));
    await expect(run(test)).rejects.toThrow(/no <button>/);
  });

  it('fails for a portaled <button> without a type, although clicking it cannot submit the form', async () => {
    const [test] = collect(() => testNoImplicitSubmit(PortaledTypelessClose));
    await expect(run(test)).rejects.toThrow(/button "Close" is outside the form \(portaled\)/);
  });

  it('passes a portaled <button type="button"> without clicking it', async () => {
    const onClick = vi.fn();
    const [test] = collect(() =>
      testNoImplicitSubmit(PortaledTypedClose, { defaultProps: { onClick } }),
    );
    await expect(run(test)).resolves.toBeUndefined();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fails for a typeless <button> in the form even when its click prevents the submission', async () => {
    const [test] = collect(() => testNoImplicitSubmit(PreventingTypelessButton));
    await expect(run(test)).rejects.toThrow(/button "Menu" has no type="button"/);
  });

  it('still clicks targets inside the form (a role="button" that submits by script)', async () => {
    const [test] = collect(() =>
      testNoImplicitSubmit(ScriptSubmitter, {
        getTargets: () => [screen.getByRole('button', { name: 'Send' })],
      }),
    );
    await expect(run(test)).rejects.toThrow(/clicking span.* "Send" submitted the enclosing form/);
  });

  it('finds the form inside a DOM-rendering wrapper', async () => {
    const [failing] = collect(() =>
      testNoImplicitSubmit(ImplicitSubmitMenu, { wrapper: SectionWrapper }),
    );
    await expect(run(failing)).rejects.toThrow(/More/);
    const [passing] = collect(() =>
      testNoImplicitSubmit(ExplicitTypeMenu, { wrapper: SectionWrapper }),
    );
    await expect(run(passing)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// testComposedHandler (layout#10)
// ---------------------------------------------------------------------------

describe('testComposedHandler', () => {
  it('fails when the consumer handler replaces the internal one', async () => {
    const tests = collect(() => testComposedHandler(OverwrittenToggle, toggleComposition));
    await expect(run(pick(tests, /composes a consumer onClick/))).rejects.toThrow();
  });

  it('passes for composeEventHandlers (consumer first, internal unless prevented)', async () => {
    const tests = collect(() => testComposedHandler(ComposedToggle, toggleComposition));
    expect(tests).toHaveLength(2);
    await runAll(tests);
  });

  it('fails when preventDefault() does not suppress the internal behaviour', async () => {
    const tests = collect(() =>
      testComposedHandler(IgnoresPreventDefaultToggle, toggleComposition),
    );
    await expect(run(pick(tests, /composes a consumer onClick/))).resolves.toBeUndefined();
    await expect(run(pick(tests, /preventDefault/))).rejects.toThrow();
  });

  it('registers only the composition test without assertInternalSuppressed', () => {
    const { assertInternalSuppressed: _unused, ...withoutSuppressed } = toggleComposition;
    expect(collect(() => testComposedHandler(ComposedToggle, withoutSuppressed))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// renderWithProviders (button-provider#28)
// ---------------------------------------------------------------------------

function ThemeProbe() {
  const { theme, dir } = useWaveTheme();
  return <output aria-label="Theme probe">{`${theme}/${dir}`}</output>;
}

describe('renderWithProviders', () => {
  it('wraps the ui in WaveProvider with the given theme and dir', () => {
    renderWithProviders(<ThemeProbe />, { theme: 'dark', dir: 'rtl' });
    const probe = screen.getByRole('status', { name: 'Theme probe' });
    expect(probe).toHaveTextContent('dark/rtl');
    expect(probe.closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });

  it('uses the provider defaults without options', () => {
    renderWithProviders(<ThemeProbe />);
    expect(screen.getByRole('status', { name: 'Theme probe' })).toHaveTextContent('light/ltr');
  });

  it('composes a custom wrapper inside the provider', () => {
    const Custom = ({ children }: { children: React.ReactNode }) => (
      <section aria-label="Custom wrapper">{children}</section>
    );
    renderWithProviders(<ThemeProbe />, { dir: 'rtl', wrapper: Custom });
    const section = screen.getByRole('region', { name: 'Custom wrapper' });
    expect(section).toContainElement(screen.getByRole('status', { name: 'Theme probe' }));
    expect(section.closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });

  it('returns the RTL render result (rerender keeps the providers)', () => {
    const { rerender } = renderWithProviders(<ThemeProbe />, { theme: 'high-contrast' });
    rerender(<ThemeProbe />);
    expect(screen.getByRole('status', { name: 'Theme probe' })).toHaveTextContent(
      'high-contrast/ltr',
    );
  });
});

// ---------------------------------------------------------------------------
// installResizeObserverMock (layout#9)
// ---------------------------------------------------------------------------

function WidthReporter() {
  const [width, setWidth] = React.useState(0);
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!box) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  return (
    <div ref={setBox} data-testid="box">
      {width}
    </div>
  );
}

describe('installResizeObserverMock', () => {
  it('there is no global ResizeObserver by default', () => {
    expect('ResizeObserver' in globalThis).toBe(false);
    expect('ResizeObserver' in window).toBe(false);
  });

  it('installs a ResizeObserver that fires only on trigger, and restores', () => {
    const ro = installResizeObserverMock();
    try {
      render(
        <>
          <div data-testid="a" />
          <div data-testid="b" />
        </>,
      );
      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const callback = vi.fn();
      const observer = new ResizeObserver(callback);
      observer.observe(a);
      observer.observe(b);
      expect(callback).not.toHaveBeenCalled();

      mockRect(a, { width: 40, height: 10 });
      ro.trigger(a);
      expect(callback).toHaveBeenCalledTimes(1);
      const [entries, receivedObserver] = callback.mock.calls[0] as [
        ResizeObserverEntry[],
        ResizeObserver,
      ];
      expect(receivedObserver).toBe(observer);
      expect(entries).toHaveLength(1);
      expect(entries[0].target).toBe(a);
      expect(entries[0].contentRect.width).toBe(40);
      expect(entries[0].borderBoxSize[0]).toEqual({ inlineSize: 40, blockSize: 10 });

      ro.trigger();
      expect((callback.mock.calls[1][0] as ResizeObserverEntry[]).map((e) => e.target)).toEqual([
        a,
        b,
      ]);

      observer.unobserve(a);
      ro.trigger(a);
      expect(callback).toHaveBeenCalledTimes(2);

      observer.disconnect();
      ro.trigger();
      expect(callback).toHaveBeenCalledTimes(2);
    } finally {
      ro.restore();
    }
    expect('ResizeObserver' in globalThis).toBe(false);
  });

  it('wraps trigger in act() so observer-driven state updates render', () => {
    const ro = installResizeObserverMock();
    const consoleError = vi.spyOn(console, 'error');
    try {
      render(<WidthReporter />);
      const box = screen.getByTestId('box');
      mockRect(box, { width: 120 });
      ro.trigger(box);
      expect(box).toHaveTextContent('120');
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      ro.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// mockMatchMedia / mockRect
// ---------------------------------------------------------------------------

describe('mockMatchMedia', () => {
  const reduce = '(prefers-reduced-motion: reduce)';

  it('answers the given queries (others false) and restores the default stub', () => {
    const restore = mockMatchMedia({ [reduce]: true });
    expect(window.matchMedia(reduce).matches).toBe(true);
    expect(window.matchMedia(reduce).media).toBe(reduce);
    expect(window.matchMedia('(min-width: 600px)').matches).toBe(false);
    restore();
    expect(window.matchMedia(reduce).matches).toBe(false);
  });

  it('ignores whitespace and case differences in queries', () => {
    const restore = mockMatchMedia({ '(Prefers-Reduced-Motion:reduce)': true });
    try {
      expect(window.matchMedia(reduce).matches).toBe(true);
    } finally {
      restore();
    }
  });

  it('notifies change listeners of lists created before the mock', () => {
    const list = window.matchMedia(reduce);
    const listener = vi.fn();
    const legacyListener = vi.fn();
    const onchange = vi.fn();
    list.addEventListener('change', listener);
    list.addListener(legacyListener);
    list.onchange = onchange;

    const restore = mockMatchMedia({ [reduce]: true });
    expect(list.matches).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ matches: true, media: reduce });
    expect(legacyListener).toHaveBeenCalledTimes(1);
    expect(onchange).toHaveBeenCalledTimes(1);

    restore();
    expect(list.matches).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    list.removeEventListener('change', listener);
    list.removeListener(legacyListener);
    const again = mockMatchMedia({ [reduce]: true });
    again();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(legacyListener).toHaveBeenCalledTimes(2);
    list.onchange = null;
  });

  it('resetMatchMediaMock empties the table without notifying and settles observed lists', () => {
    const list = window.matchMedia(reduce);
    const listener = vi.fn();
    list.addEventListener('change', listener);
    try {
      mockMatchMedia({ [reduce]: true }); // restore() forgotten on purpose
      expect(listener).toHaveBeenCalledTimes(1);

      resetMatchMediaMock();
      expect(window.matchMedia(reduce).matches).toBe(false);
      expect(list.matches).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1); // no change event for the reset

      // The list settled on `false`, so the next mock notifies it again.
      const restore = mockMatchMedia({ [reduce]: true });
      expect(listener).toHaveBeenCalledTimes(2);
      restore();
    } finally {
      list.removeEventListener('change', listener);
    }
  });

  it('the setup resets the table after every test, so a forgotten restore() cannot leak', ({
    onTestFinished,
  }) => {
    mockMatchMedia({ [reduce]: true }); // restore() forgotten on purpose
    expect(window.matchMedia(reduce).matches).toBe(true);
    // onTestFinished runs after every afterEach hook, including the setup file's.
    onTestFinished(() => {
      expect(window.matchMedia(reduce).matches).toBe(false);
    });
  });

  describe('a mock set in beforeAll lasts only the first test (as documented)', () => {
    // Both tests record what they see; afterAll checks the pair, so the check holds in any order
    // and is skipped when a filter (`-t`) selects only one of them.
    const seen: boolean[] = [];
    beforeAll(() => {
      mockMatchMedia({ [reduce]: true });
    });
    afterAll(() => {
      if (seen.length === 2) expect(seen).toEqual([true, false]);
    });
    for (const ordinal of ['one', 'two']) {
      it(`records the answer in test ${ordinal}`, () => {
        seen.push(window.matchMedia(reduce).matches);
      });
    }
  });

  describe('with beforeEach', () => {
    beforeEach(() => {
      mockMatchMedia({ [reduce]: true });
    });
    for (const ordinal of ['one', 'two']) {
      it(`answers from the mock in test ${ordinal}`, () => {
        expect(window.matchMedia(reduce).matches).toBe(true);
      });
    }
  });
});

describe('mockRect', () => {
  it('stubs getBoundingClientRect and the jsdom layout sizes', () => {
    render(<div data-testid="rect" />);
    const el = screen.getByTestId('rect');
    mockRect(el, { left: 10, top: 20, width: 100, height: 40 });
    expect(el.getBoundingClientRect()).toMatchObject({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      width: 100,
      height: 40,
      right: 110,
      bottom: 60,
    });
    expect(el.offsetWidth).toBe(100);
    expect(el.offsetHeight).toBe(40);
    expect(el.clientWidth).toBe(100);
    expect(el.clientHeight).toBe(40);

    mockRect(el, { width: 5 });
    expect(el.getBoundingClientRect()).toMatchObject({ x: 0, width: 5, right: 5, height: 0 });
    expect(el.offsetWidth).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// asClientReference (R1: element types from Server Components)
// ---------------------------------------------------------------------------

describe('asClientReference', () => {
  interface BadgeProps {
    tone?: string;
    children?: React.ReactNode;
    ref?: React.Ref<HTMLSpanElement>;
  }
  const Badge = ({ tone = 'neutral', ...rest }: BadgeProps) => <span data-tone={tone} {...rest} />;
  Badge.displayName = 'Badge';

  it('returns a React.lazy element type, not the component (the shape Flight delivers)', () => {
    const LazyBadge = asClientReference(Badge);
    const element = <LazyBadge />;
    expect(element.type).not.toBe(Badge);
    expect((element.type as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.lazy'),
    );
  });

  it('is already resolved: getElementType unwraps it to the component', () => {
    expect(getElementType(React.createElement(asClientReference(Badge)))).toBe(Badge);
  });

  it('server-renders exactly like the component', () => {
    const LazyBadge = asClientReference(Badge);
    const html = renderToString(<LazyBadge tone="brand">New</LazyBadge>);
    expect(html).toBe(renderToString(<Badge tone="brand">New</Badge>));
    expect(html).toContain('New');
  });

  it('renders on the first client render without suspending, with its props and ref', () => {
    const LazyBadge = asClientReference(Badge);
    const ref = React.createRef<HTMLSpanElement>();
    render(
      <React.Suspense fallback={<p>Loading</p>}>
        <LazyBadge ref={ref} tone="brand">
          New
        </LazyBadge>
      </React.Suspense>,
    );
    const badge = screen.getByText('New');
    expect(badge).toHaveAttribute('data-tone', 'brand');
    expect(ref.current).toBe(badge);
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('keeps the component type, so JSX props stay checked', () => {
    expectTypeOf(asClientReference(Badge)).toEqualTypeOf<typeof Badge>();
    expectTypeOf(asClientReference(Button)).toEqualTypeOf<typeof Button>();
  });
});

// ---------------------------------------------------------------------------
// src/test-setup.ts
// ---------------------------------------------------------------------------

describe('test-setup', () => {
  describe('module graph', () => {
    const setupSource = Object.values(
      import.meta.glob<string>('../test-setup.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    )[0];

    it('imports no component, hook or test-utils module (a broken one fails only its importers)', () => {
      const specifiers = Array.from(
        setupSource.matchAll(/^import\s[^;]*?['"]([^'"]+)['"];?$/gm),
        (m) => m[1],
      );
      expect(specifiers).toContain('./lib/dev');
      expect(specifiers.filter((s) => s.startsWith('.') && !s.startsWith('./lib/'))).toEqual([]);
      expect(setupSource).not.toMatch(/\bimport\s*\(/);
    });

    it('is the one instance behind the environment helpers re-exported by test-utils', () => {
      expect(mockMatchMedia).toBe(setup.mockMatchMedia);
      expect(resetMatchMediaMock).toBe(setup.resetMatchMediaMock);
      expect(assertEmptyBody).toBe(setup.assertEmptyBody);
    });

    it('is the instance the setup file evaluated: mockMatchMedia keeps its window.matchMedia', () => {
      // A second evaluation of the setup module would have its own answer table: its first
      // mockMatchMedia() would install a new window.matchMedia, and lists created from the
      // setup's one would no longer be notified.
      const query = '(prefers-reduced-motion: reduce)';
      const list = setupMatchMedia(query);
      const listener = vi.fn();
      list.addEventListener('change', listener);
      const restore = mockMatchMedia({ [query]: true });
      try {
        expect(window.matchMedia).toBe(setupMatchMedia);
        expect(listener).toHaveBeenCalledTimes(1);
      } finally {
        restore();
        list.removeEventListener('change', listener);
      }
    });
  });

  it('stubs Element.prototype.scrollIntoView with a vi.fn()', () => {
    render(<div data-testid="scroll" />);
    const el = screen.getByTestId('scroll');
    expect(() => el.scrollIntoView({ block: 'nearest' })).not.toThrow();
    expect(vi.isMockFunction(Element.prototype.scrollIntoView)).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('clears the scrollIntoView calls after every test', () => {
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('stubs window.matchMedia (nothing matches)', () => {
    expect(typeof window.matchMedia).toBe('function');
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false);
  });

  it('registers toHaveNoViolations', async () => {
    render(<button type="button">Named</button>);
    expect(await axe(document.body)).toHaveNoViolations();
  });

  describe('warn-once keys are reset after every test', () => {
    for (const ordinal of ['first', 'second']) {
      it(`warns again in the ${ordinal} test`, () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          warnOnce('f6t:reset-probe', 'probe');
          expect(warn.mock.calls).toEqual([['[WaveUI] probe']]);
        } finally {
          warn.mockRestore();
        }
      });
    }
  });

  describe('assertEmptyBody (the body-cleanup assertion)', () => {
    it('removes every leftover and names them in the error', () => {
      const leak = document.createElement('div');
      leak.id = 'leaked-portal';
      leak.setAttribute('data-wave-portal', '');
      document.body.append(leak, 'stray text', document.createComment('marker'));
      expect(() => assertEmptyBody()).toThrow(
        /document\.body is not empty after cleanup: div#leaked-portal\[data-wave-portal\], #text "stray text"\./,
      );
      expect(document.body.childNodes).toHaveLength(0);
    });

    it('ignores (but removes) comments and whitespace-only text', () => {
      document.body.append(document.createComment('marker'), '\n  ');
      expect(() => assertEmptyBody()).not.toThrow();
      expect(document.body.childNodes).toHaveLength(0);
    });

    it('passes an empty body', () => {
      expect(() => assertEmptyBody()).not.toThrow();
    });
  });

  describe('assertOverlayStateReleased (the overlay-state release assertion)', () => {
    /** The registry as `getGlobalRegistry(key)` stores it, `undefined` when there is none. */
    const registry = (key: string): unknown =>
      Reflect.get(globalThis, Symbol.for(`@mortenbrudvik/waveui/${key}`));

    // Runs before the setup's body check (a node the test appended itself).
    afterEach(() => document.getElementById('outside')?.remove());

    /** A modal surface built from the real overlay hooks. */
    function Trapped() {
      const surfaceRef = React.useRef<HTMLDivElement | null>(null);
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const setRefs = React.useCallback((el: HTMLDivElement | null) => {
        surfaceRef.current = el;
        setSurface(el);
      }, []);
      const { layerId } = useDismiss({
        open: true,
        onDismiss: () => {},
        refs: [surfaceRef],
        kind: 'modal',
      });
      useFocusTrap(surface, { enabled: true, layerId });
      useModalIsolation(true, { layerId, container: surface });
      useScrollLock(true);
      return (
        <div ref={setRefs} role="dialog" aria-label="Trapped">
          <button type="button">Inside</button>
          {/* A portal inside the surface registers its wrapper with the layer. */}
          <DismissLayerProvider layerId={layerId}>
            <Portal>
              <span>Portaled</span>
            </Portal>
          </DismissLayerProvider>
        </div>
      );
    }

    it('passes once the real overlay hooks released everything on unmount', () => {
      render(<Trapped />);
      expect(getOpenLayers()).toHaveLength(1);
      expect(document.documentElement.style.overflow).toBe('hidden');
      cleanup();
      expect(() => assertOverlayStateReleased()).not.toThrow();
    });

    it('names every leak, releases it and drops the leaked registries', () => {
      const outside = document.createElement('div');
      outside.id = 'outside';
      document.body.append(outside);
      const unregister = registerLayer(layerRecord('leaked-popover', 'popover'));
      // Still mounted when the check runs: to the check, everything below leaked.
      const { unmount } = render(<Trapped />);
      expect(outside).toHaveAttribute('inert');
      const html = document.documentElement;

      let message = '';
      try {
        assertOverlayStateReleased();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/^overlay state outlived its test: /);
      expect(message).toMatch(/2 open dismiss layers \(popover, modal\)/);
      expect(message).toMatch(/1 isolating modal\b/);
      expect(message).toMatch(/1 focus trap\b/);
      expect(message).toMatch(/1 scroll lock\b/);
      expect(message).toMatch(/portal elements registered with 1 layer\b/);
      expect(message).toMatch(/1 layer-stack subscriber\b/);
      expect(message).toMatch(/1 element made inert by modal isolation \(div#outside\)/);
      expect(message).toMatch(/inline overflow on <html> \(overflow: hidden\)/);

      for (const key of ['layers', 'traps', 'scrollLock', 'inert']) {
        expect(registry(key), key).toBeUndefined();
      }
      expect(getOpenLayers()).toEqual([]);
      expect(outside).not.toHaveAttribute('inert');
      expect(html.style.overflow).toBe('');

      // The late cleanups of the leaked registrations touch only the dropped registries.
      unregister();
      unmount();
      expect(() => assertOverlayStateReleased()).not.toThrow();
    });

    describe('the scrollbar compensation of a leaked scroll lock', () => {
      function Locked() {
        useScrollLock(true);
        return null;
      }

      /** A classic 15px scrollbar, and CSS.supports answering `gutter` for scrollbar-gutter. */
      function mockScrollbar(gutter: boolean): () => void {
        const html = document.documentElement;
        const previousCss = Object.getOwnPropertyDescriptor(globalThis, 'CSS');
        Object.defineProperty(html, 'clientWidth', {
          configurable: true,
          value: window.innerWidth - 15,
        });
        Object.defineProperty(globalThis, 'CSS', {
          configurable: true,
          writable: true,
          value: { supports: (property: string) => gutter && property === 'scrollbar-gutter' },
        });
        return () => {
          Reflect.deleteProperty(html, 'clientWidth');
          if (previousCss) Object.defineProperty(globalThis, 'CSS', previousCss);
          else Reflect.deleteProperty(globalThis, 'CSS');
        };
      }

      it.each([
        [
          'scrollbar-gutter on <html>',
          true,
          /inline scrollbar-gutter on <html> \(scrollbar-gutter: stable\)/,
        ],
        [
          'padding-inline-end on <body>',
          false,
          /inline padding-inline-end on <body> \(padding-inline-end: 15px\)/,
        ],
      ])('reports and removes %s', (_label, gutter, fragment) => {
        const restore = mockScrollbar(gutter);
        try {
          const { unmount } = render(<Locked />);
          const html = document.documentElement;
          const body = document.body;
          expect(
            gutter ? html.style.getPropertyValue('scrollbar-gutter') : body.style.paddingInlineEnd,
          ).not.toBe('');
          let message = '';
          try {
            assertOverlayStateReleased();
          } catch (error) {
            message = (error as Error).message;
          }
          expect(message).toMatch(/1 scroll lock\b/);
          expect(message).toMatch(fragment);
          expect(html.style.getPropertyValue('scrollbar-gutter')).toBe('');
          expect(body.style.paddingInlineEnd).toBe('');
          expect(html.style.overflow).toBe('');
          unmount();
          expect(() => assertOverlayStateReleased()).not.toThrow();
        } finally {
          restore();
        }
      });
    });

    it('reports and removes an inert attribute or inline overflow the test left itself', () => {
      document.body.setAttribute('inert', '');
      document.documentElement.style.overflowY = 'hidden';
      expect(() => assertOverlayStateReleased()).toThrow(
        /inert attribute on body; inline overflow on <html> \(overflow-y: hidden\)/,
      );
      expect(document.body).not.toHaveAttribute('inert');
      expect(document.documentElement.style.overflowY).toBe('');
    });

    it('uninstalls every document listener the leaked layer and focus-trap stacks installed', () => {
      const capture = (options: unknown) =>
        typeof options === 'boolean' ? options : Boolean(Object(options).capture);
      const added = vi.spyOn(document, 'addEventListener');
      const removed = vi.spyOn(document, 'removeEventListener');
      try {
        render(<Trapped />);
        // React DOM's own `selectionchange` listener stays for the document's lifetime.
        const installed = added.mock.calls.filter(([type]) => type !== 'selectionchange');
        expect(installed.map(([type]) => type)).toEqual(
          expect.arrayContaining(['keydown', 'pointerdown', 'focusin']),
        );
        expect(() => assertOverlayStateReleased()).toThrow(/1 open dismiss layer \(modal\)/);
        const remaining = installed.filter(
          ([type, listener, options]) =>
            !removed.mock.calls.some(
              ([t, l, o]) => t === type && l === listener && capture(o) === capture(options),
            ),
        );
        expect(remaining.map(([type]) => type)).toEqual([]);
      } finally {
        added.mockRestore();
        removed.mockRestore();
      }
    });

    it('reports a leaked useRestoreFocus focus tracker', () => {
      function Restoring() {
        useRestoreFocus({ enabled: false });
        return null;
      }
      render(<Restoring />);
      expect(() => assertOverlayStateReleased()).toThrow(/1 useRestoreFocus focus tracker user/);
      expect(registry('restoreFocusTracker')).toBeUndefined();
    });
  });

  describe('overlay state must be released after every test (setup wiring)', () => {
    // As for the body check below: the error is captured by the it.fails test and checked in
    // afterAll, so the check holds in any order and under `-t`.
    let leakTestRan = false;
    let leakError = '';
    afterAll(() => {
      if (!leakTestRan) return;
      expect(leakError).toMatch(/overlay state outlived its test: 1 open dismiss layer \(menu\)/);
      expect(getOpenLayers()).toEqual([]);
    });

    it.fails('fails a test that leaves a dismiss layer registered', ({ onTestFailed }) => {
      leakTestRan = true;
      onTestFailed(({ task }) => {
        leakError = (task.result?.errors ?? []).map((e) => e.message).join('\n');
      });
      registerLayer(layerRecord('leaked-menu', 'menu'));
    });
  });

  describe('document.body must be empty after cleanup (setup wiring)', () => {
    // The error is captured by the it.fails test itself and checked in afterAll, so the check
    // does not depend on test order or on another test being selected (`-t`, shuffle).
    let leakTestRan = false;
    let leakError = '';
    afterAll(() => {
      if (!leakTestRan) return;
      expect(leakError).toMatch(/document\.body is not empty after cleanup/);
      expect(leakError).toMatch(/div#leaked-portal/);
    });

    it.fails('fails a test that leaves an element in document.body', ({ onTestFailed }) => {
      leakTestRan = true;
      onTestFailed(({ task }) => {
        leakError = (task.result?.errors ?? []).map((e) => e.message).join('\n');
      });
      const leak = document.createElement('div');
      leak.id = 'leaked-portal';
      leak.setAttribute('data-wave-portal', '');
      document.body.appendChild(leak);
    });

    it('unmounts rendered trees (RTL cleanup) before the check', () => {
      render(<p>Rendered and left mounted on purpose</p>);
      expect(document.body.childNodes.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Type-level contracts (button-provider#24; checked by tsconfig.dev.json, never executed)
// ---------------------------------------------------------------------------

function typeContracts(): void {
  interface ToggleLikeProps {
    pressed?: boolean;
    disabled?: boolean;
    children?: React.ReactNode;
  }
  const ToggleLike = (_props: ToggleLikeProps) => null;

  testSystemProps(ToggleLike, {
    expectedTag: 'button',
    displayName: 'ToggleLike',
    defaultProps: { children: 'Toggle', 'data-testid': 'data attributes are always allowed' },
    a11yVariants: [
      { name: 'pressed', props: { pressed: true } },
      { name: 'disabled', props: { disabled: true } },
      // @ts-expect-error `checked` is not a ToggleLike prop, so the variant would test nothing
      { name: 'checked', props: { checked: true } },
    ],
  });

  testSystemProps(ToggleLike, {
    expectedTag: 'button',
    displayName: 'X',
    // @ts-expect-error defaultProps are checked against the component's props
    defaultProps: { nope: 1 },
  });

  const config: TestSystemPropsConfig<ToggleLikeProps> = {
    expectedTag: 'button',
    displayName: 'ToggleLike',
    a11yScope: 'container',
    control: { role: 'button' },
    conflictingClass: { className: 'p-8', overrides: 'p-4' },
  };
  testSystemProps(ToggleLike, config);

  // Polymorphic components (F2 PolymorphicComponent) are accepted.
  const Poly: PolymorphicComponent<'button', { appearance?: 'primary'; disabled?: boolean }> = () =>
    null;
  testSystemProps(Poly, {
    expectedTag: 'button',
    displayName: 'Poly',
    polymorphic: true,
    defaultProps: { appearance: 'primary', type: 'submit', 'aria-label': 'Save' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      // @ts-expect-error typos are rejected for polymorphic components too
      { name: 'typo', props: { disabledd: true } },
    ],
  });
  testSystemProps(Poly, {
    expectedTag: 'a',
    displayName: 'Poly',
    // @ts-expect-error own props keep their literal types
    defaultProps: { appearance: 'x' },
  });

  // Compound parents are plain objects/functions with statics.
  testCompoundExposure(
    Object.assign(() => null, { Item: ToggleLike }),
    ['Item'],
  );

  // testComposedHandler only accepts on* keys of the component's props.
  testComposedHandler(ComposedToggle, { ...toggleComposition, handler: 'onClick' });
  // @ts-expect-error `onFocus` is not a ToggleProps handler
  testComposedHandler(ComposedToggle, { ...toggleComposition, handler: 'onFocus' });
  // @ts-expect-error `children` is not an event handler
  testComposedHandler(ComposedToggle, { ...toggleComposition, handler: 'children' });

  // renderWithProviders only accepts WaveProvider themes and directions.
  // @ts-expect-error 'sepia' is not a WaveTheme
  renderWithProviders(<span />, { theme: 'sepia' });

  // createOverlayTestWrapper keeps the variants of a discriminated-union props type (layout#10).
  type UnionRootProps = ({ mode: 'a'; a: string } | { mode: 'b'; b: number }) & {
    children: React.ReactNode;
  };
  const UnionRoot = (_props: UnionRootProps) => null;
  createOverlayTestWrapper(UnionRoot, { mode: 'a', a: 'x' });
  createOverlayTestWrapper(UnionRoot, { mode: 'b', b: 1 });
  // @ts-expect-error `b` belongs to the other variant (and `a` is missing)
  createOverlayTestWrapper(UnionRoot, { mode: 'a', b: 1 });
  // @ts-expect-error rootProps are still checked against the root's props
  createOverlayTestWrapper(UnionRoot, { mode: 'c' });
}

it('type-level contracts compile (see typeContracts)', () => {
  expectTypeOf(typeContracts).toBeFunction();
});
