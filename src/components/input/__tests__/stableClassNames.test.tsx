/**
 * Stable class names of the input folder (spec P3-00, Appendix A "input"): every root, part and
 * nested public component carries its registered class on the element the registry names, in
 * every layout where that element renders, portaled popups and the server HTML included. The
 * values are read from the registry, never written as literals.
 */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  calendarClassNames,
  checkboxClassNames,
  colorPickerClassNames,
  colorPickerSwatchesClassNames,
  colorSwatchClassNames,
  comboboxClassNames,
  datePickerClassNames,
  dropdownClassNames,
  emptySwatchClassNames,
  fieldClassNames,
  imageSwatchClassNames,
  infoLabelClassNames,
  inputClassNames,
  labelClassNames,
  listboxClassNames,
  listboxSurfaceClassNames,
  optionClassNames,
  optionGroupClassNames,
  radioGroupClassNames,
  radioGroupItemClassNames,
  ratingClassNames,
  ratingDisplayClassNames,
  ratingItemClassNames,
  searchBoxClassNames,
  selectClassNames,
  sliderClassNames,
  spinButtonClassNames,
  swatchPickerClassNames,
  swatchPickerRowClassNames,
  switchClassNames,
  tagPickerClassNames,
  textareaClassNames,
  timePickerClassNames,
} from '../../../lib/classNames';
import { useListbox } from '../../../hooks/useListbox';
import { useMergedRefs } from '../../../hooks/useMergedRefs';
import { Button } from '../../button/Button';
import { InfoLabel } from '../../data-display/InfoLabel';
import { Calendar } from '../Calendar';
import { Checkbox } from '../Checkbox';
import { ColorPicker } from '../ColorPicker';
import { Combobox, Option, OptionGroup } from '../Combobox';
import { DatePicker } from '../DatePicker';
import { Dropdown } from '../Dropdown';
import { Field } from '../Field';
import { Input } from '../Input';
import { Label } from '../Label';
import { Listbox } from '../Listbox';
import { ListboxSurface, useListboxPopup } from '../Option';
import { RadioGroup } from '../RadioGroup';
import { Rating, RatingDisplay } from '../Rating';
import { SearchBox } from '../SearchBox';
import { Select } from '../Select';
import { Slider } from '../Slider';
import { SpinButton } from '../SpinButton';
import { SwatchPicker } from '../SwatchPicker';
import { ColorSwatch, EmptySwatch, ImageSwatch } from '../SwatchPicker.swatches';
import { Switch } from '../Switch';
import { TagPicker } from '../TagPicker';
import { Textarea } from '../Textarea';
import { TimePicker } from '../TimePicker';

/** Server HTML in a detached element (never appended: src/test-setup.ts checks document.body). */
function parse(html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/**
 * A minimal custom picker on the public listbox primitives (P5-03): its `ListboxSurface` renders
 * the list in place while closed and in the portaled surface while open.
 */
function CustomPicker() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'select-only',
    selectedValues: [],
    onSelect: () => {},
  });
  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef,
  });
  const buttonRef = useMergedRefs<HTMLButtonElement>(anchorRef, setReference);
  return (
    <div ref={rootRef}>
      <button
        type="button"
        aria-label="Font"
        {...listbox.getComboboxProps()}
        aria-expanded={expanded}
        ref={buttonRef}
        onClick={() => setOpen((current) => !current)}
      >
        Pick a font
      </button>
      <ListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        aria-label="Fonts"
      >
        <Option value="georgia">Georgia</Option>
      </ListboxSurface>
    </div>
  );
}

describe('stable class names: input folder', () => {
  it('Input: the <input> is root and input without slot content; the error message is a part', () => {
    render(<Input aria-label="Name" error="Enter a name" />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveClass(inputClassNames.root, inputClassNames.input);
    expect(screen.getByRole('alert')).toHaveClass(inputClassNames.errorMessage);
  });

  it('Input: with slot content the wrapper is the root and the <input> keeps its part class', () => {
    render(<Input aria-label="Price" contentBefore="$" contentAfter="USD" />);
    const input = screen.getByRole('textbox', { name: 'Price' });
    expect(input).toHaveClass(inputClassNames.input);
    expect(input).not.toHaveClass(inputClassNames.root);
    expect(input.parentElement).toHaveClass(inputClassNames.root);
    expect(screen.getByText('$')).toHaveClass(inputClassNames.contentBefore);
    expect(screen.getByText('USD')).toHaveClass(inputClassNames.contentAfter);
  });

  it('Textarea and Select: roots, and each one its own error message class', () => {
    render(
      <>
        <Textarea aria-label="Notes" error="Too short" />
        <Select aria-label="Size" error="Pick a size">
          <option>Small</option>
        </Select>
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveClass(textareaClassNames.root);
    expect(screen.getByRole('combobox', { name: 'Size' })).toHaveClass(selectClassNames.root);
    const [textareaError, selectError] = screen.getAllByRole('alert');
    expect(textareaError).toHaveClass(textareaClassNames.errorMessage);
    expect(textareaError).not.toHaveClass(inputClassNames.errorMessage);
    expect(selectError).toHaveClass(selectClassNames.errorMessage);
  });

  it('Field: root, label, required mark, validation message with its default icon, hint', () => {
    const { container } = render(
      <Field
        label="Email"
        required
        hint="Your work address"
        validationState="error"
        validationMessage="Enter an email"
      >
        <Input />
      </Field>,
    );
    expect(container.firstElementChild).toHaveClass(fieldClassNames.root);
    const label = container.querySelector('label') as HTMLLabelElement;
    expect(label).toHaveClass(fieldClassNames.label);
    expect(within(label).getByText('*')).toHaveClass(fieldClassNames.required);
    const message = screen.getByRole('alert');
    expect(message).toHaveClass(fieldClassNames.validationMessage);
    expect(message.firstElementChild).toHaveClass(fieldClassNames.validationMessageIcon);
    expect(screen.getByText('Your work address')).toHaveClass(fieldClassNames.hint);
  });

  it('Field: a validationMessageIcon slot renders inside the part element', () => {
    render(
      <Field
        label="Email"
        validationState="warning"
        validationMessage="Unusual domain"
        validationMessageIcon={<svg data-testid="custom-icon" />}
      >
        <Input />
      </Field>,
    );
    expect(screen.getByTestId('custom-icon').parentElement).toHaveClass(
      fieldClassNames.validationMessageIcon,
    );
  });

  it('Field: a Label or InfoLabel element passed as label carries the label part', () => {
    render(
      <>
        <Field label={<Label>Name</Label>}>
          <Input />
        </Field>
        <Field label={<InfoLabel info="Used to sign in">Email</InfoLabel>}>
          <Input />
        </Field>
      </>,
    );
    const name = screen.getByText('Name');
    expect(name.tagName).toBe('LABEL');
    expect(name).toHaveClass(labelClassNames.root, fieldClassNames.label);
    // InfoLabel's className lands on its root span, which holds its own <label>.
    const email = screen.getByText('Email');
    expect(email).toHaveClass(labelClassNames.root, infoLabelClassNames.label);
    expect(email.parentElement).toHaveClass(infoLabelClassNames.root, fieldClassNames.label);
  });

  it('Label: custom required content is the required part', () => {
    render(
      <Label required={<span>(required)</span>} htmlFor="name">
        Name
      </Label>,
    );
    expect(screen.getByText('(required)').parentElement).toHaveClass(labelClassNames.required);
  });

  it('Label: root and required mark', () => {
    render(
      <Label required htmlFor="name">
        Name
      </Label>,
    );
    const label = screen.getByText('Name');
    expect(label).toHaveClass(labelClassNames.root);
    expect(within(label).getByText('*')).toHaveClass(labelClassNames.required);
  });

  it('Checkbox: the <label> root, the box and the label text', () => {
    render(<Checkbox label="Subscribe" />);
    const box = screen.getByRole('checkbox', { name: 'Subscribe' });
    expect(box).toHaveClass(checkboxClassNames.indicator);
    expect(box.closest('label')).toHaveClass(checkboxClassNames.root);
    expect(screen.getByText('Subscribe')).toHaveClass(checkboxClassNames.label);
  });

  it('RadioGroup: the group; an item on its <label> (where className lands), radio and text', () => {
    render(
      <RadioGroup aria-label="Size" defaultValue="s">
        <RadioGroup.Item value="s" label="Small" className="wave-test-custom-class" />
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Size' })).toHaveClass(radioGroupClassNames.root);
    const radio = screen.getByRole('radio', { name: 'Small' });
    expect(radio).toHaveClass(radioGroupItemClassNames.indicator);
    expect(radio).not.toHaveClass(radioGroupItemClassNames.root);
    expect(radio.closest('label')).toHaveClass(
      radioGroupItemClassNames.root,
      'wave-test-custom-class',
    );
    expect(screen.getByText('Small')).toHaveClass(radioGroupItemClassNames.label);
  });

  it('Switch: the <label> root, track, thumb and label text', () => {
    render(<Switch label="Wi-Fi" />);
    const track = screen.getByRole('switch', { name: 'Wi-Fi' });
    expect(track).toHaveClass(switchClassNames.track);
    expect(track.firstElementChild).toHaveClass(switchClassNames.thumb);
    expect(track.closest('label')).toHaveClass(switchClassNames.root);
    expect(screen.getByText('Wi-Fi')).toHaveClass(switchClassNames.label);
  });

  it('SearchBox: root, content wrappers, input, clear button and its default glyph', () => {
    render(<SearchBox aria-label="Search" defaultValue="cats" contentAfter={<kbd>/</kbd>} />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input).toHaveClass(searchBoxClassNames.input);
    const root = input.parentElement as HTMLElement;
    expect(root).toHaveClass(searchBoxClassNames.root);
    expect(root.firstElementChild).toHaveClass(searchBoxClassNames.contentBefore);
    // The kbd sits in the slot's own span inside the contentAfter wrapper (judgement 30).
    expect(screen.getByText('/').parentElement?.parentElement).toHaveClass(
      searchBoxClassNames.contentAfter,
    );
    const clear = screen.getByRole('button', { name: 'Clear search' });
    expect(clear).toHaveClass(searchBoxClassNames.dismissButton);
    expect(clear.querySelector('svg')).toHaveClass(searchBoxClassNames.dismissIcon);
  });

  it('SearchBox: the element a dismiss slot renders is the dismissIcon part', () => {
    render(
      <SearchBox
        aria-label="Search"
        defaultValue="cats"
        dismiss={<svg data-testid="own-glyph" />}
      />,
    );
    expect(screen.getByTestId('own-glyph').parentElement).toHaveClass(
      searchBoxClassNames.dismissIcon,
    );
  });

  it("SearchBox: a merged Button's icon span is the dismissIcon part", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <SearchBox
          aria-label="Search"
          defaultValue="cats"
          dismiss={<Button icon={<svg data-testid="button-glyph" />} />}
        />,
      );
      expect(screen.getByTestId('button-glyph').parentElement).toHaveClass(
        searchBoxClassNames.dismissIcon,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] SearchBox: `dismiss` received a button element; its props were merged into the built-in clear button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<MyIcon />}`.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it('Slider: the range input is the root', () => {
    render(<Slider aria-label="Volume" />);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveClass(sliderClassNames.root);
  });

  it('SpinButton: root, step buttons and input', () => {
    render(<SpinButton aria-label="Quantity" defaultValue={2} />);
    const input = screen.getByRole('spinbutton', { name: 'Quantity' });
    expect(input).toHaveClass(spinButtonClassNames.input);
    expect(input.parentElement).toHaveClass(spinButtonClassNames.root);
    expect(screen.getByRole('button', { name: 'Decrement' })).toHaveClass(
      spinButtonClassNames.decrementButton,
    );
    expect(screen.getByRole('button', { name: 'Increment' })).toHaveClass(
      spinButtonClassNames.incrementButton,
    );
  });

  it('Combobox: root, input, buttons, glyph, listbox, surface, options and option groups', () => {
    render(
      <Combobox aria-label="Fruit" clearable defaultValue="apple" defaultOpen>
        <Option value="apple">Apple</Option>
        <OptionGroup label="Citrus">
          <Option value="orange">Orange</Option>
        </OptionGroup>
      </Combobox>,
    );
    const input = screen.getByRole('combobox', { name: 'Fruit' });
    expect(input).toHaveClass(comboboxClassNames.input);
    expect(input.parentElement?.parentElement).toHaveClass(comboboxClassNames.root);
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveClass(
      comboboxClassNames.clearButton,
    );
    const expand = screen.getByRole('button', { name: 'Show options' });
    expect(expand).toHaveClass(comboboxClassNames.expandButton);
    expect(expand.firstElementChild).toHaveClass(comboboxClassNames.expandIcon);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(comboboxClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(comboboxClassNames.surface);
    const apple = screen.getByRole('option', { name: 'Apple' });
    expect(apple).toHaveClass(optionClassNames.root);
    expect(apple.querySelector('svg')).toHaveClass(optionClassNames.checkIcon);
    expect(within(apple).getByText('Apple')).toHaveClass(optionClassNames.content);
    const citrus = screen.getByRole('group', { name: 'Citrus' });
    expect(citrus).toHaveClass(optionGroupClassNames.list);
    expect(citrus.parentElement).toHaveClass(optionGroupClassNames.root);
    expect(screen.getByText('Citrus')).toHaveClass(optionGroupClassNames.label);
  });

  it('Combobox: the "No matches" row of the popup is the emptyMessage part', async () => {
    const user = userEvent.setup();
    render(
      <Combobox aria-label="Fruit">
        <Option value="apple">Apple</Option>
      </Combobox>,
    );
    await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'zzz');
    const empty = screen.getByText('No matches', { selector: 'div' });
    expect(empty).toHaveClass(comboboxClassNames.emptyMessage);
    expect(empty.parentElement).toHaveClass(comboboxClassNames.surface);
  });

  it('Dropdown: root, button, value, chevron, clear button, listbox and surface', () => {
    render(
      <Dropdown aria-label="Color" clearable defaultValue="red" defaultOpen>
        <Option value="red">Red</Option>
        <Option value="green">Green</Option>
      </Dropdown>,
    );
    const button = screen.getByRole('combobox', { name: 'Color' });
    expect(button).toHaveClass(dropdownClassNames.button);
    expect(button.parentElement?.parentElement).toHaveClass(dropdownClassNames.root);
    expect(within(button).getByText('Red')).toHaveClass(dropdownClassNames.value);
    expect(button.querySelector('svg')).toHaveClass(dropdownClassNames.expandIcon);
    expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveClass(
      dropdownClassNames.clearButton,
    );
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(dropdownClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(dropdownClassNames.surface);
    expect(screen.getByRole('option', { name: 'Green' })).toHaveClass(optionClassNames.root);
  });

  it('TagPicker: root, tag area, tag list, tags, remove buttons, input, popup and its Options', () => {
    render(
      <TagPicker
        aria-label="Fruits"
        options={[
          { value: 'apple', label: 'Apple' },
          { value: 'banana', label: 'Banana' },
        ]}
        defaultValue={['apple']}
        defaultOpen
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Fruits' });
    expect(input).toHaveClass(tagPickerClassNames.input);
    const control = input.closest('[data-wave-tagpicker-control]') as HTMLElement;
    expect(control).toHaveClass(tagPickerClassNames.control);
    expect(control.parentElement).toHaveClass(tagPickerClassNames.root);
    expect(screen.getByRole('list', { name: 'Selected' })).toHaveClass(tagPickerClassNames.group);
    expect(screen.getByRole('listitem')).toHaveClass(tagPickerClassNames.tag);
    expect(screen.getByRole('button', { name: 'Remove Apple' })).toHaveClass(
      tagPickerClassNames.removeButton,
    );
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(tagPickerClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(tagPickerClassNames.surface);
    // A nested public component: Option's own classes plus the TagPicker part class (D5).
    const banana = screen.getByRole('option', { name: 'Banana' });
    expect(banana).toHaveClass(optionClassNames.root, tagPickerClassNames.option);
    expect(within(banana).getByText('Banana')).toHaveClass(optionClassNames.content);
  });

  it('TagPicker: the "No matches" row of the popup is the emptyMessage part', async () => {
    const user = userEvent.setup();
    render(<TagPicker aria-label="Fruits" options={[{ value: 'apple', label: 'Apple' }]} />);
    await user.type(screen.getByRole('combobox', { name: 'Fruits' }), 'zzz');
    const empty = screen.getByText('No matches', { selector: 'div' });
    expect(empty).toHaveClass(tagPickerClassNames.emptyMessage);
    expect(empty.parentElement).toHaveClass(tagPickerClassNames.surface);
  });

  it('TimePicker: root, input, buttons, glyph, listbox, surface and options with check columns', () => {
    render(<TimePicker aria-label="Start time" clearable defaultValue="09:00" defaultOpen />);
    const input = screen.getByRole('combobox', { name: 'Start time' });
    expect(input).toHaveClass(timePickerClassNames.input);
    expect(input.parentElement?.parentElement).toHaveClass(timePickerClassNames.root);
    expect(screen.getByRole('button', { name: 'Clear time' })).toHaveClass(
      timePickerClassNames.clearButton,
    );
    const expand = screen.getByRole('button', { name: 'Show times' });
    expect(expand).toHaveClass(timePickerClassNames.expandButton);
    expect(expand.firstElementChild).toHaveClass(timePickerClassNames.expandIcon);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass(timePickerClassNames.listbox);
    expect(listbox.parentElement).toHaveClass(timePickerClassNames.surface);
    const [option] = screen.getAllByRole('option');
    expect(option).toHaveClass(timePickerClassNames.option);
    // TimePicker's options are its own, not Option (judgement 6).
    expect(option).not.toHaveClass(optionClassNames.root);
    expect(option.firstElementChild).toHaveClass(timePickerClassNames.checkIcon);
  });

  it('TimePicker: the empty row of the popup and the error message are parts', async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start time" />);
    await user.type(screen.getByRole('combobox', { name: 'Start time' }), 'zz');
    const empty = screen.getByText('No matching times', { selector: 'div' });
    expect(empty).toHaveClass(timePickerClassNames.emptyMessage);
    expect(empty.parentElement).toHaveClass(timePickerClassNames.surface);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveClass(timePickerClassNames.errorMessage);
  });

  it('DatePicker: root, input, buttons, and the calendar surface with its parts', async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Start date" clearable defaultValue={new Date(2025, 0, 15)} />);
    const input = screen.getByRole('textbox', { name: 'Start date' });
    expect(input).toHaveClass(datePickerClassNames.input);
    expect(input.parentElement?.parentElement).toHaveClass(datePickerClassNames.root);
    expect(screen.getByRole('button', { name: 'Clear date' })).toHaveClass(
      datePickerClassNames.clearButton,
    );
    const open = screen.getByRole('button', { name: 'Open calendar' });
    expect(open).toHaveClass(datePickerClassNames.openCalendarButton);
    await user.click(open);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass(datePickerClassNames.surface);
    const previous = within(dialog).getByRole('button', { name: 'Previous month' });
    expect(previous).toHaveClass(datePickerClassNames.previousMonthButton);
    expect(previous.parentElement).toHaveClass(datePickerClassNames.header);
    expect(within(dialog).getByRole('button', { name: 'Next month' })).toHaveClass(
      datePickerClassNames.nextMonthButton,
    );
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveClass(
      datePickerClassNames.heading,
    );
    const grid = within(dialog).getByRole('grid');
    expect(grid).toHaveClass(datePickerClassNames.grid);
    expect(within(grid).getAllByRole('columnheader')[0]).toHaveClass(datePickerClassNames.weekday);
    expect(within(grid).getAllByRole('button')[0]).toHaveClass(datePickerClassNames.day);
  });

  it('DatePicker: the error message is a part', async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="End date" />);
    await user.type(screen.getByRole('textbox', { name: 'End date' }), '02/31/2025{Enter}');
    expect(screen.getByRole('alert')).toHaveClass(datePickerClassNames.errorMessage);
  });

  it('SwatchPicker: root and swatches', () => {
    render(
      <SwatchPicker
        aria-label="Accent"
        items={[{ value: 'blue', color: '#0f6cbd', label: 'Blue' }]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Accent' })).toHaveClass(
      swatchPickerClassNames.root,
    );
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveClass(swatchPickerClassNames.swatch);
  });

  it("ColorPicker: root and the opacity row's caption and readout (0.7 layout)", () => {
    render(
      <ColorPicker
        aria-label="Accent color"
        defaultValue="#0f6cbd"
        showOpacity
        presets={[{ color: '#d13438', label: 'Red' }]}
      />,
    );
    const picker = screen.getByRole('group', { name: 'Accent color' });
    expect(picker).toHaveClass(colorPickerClassNames.root);
    // The opacity row's caption and readout, found by their classes rather than as the slider's
    // siblings: P3-color (Task C10) replaces the slider with an AlphaSlider and keeps both spans.
    expect(picker.querySelector(`.${colorPickerClassNames.opacityLabel}`)).toHaveTextContent(
      'Opacity',
    );
    expect(picker.querySelector(`.${colorPickerClassNames.opacityValue}`)).toHaveTextContent(
      '100%',
    );
    // The presets are a SwatchPicker, which keeps its own root class.
    expect(screen.getByRole('radiogroup')).toHaveClass(swatchPickerClassNames.root);
  });

  it('Rating: root, stars (RatingItems, which also carry the star part) and their glyphs', () => {
    render(<Rating aria-label="Score" defaultValue={3} />);
    expect(screen.getByRole('radiogroup', { name: 'Score' })).toHaveClass(ratingClassNames.root);
    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);
    for (const star of stars) {
      expect(star).toHaveClass(ratingItemClassNames.root, ratingClassNames.star);
      expect(star).not.toHaveClass(ratingDisplayClassNames.star);
      // A filled (3) and an unfilled (2) default glyph alike.
      expect(star.querySelector('svg')).toHaveClass(
        ratingItemClassNames.icon,
        ratingClassNames.icon,
      );
    }
  });

  it('Rating with step={0.5}: the star element carries the classes, its two radios do not', () => {
    render(<Rating aria-label="Score" step={0.5} defaultValue={2.5} />);
    const half = screen.getByRole('radio', { name: '2.5 stars' });
    const full = screen.getByRole('radio', { name: '3 stars' });
    // Both radios of a star are transparent inputs inside one star element (not parts, spec D4).
    const star = half.parentElement as HTMLElement;
    expect(full.parentElement).toBe(star);
    expect(star).toHaveClass(ratingItemClassNames.root, ratingClassNames.star);
    for (const radio of [half, full]) {
      expect(radio).not.toHaveClass(ratingItemClassNames.root);
      expect(radio).not.toHaveClass(ratingClassNames.star);
    }
    // The half-filled star draws two glyphs, the outline and the clipped filled one: both icons.
    const glyphs = Array.from(star.querySelectorAll('svg'));
    expect(glyphs).toHaveLength(2);
    for (const glyph of glyphs) {
      expect(glyph).toHaveClass(ratingItemClassNames.icon, ratingClassNames.icon);
    }
  });

  it('Rating: Rating.Item children and a custom glyph pair carry the same classes', () => {
    render(
      <Rating
        aria-label="Score"
        max={2}
        defaultValue={1}
        iconFilled={<svg data-testid="heart" />}
        iconOutline={<svg data-testid="heart-outline" />}
      >
        <Rating.Item value={1} className="wave-test-custom-class" />
        <Rating.Item value={2} />
      </Rating>,
    );
    const first = screen.getByRole('radio', { name: '1 star' });
    expect(first).toHaveClass(
      ratingItemClassNames.root,
      ratingClassNames.star,
      'wave-test-custom-class',
    );
    // A slot glyph keeps the part class on the span the slot renders.
    expect(screen.getByTestId('heart').parentElement).toHaveClass(
      ratingItemClassNames.icon,
      ratingClassNames.icon,
    );
    expect(screen.getByTestId('heart-outline').parentElement).toHaveClass(
      ratingItemClassNames.icon,
      ratingClassNames.icon,
    );
  });

  it('RatingDisplay: root, stars (the outer span of a partly filled one), glyphs, value, count', () => {
    render(<RatingDisplay value={3.5} showValue count={12} locale="en-US" />);
    const root = screen.getByRole('img');
    expect(root).toHaveClass(ratingDisplayClassNames.root);
    const stars = Array.from(root.children).slice(0, 5);
    for (const star of stars) {
      expect(star).toHaveClass(ratingItemClassNames.root, ratingDisplayClassNames.star);
      expect(star).not.toHaveClass(ratingClassNames.star);
    }
    const partial = stars[3];
    const glyphs = Array.from(partial.querySelectorAll('svg'));
    expect(glyphs).toHaveLength(2);
    for (const glyph of glyphs) {
      expect(glyph).toHaveClass(ratingItemClassNames.icon, ratingDisplayClassNames.icon);
    }
    // The clipping span of a partly filled star is a layout wrapper (judgement 27).
    expect(partial.lastElementChild?.className ?? '').not.toMatch(/\bwave-/);
    expect(within(root).getByText('3.5')).toHaveClass(ratingDisplayClassNames.value);
    expect(within(root).getByText('(12)')).toHaveClass(ratingDisplayClassNames.count);
  });

  it('RatingDisplay: the one star of the compact layout (not a RatingItem)', () => {
    render(<RatingDisplay value={4} compact locale="en-US" />);
    const root = screen.getByRole('img');
    const star = root.firstElementChild as HTMLElement;
    expect(star).toHaveClass(ratingDisplayClassNames.star);
    expect(star).not.toHaveClass(ratingItemClassNames.root);
    const glyph = star.querySelector('svg');
    expect(glyph).toHaveClass(ratingDisplayClassNames.icon);
    expect(glyph).not.toHaveClass(ratingItemClassNames.icon);
    expect(within(root).getByText('4')).toHaveClass(ratingDisplayClassNames.value);
  });

  it('Rating and RatingDisplay: the star classes are in the server HTML', () => {
    const host = parse(
      renderToString(
        <>
          <Rating aria-label="Score" step={0.5} defaultValue={1.5} />
          <RatingDisplay value={2} locale="en-US" />
        </>,
      ),
    );
    expect(
      host.querySelectorAll(`.${ratingItemClassNames.root}.${ratingClassNames.star}`),
    ).toHaveLength(5);
    expect(
      host.querySelectorAll(`.${ratingItemClassNames.root}.${ratingDisplayClassNames.star}`),
    ).toHaveLength(5);
    expect(host.querySelectorAll(`svg.${ratingClassNames.icon}`)).toHaveLength(6);
  });

  it('renders the classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <Field label="Email" required hint="Your work address">
          <Input contentBefore="@" />
        </Field>,
      ),
    );
    expect(host.firstElementChild).toHaveClass(fieldClassNames.root);
    expect(host.querySelector('label')).toHaveClass(fieldClassNames.label);
    const input = host.querySelector('input');
    expect(input).toHaveClass(inputClassNames.input);
    expect(input?.parentElement).toHaveClass(inputClassNames.root);
    expect(host.querySelector('p')).toHaveClass(fieldClassNames.hint);
  });
});

/** Every class of an element that comes from the registry (`wave-…`), sorted. */
function stableClassesOf(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].filter((cls) => cls.startsWith('wave-')).sort();
}

describe('stable class names: the 0.10 listbox and swatch parts', () => {
  it('Option: the multi-select box is the indicator part; its check glyph the checkIcon part', () => {
    render(
      <Listbox aria-label="Fruit" multiselect defaultValue={['apple']}>
        <Option value="apple">Apple</Option>
        <Option value="pear">Pear</Option>
      </Listbox>,
    );
    const apple = screen.getByRole('option', { name: 'Apple' });
    const box = apple.querySelector('[data-wave-option-box]');
    expect(box).toHaveClass(optionClassNames.indicator);
    expect(box?.querySelector('svg')).toHaveClass(optionClassNames.checkIcon);
    expect(within(apple).getByText('Apple')).toHaveClass(optionClassNames.content);
    // An unselected option draws the box (the indicator) without a glyph.
    const pear = screen.getByRole('option', { name: 'Pear' });
    const pearBox = pear.querySelector('[data-wave-option-box]');
    expect(pearBox).toHaveClass(optionClassNames.indicator);
    expect(pearBox?.firstElementChild).toBeNull();
  });

  it('Option: the span of a checkIcon slot is the checkIcon part, single and multi-select', () => {
    render(
      <>
        <Listbox aria-label="Single" defaultValue="apple">
          <Option value="apple" checkIcon={<svg data-testid="single-glyph" />}>
            Apple
          </Option>
        </Listbox>
        <Listbox aria-label="Multi" multiselect defaultValue={['apple']}>
          <Option value="apple" checkIcon={<svg data-testid="multi-glyph" />}>
            Apple
          </Option>
        </Listbox>
      </>,
    );
    expect(screen.getByTestId('single-glyph').parentElement).toHaveClass(
      optionClassNames.checkIcon,
    );
    const multiGlyph = screen.getByTestId('multi-glyph').parentElement;
    expect(multiGlyph).toHaveClass(optionClassNames.checkIcon);
    expect(multiGlyph?.parentElement).toHaveClass(optionClassNames.indicator);
  });

  it('OptionGroup: a rich label renders in the label part; a label-less group renders none', () => {
    render(
      <Listbox aria-label="Fruit">
        <OptionGroup
          label={
            <>
              <svg aria-hidden="true" /> Citrus
            </>
          }
        >
          <Option value="orange">Orange</Option>
        </OptionGroup>
        <OptionGroup aria-label="Berries">
          <Option value="strawberry">Strawberry</Option>
        </OptionGroup>
      </Listbox>,
    );
    const citrus = screen.getByRole('group', { name: 'Citrus' });
    expect(citrus).toHaveClass(optionGroupClassNames.list);
    expect(citrus.previousElementSibling).toHaveClass(optionGroupClassNames.label);
    const berries = screen.getByRole('group', { name: 'Berries' });
    expect(berries).toHaveClass(optionGroupClassNames.list);
    expect(berries.previousElementSibling).toBeNull();
    expect(berries.parentElement).toHaveClass(optionGroupClassNames.root);
  });

  it('Listbox: the root on the <ul> (where className lands), with Option and OptionGroup parts', () => {
    render(
      <Listbox aria-label="Fruit" className="wave-test-custom-class">
        <Listbox.Option value="apple">Apple</Listbox.Option>
        <Listbox.OptionGroup label="Citrus">
          <Listbox.Option value="orange">Orange</Listbox.Option>
        </Listbox.OptionGroup>
      </Listbox>,
    );
    const listbox = screen.getByRole('listbox', { name: 'Fruit' });
    expect(stableClassesOf(listbox)).toEqual([listboxClassNames.root, 'wave-test-custom-class']);
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveClass(optionClassNames.root);
    expect(screen.getByRole('group', { name: 'Citrus' })).toHaveClass(optionGroupClassNames.list);
  });

  it('ListboxSurface: the root on the portaled surface and list on the <ul>', async () => {
    const user = userEvent.setup();
    render(<CustomPicker />);
    // Closed: the list renders in place, hidden, and keeps its part class; no surface exists.
    const inline = screen.getByRole('listbox', { hidden: true });
    expect(stableClassesOf(inline)).toEqual([listboxSurfaceClassNames.list]);
    expect(document.querySelector('[data-wave-listbox-surface]')).toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'Font' }));
    const list = screen.getByRole('listbox', { name: 'Fonts' });
    expect(stableClassesOf(list)).toEqual([listboxSurfaceClassNames.list]);
    const surface = list.parentElement;
    expect(surface).toHaveAttribute('data-wave-listbox-surface');
    expect(stableClassesOf(surface)).toEqual([listboxSurfaceClassNames.root]);
    expect(screen.getByRole('option', { name: 'Georgia' })).toHaveClass(optionClassNames.root);
  });

  it.each([
    [
      'Dropdown',
      () => (
        <Dropdown aria-label="Fruit" defaultOpen>
          <Option value="apple">Apple</Option>
        </Dropdown>
      ),
      dropdownClassNames,
    ],
    [
      'Combobox',
      () => (
        <Combobox aria-label="Fruit" defaultOpen>
          <Option value="apple">Apple</Option>
        </Combobox>
      ),
      comboboxClassNames,
    ],
    [
      'TagPicker',
      () => (
        <TagPicker aria-label="Fruit" options={[{ value: 'apple', label: 'Apple' }]} defaultOpen />
      ),
      tagPickerClassNames,
    ],
  ] as const)(
    '%s: its list and surface carry ListboxSurface’s classes and its own parts (D5)',
    (_name, ui, host) => {
      render(ui());
      const listbox = screen.getByRole('listbox');
      expect(stableClassesOf(listbox)).toEqual(
        [listboxSurfaceClassNames.list, host.listbox].sort(),
      );
      expect(stableClassesOf(listbox.parentElement)).toEqual(
        [listboxSurfaceClassNames.root, host.surface].sort(),
      );
    },
  );

  it('Dropdown: an expandIcon slot renders in the expandIcon part, renderValue in the value part', () => {
    render(
      <Dropdown
        aria-label="Color"
        defaultValue="red"
        expandIcon={<svg data-testid="own-chevron" />}
        renderValue={(value) => <b data-testid="rich-value">{value.toUpperCase()}</b>}
      >
        <Option value="red">Red</Option>
      </Dropdown>,
    );
    expect(screen.getByTestId('own-chevron').parentElement).toHaveClass(
      dropdownClassNames.expandIcon,
    );
    expect(screen.getByTestId('rich-value').parentElement).toHaveClass(dropdownClassNames.value);
  });

  it('Dropdown: the multi-select value text is the value part', () => {
    render(
      <Dropdown aria-label="Colors" multiselect defaultValue={['red', 'blue']}>
        <Option value="red">Red</Option>
        <Option value="blue">Blue</Option>
      </Dropdown>,
    );
    const button = screen.getByRole('combobox', { name: 'Colors' });
    expect(within(button).getByText('Red, Blue')).toHaveClass(dropdownClassNames.value);
  });

  it('SwatchPicker (row layout): each swatch kind carries its root, the swatch part and its icon part', () => {
    render(
      <SwatchPicker
        aria-label="Accent"
        defaultValue="blue"
        items={[{ value: 'blue', color: '#0f6cbd', label: 'Blue' }]}
      >
        <ColorSwatch
          value="red"
          color="#d13438"
          aria-label="Red"
          icon={<svg data-testid="red-glyph" />}
        />
        <ColorSwatch value="grey" color="#8a8886" aria-label="Grey" disabled />
        <ImageSwatch value="dots" src="/dots.png" aria-label="Dots" />
        <EmptySwatch />
      </SwatchPicker>,
    );
    expect(stableClassesOf(screen.getByRole('radiogroup', { name: 'Accent' }))).toEqual([
      swatchPickerClassNames.root,
    ]);
    // `items` render as ColorSwatches: the same classes as a ColorSwatch child.
    const blue = screen.getByRole('radio', { name: 'Blue' });
    const grey = screen.getByRole('radio', { name: 'Grey' });
    for (const swatch of [blue, screen.getByRole('radio', { name: 'Red' }), grey]) {
      expect(stableClassesOf(swatch)).toEqual(
        [colorSwatchClassNames.root, swatchPickerClassNames.swatch].sort(),
      );
    }
    expect(stableClassesOf(screen.getByRole('radio', { name: 'Dots' }))).toEqual(
      [imageSwatchClassNames.root, swatchPickerClassNames.swatch].sort(),
    );
    const add = screen.getByRole('button', { name: 'Add color' });
    expect(stableClassesOf(add)).toEqual(
      [emptySwatchClassNames.root, swatchPickerClassNames.swatch].sort(),
    );
    // Icons: the slot's span on a ColorSwatch, the default plus glyph's span on an EmptySwatch.
    expect(screen.getByTestId('red-glyph').parentElement).toHaveClass(colorSwatchClassNames.icon);
    expect(stableClassesOf(add.firstElementChild)).toEqual([emptySwatchClassNames.icon]);
    // The check of the selected swatch and the slash of a disabled one are uncontrolled glyphs
    // that fill the swatch button, so they carry no class (phase 3 Appendix A, judgement 26).
    expect(blue.querySelectorAll('[class*="wave-"]')).toHaveLength(0);
    expect(grey.querySelector('[data-wave-swatch-slash]')).not.toBeNull();
    expect(grey.querySelectorAll('[class*="wave-"]')).toHaveLength(0);
  });

  it('SwatchPicker (grid layout): explicit and implicit rows carry the row root; cells carry none', () => {
    render(
      <SwatchPicker
        aria-label="Accent"
        layout="grid"
        required
        items={[{ value: 'blue', color: '#0f6cbd', label: 'Blue' }]}
      >
        <EmptySwatch />
        <SwatchPicker.Row className="wave-test-custom-class">
          <ColorSwatch value="red" color="#d13438" aria-label="Red" />
        </SwatchPicker.Row>
      </SwatchPicker>,
    );
    const grid = screen.getByRole('grid', { name: 'Accent' });
    expect(stableClassesOf(grid)).toEqual([swatchPickerClassNames.root]);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(stableClassesOf(rows[0])).toEqual([swatchPickerRowClassNames.root]);
    expect(stableClassesOf(rows[1])).toEqual([
      swatchPickerRowClassNames.root,
      'wave-test-custom-class',
    ]);
    // The gridcell around each swatch button is a layout wrapper, not a part.
    for (const cell of screen.getAllByRole('gridcell')) expect(stableClassesOf(cell)).toEqual([]);
    expect(stableClassesOf(screen.getByRole('button', { name: 'Red' }))).toEqual(
      [colorSwatchClassNames.root, swatchPickerClassNames.swatch].sort(),
    );
    expect(stableClassesOf(screen.getByRole('button', { name: 'Add color' }))).toEqual(
      [emptySwatchClassNames.root, swatchPickerClassNames.swatch].sort(),
    );
    // The visually hidden required hint is no part (spec D4).
    const hint = grid.querySelector('span[hidden]');
    expect(hint).toHaveTextContent('Required');
    expect(stableClassesOf(hint)).toEqual([]);
  });

  it('SwatchPicker.Row in the row layout carries the row root too', () => {
    render(
      <SwatchPicker aria-label="Accent">
        <SwatchPicker.Row data-testid="line">
          <ColorSwatch value="red" color="#d13438" aria-label="Red" />
        </SwatchPicker.Row>
      </SwatchPicker>,
    );
    expect(stableClassesOf(screen.getByTestId('line'))).toEqual([swatchPickerRowClassNames.root]);
  });

  it('ColorPicker.Swatches with layout="grid": a grid of the presets with the part classes', () => {
    render(
      <ColorPicker aria-label="Accent color" defaultValue="#0f6cbd">
        <ColorPicker.Swatches layout="grid">
          <EmptySwatch />
        </ColorPicker.Swatches>
      </ColorPicker>,
    );
    const grid = screen.getByRole('grid', { name: 'Preset colors' });
    expect(stableClassesOf(grid)).toEqual(
      [colorPickerSwatchesClassNames.root, swatchPickerClassNames.root].sort(),
    );
    // The presets and the extra swatch share one implicit row.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(1);
    expect(stableClassesOf(rows[0])).toEqual([swatchPickerRowClassNames.root]);
    const blue = within(rows[0]).getByRole('button', { name: 'Blue' });
    expect(blue).toHaveAttribute('aria-pressed', 'true');
    expect(stableClassesOf(blue)).toEqual(
      [colorSwatchClassNames.root, swatchPickerClassNames.swatch].sort(),
    );
    expect(stableClassesOf(within(rows[0]).getByRole('button', { name: 'Add color' }))).toEqual(
      [emptySwatchClassNames.root, swatchPickerClassNames.swatch].sort(),
    );
  });

  it('renders the 0.10 classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <>
          <Listbox aria-label="Fruit" multiselect defaultValue={['apple']}>
            <Option value="apple">Apple</Option>
          </Listbox>
          <SwatchPicker aria-label="Accent" layout="grid">
            <ColorSwatch value="red" color="#d13438" aria-label="Red" />
          </SwatchPicker>
        </>,
      ),
    );
    expect(host.querySelector('[role="listbox"]')).toHaveClass(listboxClassNames.root);
    expect(host.querySelector('[data-wave-option-box]')).toHaveClass(optionClassNames.indicator);
    expect(host.querySelector('[role="row"]')).toHaveClass(swatchPickerRowClassNames.root);
    expect(host.querySelector('[role="gridcell"] button')).toHaveClass(
      colorSwatchClassNames.root,
      swatchPickerClassNames.swatch,
    );
  });
});

describe('stable class names: the 0.10 calendar parts', () => {
  it('Calendar: root on the group, and its header, buttons, heading, grid, weekdays and days', () => {
    render(<Calendar aria-label="Due date" locale="en-US" today={new Date(2025, 5, 12)} />);
    const group = screen.getByRole('group', { name: 'Due date' });
    expect(stableClassesOf(group)).toEqual([calendarClassNames.root]);
    const previous = within(group).getByRole('button', { name: 'Previous month' });
    expect(stableClassesOf(previous)).toEqual([calendarClassNames.previousButton]);
    expect(stableClassesOf(previous.parentElement)).toEqual([calendarClassNames.header]);
    expect(stableClassesOf(within(group).getByRole('button', { name: 'Next month' }))).toEqual([
      calendarClassNames.nextButton,
    ]);
    const heading = within(group).getByRole('button', { name: 'June 2025' }).parentElement;
    expect(heading).toHaveAttribute('aria-live', 'polite');
    expect(stableClassesOf(heading)).toEqual([calendarClassNames.heading]);
    const grid = within(group).getByRole('grid');
    expect(stableClassesOf(grid)).toEqual([calendarClassNames.grid]);
    expect(stableClassesOf(within(grid).getAllByRole('columnheader')[0])).toEqual([
      calendarClassNames.weekday,
    ]);
    expect(
      stableClassesOf(within(grid).getByRole('button', { name: 'Thursday, June 12, 2025' })),
    ).toEqual([calendarClassNames.day]);
    // Layout wrappers (the gridcells) and the hidden texts are no parts.
    expect(stableClassesOf(within(grid).getAllByRole('gridcell')[0])).toEqual([]);
  });

  it("Calendar: the required hint is no part, and DatePicker's calendar keeps its own classes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Calendar aria-label="Due date" required today={new Date(2025, 5, 12)} />
        <DatePicker aria-label="Start date" />
      </>,
    );
    const group = screen.getByRole('group', { name: 'Due date' });
    const hint = document.getElementById(group.getAttribute('aria-describedby') ?? '');
    expect(hint).toHaveTextContent('Required');
    expect(stableClassesOf(hint)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    const dialog = screen.getByRole('dialog');
    expect(stableClassesOf(within(dialog).getByRole('grid'))).toEqual([datePickerClassNames.grid]);
    expect(stableClassesOf(within(dialog).getByRole('button', { name: 'Previous month' }))).toEqual(
      [datePickerClassNames.previousMonthButton],
    );
  });

  it('Calendar: the heading button, and the month and year grids with their cells', async () => {
    const user = userEvent.setup();
    render(
      <Calendar
        aria-label="Due date"
        locale="en-US"
        today={new Date(2025, 5, 12)}
        defaultValue={new Date(2025, 5, 15)}
      />,
    );
    const group = screen.getByRole('group', { name: 'Due date' });
    const headingButton = within(group).getByRole('button', { name: 'June 2025' });
    expect(stableClassesOf(headingButton)).toEqual([calendarClassNames.headingButton]);
    // The hidden hint is no part.
    const hint = document.getElementById(headingButton.getAttribute('aria-describedby') ?? '');
    expect(hint).toHaveTextContent('Choose a month');
    expect(stableClassesOf(hint)).toEqual([]);
    await user.click(headingButton);
    let grid = within(group).getByRole('grid', { name: '2025' });
    expect(stableClassesOf(grid)).toEqual([calendarClassNames.grid]);
    const june = within(grid).getByRole('button', { name: 'June 2025' });
    expect(stableClassesOf(june)).toEqual([calendarClassNames.month]);
    expect(stableClassesOf(june.closest('[role="gridcell"]'))).toEqual([]);
    expect(stableClassesOf(within(group).getByRole('button', { name: 'Previous year' }))).toEqual([
      calendarClassNames.previousButton,
    ]);
    expect(stableClassesOf(within(group).getByRole('button', { name: 'Next year' }))).toEqual([
      calendarClassNames.nextButton,
    ]);
    const yearButton = within(group).getByRole('button', { name: '2025' });
    expect(stableClassesOf(yearButton)).toEqual([calendarClassNames.headingButton]);
    expect(stableClassesOf(yearButton.parentElement)).toEqual([calendarClassNames.heading]);
    await user.click(yearButton);
    grid = within(group).getByRole('grid');
    expect(stableClassesOf(grid)).toEqual([calendarClassNames.grid]);
    expect(stableClassesOf(within(grid).getByRole('button', { name: '2025' }))).toEqual([
      calendarClassNames.year,
    ]);
    expect(stableClassesOf(within(grid).getByRole('button', { name: '2019' }))).toEqual([
      calendarClassNames.year,
    ]);
    expect(
      stableClassesOf(document.getElementById(grid.getAttribute('aria-labelledby') ?? '')),
    ).toEqual([calendarClassNames.heading]);
    expect(stableClassesOf(within(group).getByRole('button', { name: 'Previous decade' }))).toEqual(
      [calendarClassNames.previousButton],
    );
  });

  it("DatePicker: the heading button, months and years carry DatePicker's classes", async () => {
    const user = userEvent.setup();
    render(
      <DatePicker aria-label="Start date" locale="en-US" defaultValue={new Date(2025, 5, 15)} />,
    );
    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    const dialog = screen.getByRole('dialog');
    const headingButton = within(dialog).getByRole('button', { name: 'June 2025' });
    expect(stableClassesOf(headingButton)).toEqual([datePickerClassNames.headingButton]);
    expect(stableClassesOf(headingButton.parentElement)).toEqual([datePickerClassNames.heading]);
    await user.click(headingButton);
    const months = within(dialog).getByRole('grid', { name: '2025' });
    expect(stableClassesOf(months)).toEqual([datePickerClassNames.grid]);
    expect(stableClassesOf(within(months).getByRole('button', { name: 'June 2025' }))).toEqual([
      datePickerClassNames.month,
    ]);
    expect(stableClassesOf(within(dialog).getByRole('button', { name: 'Previous year' }))).toEqual([
      datePickerClassNames.previousMonthButton,
    ]);
    await user.click(within(dialog).getByRole('button', { name: '2025' }));
    const years = within(dialog).getByRole('grid');
    expect(stableClassesOf(years)).toEqual([datePickerClassNames.grid]);
    expect(stableClassesOf(within(years).getByRole('button', { name: '2025' }))).toEqual([
      datePickerClassNames.year,
    ]);
    expect(stableClassesOf(within(dialog).getByRole('button', { name: 'Next decade' }))).toEqual([
      datePickerClassNames.nextMonthButton,
    ]);
  });

  it('Calendar: week numbers, the marked-day dot and the footer button are parts', () => {
    render(
      <Calendar
        aria-label="Due date"
        locale="en-US"
        today={new Date(2025, 5, 12)}
        showWeekNumbers
        showGoToToday
        markedDates={(date) => date.getDate() === 16}
      />,
    );
    const group = screen.getByRole('group', { name: 'Due date' });
    const grid = within(group).getByRole('grid');
    expect(stableClassesOf(within(grid).getAllByRole('columnheader')[0])).toEqual([
      calendarClassNames.weekNumberHeader,
    ]);
    expect(stableClassesOf(within(grid).getAllByRole('columnheader')[1])).toEqual([
      calendarClassNames.weekday,
    ]);
    expect(stableClassesOf(within(grid).getAllByRole('rowheader')[0])).toEqual([
      calendarClassNames.weekNumber,
    ]);
    const marked = within(grid).getByRole('button', { name: 'Monday, June 16, 2025, marked' });
    expect(stableClassesOf(marked)).toEqual([calendarClassNames.day]);
    expect(stableClassesOf(marked.querySelector('[aria-hidden="true"]'))).toEqual([
      calendarClassNames.markedDot,
    ]);
    const today = within(group).getByRole('button', { name: 'Go to today' });
    expect(stableClassesOf(today)).toEqual([calendarClassNames.todayButton]);
    expect(stableClassesOf(today.parentElement)).toEqual([calendarClassNames.footer]);
  });

  it('DatePicker: the same parts carry its classes, and the Close button its own', async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        aria-label="Start date"
        locale="en-US"
        today={new Date(2025, 5, 12)}
        showWeekNumbers
        showGoToToday
        showCloseButton
        markedDates={(date) => date.getDate() === 16}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open calendar' }));
    const dialog = screen.getByRole('dialog');
    const grid = within(dialog).getByRole('grid');
    expect(stableClassesOf(within(grid).getAllByRole('columnheader')[0])).toEqual([
      datePickerClassNames.weekNumberHeader,
    ]);
    expect(stableClassesOf(within(grid).getAllByRole('rowheader')[0])).toEqual([
      datePickerClassNames.weekNumber,
    ]);
    const marked = within(grid).getByRole('button', { name: 'Monday, June 16, 2025, marked' });
    expect(stableClassesOf(marked.querySelector('[aria-hidden="true"]'))).toEqual([
      datePickerClassNames.markedDot,
    ]);
    const today = within(dialog).getByRole('button', { name: 'Go to today' });
    expect(stableClassesOf(today)).toEqual([datePickerClassNames.todayButton]);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(stableClassesOf(close)).toEqual([datePickerClassNames.closeButton]);
    expect(stableClassesOf(close.parentElement)).toEqual([datePickerClassNames.footer]);
    expect(close.parentElement).toBe(today.parentElement);
  });

  it('renders the calendar classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <Calendar aria-label="Due date" locale="en-US" today={new Date(2025, 5, 12)} />,
      ),
    );
    expect(host.querySelector('[role="group"]')).toHaveClass(calendarClassNames.root);
    expect(host.querySelector('[role="grid"]')).toHaveClass(calendarClassNames.grid);
    expect(host.querySelector('[data-date="2025-06-12"]')).toHaveClass(calendarClassNames.day);
  });
});
