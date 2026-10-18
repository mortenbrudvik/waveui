/**
 * TagPicker.Option (spec P6-04 D64): an Option with a decorative visual and a second line, whose
 * label is its text alone; both meanings of `TagPickerOption`.
 */
import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { TagPicker, TagPickerOption } from '../TagPicker';
import type { TagPickerOptionProps } from '../TagPicker';
import { Combobox } from '../Combobox';
import { Option } from '../Option';
import type { OptionProps } from '../Option';
import { asClientReference } from '../../../test-utils';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';
import { optionClassNames, tagPickerOptionClassNames } from '../../../lib/classNames';
import type { Slot } from '../../../lib/slot';

function combobox() {
  return screen.getByRole('combobox', { name: 'People' });
}

function People({
  OptionPart = TagPickerOption,
  ...props
}: Partial<React.ComponentProps<typeof TagPicker>> & { OptionPart?: typeof TagPickerOption }) {
  return (
    <TagPicker aria-label="People" {...props}>
      <TagPicker.Control />
      <TagPicker.List>
        <OptionPart value="katri" media={<b>KA</b>} secondaryContent="Designer">
          Katri Athokas
        </OptionPart>
        <OptionPart value="elvia">Elvia Atkins</OptionPart>
      </TagPicker.List>
    </TagPicker>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TagPicker.Option', () => {
  it('renders media aria-hidden with its class and the second line under the text with its class', async () => {
    const user = userEvent.setup();
    render(<People />);
    await user.click(combobox());
    const katri = screen.getByRole('option', { name: /^Katri Athokas\s*Designer$/ });
    expect(katri).toHaveClass(optionClassNames.root, tagPickerOptionClassNames.root);
    const media = within(katri).getByText('KA').parentElement!;
    expect(media).toHaveClass(tagPickerOptionClassNames.media);
    expect(media).toHaveAttribute('aria-hidden', 'true');
    const second = within(katri).getByText('Designer');
    expect(second).toHaveClass(tagPickerOptionClassNames.secondaryContent, 'text-caption-1');
    // The second line follows the text in the same column.
    expect(second.previousElementSibling).toHaveTextContent('Katri Athokas');
  });

  it('names the option with its text and second line', async () => {
    const user = userEvent.setup();
    render(<People />);
    await user.click(combobox());
    expect(screen.getByRole('option', { name: /^Katri Athokas\s*Designer$/ })).toBeInTheDocument();
  });

  it('uses the text alone as the label of the tag, the filter and the announcement', async () => {
    const user = userEvent.setup();
    render(<People />);
    await user.type(combobox(), 'designer');
    // The second line is not part of the label the filter matches.
    expect(screen.queryByRole('option', { name: /Katri/ })).toBeNull();
    await user.clear(combobox());
    await user.type(combobox(), 'katri');
    await user.keyboard('{Enter}');
    const list = screen.getByRole('list', { name: 'Selected' });
    expect(within(list).getByRole('listitem')).toHaveTextContent(/^Katri Athokas$/);
    await waitFor(() => expect(__getAnnouncerText()).toBe('Katri Athokas added, 1 selected'));
  });

  it('its label prop wins', async () => {
    const user = userEvent.setup();
    render(
      <TagPicker aria-label="People" defaultValue={['k']}>
        <TagPicker.Control />
        <TagPicker.List>
          <TagPickerOption value="k" label="Katri">
            <i>Katri A.</i>
          </TagPickerOption>
        </TagPicker.List>
      </TagPicker>,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent(/^Katri$/);
    await user.click(screen.getByRole('button', { name: 'Remove Katri' }));
    await waitFor(() => expect(__getAnnouncerText()).toBe('Katri removed, 0 selected'));
  });

  it('warns TagPicker.Option:label once for children without text, and uses the value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function Icon() {
      return <svg aria-hidden="true" />;
    }
    render(
      <TagPicker aria-label="People" defaultValue={['star']}>
        <TagPicker.Control />
        <TagPicker.List>
          <TagPickerOption value="star">
            <Icon />
          </TagPickerOption>
          <TagPickerOption value="moon">
            <Icon />
          </TagPickerOption>
        </TagPicker.List>
      </TagPicker>,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent(/^star$/);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] TagPicker.Option: the option "star" has no text label, so its value is used. Pass `label` when its children are not plain text: its tag, the filter and the announcements read it.',
      ],
    ]);
  });

  it('renders Option’s DOM without media and secondaryContent', () => {
    const html = (part: React.ReactNode) =>
      renderToString(
        <TagPicker aria-label="People">
          <TagPicker.Control />
          <TagPicker.List>{part}</TagPicker.List>
        </TagPicker>,
      );
    const own = html(<TagPickerOption value="elvia">Elvia</TagPickerOption>);
    const plain = html(
      <Option value="elvia" className={tagPickerOptionClassNames.root}>
        Elvia
      </Option>,
    );
    expect(own).toBe(plain);
  });

  it('works in a Combobox', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox aria-label="Person" onValueChange={onValueChange}>
        <TagPickerOption value="katri" secondaryContent="Designer">
          Katri
        </TagPickerOption>
      </Combobox>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Person' }));
    await user.click(screen.getByRole('option', { name: /^Katri\s*Designer$/ }));
    expect(onValueChange).toHaveBeenCalledWith('katri');
    expect(screen.getByRole('combobox', { name: 'Person' })).toHaveValue('Katri');
  });

  it('renders the same as a client reference', async () => {
    const user = userEvent.setup();
    const ClientOption = asClientReference(TagPickerOption);
    const plain = renderToString(<People defaultValue={['katri']} />);
    const client = renderToString(<People defaultValue={['katri']} OptionPart={ClientOption} />);
    expect(client).toBe(plain);
    render(<People defaultValue={['katri']} OptionPart={ClientOption} />);
    expect(screen.getByRole('listitem')).toHaveTextContent(/^Katri Athokas$/);
    await user.click(combobox());
    await user.click(screen.getByRole('option', { name: 'Elvia Atkins' }));
    expect(screen.getAllByRole('listitem').map((tag) => tag.textContent)).toEqual([
      'Katri Athokas',
      'Elvia Atkins',
    ]);
  });

  it('calls onClick once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <TagPicker aria-label="People">
          <TagPicker.Control />
          <TagPicker.List>
            <TagPickerOption value="katri" onClick={onClick}>
              Katri
            </TagPickerOption>
          </TagPicker.List>
        </TagPicker>
      </React.StrictMode>,
    );
    await user.click(combobox());
    await user.click(screen.getByRole('option', { name: 'Katri' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('types: both meanings of TagPickerOption', () => {
    expectTypeOf<TagPickerOptionProps>().toMatchTypeOf<OptionProps>();
    expectTypeOf<TagPickerOptionProps['media']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TagPickerOptionProps['secondaryContent']>().toEqualTypeOf<
      Slot<'span'> | undefined
    >();
    const entry: TagPickerOption = { value: 'a', label: 'A' };
    expect(entry.label).toBe('A');
    const element = <TagPickerOption value="a" />;
    expect(element.props.value).toBe('a');
  });
});
