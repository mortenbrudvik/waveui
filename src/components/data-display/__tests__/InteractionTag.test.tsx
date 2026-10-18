import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { InteractionTag, InteractionTagPrimary, InteractionTagSecondary } from '../InteractionTag';
import type {
  InteractionTagPrimaryProps,
  InteractionTagProps,
  InteractionTagSecondaryProps,
} from '../InteractionTag';
import { Avatar, avatarSizeClasses } from '../Avatar';
import { TagGroup } from '../TagGroup';
import {
  interactionTagClassNames,
  interactionTagPrimaryClassNames,
  interactionTagSecondaryClassNames,
} from '../../../lib/classNames';
import { focusRing, forcedColors } from '../../../lib/styles';
import type { TagAppearance, TagShape, TagSize } from '../../../lib/types';
import {
  asClientReference,
  expectThrows,
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const APPEARANCES: readonly TagAppearance[] = ['filled', 'outline', 'brand'];
const SIZES: readonly TagSize[] = ['medium', 'small', 'extra-small'];
const SHAPES: readonly TagShape[] = ['circular', 'rounded'];

const BUTTON_CHILD_WARNING =
  "[WaveUI] InteractionTag.Secondary: its content received a button. A button cannot contain a button: its children became the content of the Dismiss button and its props were dropped. Pass icon content, and handle the dismissal in `onClick` or in the TagGroup's `onDismiss`.";

/** A decorative glyph a test can find. */
const Glyph = ({ testId = 'glyph' }: { testId?: string }) => (
  <svg data-testid={testId} aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" />
);

/** Spies on `console.warn`; read the messages with `warnings()`. */
function spyOnWarnings() {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  return () => spy.mock.calls.map((call) => String(call[0]));
}

const primary = (name: string | RegExp = 'Cherry') => screen.getByRole('button', { name });
const secondary = (name = 'Dismiss Cherry') => screen.getByRole('button', { name });

/** The InteractionTag every render needs as the parts' parent. */
const InTag = ({ children }: { children: React.ReactNode }) => (
  <InteractionTag>{children}</InteractionTag>
);

/** An InteractionTag with a Primary, so the Secondary's name has its second half. */
const InTagWithPrimary = ({ children }: { children: React.ReactNode }) => (
  <InteractionTag>
    <InteractionTag.Primary>Cherry</InteractionTag.Primary>
    {children}
  </InteractionTag>
);

interface CherryProps extends InteractionTagProps {
  primaryProps?: InteractionTagPrimaryProps;
  /** Props of the Secondary, or `false` for none. */
  secondaryProps?: InteractionTagSecondaryProps | false;
}

/** "Cherry" with a Primary and, unless `secondaryProps` is `false`, a Secondary. */
function Cherry({ primaryProps, secondaryProps = {}, ...props }: CherryProps) {
  return (
    <InteractionTag {...props}>
      <InteractionTag.Primary {...primaryProps}>Cherry</InteractionTag.Primary>
      {secondaryProps && <InteractionTag.Secondary {...secondaryProps} />}
    </InteractionTag>
  );
}

describe('InteractionTag', () => {
  testSystemProps(InteractionTag, {
    expectedTag: 'div',
    displayName: 'InteractionTag',
    defaultProps: {
      children: [
        <InteractionTag.Primary key="primary">Cherry</InteractionTag.Primary>,
        <InteractionTag.Secondary key="secondary" />,
      ],
    },
    conflictingClass: { className: 'items-center', overrides: 'items-stretch' },
    a11yVariants: [
      ...APPEARANCES.map((appearance) => ({ name: appearance, props: { appearance } })),
      { name: 'selected', props: { selected: true } },
      { name: 'not selected (a toggle)', props: { selected: false } },
      { name: 'disabled', props: { disabled: true } },
      ...SIZES.map((size) => ({ name: size, props: { size } })),
      { name: 'rounded', props: { shape: 'rounded' as const } },
      {
        name: 'media, icon and secondary text',
        props: {
          children: [
            <InteractionTag.Primary
              key="primary"
              media={<Avatar name="Katri Athokas" />}
              icon={<Glyph />}
              secondaryText="Designer"
            >
              Katri
            </InteractionTag.Primary>,
            <InteractionTag.Secondary key="secondary" />,
          ],
        },
      },
      {
        name: 'Primary only',
        props: { children: <InteractionTag.Primary>Cherry</InteractionTag.Primary> },
      },
    ],
  });

  describe('InteractionTag.Primary', () => {
    testSystemProps(InteractionTagPrimary, {
      expectedTag: 'button',
      displayName: 'InteractionTagPrimary',
      defaultProps: { children: 'Cherry' },
      wrapper: InTag,
      conflictingClass: { className: 'bg-error', overrides: 'bg-muted' },
      a11yVariants: [
        {
          name: 'media, icon and secondary text',
          props: {
            media: <Avatar name="Katri Athokas" />,
            icon: <Glyph />,
            secondaryText: 'Designer',
          },
        },
        { name: 'disabled', props: { disabled: true } },
      ],
    });
  });

  describe('InteractionTag.Secondary', () => {
    testSystemProps(InteractionTagSecondary, {
      expectedTag: 'button',
      displayName: 'InteractionTagSecondary',
      wrapper: InTagWithPrimary,
      conflictingClass: { className: 'min-w-10', overrides: 'min-w-7' },
      a11yVariants: [
        { name: 'a text label', props: { children: 'Remove' } },
        { name: 'an icon', props: { children: <Glyph /> } },
        { name: 'disabled', props: { disabled: true } },
      ],
    });
  });

  testNoImplicitSubmit(InteractionTag, {
    defaultProps: {
      children: [
        <InteractionTag.Primary key="primary">Cherry</InteractionTag.Primary>,
        <InteractionTag.Secondary key="secondary" />,
      ],
    },
  });

  testCompoundExposure(InteractionTag, ['Primary', 'Secondary']);

  it('exposes the parts under their flat names', () => {
    expect(InteractionTagPrimary).toBe(InteractionTag.Primary);
    expect(InteractionTagSecondary).toBe(InteractionTag.Secondary);
  });

  it('renders the same with parts as client references', async () => {
    const user = userEvent.setup();
    const LazyPrimary = asClientReference(InteractionTagPrimary);
    const LazySecondary = asClientReference(InteractionTagSecondary);
    const plain = renderToString(
      <InteractionTag value="cherry" selected>
        <InteractionTag.Primary icon={<Glyph />}>Cherry</InteractionTag.Primary>
        <InteractionTag.Secondary />
      </InteractionTag>,
    );
    const onClick = vi.fn();
    const lazy = (
      <InteractionTag value="cherry" selected>
        <LazyPrimary icon={<Glyph />}>Cherry</LazyPrimary>
        <LazySecondary onClick={onClick} />
      </InteractionTag>
    );
    expect(renderToString(lazy)).toBe(plain);

    render(lazy);
    expect(primary()).toHaveAttribute('aria-pressed', 'true');
    await user.click(primary());
    await user.keyboard('{Delete}');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(secondary()).toHaveAttribute('data-wave-tag-dismiss', '');
  });

  it('never nests a button in a button', () => {
    const warnings = spyOnWarnings();
    const { container } = render(
      <>
        <InteractionTag selected>
          <InteractionTag.Primary
            media={<Avatar name="Katri Athokas" />}
            icon={<Glyph />}
            secondaryText="Designer"
          >
            Katri
          </InteractionTag.Primary>
          <InteractionTag.Secondary>
            <Glyph testId="custom" />
          </InteractionTag.Secondary>
        </InteractionTag>
        <InteractionTag>
          <InteractionTag.Primary>Fig</InteractionTag.Primary>
          <InteractionTag.Secondary>
            <button type="button">
              <Glyph testId="unwrapped" />
            </button>
          </InteractionTag.Secondary>
        </InteractionTag>
        <TagGroup aria-label="Fruit">
          <InteractionTag value="plum">
            <InteractionTag.Primary>Plum</InteractionTag.Primary>
            <InteractionTag.Secondary />
          </InteractionTag>
        </TagGroup>
      </>,
    );
    expect(container.querySelector('button button')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(6);
    expect(warnings()).toEqual([BUTTON_CHILD_WARNING]);
  });

  describe('names (D43)', () => {
    it('names the Secondary after the primary text: Dismiss Cherry', () => {
      render(<Cherry />);
      const button = secondary();
      const [labelId, textId] = (button.getAttribute('aria-labelledby') ?? '').split(' ');
      expect(document.getElementById(labelId)).toHaveTextContent('Dismiss');
      expect(document.getElementById(labelId)).toHaveClass('sr-only');
      expect(document.getElementById(textId)).toBe(screen.getByText('Cherry'));
      expect(screen.getByText('Cherry')).toHaveClass(interactionTagPrimaryClassNames.primaryText);
    });

    it('dismissLabel localises it', () => {
      render(<Cherry secondaryProps={{ dismissLabel: 'Entfernen' }} />);
      expect(secondary('Entfernen Cherry')).toBeInTheDocument();
    });

    it('a text label in the children replaces dismissLabel, also when a child component renders it after mount', async () => {
      const setTextRef = React.createRef<(text: string) => void>();
      function LateText({ ref }: { ref: React.Ref<(text: string) => void> }) {
        const [text, setText] = React.useState('');
        React.useImperativeHandle(ref, () => setText, []);
        return <>{text}</>;
      }
      render(
        <>
          <Cherry secondaryProps={{ children: 'Remove' }} />
          <InteractionTag>
            <InteractionTag.Primary>Plum</InteractionTag.Primary>
            <InteractionTag.Secondary>
              <Glyph />
              <LateText ref={setTextRef} />
            </InteractionTag.Secondary>
          </InteractionTag>
        </>,
      );
      expect(secondary('Remove Cherry')).toHaveTextContent('Remove');
      const plum = secondary('Dismiss Plum');

      act(() => setTextRef.current?.('Delete'));
      await waitFor(() => expect(plum).toHaveAccessibleName('Delete Plum'));
      act(() => setTextRef.current?.(''));
      await waitFor(() => expect(plum).toHaveAccessibleName('Dismiss Plum'));
    });

    it('icon children keep Dismiss Cherry', () => {
      render(
        <>
          <Cherry secondaryProps={{ children: <Glyph /> }} />
          <InteractionTag>
            <InteractionTag.Primary>Plum</InteractionTag.Primary>
            <InteractionTag.Secondary>×</InteractionTag.Secondary>
          </InteractionTag>
        </>,
      );
      expect(secondary()).toContainElement(screen.getByTestId('glyph'));
      expect(secondary('Dismiss Plum')).toBeInTheDocument();
    });

    it('a consumer aria-label replaces the name and drops aria-labelledby', () => {
      render(<Cherry secondaryProps={{ 'aria-label': 'Remove the cherry filter' }} />);
      const button = secondary('Remove the cherry filter');
      expect(button).not.toHaveAttribute('aria-labelledby');
      expect(button.querySelector('.sr-only')).toBeNull();
    });

    it('a consumer aria-labelledby replaces ours', () => {
      render(
        <>
          <span id="discard-label">Discard</span>
          <Cherry secondaryProps={{ 'aria-labelledby': 'discard-label' }} />
        </>,
      );
      expect(secondary('Discard')).toHaveAttribute('aria-labelledby', 'discard-label');
    });

    it("leaves the secondary text out of the Secondary's name", () => {
      render(
        <InteractionTag>
          <InteractionTag.Primary secondaryText="Fruit">Cherry</InteractionTag.Primary>
          <InteractionTag.Secondary />
        </InteractionTag>,
      );
      expect(secondary()).toBeInTheDocument();
      expect(primary('Cherry Fruit')).toBeInTheDocument();
    });

    it('names the Primary by its text and secondary text, with media and icon hidden', () => {
      render(
        <InteractionTag>
          <InteractionTag.Primary
            media={<Avatar name="Katri Athokas" />}
            icon={<Glyph />}
            secondaryText="Designer"
          >
            Katri
          </InteractionTag.Primary>
          <InteractionTag.Secondary />
        </InteractionTag>,
      );
      const button = primary('Katri Designer');
      const media = button.querySelector(`.${interactionTagPrimaryClassNames.media}`);
      expect(media).toHaveAttribute('aria-hidden', 'true');
      expect(within(button).queryByRole('img')).toBeNull();
      expect(screen.getByTestId('glyph').parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(secondary('Dismiss Katri')).toBeInTheDocument();
    });
  });

  describe('glyph', () => {
    it.each([
      ['an empty array', []],
      ['an empty fragment', <></>],
      ['false', false],
    ] as const)(
      'shows the default glyph for children that render nothing: %s',
      (_name, children) => {
        render(<Cherry secondaryProps={{ children }} />);
        const glyph = secondary().querySelector('[data-wave-icon="dismiss"]');
        expect(glyph).toHaveClass(interactionTagSecondaryClassNames.dismissIcon);
        expect(glyph).toHaveAttribute('aria-hidden', 'true');
      },
    );

    it('unwraps a button child and warns InteractionTag.Secondary:button-child', async () => {
      const user = userEvent.setup();
      const warnings = spyOnWarnings();
      const onChildClick = vi.fn();
      const onClick = vi.fn();
      render(
        <Cherry
          secondaryProps={{
            onClick,
            children: (
              <button type="button" className="wave-test-child" onClick={onChildClick}>
                <Glyph />
              </button>
            ),
          }}
        />,
      );
      const button = secondary();
      expect(button.querySelector('button')).toBeNull();
      expect(button.querySelector('.wave-test-child')).toBeNull();
      expect(screen.getByTestId('glyph').parentElement).toHaveClass(
        interactionTagSecondaryClassNames.dismissIcon,
      );
      await user.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onChildClick).not.toHaveBeenCalled();
      expect(warnings()).toEqual([BUTTON_CHILD_WARNING]);
    });
  });

  describe('Delete and Backspace (D33)', () => {
    it.each(['Delete', 'Backspace'])('%s on the Secondary clicks it (its onClick once)', (key) => {
      const onClick = vi.fn();
      render(<Cherry secondaryProps={{ onClick }} />);
      expect(fireEvent.keyDown(secondary(), { key })).toBe(false);
      expect(onClick).toHaveBeenCalledTimes(1);
      // The button's own click: a keyboard activation (detail 0).
      expect(onClick.mock.calls[0][0].detail).toBe(0);
    });

    it.each(['Delete', 'Backspace'])('%s on the Primary clicks the Secondary', (key) => {
      const onPrimaryClick = vi.fn();
      const onClick = vi.fn();
      render(<Cherry primaryProps={{ onClick: onPrimaryClick }} secondaryProps={{ onClick }} />);
      fireEvent.keyDown(primary(), { key });
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onPrimaryClick).not.toHaveBeenCalled();
    });

    it('do nothing on a Primary without a Secondary or with a disabled one', () => {
      const onClick = vi.fn();
      const { rerender } = render(<Cherry secondaryProps={false} />);
      // Not handled at all: the key's default is left alone.
      expect(fireEvent.keyDown(primary(), { key: 'Delete' })).toBe(true);
      rerender(<Cherry secondaryProps={{ disabled: true, onClick }} />);
      expect(fireEvent.keyDown(primary(), { key: 'Backspace' })).toBe(true);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('ignore a repeated key, Ctrl, Alt and Meta, and a composition', () => {
      const onClick = vi.fn();
      render(<Cherry secondaryProps={{ onClick }} />);
      for (const target of [primary(), secondary()]) {
        fireEvent.keyDown(target, { key: 'Delete', repeat: true });
        fireEvent.keyDown(target, { key: 'Backspace', ctrlKey: true });
        fireEvent.keyDown(target, { key: 'Delete', altKey: true });
        fireEvent.keyDown(target, { key: 'Delete', metaKey: true });
        fireEvent.keyDown(target, { key: 'Backspace', isComposing: true });
      }
      expect(onClick).not.toHaveBeenCalled();
    });

    it("a consumer onKeyDown runs first and its preventDefault() cancels the key; the Secondary onClick's preventDefault() cancels the group", () => {
      const onDismiss = vi.fn();
      const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
      render(
        <TagGroup aria-label="Fruit" onDismiss={onDismiss}>
          <Cherry
            value="cherry"
            primaryProps={{ onKeyDown: (event) => event.preventDefault() }}
            secondaryProps={{ onClick }}
          />
        </TagGroup>,
      );
      fireEvent.keyDown(primary(), { key: 'Delete' });
      expect(onClick).not.toHaveBeenCalled();
      fireEvent.keyDown(secondary(), { key: 'Delete' });
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('standalone', () => {
    it('has two Tab stops, Primary then Secondary', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Cherry />
          <button type="button">After</button>
        </>,
      );
      await user.tab();
      expect(primary()).toHaveFocus();
      await user.tab();
      expect(secondary()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('a boolean selected sets aria-pressed and data-selected; undefined sets none (D45)', () => {
      const { rerender } = render(<Cherry selected data-testid="tag" />);
      const tag = screen.getByTestId('tag');
      expect(tag).toHaveAttribute('data-selected', '');
      expect(primary()).toHaveAttribute('aria-pressed', 'true');
      expect(primary()).toHaveAttribute('data-selected', '');
      expect(secondary()).toHaveAttribute('data-selected', '');
      expect(secondary()).not.toHaveAttribute('aria-pressed');

      rerender(<Cherry selected={false} data-testid="tag" />);
      expect(primary()).toHaveAttribute('aria-pressed', 'false');
      for (const element of [tag, primary(), secondary()]) {
        expect(element).not.toHaveAttribute('data-selected');
      }

      rerender(<Cherry data-testid="tag" />);
      expect(primary()).not.toHaveAttribute('aria-pressed');
      expect(tag).not.toHaveAttribute('data-selected');
    });

    it('calls the consumer onClick of the Primary, and nothing more, outside a TagGroup', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Cherry selected={false} primaryProps={{ onClick }} />);
      await user.click(primary());
      expect(onClick).toHaveBeenCalledTimes(1);
      // `selected` is the app's state: a click does not toggle it.
      expect(primary()).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('disabled (D25)', () => {
    it('disables both buttons natively and sets data-disabled on the root', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <>
          <Cherry disabled data-testid="tag" secondaryProps={{ onClick }} />
          <button type="button">After</button>
        </>,
      );
      expect(primary()).toBeDisabled();
      expect(secondary()).toBeDisabled();
      const tag = screen.getByTestId('tag');
      expect(tag).toHaveAttribute('data-disabled', '');
      // Each button dims itself; the root is not dimmed.
      expect(tag).not.toHaveClass('opacity-50');
      for (const button of [primary(), secondary()]) {
        expect(button).toHaveClass(
          'disabled:cursor-not-allowed',
          'disabled:opacity-50',
          ...forcedColors.disabled.split(' '),
        );
      }
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      fireEvent.click(secondary());
      fireEvent.keyDown(secondary(), { key: 'Delete' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it("a part's disabled disables only it; a part cannot re-enable a disabled tag", () => {
      const { rerender } = render(<Cherry secondaryProps={{ disabled: true }} />);
      expect(primary()).toBeEnabled();
      expect(secondary()).toBeDisabled();
      rerender(
        <Cherry disabled primaryProps={{ disabled: false }} secondaryProps={{ disabled: false }} />,
      );
      expect(primary()).toBeDisabled();
      expect(secondary()).toBeDisabled();
    });

    it('a button disabled while it has focus keeps it until focus leaves it', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onPrimaryClick = vi.fn();
      const ui = (disabled: boolean) => (
        <>
          <Cherry
            disabled={disabled}
            primaryProps={{ onClick: onPrimaryClick }}
            secondaryProps={{ onClick }}
          />
          <button type="button">After</button>
        </>
      );
      const { rerender } = render(ui(false));
      await user.tab();
      await user.tab();
      expect(secondary()).toHaveFocus();

      rerender(ui(true));
      const held = secondary();
      expect(held).toHaveFocus();
      expect(held).toHaveAttribute('aria-disabled', 'true');
      expect(held).toHaveAttribute('data-disabled-focusable', '');
      expect(held).not.toBeDisabled();
      // The unfocused Primary is natively disabled at once.
      expect(primary()).toBeDisabled();
      await user.keyboard('{Enter} {Delete}{Backspace}');
      expect(onClick).not.toHaveBeenCalled();

      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(held).toBeDisabled();
      expect(held).not.toHaveAttribute('aria-disabled');

      // The Primary is held too, and Delete on it dismisses nothing.
      rerender(ui(false));
      act(() => primary().focus());
      rerender(ui(true));
      expect(primary()).toHaveFocus();
      expect(primary()).toHaveAttribute('aria-disabled', 'true');
      await user.keyboard('{Enter}{Delete}');
      expect(onPrimaryClick).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  it('renders data-appearance, data-size and data-shape with their defaults (filled, medium, circular)', () => {
    render(<Cherry data-testid="tag" />);
    const tag = screen.getByTestId('tag');
    expect(tag).toHaveAttribute('data-appearance', 'filled');
    expect(tag).toHaveAttribute('data-size', 'medium');
    expect(tag).toHaveAttribute('data-shape', 'circular');
    expect(tag).toHaveAttribute('data-wave-tag-item', '');
    expect(tag).not.toHaveAttribute('data-selected');
    expect(tag).not.toHaveAttribute('data-disabled');
    expect(tag).not.toHaveAttribute('role');
    // The default box (Phase 4 rule 14): no default look changes by accident.
    expect(Array.from(tag.classList).sort()).toEqual(
      [
        interactionTagClassNames.root,
        'group/interaction-tag',
        'inline-flex',
        'items-stretch',
      ].sort(),
    );
    expect(primary()).toHaveClass(
      'min-h-7',
      'text-body-1',
      'ps-2.75',
      'pe-2.75',
      'bg-muted',
      'rounded-full',
    );
    expect(secondary()).toHaveClass('min-w-7', 'bg-muted', 'rounded-e-full', 'rounded-s-none');
  });

  describe('look (D46)', () => {
    const gate = 'not-disabled:not-aria-disabled:';
    const LOOKS: Record<TagAppearance | 'selected', readonly string[]> = {
      filled: [
        'border-transparent',
        'bg-muted',
        'text-foreground',
        `${gate}hover:bg-muted-hover`,
        `${gate}active:bg-muted-pressed`,
      ],
      outline: [
        'border-stroke',
        'bg-transparent',
        'text-foreground',
        `${gate}hover:border-stroke-hover`,
        `${gate}hover:bg-subtle-hover`,
        `${gate}active:bg-subtle-pressed`,
      ],
      brand: [
        'border-transparent',
        'bg-selected',
        'text-selected-foreground',
        `${gate}hover:bg-selected-hover`,
        `${gate}active:bg-selected-pressed`,
      ],
      selected: [
        'border-primary',
        'bg-primary',
        'text-primary-foreground',
        `${gate}hover:bg-primary-hover`,
        `${gate}active:bg-primary-pressed`,
        ...forcedColors.selectedContainer.split(' '),
        'forced-colors:border-[Highlight]',
      ],
    };
    const DIVIDER: Record<TagAppearance | 'selected', string> = {
      filled: 'border-s-stroke',
      outline: 'border-s-stroke',
      brand: 'border-s-stroke',
      selected: 'border-s-primary-foreground',
    };
    const RAW_COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\b(?:white|black)\b|-(?:gray|grey|blue|red)-\d/i;

    it.each([...APPEARANCES, 'selected'] as const)(
      'draws the %s look on both buttons, with its hover and pressed fills and the divider',
      (look) => {
        render(
          look === 'selected' ? (
            <Cherry selected data-testid="tag" />
          ) : (
            <Cherry appearance={look} data-testid="tag" />
          ),
        );
        expect(screen.getByTestId('tag')).toHaveAttribute(
          'data-appearance',
          look === 'selected' ? 'filled' : look,
        );
        for (const button of [primary(), secondary()]) {
          expect(button).toHaveClass(...LOOKS[look], 'border');
          expect(button.outerHTML).not.toMatch(RAW_COLOR);
        }
        expect(secondary()).toHaveClass(DIVIDER[look]);
        expect(primary().className).not.toContain('border-s-');
      },
    );

    it('draws disabled over the selected look', () => {
      render(<Cherry selected disabled data-testid="tag" />);
      expect(screen.getByTestId('tag')).toHaveAttribute('data-selected', '');
      expect(primary()).toHaveAttribute('aria-pressed', 'true');
      for (const button of [primary(), secondary()]) {
        expect(button).not.toHaveClass('bg-primary', 'border-primary');
        expect(button).toHaveClass('bg-muted', ...forcedColors.disabled.split(' '));
      }
    });

    const METRICS: Record<
      TagSize,
      {
        primary: readonly string[];
        iconStart: string;
        mediaStart: string;
        joinedEnd: string;
        secondary: readonly string[];
        glyph: string;
        avatar: readonly string[];
      }
    > = {
      medium: {
        primary: ['min-h-7', 'gap-1', 'text-body-1', 'ps-2.75', 'pe-2.75'],
        iconStart: 'ps-1.75',
        mediaStart: 'ps-px',
        joinedEnd: 'group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-2',
        secondary: ['min-w-7', 'text-body-1'],
        glyph: '12',
        avatar: avatarSizeClasses['extra-small'].split(' '),
      },
      small: {
        primary: ['min-h-6', 'gap-1', 'text-caption-1', 'ps-1.75', 'pe-1.75'],
        iconStart: 'ps-1.25',
        mediaStart: 'ps-px',
        joinedEnd: 'group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-1.5',
        secondary: ['min-w-6', 'text-caption-1'],
        glyph: '12',
        avatar: ['w-5', 'h-5'],
      },
      'extra-small': {
        primary: ['min-h-5', 'gap-0.5', 'text-caption-1', 'ps-1.75', 'pe-1.75'],
        iconStart: 'ps-1.25',
        mediaStart: 'ps-px',
        joinedEnd: 'group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-1',
        secondary: ['min-w-6', 'text-caption-1'],
        glyph: '10',
        avatar: ['w-4', 'h-4'],
      },
    };

    it.each(SIZES)('sizes the Primary, its slots and the Secondary at %s', (size) => {
      const metrics = METRICS[size];
      render(
        <>
          <Cherry size={size} data-testid="tag" />
          <InteractionTag size={size}>
            <InteractionTag.Primary icon={<Glyph />}>Icon</InteractionTag.Primary>
          </InteractionTag>
          <InteractionTag size={size}>
            <InteractionTag.Primary media={<Avatar name="Katri Athokas" />}>
              Katri
            </InteractionTag.Primary>
          </InteractionTag>
        </>,
      );
      expect(screen.getByTestId('tag')).toHaveAttribute('data-size', size);
      expect(primary()).toHaveClass(...metrics.primary, metrics.joinedEnd);
      expect(secondary()).toHaveClass(...metrics.secondary);
      const glyph = secondary().querySelector('[data-wave-icon="dismiss"]');
      expect(glyph).toHaveAttribute('width', metrics.glyph);
      expect(glyph).toHaveAttribute('height', metrics.glyph);

      const withIcon = primary('Icon');
      expect(withIcon).toHaveClass(metrics.iconStart);
      expect(withIcon.querySelector(`.${interactionTagPrimaryClassNames.icon}`)).toHaveClass(
        '[&>svg]:size-full',
      );
      const withMedia = primary('Katri');
      expect(withMedia).toHaveClass(metrics.mediaStart);
      // The Avatar is hidden with its media: read it from the DOM.
      const avatar = withMedia.querySelector('[role="img"]');
      expect(avatar).toHaveClass(...metrics.avatar);
    });

    it("squares the Primary's end next to a Secondary", () => {
      render(<Cherry shape="rounded" data-testid="tag" />);
      // jsdom has no `:has()`: the classes that read the root's named group are asserted.
      expect(screen.getByTestId('tag')).toHaveClass('group/interaction-tag');
      expect(primary()).toHaveClass(
        'rounded',
        'group-has-[[data-wave-tag-dismiss]]/interaction-tag:rounded-e-none',
        'group-has-[[data-wave-tag-dismiss]]/interaction-tag:border-e-0',
      );
      expect(secondary()).toHaveClass('rounded-s-none', 'rounded-e');
      expect(secondary()).toHaveAttribute('data-wave-tag-dismiss', '');
    });

    it.each(SHAPES)('draws the %s shape', (shape) => {
      render(<Cherry shape={shape} data-testid="tag" />);
      expect(screen.getByTestId('tag')).toHaveAttribute('data-shape', shape);
      expect(primary()).toHaveClass(shape === 'circular' ? 'rounded-full' : 'rounded');
      expect(secondary()).toHaveClass(shape === 'circular' ? 'rounded-e-full' : 'rounded-e');
    });

    it('keeps the focus ring above the neighbour', () => {
      render(<Cherry />);
      for (const button of [primary(), secondary()]) {
        expect(button).toHaveClass(...focusRing.split(' '), 'relative', 'focus-visible:z-10');
        expect(button).toHaveClass('transition-colors', 'motion-reduce:transition-none');
      }
    });

    it('gives both buttons a 24px-tall target at extra-small', () => {
      render(
        <>
          <Cherry size="extra-small" />
          <InteractionTag size="small">
            <InteractionTag.Primary>Plum</InteractionTag.Primary>
            <InteractionTag.Secondary />
          </InteractionTag>
        </>,
      );
      const hit = ['before:absolute', 'before:inset-x-0', 'before:-inset-y-0.5'];
      for (const button of [primary(), secondary()]) expect(button).toHaveClass(...hit);
      for (const button of [primary('Plum'), secondary('Dismiss Plum')]) {
        expect(button).not.toHaveClass('before:-inset-y-0.5');
      }
    });

    it('turns the dismiss glyph Highlight on hover in forced colours', () => {
      render(<Cherry />);
      expect(secondary()).toHaveClass(
        'forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]',
      );
    });

    it('gives the buttons their own padding and background (C-NATIVE)', () => {
      render(<Cherry />);
      expect(primary()).toHaveClass('py-0', 'bg-muted');
      expect(secondary()).toHaveClass('py-0', 'px-1.5', 'bg-muted');
    });
  });

  it('sizes an Avatar in the Primary media for the tag; an Avatar own size wins', () => {
    render(
      <>
        <InteractionTag size="small">
          <InteractionTag.Primary media={<Avatar name="Katri Athokas" />}>
            Katri
          </InteractionTag.Primary>
        </InteractionTag>
        <InteractionTag size="small">
          <InteractionTag.Primary media={<Avatar name="Ada Lovelace" size="large" />}>
            Ada
          </InteractionTag.Primary>
        </InteractionTag>
      </>,
    );
    expect(primary('Katri').querySelector('[role="img"]')).toHaveClass('w-5', 'h-5');
    expect(primary('Ada').querySelector('[role="img"]')).toHaveClass(
      ...avatarSizeClasses.large.split(' '),
    );
  });

  it('ignores clicks and keys from a popup (portal) opened from the Primary or the Secondary', () => {
    const onDismiss = vi.fn();
    const onValueChange = vi.fn();
    const onClick = vi.fn();
    const portalTarget = document.createElement('div');
    document.body.appendChild(portalTarget);
    try {
      render(
        <TagGroup
          aria-label="Fruit"
          onDismiss={onDismiss}
          defaultValue={['cherry']}
          onValueChange={onValueChange}
        >
          <InteractionTag value="cherry">
            <InteractionTag.Primary>
              Cherry
              {/* A popup opened from the Primary: in the React tree, outside it in the DOM. */}
              {createPortal(<button type="button">In a popup</button>, portalTarget)}
            </InteractionTag.Primary>
            <InteractionTag.Secondary onClick={onClick}>
              {createPortal(<button type="button">In a dismiss popup</button>, portalTarget)}
            </InteractionTag.Secondary>
          </InteractionTag>
        </TagGroup>,
      );
      for (const name of ['In a popup', 'In a dismiss popup']) {
        const inPopup = screen.getByRole('button', { name });
        fireEvent.keyDown(inPopup, { key: 'Delete' });
        fireEvent.keyDown(inPopup, { key: 'Backspace' });
        fireEvent.click(inPopup);
      }
      // The Secondary's own `onClick` sees the bubbled click (React's portal bubbling), but the
      // group is never told of a dismissal, and the Primary does not toggle.
      expect(onDismiss).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(primary()).toHaveAttribute('aria-pressed', 'true');
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick.mock.calls[0][0].target).toBe(
        screen.getByRole('button', { name: 'In a dismiss popup' }),
      );
    } finally {
      portalTarget.remove();
    }
  });

  it('moves focus to the Primary when a focused Secondary unmounts', async () => {
    const user = userEvent.setup();
    function Lockable() {
      const [locked, setLocked] = React.useState(false);
      return (
        <InteractionTag>
          <InteractionTag.Primary>Cherry</InteractionTag.Primary>
          {!locked && <InteractionTag.Secondary onClick={() => setLocked(true)} />}
        </InteractionTag>
      );
    }
    render(<Lockable />);
    await user.tab();
    await user.tab();
    expect(secondary()).toHaveFocus();
    await user.keyboard('{Enter}');
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Dismiss Cherry' })).toBeNull();
    expect(primary()).toHaveFocus();
  });

  describe('missing context (C-CONTEXT)', () => {
    it('throws outside an InteractionTag in development', () => {
      expectThrows(
        <InteractionTag.Primary>Cherry</InteractionTag.Primary>,
        '[WaveUI] InteractionTag.Primary must be used within InteractionTag',
      );
      expectThrows(
        <InteractionTag.Secondary />,
        '[WaveUI] InteractionTag.Secondary must be used within InteractionTag',
      );
    });

    it('logs once and renders inert in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ui = (tick: number) => (
        <>
          <InteractionTagPrimary>Cherry {tick}</InteractionTagPrimary>
          <InteractionTagSecondary />
        </>
      );
      const { rerender } = render(ui(0));
      rerender(ui(1));
      expect(error.mock.calls).toEqual([
        ['[WaveUI] InteractionTag.Primary must be used within InteractionTag'],
        ['[WaveUI] InteractionTag.Secondary must be used within InteractionTag'],
      ]);
      expect(screen.getByRole('button', { name: 'Cherry 1' })).not.toHaveAttribute('aria-pressed');
      // Inert: the Secondary is named by its own label, with no dangling reference.
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeEnabled();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Cherry 1' }), { key: 'Delete' });
    });
  });

  it('uses only logical corner, divider and inset classes, in RTL', () => {
    renderWithProviders(
      <InteractionTag selected data-testid="tag">
        <InteractionTag.Primary
          media={<Avatar name="Katri Athokas" />}
          icon={<Glyph />}
          secondaryText="Designer"
        >
          Katri
        </InteractionTag.Primary>
        <InteractionTag.Secondary />
      </InteractionTag>,
      { dir: 'rtl' },
    );
    const physical =
      /(?:^|[\s:])(?:-?[pm][lr]-|left-|right-|rounded-[lr]-|rounded-[tb][lr]-|border-[lr]-|border-[lr](?:\s|$)|text-(?:left|right))/;
    const tag = screen.getByTestId('tag');
    for (const element of [tag, ...tag.querySelectorAll('*')]) {
      expect(element.getAttribute('class') ?? '').not.toMatch(physical);
    }
    expect(primary('Katri Designer')).toHaveClass('ps-px', 'text-start');
    expect(secondary('Dismiss Katri')).toHaveClass('rounded-s-none', 'border-s-primary-foreground');
  });

  it('renders and hydrates with a text-label child and selected', async () => {
    const errors = vi.spyOn(console, 'error');
    const ui = (
      <InteractionTag value="cherry" selected>
        <InteractionTag.Primary secondaryText="Fruit">Cherry</InteractionTag.Primary>
        <InteractionTag.Secondary>Remove</InteractionTag.Secondary>
      </InteractionTag>
    );
    const html = renderToString(ui);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-wave-tag-dismiss=""');
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      // Named on the server from the literal children.
      expect(within(container).getByRole('button', { name: 'Remove Cherry' })).toBeInTheDocument();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, ui);
      });
      expect(errors).not.toHaveBeenCalled();
      expect(within(container).getByRole('button', { name: 'Remove Cherry' })).toBeInTheDocument();
      expect(within(container).getByRole('button', { name: 'Cherry Fruit' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      act(() => root?.unmount());
    } finally {
      container.remove();
    }
  });

  it("calls the Primary's and Secondary's onClick once per activation in StrictMode", async () => {
    const user = userEvent.setup();
    const onPrimaryClick = vi.fn();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <Cherry primaryProps={{ onClick: onPrimaryClick }} secondaryProps={{ onClick }} />
      </React.StrictMode>,
    );
    await user.click(primary());
    await user.keyboard('{Enter}');
    expect(onPrimaryClick).toHaveBeenCalledTimes(2);
    await user.click(secondary());
    await user.keyboard(' ');
    fireEvent.keyDown(secondary(), { key: 'Delete' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('types its props', () => {
    expectTypeOf<InteractionTagProps['size']>().toEqualTypeOf<TagSize | undefined>();
    expectTypeOf<InteractionTagProps['appearance']>().toEqualTypeOf<TagAppearance | undefined>();
    expectTypeOf<InteractionTagProps['shape']>().toEqualTypeOf<TagShape | undefined>();
    expectTypeOf<InteractionTagProps['value']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<InteractionTagProps['selected']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<
      React.ComponentProps<typeof InteractionTag>
    >().toEqualTypeOf<InteractionTagProps>();
    expectTypeOf<
      React.ComponentProps<typeof InteractionTagPrimary>
    >().toEqualTypeOf<InteractionTagPrimaryProps>();
    expectTypeOf<
      React.ComponentProps<typeof InteractionTagSecondary>
    >().toEqualTypeOf<InteractionTagSecondaryProps>();
    expectTypeOf<InteractionTagSecondaryProps['dismissLabel']>().toEqualTypeOf<
      string | undefined
    >();
    const elements = [
      // @ts-expect-error the Primary is not polymorphic in 0.11
      <InteractionTag.Primary key="1" as="a" />,
      // @ts-expect-error a part takes no size: the InteractionTag's applies
      <InteractionTag.Primary key="2" size="small" />,
      // @ts-expect-error Fluent's hasSecondaryAction is not needed
      <InteractionTag.Primary key="3" hasSecondaryAction />,
      // @ts-expect-error an InteractionTag has no large size
      <InteractionTag key="4" size="large" />,
      // @ts-expect-error a value is a string
      <InteractionTag key="5" value={1} />,
    ];
    expect(elements).toHaveLength(5);
  });
});
