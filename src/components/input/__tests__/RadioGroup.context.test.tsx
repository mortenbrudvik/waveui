import * as React from 'react';
import { createPortal } from 'react-dom';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioItem } from '../RadioGroup';
import {
  useRadioGroupContext,
  useRadioGroupItem,
  type RadioGroupContextValue,
  type UseRadioGroupItemOptions,
  type UseRadioGroupItemResult,
} from '../RadioGroup.context';
import { composeEventHandlers } from '../../../lib/composeEventHandlers';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefsInHtml,
  renderWithProviders,
} from '../../../test-utils';

interface CardProps {
  value: string;
  title: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Rendered after the description (a portal, in the tests that need one). */
  extra?: React.ReactNode;
}

/** A radio card of your own: a title and a description, built on `useRadioGroupItem`. */
function Card({ value, title, disabled, onClick, onKeyDown, extra }: CardProps) {
  const id = React.useId();
  const { props, checked } = useRadioGroupItem(value, { disabled });
  return (
    <div
      {...props}
      onClick={composeEventHandlers(onClick, props.onClick)}
      onKeyDown={composeEventHandlers(onKeyDown, props.onKeyDown)}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      data-checked={checked ? '' : undefined}
    >
      <span id={`${id}-title`}>{title}</span>
      <span id={`${id}-description`}>{`The ${title} plan`}</span>
      {extra}
    </div>
  );
}
Card.displayName = 'Card';

function radio(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

function plans(disabled?: string) {
  return ['free', 'pro', 'team'].map((value) => (
    <Card
      key={value}
      value={value}
      title={value[0]!.toUpperCase() + value.slice(1)}
      disabled={value === disabled}
    />
  ));
}

const CONTEXT_ERROR = '[WaveUI] useRadioGroupContext must be used within a RadioGroup';
const ITEM_ERROR = '[WaveUI] useRadioGroupItem must be used within a RadioGroup';

describe('useRadioGroupContext (P13-02, R13)', () => {
  function ContextProbe({ record }: { record: (value: RadioGroupContextValue) => void }) {
    record(useRadioGroupContext());
    return null;
  }

  it('returns the narrow value inside a RadioGroup: value, disabled and select, nothing else', () => {
    const seen: RadioGroupContextValue[] = [];
    const record = (value: RadioGroupContextValue) => seen.push(value);
    render(
      <RadioGroup aria-label="Plan" defaultValue="pro">
        {plans()}
        <ContextProbe record={record} />
      </RadioGroup>,
    );
    expect(seen.at(-1)).toStrictEqual({
      value: 'pro',
      disabled: false,
      select: expect.any(Function),
    });
  });

  it('value is undefined while nothing is selected; select chooses a value as a click does', () => {
    const onValueChange = vi.fn();
    const seen: RadioGroupContextValue[] = [];
    const record = (value: RadioGroupContextValue) => seen.push(value);
    render(
      <RadioGroup aria-label="Plan" onValueChange={onValueChange}>
        {plans()}
        <ContextProbe record={record} />
      </RadioGroup>,
    );
    expect(seen.at(-1)?.value).toBeUndefined();
    act(() => seen.at(-1)?.select('team'));
    expect(onValueChange.mock.calls).toEqual([['team']]);
    expect(radio('Team')).toHaveAttribute('aria-checked', 'true');
    expect(seen.at(-1)?.value).toBe('team');
    // Selecting the selected value again changes nothing and calls nothing.
    act(() => seen.at(-1)?.select('team'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("disabled follows the group's disabled prop", () => {
    const seen: RadioGroupContextValue[] = [];
    const record = (value: RadioGroupContextValue) => seen.push(value);
    const { rerender } = render(
      <RadioGroup aria-label="Plan" disabled>
        <ContextProbe record={record} />
      </RadioGroup>,
    );
    expect(seen.at(-1)?.disabled).toBe(true);
    rerender(
      <RadioGroup aria-label="Plan">
        <ContextProbe record={record} />
      </RadioGroup>,
    );
    expect(seen.at(-1)?.disabled).toBe(false);
  });

  it('keeps the same object across unrelated re-renders and a new one when the value changes', () => {
    const seen: RadioGroupContextValue[] = [];
    const record = (value: RadioGroupContextValue) => seen.push(value);
    function Parent({ tick, value }: { tick: number; value: string }) {
      return (
        <RadioGroup aria-label="Plan" value={value} data-tick={tick}>
          {plans()}
          <ContextProbe record={record} />
        </RadioGroup>
      );
    }
    const { rerender } = render(<Parent tick={0} value="free" />);
    const first = seen.at(-1);
    rerender(<Parent tick={1} value="free" />);
    expect(seen.at(-1)).toBe(first);
    rerender(<Parent tick={2} value="pro" />);
    expect(seen.at(-1)).not.toBe(first);
    expect(seen.at(-1)?.value).toBe('pro');
    expect(seen.at(-1)?.select).toBe(first?.select);
  });

  it('throws outside a RadioGroup in development (C-CONTEXT)', () => {
    expectThrows(<ContextProbe record={() => {}} />, CONTEXT_ERROR);
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a RadioGroup and returns the inert value', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const seen: RadioGroupContextValue[] = [];
        const record = (value: RadioGroupContextValue) => seen.push(value);
        const { rerender } = render(<ContextProbe record={record} />);
        rerender(<ContextProbe record={record} />);
        expect(error.mock.calls).toEqual([[CONTEXT_ERROR]]);
        expect(seen.at(-1)).toStrictEqual({
          value: undefined,
          disabled: false,
          select: expect.any(Function),
        });
        expect(() => seen.at(-1)?.select('pro')).not.toThrow();
      } finally {
        error.mockRestore();
      }
    });
  });
});

describe('useRadioGroupItem (P13-02, R13)', () => {
  function ItemProbe({
    value,
    disabled,
    record,
  }: {
    value: string;
    disabled?: boolean;
    record: (value: string, result: UseRadioGroupItemResult) => void;
  }) {
    const result = useRadioGroupItem(value, { disabled });
    record(value, result);
    return <div {...result.props} aria-label={value} />;
  }

  it('returns the props of the radio element, its checked state and its disabled state', () => {
    const seen: Record<string, UseRadioGroupItemResult> = {};
    const record = (value: string, result: UseRadioGroupItemResult) => {
      seen[value] = result;
    };
    render(
      <RadioGroup aria-label="Plan" defaultValue="free">
        <ItemProbe value="free" record={record} />
        <ItemProbe value="pro" record={record} />
        <ItemProbe value="team" disabled record={record} />
      </RadioGroup>,
    );
    expect(seen.free).toStrictEqual({
      props: {
        role: 'radio',
        'aria-checked': true,
        tabIndex: 0,
        'data-roving-value': 'free',
        onClick: expect.any(Function),
        onKeyDown: expect.any(Function),
      },
      checked: true,
      disabled: false,
    });
    expect(seen.pro).toStrictEqual({
      props: {
        role: 'radio',
        'aria-checked': false,
        tabIndex: -1,
        'data-roving-value': 'pro',
        onClick: expect.any(Function),
        onKeyDown: expect.any(Function),
      },
      checked: false,
      disabled: false,
    });
    expect(seen.team).toStrictEqual({
      props: {
        role: 'radio',
        'aria-checked': false,
        'aria-disabled': true,
        tabIndex: -1,
        'data-roving-value': 'team',
        onClick: expect.any(Function),
        onKeyDown: expect.any(Function),
      },
      checked: false,
      disabled: true,
    });
  });

  it('a disabled group disables every item', () => {
    const seen: Record<string, UseRadioGroupItemResult> = {};
    const record = (value: string, result: UseRadioGroupItemResult) => {
      seen[value] = result;
    };
    render(
      <RadioGroup aria-label="Plan" defaultValue="free" disabled>
        <ItemProbe value="free" record={record} />
        <ItemProbe value="pro" record={record} />
      </RadioGroup>,
    );
    for (const value of ['free', 'pro']) {
      expect(seen[value]?.disabled).toBe(true);
      expect(seen[value]?.props['aria-disabled']).toBe(true);
      expect(seen[value]?.props.tabIndex).toBe(-1);
    }
    expect(seen.free?.checked).toBe(true);
  });

  it('throws outside a RadioGroup in development (C-CONTEXT)', () => {
    expectThrows(<ItemProbe value="free" record={() => {}} />, ITEM_ERROR);
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a RadioGroup and returns the props of an inert radio', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const seen: Record<string, UseRadioGroupItemResult> = {};
        const record = (value: string, result: UseRadioGroupItemResult) => {
          seen[value] = result;
        };
        const { rerender } = render(
          <>
            <ItemProbe value="free" record={record} />
            <ItemProbe value="pro" record={record} />
          </>,
        );
        rerender(
          <>
            <ItemProbe value="free" record={record} />
            <ItemProbe value="pro" record={record} />
          </>,
        );
        expect(error.mock.calls).toEqual([[ITEM_ERROR]]);
        expect(seen.free).toStrictEqual({
          props: {
            role: 'radio',
            'aria-checked': false,
            tabIndex: -1,
            'data-roving-value': 'free',
            onClick: expect.any(Function),
            onKeyDown: expect.any(Function),
          },
          checked: false,
          disabled: false,
        });
        await userEvent.setup().click(screen.getByRole('radio', { name: 'free' }));
        expect(screen.getByRole('radio', { name: 'free' })).toHaveAttribute(
          'aria-checked',
          'false',
        );
      } finally {
        error.mockRestore();
      }
    });
  });
});

describe('a radio card of your own (useRadioGroupItem)', () => {
  it('is a named radio of a named group, with no axe violation', async () => {
    render(
      <RadioGroup aria-label="Plan" defaultValue="pro">
        {plans('team')}
      </RadioGroup>,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(radio('Pro')).toHaveAccessibleDescription('The Pro plan');
    await expectNoA11yViolations(document.body);
  });

  it('arrow keys, Home and End move focus between the cards and select (LTR)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" defaultValue="free" onValueChange={onValueChange}>
        {plans()}
      </RadioGroup>,
    );
    act(() => radio('Free').focus());
    await user.keyboard('{ArrowDown}');
    expect(radio('Pro')).toHaveFocus();
    expect(radio('Pro')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Pro')).toHaveAttribute('tabindex', '0');
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Free')).toHaveAttribute('tabindex', '-1');
    await user.keyboard('{ArrowRight}');
    expect(radio('Team')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(radio('Pro')).toHaveFocus();
    await user.keyboard('{End}');
    expect(radio('Team')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(radio('Free')).toHaveFocus();
    expect(radio('Free')).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([['pro'], ['team'], ['pro'], ['team'], ['free']]);
  });

  it('mirrors Left and Right under dir="rtl"', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RadioGroup aria-label="Plan" orientation="horizontal" defaultValue="free">
        {plans()}
      </RadioGroup>,
      { dir: 'rtl' },
    );
    act(() => radio('Free').focus());
    await user.keyboard('{ArrowLeft}');
    expect(radio('Pro')).toHaveFocus();
    expect(radio('Pro')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(radio('Free')).toHaveFocus();
    expect(radio('Free')).toHaveAttribute('aria-checked', 'true');
  });

  it('Tab reaches the first card and Space checks it (APG); the Space is default-prevented', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" onValueChange={onValueChange}>
        {plans()}
      </RadioGroup>,
    );
    expect(radio('Free')).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(radio('Free')).toHaveFocus();
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
    await user.keyboard(' ');
    expect(radio('Free')).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([['free']]);
    // fireEvent returns false when a handler called preventDefault(): the page does not scroll.
    expect(fireEvent.keyDown(radio('Free'), { key: ' ' })).toBe(false);
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it('Enter checks the focused card, as on the built-in item', async () => {
    const user = userEvent.setup();
    render(<RadioGroup aria-label="Plan">{plans()}</RadioGroup>);
    act(() => radio('Pro').focus());
    expect(radio('Pro')).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('{Enter}');
    expect(radio('Pro')).toHaveAttribute('aria-checked', 'true');
  });

  it('aria-checked tracks the selection: clicks and a controlled value', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = React.useState('free');
      return (
        <>
          <RadioGroup aria-label="Plan" value={value} onValueChange={setValue}>
            {plans()}
          </RadioGroup>
          <button type="button" onClick={() => setValue('team')}>
            Choose Team
          </button>
        </>
      );
    }
    render(<Controlled />);
    expect(radio('Free')).toHaveAttribute('aria-checked', 'true');
    await user.click(radio('Pro'));
    expect(radio('Pro')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Pro')).toHaveAttribute('data-checked', '');
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Free')).not.toHaveAttribute('data-checked');
    await user.click(screen.getByRole('button', { name: 'Choose Team' }));
    expect(radio('Team')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Team')).toHaveAttribute('tabindex', '0');
    expect(radio('Pro')).toHaveAttribute('aria-checked', 'false');
  });

  it('a disabled card is skipped by the arrow keys, never holds the tab stop, and ignores clicks and keys', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" onValueChange={onValueChange}>
        {plans('free')}
      </RadioGroup>,
    );
    expect(radio('Free')).toHaveAttribute('aria-disabled', 'true');
    expect(radio('Free')).toHaveAttribute('tabindex', '-1');
    expect(radio('Pro')).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(radio('Pro')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(radio('Team')).toHaveFocus();
    // From Team, the next enabled card wraps past the disabled Free to Pro.
    await user.keyboard('{ArrowDown}');
    expect(radio('Pro')).toHaveFocus();
    expect(onValueChange.mock.calls).toEqual([['team'], ['pro']]);
    onValueChange.mockClear();
    await user.click(radio('Free'));
    fireEvent.keyDown(radio('Free'), { key: ' ' });
    fireEvent.keyDown(radio('Free'), { key: 'Enter' });
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('a disabled group disables every card', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" defaultValue="pro" disabled onValueChange={onValueChange}>
        {plans()}
      </RadioGroup>,
    );
    for (const name of ['Free', 'Pro', 'Team']) {
      expect(radio(name)).toHaveAttribute('aria-disabled', 'true');
      expect(radio(name)).toHaveAttribute('tabindex', '-1');
    }
    await user.click(radio('Team'));
    expect(radio('Pro')).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('fires onValueChange once per click, Space and arrow key in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <RadioGroup aria-label="Plan" onValueChange={onValueChange}>
          {plans()}
        </RadioGroup>
      </React.StrictMode>,
    );
    await user.click(radio('Pro'));
    expect(onValueChange.mock.calls).toEqual([['pro']]);
    await user.keyboard('{ArrowDown}');
    expect(onValueChange.mock.calls).toEqual([['pro'], ['team']]);
    act(() => radio('Free').focus());
    await user.keyboard(' ');
    expect(onValueChange.mock.calls).toEqual([['pro'], ['team'], ['free']]);
  });

  it("a consumer handler that prevents the default cancels the card's selection", async () => {
    const user = userEvent.setup();
    const prevent = (event: React.SyntheticEvent) => event.preventDefault();
    render(
      <RadioGroup aria-label="Plan">
        <Card value="free" title="Free" onClick={prevent} onKeyDown={prevent} />
      </RadioGroup>,
    );
    await user.click(radio('Free'));
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
    await user.keyboard(' ');
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
  });

  it('the returned handlers skip an event whose default was prevented before them', async () => {
    const user = userEvent.setup();
    function BareCard() {
      const { props } = useRadioGroupItem('free');
      return <div {...props} aria-label="Free" />;
    }
    const prevent = (event: React.SyntheticEvent) => event.preventDefault();
    render(
      <RadioGroup aria-label="Plan">
        <div onClickCapture={prevent} onKeyDownCapture={prevent}>
          <BareCard />
        </div>
      </RadioGroup>,
    );
    await user.click(radio('Free'));
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
  });

  it('ignores clicks and keys that React bubbles from a portal the card renders (C-COMPOSE)', () => {
    render(
      <RadioGroup aria-label="Plan">
        <Card
          value="free"
          title="Free"
          extra={createPortal(<span data-testid="portaled">Details</span>, document.body)}
        />
      </RadioGroup>,
    );
    const portaled = screen.getByTestId('portaled');
    fireEvent.click(portaled);
    fireEvent.keyDown(portaled, { key: ' ' });
    fireEvent.keyDown(portaled, { key: 'Enter' });
    expect(radio('Free')).toHaveAttribute('aria-checked', 'false');
  });

  it('shares one tab stop and one arrow order with the built-in items of the same group', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Plan" defaultValue="basic">
        <RadioItem value="basic" label="Basic" />
        {plans()}
      </RadioGroup>,
    );
    const tabStops = screen.getAllByRole('radio').filter((el) => el.tabIndex === 0);
    expect(tabStops).toEqual([radio('Basic')]);
    act(() => radio('Basic').focus());
    await user.keyboard('{ArrowDown}');
    expect(radio('Free')).toHaveFocus();
    expect(radio('Free')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Basic')).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('{ArrowUp}');
    expect(radio('Basic')).toHaveFocus();
    expect(radio('Basic')).toHaveAttribute('aria-checked', 'true');
  });

  it("counts the cards in the group's duplicate-value warning (C-DEV)", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <RadioGroup aria-label="Plan">
          <RadioItem value="free" label="Basic" />
          <Card value="free" title="Free" />
        </RadioGroup>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] RadioGroup: several items share the value "free". Item values must be unique ' +
            'within a RadioGroup; items that share a value are checked together.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  describe('in a form (C-FORMS)', () => {
    function getForm() {
      return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    }

    it("submits the selected card's value under the group's name and resets to defaultValue", async () => {
      const user = userEvent.setup();
      render(
        <form aria-label="Form">
          <RadioGroup aria-label="Plan" name="plan" defaultValue="free">
            {plans()}
          </RadioGroup>
        </form>,
      );
      expect(new FormData(getForm()).getAll('plan')).toEqual(['free']);
      await user.click(radio('Team'));
      expect(new FormData(getForm()).getAll('plan')).toEqual(['team']);
      act(() => getForm().reset());
      expect(radio('Free')).toHaveAttribute('aria-checked', 'true');
      expect(new FormData(getForm()).getAll('plan')).toEqual(['free']);
    });

    it('a failed validation focuses the card that holds the tab stop', () => {
      render(
        <form aria-label="Form">
          <RadioGroup aria-label="Plan" required>
            {plans('free')}
          </RadioGroup>
        </form>,
      );
      act(() => {
        getForm().reportValidity();
      });
      expect(radio('Pro')).toHaveFocus();
    });
  });

  describe('server rendering', () => {
    const ui = (
      <RadioGroup aria-label="Plan" defaultValue="pro">
        {plans('team')}
      </RadioGroup>
    );

    it('renders the cards on the server and hydrates without an error', async () => {
      const html = renderToString(ui);
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
      const container = document.createElement('div');
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        container.innerHTML = html;
        document.body.appendChild(container);
        const pro = screen.getByRole('radio', { name: 'Pro' });
        expect(pro).toHaveAttribute('aria-checked', 'true');
        expect(pro).toHaveAttribute('tabindex', '0');
        expect(radio('Free')).toHaveAttribute('tabindex', '-1');
        expect(radio('Team')).toHaveAttribute('aria-disabled', 'true');
        await act(async () => {
          root = hydrateRoot(container, ui);
        });
        expect(error).not.toHaveBeenCalled();
        expect(radio('Pro')).toBe(pro);
        await userEvent.setup().click(radio('Free'));
        expect(radio('Free')).toHaveAttribute('aria-checked', 'true');
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });

    it('a card imported by a Server Component (a client reference) renders the same markup', () => {
      const ReferenceCard = asClientReference(Card);
      const html = renderToString(ui);
      const referenced = renderToString(
        <RadioGroup aria-label="Plan" defaultValue="pro">
          {['free', 'pro', 'team'].map((value) => (
            <ReferenceCard
              key={value}
              value={value}
              title={value[0]!.toUpperCase() + value.slice(1)}
              disabled={value === 'team'}
            />
          ))}
        </RadioGroup>,
      );
      // React.useId differs between the two trees (the lazy wrapper adds a level), nothing else.
      const withoutIds = (markup: string) => markup.replace(/(id|aria-\w+by)="[^"]*"/g, '$1=""');
      expect(withoutIds(referenced)).toBe(withoutIds(html));
    });
  });
});

describe('RadioGroup hooks — types', () => {
  it('useRadioGroupContext returns the narrow value', () => {
    expectTypeOf(useRadioGroupContext).toEqualTypeOf<() => RadioGroupContextValue>();
    expectTypeOf<RadioGroupContextValue>().toEqualTypeOf<{
      value: string | undefined;
      disabled: boolean;
      select: (value: string) => void;
    }>();
  });

  it('useRadioGroupItem takes a value and options and returns props, checked and disabled', () => {
    expectTypeOf(useRadioGroupItem).toEqualTypeOf<
      (value: string, options?: UseRadioGroupItemOptions) => UseRadioGroupItemResult
    >();
    expectTypeOf<UseRadioGroupItemOptions>().toEqualTypeOf<{ disabled?: boolean }>();
    expectTypeOf<UseRadioGroupItemResult>().toEqualTypeOf<{
      props: {
        role: 'radio';
        'aria-checked': boolean;
        'aria-disabled'?: boolean;
        tabIndex: 0 | -1;
        'data-roving-value': string;
        onClick: React.MouseEventHandler<HTMLElement>;
        onKeyDown: React.KeyboardEventHandler<HTMLElement>;
      };
      checked: boolean;
      disabled: boolean;
    }>();
  });

  it('the props spread onto any element', () => {
    function Spread() {
      const { props } = useRadioGroupItem('a');
      return (
        <>
          <div {...props} />
          <li {...props} />
          <button type="button" {...props} />
        </>
      );
    }
    expect(Spread).toBeTypeOf('function');
  });
});
