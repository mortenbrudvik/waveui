import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagGroup } from '../TagGroup';
import type { TagGroupProps } from '../TagGroup';
import { InteractionTag } from '../InteractionTag';
import { Tag } from '../Tag';
import { Field } from '../../input/Field';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { expectNoA11yViolations } from '../../../test-utils';

const chip = (value: string, label = value) => (
  <InteractionTag key={value} value={value}>
    <InteractionTag.Primary>{label}</InteractionTag.Primary>
  </InteractionTag>
);

const pressed = () =>
  screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent);

describe('TagGroup selectionMode="single"', () => {
  it('selects one tag and replaces the selected one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TagGroup aria-label="Size" selectionMode="single" onValueChange={onValueChange}>
        {chip('s')}
        {chip('m')}
        {chip('l')}
      </TagGroup>,
    );
    await user.click(screen.getByRole('button', { name: 's' }));
    expect(pressed()).toEqual(['s']);
    await user.click(screen.getByRole('button', { name: 'l' }));
    expect(pressed()).toEqual(['l']);
    expect(onValueChange.mock.calls).toEqual([[['s']], [['l']]]);
  });

  it('deselects the selected tag when it is pressed again', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TagGroup
        aria-label="Size"
        selectionMode="single"
        defaultValue={['m']}
        onValueChange={onValueChange}
      >
        {chip('s')}
        {chip('m')}
      </TagGroup>,
    );
    expect(pressed()).toEqual(['m']);
    await user.click(screen.getByRole('button', { name: 'm' }));
    expect(pressed()).toEqual([]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it('works with Enter and Space, and moves with the arrows without selecting', async () => {
    const user = userEvent.setup();
    render(
      <TagGroup aria-label="Size" selectionMode="single" defaultValue={[]}>
        {chip('s')}
        {chip('m')}
      </TagGroup>,
    );
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(pressed()).toEqual([]);
    await user.keyboard('{Enter}');
    expect(pressed()).toEqual(['m']);
    await user.keyboard('{ArrowLeft}{ }');
    expect(pressed()).toEqual(['s']);
  });

  it('is controlled by value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TagGroup
        aria-label="Size"
        selectionMode="single"
        value={['s']}
        onValueChange={onValueChange}
      >
        {chip('s')}
        {chip('m')}
      </TagGroup>,
    );
    await user.click(screen.getByRole('button', { name: 'm' }));
    expect(onValueChange).toHaveBeenCalledWith(['m']);
    expect(pressed()).toEqual(['s']);
  });

  it('calls onValueChange once per press in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <TagGroup aria-label="Size" selectionMode="single" onValueChange={onValueChange}>
          {chip('s')}
          {chip('m')}
        </TagGroup>
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 's' }));
    await user.click(screen.getByRole('button', { name: 'm' }));
    expect(onValueChange.mock.calls).toEqual([[['s']], [['m']]]);
  });

  it('submits at most one entry, and a dismissed selected tag leaves the selection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <form>
        <TagGroup
          aria-label="Size"
          selectionMode="single"
          name="size"
          defaultValue={['m']}
          onValueChange={onValueChange}
          onDismiss={() => {}}
        >
          <InteractionTag value="m">
            <InteractionTag.Primary>m</InteractionTag.Primary>
            <InteractionTag.Secondary />
          </InteractionTag>
        </TagGroup>
      </form>,
    );
    const form = container.querySelector('form') as HTMLFormElement;
    expect(new FormData(form).getAll('size')).toEqual(['m']);
    await user.click(screen.getByRole('button', { name: 'Dismiss m' }));
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it('warns once when several values are selected, and shows them all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <TagGroup aria-label="Size" selectionMode="single" value={['s', 'm']}>
        {chip('s')}
        {chip('m')}
      </TagGroup>,
    );
    expect(pressed()).toEqual(['s', 'm']);
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[WaveUI] TagGroup: a group with selectionMode="single" received several selected values. Pass one value, or use selectionMode="multiple".',
    ]);
  });

  it('multiple stays the default: each Primary toggles its own value', async () => {
    const user = userEvent.setup();
    render(
      <TagGroup aria-label="Size" defaultValue={[]}>
        {chip('s')}
        {chip('m')}
      </TagGroup>,
    );
    await user.click(screen.getByRole('button', { name: 's' }));
    await user.click(screen.getByRole('button', { name: 'm' }));
    expect(pressed()).toEqual(['s', 'm']);
  });

  it('has no axe violations', async () => {
    render(
      <TagGroup aria-label="Size" selectionMode="single" defaultValue={['s']}>
        {chip('s')}
        {chip('m')}
      </TagGroup>,
    );
    await expectNoA11yViolations();
  });

  it('types selectionMode', () => {
    expectTypeOf<TagGroupProps['selectionMode']>().toEqualTypeOf<
      'single' | 'multiple' | undefined
    >();
  });
});

describe('TagGroup in a Field', () => {
  it('is named by the Field label and described by its hint and message', () => {
    renderWithFieldContext(
      <TagGroup>
        <Tag>Cherry</Tag>
      </TagGroup>,
      { hintId: FIELD_TEST_IDS.hintId, errorId: FIELD_TEST_IDS.errorId },
    );
    const group = screen.getByRole('toolbar', { name: FIELD_TEST_TEXT.label });
    expect(group).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
    expect(group).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(group).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
    // A toolbar takes neither aria-invalid nor aria-required.
    expect(group).not.toHaveAttribute('aria-invalid');
    expect(group).not.toHaveAttribute('aria-required');
  });

  it('a list group is named and described the same way', () => {
    renderWithFieldContext(
      <TagGroup role="list">
        <Tag>Cherry</Tag>
      </TagGroup>,
      { hintId: FIELD_TEST_IDS.hintId },
    );
    expect(screen.getByRole('list', { name: FIELD_TEST_TEXT.label })).toHaveAccessibleDescription(
      FIELD_TEST_TEXT.hint,
    );
  });

  it('keeps its own name and ids, joining the description', () => {
    renderWithFieldContext(
      <TagGroup id="mine" aria-label="Own" aria-describedby="extra">
        <Tag>Cherry</Tag>
      </TagGroup>,
      { hintId: FIELD_TEST_IDS.hintId },
    );
    const group = screen.getByRole('toolbar', { name: 'Own' });
    expect(group).toHaveAttribute('id', 'mine');
    expect(group).not.toHaveAttribute('aria-labelledby');
    expect(group.getAttribute('aria-describedby')).toBe(`extra ${FIELD_TEST_IDS.hintId}`);
  });

  it('a required Field makes an empty selecting group natively required', () => {
    const { container } = renderWithFieldContext(
      <form>
        <TagGroup name="fruit" defaultValue={[]}>
          {chip('a')}
        </TagGroup>
      </form>,
      { required: true },
    );
    const form = container.querySelector('form') as HTMLFormElement;
    let valid = true;
    // An invalid event focuses the group (a state update).
    act(() => {
      valid = form.checkValidity();
    });
    expect(valid).toBe(false);
  });

  it('an explicit required={false} wins over a required Field', () => {
    const { container } = renderWithFieldContext(
      <form>
        <TagGroup name="fruit" defaultValue={[]} required={false}>
          {chip('a')}
        </TagGroup>
      </form>,
      { required: true },
    );
    expect((container.querySelector('form') as HTMLFormElement).checkValidity()).toBe(true);
  });

  it('works inside the real Field, which labels it and leaves the control id to the first control', () => {
    render(
      <Field label="Fruit" hint="Pick some">
        <TagGroup defaultValue={['a']}>{chip('a', 'Apple')}</TagGroup>
      </Field>,
    );
    const group = screen.getByRole('toolbar', { name: 'Fruit' });
    expect(group).toHaveAccessibleDescription('Pick some');
  });

  it('has no axe violations', async () => {
    renderWithFieldContext(
      <TagGroup>
        <Tag dismissible>Cherry</Tag>
      </TagGroup>,
      { hintId: FIELD_TEST_IDS.hintId },
    );
    await expectNoA11yViolations();
  });
});
