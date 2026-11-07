import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tag, type TagProps } from '../Tag';
import { InteractionTag } from '../InteractionTag';
import type { InteractionTagProps } from '../InteractionTag';
import { TagGroup } from '../TagGroup';
import { expectNoA11yViolations } from '../../../test-utils';

/*
 * `disabledFocusable` on Tag and InteractionTag (C-DISABLED): unavailable like `disabled`, but the
 * controls keep their Tab stop and their place in the TagGroup's arrow order.
 */

describe('Tag disabledFocusable', () => {
  it('keeps the Dismiss button focusable, unavailable, in the Tab order', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onDismissClick = vi.fn();
    render(
      <Tag
        dismissible
        disabledFocusable
        onDismiss={onDismiss}
        slotProps={{ dismissButton: { onClick: onDismissClick } }}
      >
        Cherry
      </Tag>,
    );
    const button = screen.getByRole('button', { name: 'Dismiss Cherry' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-disabled', '');
    expect(button).toHaveAttribute('data-disabled-focusable', '');
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}{ }{Delete}{Backspace}');
    await user.click(button);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onDismissClick).not.toHaveBeenCalled();
  });

  it('draws the disabled tag: data-disabled on the root, none of the native disabled', () => {
    render(
      <Tag dismissible disabledFocusable data-testid="tag">
        Cherry
      </Tag>,
    );
    expect(screen.getByTestId('tag')).toHaveAttribute('data-disabled', '');
    // The root is a plain span: no state attributes of a control.
    expect(screen.getByTestId('tag')).not.toHaveAttribute('aria-disabled');
  });

  it('wins over disabled, also a disabled TagGroup', () => {
    render(
      <>
        <Tag dismissible disabled disabledFocusable>
          Cherry
        </Tag>
        <TagGroup aria-label="Group" disabled>
          <Tag dismissible disabledFocusable value="plum">
            Plum
          </Tag>
          <Tag dismissible value="fig">
            Fig
          </Tag>
        </TagGroup>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Dismiss Cherry' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss Plum' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss Fig' })).toBeDisabled();
  });

  it('keeps a link root and its href focusable, with the click blocked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onAncestorClick = vi.fn();
    render(
      <div onClick={onAncestorClick}>
        <Tag as="a" href="#x" disabledFocusable onClick={onClick}>
          Docs
        </Tag>
      </div>,
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveAttribute('href', '#x');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('data-disabled-focusable', '');
    await user.tab();
    expect(link).toHaveFocus();
    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
    expect(onAncestorClick).not.toHaveBeenCalled();
  });

  it('keeps a button root focusable instead of natively disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Tag as="button" disabledFocusable onClick={onClick}>
        Open
      </Tag>,
    );
    const button = screen.getByRole('button', { name: 'Open' });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-disabled-focusable', '');
    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays in the arrow order of a TagGroup toolbar, where a disabled one is skipped', async () => {
    const user = userEvent.setup();
    render(
      <TagGroup aria-label="Tags" dismissible>
        <Tag value="a">A</Tag>
        <Tag value="b" disabledFocusable>
          B
        </Tag>
        <Tag value="c" disabled>
          C
        </Tag>
        <Tag value="d">D</Tag>
      </TagGroup>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss A' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Dismiss B' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    // C is natively disabled: skipped.
    expect(screen.getByRole('button', { name: 'Dismiss D' })).toHaveFocus();
    // One Tab stop in the toolbar.
    expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('does not let the part handlers of its text run on a blocked link root', () => {
    const onClick = vi.fn();
    render(
      <Tag as="a" href="#x" disabledFocusable slotProps={{ primaryText: { onClick } }}>
        Docs
      </Tag>,
    );
    fireEvent.click(screen.getByText('Docs'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is off by default, and does not reach the DOM as an attribute', () => {
    render(
      <Tag dismissible data-testid="tag">
        Cherry
      </Tag>,
    );
    expect(screen.getByRole('button', { name: 'Dismiss Cherry' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(screen.getByTestId('tag')).not.toHaveAttribute('disabledfocusable');
  });

  it('has no axe violations', async () => {
    render(
      <TagGroup aria-label="Tags">
        <Tag dismissible disabledFocusable value="a">
          Cherry
        </Tag>
      </TagGroup>,
    );
    await expectNoA11yViolations();
  });

  it('types disabledFocusable', () => {
    expectTypeOf<TagProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
  });
});

describe('InteractionTag disabledFocusable', () => {
  const tag = (props: Partial<InteractionTagProps> = {}) => (
    <InteractionTag value="cherry" {...props}>
      <InteractionTag.Primary>Cherry</InteractionTag.Primary>
      <InteractionTag.Secondary />
    </InteractionTag>
  );

  it('keeps both buttons focusable, unavailable and in the Tab order', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <InteractionTag value="cherry" disabledFocusable data-testid="tag">
        <InteractionTag.Primary onClick={onPrimary}>Cherry</InteractionTag.Primary>
        <InteractionTag.Secondary onClick={onSecondary} />
      </InteractionTag>,
    );
    const primary = screen.getByRole('button', { name: 'Cherry' });
    const secondary = screen.getByRole('button', { name: 'Dismiss Cherry' });
    expect(screen.getByTestId('tag')).toHaveAttribute('data-disabled', '');
    for (const button of [primary, secondary]) {
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-disabled-focusable', '');
    }
    await user.tab();
    expect(primary).toHaveFocus();
    await user.tab();
    expect(secondary).toHaveFocus();
    await user.keyboard('{Enter}{ }{Delete}{Backspace}');
    await user.click(secondary);
    await user.click(primary);
    expect(onPrimary).not.toHaveBeenCalled();
    expect(onSecondary).not.toHaveBeenCalled();
  });

  it('wins over disabled, and over a disabled TagGroup', () => {
    render(
      <>
        {tag({ disabled: true, disabledFocusable: true })}
        <TagGroup aria-label="Group" disabled>
          {tag({ value: 'plum', disabledFocusable: true })}
          {tag({ value: 'fig' })}
        </TagGroup>
      </>,
    );
    const primaries = screen.getAllByRole('button', { name: 'Cherry' });
    expect(primaries[0]).not.toBeDisabled();
    expect(primaries[1]).not.toBeDisabled();
    expect(primaries[2]).toBeDisabled();
  });

  it('a group does not toggle or dismiss through it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onDismiss = vi.fn();
    render(
      <TagGroup aria-label="Fruit" onValueChange={onValueChange} onDismiss={onDismiss}>
        {tag({ disabledFocusable: true })}
      </TagGroup>,
    );
    const primary = screen.getByRole('button', { name: 'Cherry' });
    await user.click(primary);
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Dismiss Cherry' }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(primary).toHaveAttribute('aria-pressed', 'false');
  });

  it('stays in the arrow order of a TagGroup toolbar', async () => {
    const user = userEvent.setup();
    render(
      <TagGroup aria-label="Tags">
        {tag({ value: 'a' })}
        {tag({ value: 'b', disabledFocusable: true })}
        {tag({ value: 'c', disabled: true })}
      </TagGroup>,
    );
    const primaries = screen.getAllByRole('button', { name: 'Cherry' });
    await user.tab();
    expect(primaries[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(primaries[1]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getAllByRole('button', { name: 'Dismiss Cherry' })[1]).toHaveFocus();
  });

  it('takes the prop on each button alone', async () => {
    const user = userEvent.setup();
    const onSecondary = vi.fn();
    render(
      <InteractionTag value="cherry" data-testid="tag">
        <InteractionTag.Primary disabledFocusable>Cherry</InteractionTag.Primary>
        <InteractionTag.Secondary disabledFocusable onClick={onSecondary} />
      </InteractionTag>,
    );
    const primary = screen.getByRole('button', { name: 'Cherry' });
    const secondary = screen.getByRole('button', { name: 'Dismiss Cherry' });
    expect(primary).toHaveAttribute('data-disabled-focusable', '');
    expect(secondary).toHaveAttribute('data-disabled-focusable', '');
    await user.click(secondary);
    expect(onSecondary).not.toHaveBeenCalled();
    // The root is not disabled by a part.
    expect(screen.getByTestId('tag')).not.toHaveAttribute('data-disabled');
  });

  it('is off by default', () => {
    render(tag());
    expect(screen.getByRole('button', { name: 'Cherry' })).not.toHaveAttribute('aria-disabled');
  });

  it('has no axe violations', async () => {
    render(<TagGroup aria-label="Tags">{tag({ disabledFocusable: true })}</TagGroup>);
    await expectNoA11yViolations();
  });

  it('types disabledFocusable', () => {
    expectTypeOf<InteractionTagProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
  });
});
