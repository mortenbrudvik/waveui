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
import { Popover } from '../../overlays/Popover';
import {
  interactionTagClassNames,
  interactionTagPrimaryClassNames,
  interactionTagSecondaryClassNames,
} from '../../../lib/classNames';
import { focusRing, forcedColors } from '../../../lib/styles';
import type { TagAppearance, TagShape, TagSize } from '../../../lib/types';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  findDanglingIdRefsInHtml,
  openingTags,
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
    conflictingClass: { className: 'items-center', overrides: 'wave:items-stretch' },
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
      conflictingClass: { className: 'bg-error', overrides: 'wave:bg-muted' },
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
      conflictingClass: { className: 'min-w-10', overrides: 'wave:min-w-7' },
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
      expect(document.getElementById(labelId)).toHaveClass('wave:sr-only');
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
      expect(button.querySelector('.wave\\:sr-only')).toBeNull();
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

    it('points at no missing id without a Primary, and takes the primary text once one renders', () => {
      function Chip({ withPrimary }: { withPrimary: boolean }) {
        return (
          <InteractionTag>
            {withPrimary && <InteractionTag.Primary>Cherry</InteractionTag.Primary>}
            <InteractionTag.Secondary />
          </InteractionTag>
        );
      }
      const { rerender } = render(<Chip withPrimary={false} />);
      const button = secondary('Dismiss');
      expect(findDanglingIdRefs()).toEqual([]);
      expect(button.getAttribute('aria-labelledby')?.split(' ')).toHaveLength(1);

      rerender(<Chip withPrimary />);
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      rerender(<Chip withPrimary={false} />);
      expect(button).toHaveAccessibleName('Dismiss');
      expect(findDanglingIdRefs()).toEqual([]);
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

    it('a held Enter on the Secondary activates it once', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Cherry secondaryProps={{ onClick }} />);
      await user.tab();
      await user.tab();
      expect(secondary()).toHaveFocus();
      // The browser clicks a button on every repeated Enter (`repeat: true`): only the first
      // press activates it.
      await user.keyboard('{Enter>4/}');
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(fireEvent.keyDown(secondary(), { key: 'Enter', repeat: true })).toBe(false);
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

    it("a consumer aria-pressed on the Primary yields to selected and to a selecting group's value, and passes through otherwise (D45)", () => {
      const { rerender } = render(<Cherry selected primaryProps={{ 'aria-pressed': false }} />);
      expect(primary()).toHaveAttribute('aria-pressed', 'true');

      rerender(<Cherry selected={false} primaryProps={{ 'aria-pressed': true }} />);
      expect(primary()).toHaveAttribute('aria-pressed', 'false');

      rerender(
        <TagGroup aria-label="Fruit" defaultValue={['cherry']}>
          <Cherry value="cherry" primaryProps={{ 'aria-pressed': false }} />
          <Cherry value="plum" primaryProps={{ 'aria-pressed': true }} secondaryProps={false} />
        </TagGroup>,
      );
      const [cherry, plum] = screen.getAllByRole('button', { name: 'Cherry' });
      expect(cherry).toHaveAttribute('aria-pressed', 'true');
      expect(plum).toHaveAttribute('aria-pressed', 'false');

      // A Primary that is no toggle of the tag's keeps the consumer's own state.
      rerender(<Cherry primaryProps={{ 'aria-pressed': true }} data-testid="tag" />);
      expect(primary()).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('tag')).not.toHaveAttribute('data-selected');
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
      expect(tag).not.toHaveClass('wave:opacity-50');
      for (const button of [primary(), secondary()]) {
        expect(button).toHaveClass(
          'wave:disabled:cursor-not-allowed',
          'wave:disabled:opacity-50',
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
        'wave:group/interaction-tag',
        'wave:inline-flex',
        'wave:items-stretch',
      ].sort(),
    );
    expect(primary()).toHaveClass(
      'wave:min-h-7',
      'wave:text-body-1',
      'wave:ps-2.75',
      'wave:pe-2.75',
      'wave:bg-muted',
      'wave:rounded-full',
    );
    expect(secondary()).toHaveClass(
      'wave:min-w-7',
      'wave:bg-muted',
      'wave:rounded-e-full',
      'wave:rounded-s-none',
    );
  });

  describe('look (D46)', () => {
    const gate = 'not-disabled:not-aria-disabled:';
    const LOOKS: Record<TagAppearance | 'selected', readonly string[]> = {
      filled: [
        'wave:border-transparent',
        'wave:bg-muted',
        'wave:text-foreground',
        `wave:${gate}hover:bg-muted-hover`,
        `wave:${gate}active:bg-muted-pressed`,
      ],
      outline: [
        'wave:border-stroke',
        'wave:bg-transparent',
        'wave:text-foreground',
        `wave:${gate}hover:border-stroke-hover`,
        `wave:${gate}hover:bg-subtle-hover`,
        `wave:${gate}active:bg-subtle-pressed`,
      ],
      brand: [
        'wave:border-transparent',
        'wave:bg-selected',
        'wave:text-selected-foreground',
        `wave:${gate}hover:bg-selected-hover`,
        `wave:${gate}active:bg-selected-pressed`,
      ],
      selected: [
        'wave:border-primary',
        'wave:bg-primary',
        'wave:text-primary-foreground',
        `wave:${gate}hover:bg-primary-hover`,
        `wave:${gate}active:bg-primary-pressed`,
        ...forcedColors.selectedContainer.split(' '),
        'wave:forced-colors:border-[Highlight]',
      ],
    };
    const DIVIDER: Record<TagAppearance | 'selected', string> = {
      filled: 'wave:border-s-stroke',
      outline: 'wave:border-s-stroke',
      brand: 'wave:border-s-stroke',
      selected: 'wave:border-s-primary-foreground',
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
          expect(button).toHaveClass(...LOOKS[look], 'wave:border');
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
        expect(button).not.toHaveClass('wave:bg-primary', 'wave:border-primary');
        expect(button).toHaveClass('wave:bg-muted', ...forcedColors.disabled.split(' '));
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
        primary: ['wave:min-h-7', 'wave:gap-1', 'wave:text-body-1', 'wave:ps-2.75', 'wave:pe-2.75'],
        iconStart: 'wave:ps-1.75',
        mediaStart: 'wave:ps-px',
        joinedEnd: 'wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-2',
        secondary: ['wave:min-w-7', 'wave:text-body-1'],
        glyph: '12',
        avatar: avatarSizeClasses['extra-small'].split(' '),
      },
      small: {
        primary: [
          'wave:min-h-6',
          'wave:gap-1',
          'wave:text-caption-1',
          'wave:ps-1.75',
          'wave:pe-1.75',
        ],
        iconStart: 'wave:ps-1.25',
        mediaStart: 'wave:ps-px',
        joinedEnd: 'wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-1.5',
        secondary: ['wave:min-w-6', 'wave:text-caption-1'],
        glyph: '12',
        avatar: ['wave:w-5', 'wave:h-5'],
      },
      'extra-small': {
        primary: [
          'wave:min-h-5',
          'wave:gap-0.5',
          'wave:text-caption-1',
          'wave:ps-1.75',
          'wave:pe-1.75',
        ],
        iconStart: 'wave:ps-1.25',
        mediaStart: 'wave:ps-px',
        joinedEnd: 'wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-1',
        secondary: ['wave:min-w-6', 'wave:text-caption-1'],
        glyph: '10',
        avatar: ['wave:w-4', 'wave:h-4'],
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
        'wave:[&>svg]:size-full',
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
      expect(screen.getByTestId('tag')).toHaveClass('wave:group/interaction-tag');
      expect(primary()).toHaveClass(
        'wave:rounded',
        'wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:rounded-e-none',
        'wave:group-has-[[data-wave-tag-dismiss]]/interaction-tag:border-e-0',
      );
      expect(secondary()).toHaveClass('wave:rounded-s-none', 'wave:rounded-e');
      expect(secondary()).toHaveAttribute('data-wave-tag-dismiss', '');
    });

    it.each(SHAPES)('draws the %s shape', (shape) => {
      render(<Cherry shape={shape} data-testid="tag" />);
      expect(screen.getByTestId('tag')).toHaveAttribute('data-shape', shape);
      expect(primary()).toHaveClass(shape === 'circular' ? 'wave:rounded-full' : 'wave:rounded');
      expect(secondary()).toHaveClass(
        shape === 'circular' ? 'wave:rounded-e-full' : 'wave:rounded-e',
      );
    });

    it('keeps the focus ring above the neighbour', () => {
      render(<Cherry />);
      for (const button of [primary(), secondary()]) {
        expect(button).toHaveClass(
          ...focusRing.split(' '),
          'wave:relative',
          'wave:focus-visible:z-10',
        );
        expect(button).toHaveClass('wave:transition-colors', 'wave:motion-reduce:transition-none');
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
      const hit = ['wave:before:absolute', 'wave:before:inset-x-0', 'wave:before:-inset-y-0.5'];
      for (const button of [primary(), secondary()]) expect(button).toHaveClass(...hit);
      for (const button of [primary('Plum'), secondary('Dismiss Plum')]) {
        expect(button).not.toHaveClass('wave:before:-inset-y-0.5');
      }
    });

    it('turns the dismiss glyph Highlight on hover in forced colours', () => {
      render(<Cherry />);
      expect(secondary()).toHaveClass(
        'wave:forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]',
      );
    });

    it('gives the buttons their own padding and background (C-NATIVE)', () => {
      render(<Cherry />);
      expect(primary()).toHaveClass('wave:py-0', 'wave:bg-muted');
      expect(secondary()).toHaveClass('wave:p-0', 'wave:bg-muted');
    });

    // jsdom has no layout: the width is pinned by its classes. With no padding of its own, a
    // glyph Secondary is its minimum width, 28, 24 or 24px (the 12, 12 or 10px glyph and the 1px
    // borders fit inside); a text label is padded 6px on each side.
    it.each(SIZES)(
      'keeps a glyph Secondary at its width at %s; only a text label is padded',
      (size) => {
        render(
          <>
            <Cherry size={size} />
            <InteractionTag size={size}>
              <InteractionTag.Primary>Plum</InteractionTag.Primary>
              <InteractionTag.Secondary>
                <Glyph />
              </InteractionTag.Secondary>
            </InteractionTag>
            <InteractionTag size={size}>
              <InteractionTag.Primary>Fig</InteractionTag.Primary>
              <InteractionTag.Secondary>Remove</InteractionTag.Secondary>
            </InteractionTag>
          </>,
        );
        const inlinePadding = /(?:^|\s)wave:(?:p[xse]|padding)-/;
        for (const button of [secondary(), secondary('Dismiss Plum'), secondary('Remove Fig')]) {
          expect(button).toHaveClass('wave:p-0', METRICS[size].secondary[0]);
          expect(button.className).not.toMatch(inlinePadding);
        }
        for (const name of ['Dismiss Cherry', 'Dismiss Plum']) {
          const content = secondary(name).querySelector(
            `.${interactionTagSecondaryClassNames.dismissIcon}`,
          );
          expect(content?.getAttribute('class') ?? '').not.toMatch(inlinePadding);
        }
        const label = secondary('Remove Fig').querySelector(
          `.${interactionTagSecondaryClassNames.dismissIcon}`,
        );
        expect(label).toHaveClass('wave:px-1.5');
      },
    );
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
    expect(primary('Katri').querySelector('[role="img"]')).toHaveClass('wave:w-5', 'wave:h-5');
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

  it('ignores clicks and keys from a Popover opened from the Primary', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onValueChange = vi.fn();
    render(
      <TagGroup aria-label="People" onDismiss={onDismiss} onValueChange={onValueChange}>
        <InteractionTag value="katri">
          <Popover>
            <Popover.Trigger>
              <InteractionTag.Primary>Katri</InteractionTag.Primary>
            </Popover.Trigger>
            <Popover.Content title="Katri Athokas">
              <button type="button">Message</button>
            </Popover.Content>
          </Popover>
          <InteractionTag.Secondary />
        </InteractionTag>
        <InteractionTag value="ada">
          <InteractionTag.Primary>Ada</InteractionTag.Primary>
        </InteractionTag>
      </TagGroup>,
    );
    // The click that opens the Popover is the Primary's own: it toggles the tag.
    await user.click(primary('Katri'));
    expect(onValueChange.mock.calls).toEqual([[['katri']]]);
    const inPopover = await screen.findByRole('button', { name: 'Message' });

    await user.click(inPopover);
    act(() => inPopover.focus());
    await user.keyboard('{Delete}{Backspace}{Enter} ');
    // The toolbar's arrow keys do not move focus out of the Popover either.
    await user.keyboard('{ArrowRight}');
    expect(inPopover).toHaveFocus();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(primary('Katri')).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Message' })).toBeNull();
    expect(primary('Katri')).toHaveFocus();
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
    expect(primary('Katri Designer')).toHaveClass('wave:ps-px', 'wave:text-start');
    expect(secondary('Dismiss Katri')).toHaveClass(
      'wave:rounded-s-none',
      'wave:border-s-primary-foreground',
    );
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

describe('InteractionTag — slotProps', () => {
  type PrimarySlotProps = NonNullable<InteractionTagPrimaryProps['slotProps']>;
  type SecondarySlotProps = NonNullable<InteractionTagSecondaryProps['slotProps']>;
  const EVERY_PRIMARY_PART: PrimarySlotProps = { primaryText: {}, secondaryText: {} };
  const EVERY_SECONDARY_PART: SecondarySlotProps = { dismissIcon: {} };
  const all = (root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`));
  const partsOf = (root: ParentNode = document) => [
    ...all(root, interactionTagPrimaryClassNames.primaryText),
    ...all(root, interactionTagPrimaryClassNames.secondaryText),
    ...all(root, interactionTagSecondaryClassNames.dismissIcon),
  ];

  /**
   * A tag with a second line and the default glyph (`glyph` reaches its Secondary), a disabled one
   * with a text label and one with icon children (`label` reaches their Secondaries).
   */
  function Tags({
    primary: primaryParts,
    glyph,
    label = glyph,
  }: {
    primary?: PrimarySlotProps;
    glyph?: SecondarySlotProps;
    label?: SecondarySlotProps;
  }) {
    return (
      <>
        <InteractionTag value="c">
          <InteractionTag.Primary secondaryText="Fruit" slotProps={primaryParts}>
            Cherry
          </InteractionTag.Primary>
          <InteractionTag.Secondary slotProps={glyph} />
        </InteractionTag>
        <InteractionTag value="d" disabled>
          <InteractionTag.Primary slotProps={primaryParts}>Date</InteractionTag.Primary>
          <InteractionTag.Secondary slotProps={label}>Remove</InteractionTag.Secondary>
        </InteractionTag>
        <InteractionTag value="e">
          <InteractionTag.Secondary slotProps={label}>
            <span aria-hidden="true">x</span>
          </InteractionTag.Secondary>
        </InteractionTag>
      </>
    );
  }

  // Captured from c2b9673's dist (client and server agree).
  const BASE_PINS = [
    '<span class="wave-interaction-tag-primary__primary-text wave:text-caption-1 wave:leading-3.5" id="interaction-tag-text-_id0_">',
    '<span class="wave-interaction-tag-primary__primary-text" id="interaction-tag-text-_id1_">',
    '<span class="wave-interaction-tag-primary__secondary-text wave:text-caption-2 wave:leading-3">',
    '<svg aria-hidden="true" class="wave-interaction-tag-secondary__dismiss-icon" data-wave-icon="dismiss" fill="currentColor" focusable="false" height="12" viewBox="0 0 20 20" width="12" xmlns="http://www.w3.org/2000/svg">',
    '<span class="wave-interaction-tag-secondary__dismiss-icon wave:inline-flex wave:items-center wave:justify-center wave:px-1.5" id="interaction-tag-dismiss-content-_id2_">',
    '<span class="wave-interaction-tag-secondary__dismiss-icon wave:inline-flex wave:items-center wave:justify-center" id="interaction-tag-dismiss-content-_id3_">',
  ].join('\n');

  it('renders the parts of c2b9673 (attributes sorted), on the client and the server', () => {
    for (const [primaryParts, secondaryParts] of [
      [undefined, undefined],
      [EVERY_PRIMARY_PART, EVERY_SECONDARY_PART],
    ] as const) {
      const ui = <Tags primary={primaryParts} glyph={secondaryParts} />;
      const view = render(ui);
      expect(openingTags(...partsOf())).toBe(BASE_PINS);
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(ui);
      expect(openingTags(...partsOf(template.content))).toBe(BASE_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    expectInertSlotProps(
      (slotProps: PrimarySlotProps | undefined) => <Tags primary={slotProps} />,
      EVERY_PRIMARY_PART,
    );
    expectInertSlotProps(
      (slotProps: SecondarySlotProps | undefined) => <Tags glyph={slotProps} />,
      EVERY_SECONDARY_PART,
    );
    expectInertSlotProps(
      (slotProps: PrimarySlotProps | undefined) => (
        <TagGroup aria-label="Fruit" value={['plum']} onDismiss={() => {}}>
          <InteractionTag value="plum">
            <InteractionTag.Primary secondaryText="Stone fruit" slotProps={slotProps}>
              Plum
            </InteractionTag.Primary>
            <InteractionTag.Secondary />
          </InteractionTag>
        </TagGroup>
      ),
      EVERY_PRIMARY_PART,
    );
  });

  it('puts your className, style, data-* and ref on each part', () => {
    const refs: Element[] = [];
    const collect = (node: Element | null) => void (node && refs.push(node));
    render(
      <>
        <InteractionTag>
          <InteractionTag.Primary
            secondaryText="Fruit"
            slotProps={{
              primaryText: {
                className: 'my-primary',
                style: { opacity: 0.5 },
                'data-part': 'primaryText',
                ref: collect,
              },
              secondaryText: {
                className: 'my-secondary leading-4',
                style: { opacity: 0.5 },
                'data-part': 'secondaryText',
                ref: collect,
              },
            }}
          >
            Cherry
          </InteractionTag.Primary>
          <InteractionTag.Secondary
            slotProps={{
              dismissIcon: {
                className: 'my-glyph',
                style: { opacity: 0.5 },
                'data-part': 'dismissIcon',
                ref: collect,
              },
            }}
          />
        </InteractionTag>
        <InteractionTag>
          <InteractionTag.Primary>Plum</InteractionTag.Primary>
          <InteractionTag.Secondary
            slotProps={{
              dismissIcon: {
                className: 'my-glyph items-start',
                style: { opacity: 0.5 },
                'data-part': 'dismissIcon',
                ref: collect,
              },
            }}
          >
            Remove
          </InteractionTag.Secondary>
        </InteractionTag>
      </>,
    );
    const [primaryText] = all(document, interactionTagPrimaryClassNames.primaryText);
    const [secondaryText] = all(document, interactionTagPrimaryClassNames.secondaryText);
    const [svg, span] = all(document, interactionTagSecondaryClassNames.dismissIcon);
    expect(svg.localName).toBe('svg');
    expect(span.localName).toBe('span');
    for (const [element, cls, name, mine] of [
      [primaryText, interactionTagPrimaryClassNames.primaryText, 'primaryText', 'my-primary'],
      [
        secondaryText,
        interactionTagPrimaryClassNames.secondaryText,
        'secondaryText',
        'my-secondary',
      ],
      [svg, interactionTagSecondaryClassNames.dismissIcon, 'dismissIcon', 'my-glyph'],
      [span, interactionTagSecondaryClassNames.dismissIcon, 'dismissIcon', 'my-glyph'],
    ] as const) {
      expect(element.classList[0]).toBe(cls);
      expect(element).toHaveClass(mine);
      expect(element).toHaveAttribute('data-part', name);
      expect(element).toHaveStyle({ opacity: '0.5' });
      expect(refs).toContain(element);
    }
    // Your class replaces a conflicting one of the part.
    expect(secondaryText).not.toHaveClass('wave:leading-3');
    expect(span).not.toHaveClass('wave:items-center');
    expect(refs).toHaveLength(4);
  });

  it('locks the attributes the tag sets and the markers it reads', () => {
    const textAttempt = {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Mine',
      'data-roving-container': '',
      'data-wave-tag-item': 'mine',
      'data-wave-tag-dismiss': 'mine',
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as PrimarySlotProps['primaryText'];
    const glyphAttempt = {
      role: 'img',
      tabIndex: 0,
      'aria-hidden': false,
      focusable: 'true',
    } as unknown as SecondarySlotProps['dismissIcon'];
    render(
      <Tags
        primary={{ primaryText: { ...textAttempt, id: 'mine' }, secondaryText: textAttempt }}
        glyph={{ dismissIcon: glyphAttempt }}
        label={{ dismissIcon: { ...textAttempt, id: 'mine-too' } }}
      />,
    );
    expect(openingTags(...partsOf())).toBe(BASE_PINS);
    expect(secondary('Remove Date')).toBeInTheDocument();
  });

  /** InteractionTags in a toolbar TagGroup that removes the dismissed one. */
  function Fruits({ slotProps }: { slotProps?: PrimarySlotProps }) {
    const [fruits, setFruits] = React.useState(['Cherry', 'Plum', 'Fig']);
    return (
      <TagGroup
        aria-label="Fruit"
        onDismiss={(value) => setFruits((current) => current.filter((f) => f !== value))}
      >
        {fruits.map((fruit) => (
          <InteractionTag key={fruit} value={fruit}>
            <InteractionTag.Primary slotProps={slotProps}>{fruit}</InteractionTag.Primary>
            <InteractionTag.Secondary />
          </InteractionTag>
        ))}
      </TagGroup>
    );
  }

  it("keeps the group's arrow order, and focus after a removal on the Dismiss buttons", async () => {
    const user = userEvent.setup();
    const attempt = {
      tabIndex: 0,
      'data-wave-tag-item': '',
      'data-wave-tag-dismiss': '',
    } as unknown as PrimarySlotProps['primaryText'];
    render(<Fruits slotProps={{ primaryText: attempt, secondaryText: attempt }} />);
    const group = screen.getByRole('toolbar', { name: 'Fruit' });
    expect(group.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    await user.tab();
    expect(primary('Cherry')).toHaveFocus();
    const order: Element[] = [];
    for (let step = 0; step < 6; step++) {
      await user.keyboard('{ArrowRight}');
      order.push(document.activeElement as Element);
    }
    expect(order).toEqual([
      secondary('Dismiss Cherry'),
      primary('Plum'),
      secondary('Dismiss Plum'),
      primary('Fig'),
      secondary('Dismiss Fig'),
      primary('Cherry'),
    ]);
    // The removed tag's Secondary hands focus to the next tag's Secondary, not its Primary.
    act(() => secondary('Dismiss Plum').focus());
    await user.keyboard('{Delete}');
    await act(async () => {});
    expect(screen.queryByText('Plum')).toBeNull();
    expect(secondary('Dismiss Fig')).toHaveFocus();
  });

  it('runs your part handlers before the buttons: preventDefault() skips the toggle and the dismissal', () => {
    const order: string[] = [];
    const ui = (prevent: boolean) => (
      <TagGroup
        aria-label="Fruit"
        defaultValue={[]}
        onValueChange={(value) => void order.push(`select ${value.join()}`)}
        onDismiss={() => void order.push('group')}
      >
        <InteractionTag value="cherry">
          <InteractionTag.Primary
            onClick={() => void order.push('primary')}
            slotProps={{
              primaryText: {
                onClick: (event) => {
                  order.push('primaryText');
                  if (prevent) event.preventDefault();
                },
              },
            }}
          >
            Cherry
          </InteractionTag.Primary>
          <InteractionTag.Secondary
            onClick={() => void order.push('secondary')}
            slotProps={{
              dismissIcon: {
                onClick: (event) => {
                  order.push('dismissIcon');
                  if (prevent) event.preventDefault();
                },
              },
            }}
          />
        </InteractionTag>
      </TagGroup>
    );
    const { rerender } = render(ui(false));
    const glyph = () => all(document, interactionTagSecondaryClassNames.dismissIcon)[0];
    fireEvent.click(screen.getByText('Cherry'));
    fireEvent.click(glyph());
    // The dismissal reports the value, then takes it out of the selection.
    expect(order).toEqual([
      'primaryText',
      'primary',
      'select cherry',
      'dismissIcon',
      'secondary',
      'group',
      'select ',
    ]);
    order.length = 0;
    rerender(ui(true));
    fireEvent.click(screen.getByText('Cherry'));
    fireEvent.click(glyph());
    expect(order).toEqual(['primaryText', 'primary', 'dismissIcon', 'secondary']);
  });

  it.each([
    ['a disabled', { disabled: true }, 0],
    ['an enabled', {}, 1],
  ] as const)(
    'calls your part onClick on %s tag as its buttons call their own',
    (_, props, calls) => {
      const parts = {
        primaryText: vi.fn(),
        secondaryText: vi.fn(),
        dismissIcon: vi.fn(),
        label: vi.fn(),
      };
      render(
        <>
          <InteractionTag {...props}>
            <InteractionTag.Primary
              secondaryText="Fruit"
              slotProps={{
                primaryText: { onClick: parts.primaryText },
                secondaryText: { onClick: parts.secondaryText },
              }}
            >
              Cherry
            </InteractionTag.Primary>
            <InteractionTag.Secondary slotProps={{ dismissIcon: { onClick: parts.dismissIcon } }} />
          </InteractionTag>
          <InteractionTag {...props}>
            <InteractionTag.Primary>Plum</InteractionTag.Primary>
            <InteractionTag.Secondary slotProps={{ dismissIcon: { onClick: parts.label } }}>
              Remove
            </InteractionTag.Secondary>
          </InteractionTag>
        </>,
      );
      fireEvent.click(screen.getByText('Cherry'));
      fireEvent.click(screen.getByText('Fruit'));
      for (const glyph of all(document, interactionTagSecondaryClassNames.dismissIcon)) {
        fireEvent.click(glyph);
      }
      for (const handler of Object.values(parts)) expect(handler).toHaveBeenCalledTimes(calls);
    },
  );

  it('does not call your part onClick on buttons held unavailable while they keep focus', async () => {
    const user = userEvent.setup();
    const primaryText = vi.fn();
    const dismissIcon = vi.fn();
    const ui = (disabled: boolean) => (
      <InteractionTag disabled={disabled}>
        <InteractionTag.Primary slotProps={{ primaryText: { onClick: primaryText } }}>
          Cherry
        </InteractionTag.Primary>
        <InteractionTag.Secondary slotProps={{ dismissIcon: { onClick: dismissIcon } }} />
      </InteractionTag>
    );
    const { rerender } = render(ui(false));
    await user.tab();
    expect(primary()).toHaveFocus();
    rerender(ui(true));
    expect(primary()).toHaveAttribute('data-disabled-focusable', '');
    fireEvent.click(screen.getByText('Cherry'));
    expect(primaryText).not.toHaveBeenCalled();
    expect(secondary()).toBeDisabled();
    fireEvent.click(all(document, interactionTagSecondaryClassNames.dismissIcon)[0]);
    expect(dismissIcon).not.toHaveBeenCalled();
  });

  it('keeps naming the Secondary by its children while a new inline ref arrives on every render', async () => {
    const setTextRef = React.createRef<(text: string) => void>();
    function LateText({ ref }: { ref: React.Ref<(text: string) => void> }) {
      const [text, setText] = React.useState('');
      React.useImperativeHandle(ref, () => setText, []);
      return <>{text}</>;
    }
    const seen: Element[] = [];
    function Plum() {
      return (
        <InteractionTag>
          <InteractionTag.Primary>Plum</InteractionTag.Primary>
          <InteractionTag.Secondary
            slotProps={{ dismissIcon: { ref: (node) => void (node && seen.push(node)) } }}
          >
            <Glyph />
            <LateText ref={setTextRef} />
          </InteractionTag.Secondary>
        </InteractionTag>
      );
    }
    const { rerender } = render(<Plum />);
    rerender(<Plum />);
    const plum = secondary('Dismiss Plum');
    expect(seen.length).toBeGreaterThan(0);
    expect(
      seen.every(
        (node) => node === all(document, interactionTagSecondaryClassNames.dismissIcon)[0],
      ),
    ).toBe(true);
    act(() => setTextRef.current?.('Delete'));
    await waitFor(() => expect(plum).toHaveAccessibleName('Delete Plum'));
  });

  it('ignores the parts a Primary without a second line does not draw', () => {
    const error = vi.spyOn(console, 'error');
    render(
      <InteractionTag>
        <InteractionTag.Primary slotProps={{ secondaryText: { className: 'my-secondary' } }}>
          Cherry
        </InteractionTag.Primary>
      </InteractionTag>,
    );
    expect(all(document, interactionTagPrimaryClassNames.secondaryText)).toHaveLength(0);
    expect(document.querySelector('.my-secondary')).toBeNull();
    expect(primary()).not.toHaveAttribute('slotprops');
    expect(error).not.toHaveBeenCalled();
  });

  it('calls each part handler once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const primaryText = vi.fn();
    const dismissIcon = vi.fn();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <InteractionTag>
          <InteractionTag.Primary slotProps={{ primaryText: { onClick: primaryText } }}>
            Cherry
          </InteractionTag.Primary>
          <InteractionTag.Secondary
            onClick={onClick}
            slotProps={{ dismissIcon: { onClick: dismissIcon } }}
          >
            Remove
          </InteractionTag.Secondary>
        </InteractionTag>
      </React.StrictMode>,
    );
    await user.click(screen.getByText('Cherry'));
    await user.click(screen.getByText('Remove'));
    expect(primaryText).toHaveBeenCalledTimes(1);
    expect(dismissIcon).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the parts and the mirrored arrow keys of a right-to-left group', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TagGroup aria-label="Fruit">
        <InteractionTag value="cherry">
          <InteractionTag.Primary slotProps={{ primaryText: { className: 'my-primary' } }}>
            Cherry
          </InteractionTag.Primary>
          <InteractionTag.Secondary slotProps={{ dismissIcon: { className: 'my-glyph' } }} />
        </InteractionTag>
      </TagGroup>,
      { dir: 'rtl' },
    );
    expect(all(document, interactionTagPrimaryClassNames.primaryText)[0]).toHaveClass('my-primary');
    expect(all(document, interactionTagSecondaryClassNames.dismissIcon)[0]).toHaveClass('my-glyph');
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(secondary()).toHaveFocus();
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <>
        <p id="fruit-note">Selected fruit is shown first</p>
        <TagGroup aria-label="Fruit" defaultValue={['cherry']}>
          <InteractionTag value="cherry">
            <InteractionTag.Primary
              secondaryText="Stone fruit"
              slotProps={{
                primaryText: { className: 'my-primary', lang: 'en' },
                secondaryText: { className: 'my-secondary', 'aria-describedby': 'fruit-note' },
              }}
            >
              Cherry
            </InteractionTag.Primary>
            <InteractionTag.Secondary slotProps={{ dismissIcon: { className: 'my-glyph' } }}>
              Remove
            </InteractionTag.Secondary>
          </InteractionTag>
        </TagGroup>
      </>,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof PrimarySlotProps>().toEqualTypeOf<'primaryText' | 'secondaryText'>();
    expectTypeOf<keyof SecondarySlotProps>().toEqualTypeOf<'dismissIcon'>();
    expectTypeOf<NonNullable<PrimarySlotProps['primaryText']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<PrimarySlotProps['secondaryText']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<SecondarySlotProps['dismissIcon']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement | SVGSVGElement> | undefined
    >();
    // @ts-expect-error -- the Primary draws its text
    const text: PrimarySlotProps = { primaryText: { children: 'x' } };
    // @ts-expect-error -- the Secondary's children are the glyph's content
    const glyph: SecondarySlotProps = { dismissIcon: { children: 'x' } };
    expect([text, glyph]).toHaveLength(2);
  });
});
