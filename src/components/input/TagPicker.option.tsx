import * as React from 'react';
import { wcn } from '../../lib/cn';
import { tagPickerOptionClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { collectOptionLabels, markListboxElement } from '../../hooks/useListbox';
import { Option } from './Option';
import type { OptionProps } from './Option';

/**
 * One entry of `options`, the array form of TagPicker's options. The component of the same name,
 * `TagPickerOption`, is `TagPicker.Option`, the parts form.
 */
export interface TagPickerOption {
  /** Unique identifier for the option. */
  value: string;
  /** Display label: the option's text, its tag's text, and the text the filter and the announcements use. */
  label: string;
  /**
   * A visual before the label, in the option and in its tag (an Avatar, an icon). Decorative in
   * both: the label names them. An Avatar takes the tag's size (24, 20 or 16px).
   */
  media?: React.ReactNode;
  /** A second line under the label in the option (a role, an e-mail address); tags do not show it. */
  secondaryContent?: React.ReactNode;
  /**
   * The option cannot be picked: it stays in the list, dimmed (`aria-disabled`), and a click or
   * Enter does not add it; the arrow keys and typeahead skip it. As `disabled` on an `Option`.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Props of TagPicker.Option: an Option with a visual and a second line. Every prop of Option
 * applies as on an Option, its `slotProps` included: `indicator` (the checkbox square of a
 * multi-select list) and `content` (the `<span>` around the visual, the text and the second line).
 */
export interface TagPickerOptionProps extends OptionProps {
  /** A visual before the text (an Avatar, an icon). Decorative (`aria-hidden`): the text names the option. */
  media?: Slot<'span'>;
  /** A second, smaller line under the text. Part of the option's name, not of its label. */
  secondaryContent?: Slot<'span'>;
  /**
   * The text of the option's tag, the filter and the announcements. Pass it when the children
   * are not plain text (a development warning otherwise).
   * @default `textValue`, else the text of the children, else `value`
   */
  label?: string;
}

/**
 * The label of an option: its own `label`, else `textValue`, else the text of its string, number
 * and host-element children (read as the root reads it on the server, so both agree), else
 * `undefined` (children without text).
 */
function optionLabel(
  value: string,
  label: string | undefined,
  textValue: string | undefined,
  children: React.ReactNode,
): string | undefined {
  if (label !== undefined) return label;
  if (textValue !== undefined) return textValue;
  if (children === null || children === undefined) return value;
  return collectOptionLabels(<Option value={value}>{children}</Option>).get(value);
}

function TagPickerOptionImpl({
  value,
  label,
  textValue,
  media,
  secondaryContent,
  className,
  children,
  ...rest
}: TagPickerOptionProps) {
  const resolved = optionLabel(value, label, textValue, children);
  const missingLabel = resolved === undefined;
  React.useEffect(() => {
    if (missingLabel) {
      warnOnce(
        'TagPicker.Option:label',
        `TagPicker.Option: the option "${value}" has no text label, so its value is used. Pass \`label\` when its children are not plain text: its tag, the filter and the announcements read it.`,
      );
    }
  }, [missingLabel, value]);

  const hasMedia = slotRendersContent(media);
  const hasSecondary = slotRendersContent(secondaryContent);
  const content =
    hasMedia || hasSecondary ? (
      // A layout wrapper (no class): the visual, then the text over its second line.
      <span className="wave:flex wave:items-center wave:gap-2">
        {hasMedia &&
          renderSlot(
            media,
            'span',
            wcn(tagPickerOptionClassNames.media, 'wave:inline-flex wave:shrink-0'),
            {
              'aria-hidden': true,
            },
          )}
        <span className="wave:flex wave:min-w-0 wave:flex-col">
          <span>{children ?? value}</span>
          {hasSecondary &&
            renderSlot(
              secondaryContent,
              'span',
              wcn(
                tagPickerOptionClassNames.secondaryContent,
                'wave:text-caption-1 wave:text-muted-foreground',
              ),
            )}
        </span>
      </span>
    ) : (
      children
    );

  return (
    <Option
      {...rest}
      value={value}
      label={resolved ?? value}
      textValue={textValue}
      className={wcn(tagPickerOptionClassNames.root, className)}
    >
      {content}
    </Option>
  );
}
TagPickerOptionImpl.displayName = 'TagPickerOption';

const MemoTagPickerOption = /* @__PURE__ */ React.memo(TagPickerOptionImpl);
MemoTagPickerOption.displayName = 'TagPickerOption';

/**
 * An option of TagPicker's list (`TagPicker.Option`): an `Option` with a decorative visual before
 * its text (`media`, an Avatar or an icon, `aria-hidden`) and a second, smaller line under it
 * (`secondaryContent`, part of the option's accessible name). Its label, the text of its tag, the
 * filter and the announcements, is `label`, else `textValue`, else the text of its children, so
 * the visual and the second line never enter it; pass `label` when the children are not plain
 * text (a development warning otherwise, and the value is used). It works in any listbox:
 * TagPicker's list, a Combobox, a Listbox or a custom picker. Without `media` and
 * `secondaryContent` it renders `Option`'s DOM. The interface of the same name, `TagPickerOption`,
 * is an entry of TagPicker's `options` array.
 *
 * @example
 * <TagPicker.Option
 *   value="katri"
 *   label="Katri Athokas"
 *   media={<Avatar name="Katri Athokas" />}
 *   secondaryContent="Designer"
 * >
 *   Katri Athokas
 * </TagPicker.Option>
 */
export const TagPickerOption: React.NamedExoticComponent<TagPickerOptionProps> =
  /* @__PURE__ */ markListboxElement(MemoTagPickerOption, 'option');
