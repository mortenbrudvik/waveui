import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Tag } from '../Tag';
import type { TagOwnProps, TagProps } from '../Tag';
import { Button } from '../../button/Button';
import { renderWithProviders, testNoImplicitSubmit, testSystemProps } from '../../../test-utils';

const CustomIcon = () => (
  <svg data-testid="custom-icon" width="12" height="12" viewBox="0 0 12 12">
    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" />
  </svg>
);

describe('Tag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(Tag, {
    expectedTag: 'span',
    displayName: 'Tag',
    polymorphic: true,
    defaultProps: { children: 'Label' },
    conflictingClass: { className: 'bg-primary', overrides: 'bg-muted' },
    a11yVariants: [
      { name: 'dismissible', props: { dismissible: true, children: 'Cherry' } },
      {
        name: 'dismissible with a custom icon',
        props: { dismissible: true, children: 'Cherry', dismissIcon: <CustomIcon /> },
      },
    ],
  });

  testNoImplicitSubmit(Tag, { defaultProps: { dismissible: true, children: 'Cherry' } });

  it('renders children', () => {
    render(<Tag>React</Tag>);
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders as a different element via as prop', () => {
    render(
      <Tag as="div" data-testid="tag">
        Label
      </Tag>,
    );
    expect(screen.getByTestId('tag').tagName.toLowerCase()).toBe('div');
  });

  it('uses theme tokens for the chip (C-TOKENS)', () => {
    render(<Tag data-testid="tag">Label</Tag>);
    expect(screen.getByTestId('tag')).toHaveClass('bg-muted', 'text-foreground');
  });

  it('does not show a dismiss button when not dismissible', () => {
    render(<Tag>Label</Tag>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('dismiss button name (data-display#10)', () => {
    it('names the dismiss button after the dismiss label and the tag content', () => {
      render(<Tag dismissible>Cherry</Tag>);
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('gives each tag of a group its own dismiss name', () => {
      render(
        <>
          <Tag dismissible>Red</Tag>
          <Tag dismissible>Blue</Tag>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Dismiss Red' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss Blue' })).toBeInTheDocument();
    });

    it('uses the shared decorative dismiss icon (input-datetime#22)', () => {
      render(<Tag dismissible>Cherry</Tag>);
      const icon = screen
        .getByRole('button', { name: 'Dismiss Cherry' })
        .querySelector('[data-wave-icon="dismiss"]');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('uses a custom dismissLabel (localisation)', () => {
      render(
        <Tag dismissible dismissLabel="Entfernen">
          Kirsche
        </Tag>,
      );
      expect(screen.getByRole('button', { name: 'Entfernen Kirsche' })).toBeInTheDocument();
    });
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Tag dismissible onDismiss={onDismiss}>
        Label
      </Tag>,
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss Label' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses from the keyboard', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Tag dismissible onDismiss={onDismiss}>
        Label
      </Tag>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss Label' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe('dismissIcon slot (data-display#1, feedback-navigation#1)', () => {
    it('renders a custom icon inside the wired dismiss button', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag dismissible onDismiss={onDismiss} dismissIcon={<CustomIcon />}>
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      expect(button).toContainElement(screen.getByTestId('custom-icon'));
      await user.click(screen.getByTestId('custom-icon'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(button).toHaveAccessibleName('Dismiss Cherry');
    });

    it('renders slot object content inside the wired button', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={{ className: 'text-error', children: <CustomIcon /> }}
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
      const icon = screen.getByTestId('custom-icon');
      expect(button).toContainElement(icon);
      expect(icon.parentElement).toHaveClass('text-error');
      await user.click(icon);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('merges a <button> slot into the wired button instead of nesting it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const calls: string[] = [];
      render(
        <Tag
          dismissible
          onDismiss={() => calls.push('onDismiss')}
          dismissIcon={
            <button type="button" className="text-error" onClick={() => calls.push('slot')}>
              <CustomIcon />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Dismiss Cherry');
      expect(buttons[0]).toHaveClass('text-error');
      expect(buttons[0]).toContainElement(screen.getByTestId('custom-icon'));
      await user.click(buttons[0]);
      expect(calls).toEqual(['slot', 'onDismiss']);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[WaveUI] Tag:'));
    });

    it('lets a <button> slot that calls preventDefault() suppress onDismiss', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={
            <button type="button" onClick={(event) => event.preventDefault()}>
              x
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      await user.click(screen.getByRole('button', { name: 'Dismiss Cherry' }));
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('merges a Wave Button slot into the wired button', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onClick = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={<Button appearance="subtle" icon={<CustomIcon />} onClick={onClick} />}
        >
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Dismiss Cherry');
      expect(buttons[0]).not.toHaveAttribute('appearance');
      await user.click(buttons[0]);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('merges the deprecated button-object form onto the wired button with a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onClick = vi.fn();
      render(
        <Tag
          dismissible
          onDismiss={onDismiss}
          dismissIcon={{ as: 'button', onClick, children: <CustomIcon /> }}
        >
          Cherry
        </Tag>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      await user.click(buttons[0]);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });

    it('puts the button attributes of the deprecated button-object form on the dismiss button', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <p id="remove-hint">Removes the filter</p>
          <Tag
            dismissible
            dismissIcon={{
              as: 'button',
              id: 'remove-cherry',
              className: 'text-error',
              'aria-label': 'Remove',
              'aria-describedby': 'remove-hint',
              onClick: () => {},
              children: <CustomIcon />,
            }}
          >
            Cherry
          </Tag>
        </>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      expect(button).toHaveAccessibleDescription('Removes the filter');
      expect(button).toHaveAttribute('id', 'remove-cherry');
      expect(button).toHaveClass('text-error');
      expect(button).not.toHaveAttribute('aria-label');

      const iconSpan = screen.getByTestId('custom-icon').parentElement as HTMLElement;
      expect(iconSpan).toHaveAttribute('aria-hidden', 'true');
      expect(iconSpan).not.toHaveAttribute('aria-label');
      expect(iconSpan).not.toHaveAttribute('aria-describedby');
      expect(iconSpan).not.toHaveAttribute('id');
      expect(iconSpan).not.toHaveClass('text-error');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('`dismissLabel`'));
    });

    it('ignores aria-label on a <button> slot and says so (the name comes from dismissLabel)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          dismissIcon={
            <button type="button" aria-label="Remove">
              <CustomIcon />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      expect(button).not.toHaveAttribute('aria-label');
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/aria-label.*ignored.*dismissLabel/));
    });

    it('moves aria attributes of an icon slot object to the dismiss button', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <p id="remove-hint">Removes the filter</p>
          <Tag
            dismissible
            dismissIcon={{
              className: 'text-error',
              'aria-label': 'Remove',
              'aria-describedby': 'remove-hint',
              children: <CustomIcon />,
            }}
          >
            Cherry
          </Tag>
        </>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');
      expect(button).toHaveAccessibleDescription('Removes the filter');
      const iconSpan = screen.getByTestId('custom-icon').parentElement as HTMLElement;
      expect(iconSpan).toHaveClass('text-error');
      expect(iconSpan).toHaveAttribute('aria-hidden', 'true');
      expect(iconSpan).not.toHaveAttribute('aria-label');
      expect(iconSpan).not.toHaveAttribute('aria-describedby');
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/aria-label.*ignored.*dismissLabel/));
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    });
  });

  describe('dismiss name from a merged button with a text label (C-SLOTS naming, WCAG 2.5.3)', () => {
    /** Stands in for `<FormattedMessage>`/`<Trans>`: the text comes from a component. */
    function Translated({ text }: { text: string }) {
      return <>{text}</>;
    }

    it('names the button by its visible text plus the tag content (P12 change request)', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <Tag dismissible onDismiss={onDismiss} dismissIcon={<button type="button">Remove</button>}>
          Cherry
        </Tag>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName(expect.stringContaining('Remove'));
      expect(button).toHaveAccessibleName('Remove Cherry');
      await user.click(button);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a Wave Button with a text label', <Button key="b">Remove</Button>, 'Remove Cherry'],
      [
        'a <button> whose child component renders the text (i18n)',
        <button key="t" type="button">
          <Translated text="Entfernen" />
        </button>,
        'Entfernen Cherry',
      ],
      [
        'a <button> with an icon and a text label',
        <button key="i" type="button">
          <CustomIcon />
          Remove
        </button>,
        'Remove Cherry',
      ],
    ])('%s is named by its visible text', (_, dismissIcon, name) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag dismissible dismissIcon={dismissIcon}>
          Cherry
        </Tag>,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName(name);
    });

    it.each([
      ['a lone letter used as a glyph', 'x'],
      ['a symbol', '×'],
      ['an icon', <CustomIcon key="icon" />],
      [
        'aria-hidden text',
        <span key="h" aria-hidden="true">
          Remove
        </span>,
      ],
      [
        'hidden text',
        <span key="h" hidden>
          Remove
        </span>,
      ],
    ])('a <button> whose content is %s keeps "Dismiss Cherry"', (_, children) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag dismissible dismissIcon={<button type="button">{children}</button>}>
          Cherry
        </Tag>,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName('Dismiss Cherry');
    });

    it('keeps "Dismiss Cherry" for text in icon content (slot content is decorative)', () => {
      render(
        <Tag dismissible dismissIcon={<span>Remove</span>}>
          Cherry
        </Tag>,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName('Dismiss Cherry');
    });

    it('still ignores aria-label on the slot: the visible text and the tag content name the button', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Tag
          dismissible
          dismissIcon={
            <button type="button" aria-label="Delete">
              Remove
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Remove Cherry');
      expect(button).not.toHaveAttribute('aria-label');
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/aria-label.*ignored.*dismissLabel/));
    });

    it('follows text that a child component renders or removes later', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setTextRef = React.createRef<(text: string) => void>();
      function LateText({ ref }: { ref: React.Ref<(text: string) => void> }) {
        const [text, setText] = React.useState('');
        React.useImperativeHandle(ref, () => setText, []);
        return <>{text}</>;
      }
      render(
        <Tag
          dismissible
          dismissIcon={
            <button type="button">
              <CustomIcon />
              <LateText ref={setTextRef} />
            </button>
          }
        >
          Cherry
        </Tag>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Dismiss Cherry');

      act(() => setTextRef.current?.('Remove'));
      await waitFor(() => expect(button).toHaveAccessibleName('Remove Cherry'));

      act(() => setTextRef.current?.(''));
      await waitFor(() => expect(button).toHaveAccessibleName('Dismiss Cherry'));
    });

    it('decides the server-rendered name from the literal children', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const host = document.createElement('div');
      document.body.appendChild(host);
      try {
        host.innerHTML = renderToString(
          <>
            <Tag dismissible dismissIcon={<button type="button">Remove</button>}>
              Cherry
            </Tag>
            <Tag dismissible dismissIcon={<button type="button">x</button>}>
              Plum
            </Tag>
          </>,
        );
        const [named, glyph] = within(host).getAllByRole('button');
        expect(named).toHaveAccessibleName('Remove Cherry');
        expect(glyph).toHaveAccessibleName('Dismiss Plum');
      } finally {
        host.remove();
      }
    });
  });

  it('uses logical padding, so the tag is RTL-safe (feedback-navigation#34)', () => {
    renderWithProviders(
      <Tag dismissible data-testid="tag">
        Label
      </Tag>,
      { dir: 'rtl' },
    );
    const tag = screen.getByTestId('tag');
    expect(tag).toHaveClass('ps-3', 'pe-1.5');
    expect(tag.className).not.toMatch(/\bp[lr]-/);
  });

  describe('types (button-provider#8, data-display#1)', () => {
    it('type-checks props against the `as` element', () => {
      const anchorRef = React.createRef<HTMLAnchorElement>();
      const elementRef = React.createRef<HTMLElement>();
      render(
        <>
          <Tag as="a" href="/topics/react" ref={anchorRef}>
            React
          </Tag>
          <Tag ref={elementRef}>Vue</Tag>
        </>,
      );
      expect(anchorRef.current).toBe(screen.getByRole('link', { name: 'React' }));
      expect(elementRef.current?.tagName.toLowerCase()).toBe('span');
    });

    it('rejects props the rendered element does not have', () => {
      const elements = [
        // @ts-expect-error href is not a <span> attribute
        <Tag key="1" href="/nope" />,
        // @ts-expect-error dismissLabel is a string
        <Tag key="2" dismissLabel={3} />,
      ];
      expect(elements).toHaveLength(2);
    });

    it('accepts icon content and the deprecated button-object form for dismissIcon', () => {
      expectTypeOf<{ onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }>().toExtend<
        NonNullable<TagOwnProps['dismissIcon']>
      >();
      expectTypeOf<React.ReactElement>().toExtend<NonNullable<TagOwnProps['dismissIcon']>>();
      expectTypeOf<TagProps>().toEqualTypeOf<TagProps<'span'>>();
      interface FilterTagProps extends TagProps {
        filterId: string;
      }
      expectTypeOf<FilterTagProps>().toHaveProperty('dismissible');
    });
  });
});
