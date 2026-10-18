import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  avatarClassNames,
  avatarGroupClassNames,
  badgeClassNames,
  counterBadgeClassNames,
  dividerClassNames,
  imageClassNames,
  infoButtonClassNames,
  infoLabelClassNames,
  interactionTagClassNames,
  interactionTagPrimaryClassNames,
  interactionTagSecondaryClassNames,
  labelClassNames,
  listClassNames,
  listItemClassNames,
  personaClassNames,
  presenceBadgeClassNames,
  tagClassNames,
  tagGroupClassNames,
} from '../../../lib/classNames';
import { Button } from '../../button/Button';
import type { Slot } from '../../../lib/slot';
import { Avatar } from '../Avatar';
import { AvatarGroup } from '../AvatarGroup';
import { Badge } from '../Badge';
import { CounterBadge } from '../CounterBadge';
import { Divider } from '../Divider';
import { Image } from '../Image';
import { InfoButton } from '../InfoButton';
import { InfoLabel } from '../InfoLabel';
import { InteractionTag } from '../InteractionTag';
import { List } from '../List';
import { Persona } from '../Persona';
import { PresenceBadge } from '../PresenceBadge';
import { Tag } from '../Tag';
import { TagGroup } from '../TagGroup';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A decorative glyph a test can find. */
const Glyph = ({ testId }: { testId: string }) => <svg data-testid={testId} aria-hidden="true" />;

/** The element a glyph sits in: the slot's element. */
const iconBox = (testId: string) => screen.getByTestId(testId).parentElement as HTMLElement;

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): data-display folder', () => {
  it('Avatar without a badge: the circle is the root and carries the visual part; the initials part', () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveClass(
      avatarClassNames.root,
      avatarClassNames.visual,
    );
    expect(screen.getByText('AL')).toHaveClass(avatarClassNames.initials);
  });

  it('Avatar: the default person glyph, an icon slot, an image and an image slot element', () => {
    render(
      <>
        <Avatar data-testid="anonymous" />
        <Avatar name="Team" icon={<Glyph testId="team-icon" />} />
        <Avatar name="Ada Lovelace" src="ada.png" />
        <Avatar
          name="Grace Hopper"
          image={<img src="grace.png" alt="" data-testid="grace-image" />}
        />
      </>,
    );
    expect(screen.getByTestId('anonymous').querySelector('[data-wave-icon="person"]')).toHaveClass(
      avatarClassNames.icon,
    );
    expect(iconBox('team-icon')).toHaveClass(avatarClassNames.icon);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveClass(avatarClassNames.image);
    expect(screen.getByTestId('grace-image')).toHaveClass(avatarClassNames.image);
  });

  it('Avatar with a badge: the root moves to the wrapper, the circle keeps the visual part', () => {
    render(
      <Avatar
        name="Ada Lovelace"
        badge={<PresenceBadge status="available" />}
        data-testid="avatar"
      />,
    );
    const root = screen.getByTestId('avatar');
    expect(root).toHaveClass(avatarClassNames.root);
    expect(root).not.toHaveClass(avatarClassNames.visual);
    const circle = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(circle).toHaveClass(avatarClassNames.visual);
    expect(circle).not.toHaveClass(avatarClassNames.root);
    expect(screen.getByRole('img', { name: 'Available' }).parentElement).toHaveClass(
      avatarClassNames.badge,
    );
  });

  it('AvatarGroup: root, member wrappers, overflow button and its popup list', async () => {
    const user = userEvent.setup();
    render(
      <AvatarGroup aria-label="Team" max={2}>
        <Avatar name="Ada Lovelace" />
        <Avatar name="Grace Hopper" />
        <Avatar name="Alan Turing" />
      </AvatarGroup>,
    );
    expect(screen.getByRole('group', { name: 'Team' })).toHaveClass(avatarGroupClassNames.root);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).parentElement).toHaveClass(
      avatarGroupClassNames.item,
    );
    const overflow = screen.getByRole('button', { name: '1 more' });
    expect(overflow).toHaveClass(avatarGroupClassNames.overflowButton);
    await user.click(overflow);
    await act(async () => {});
    const surface = screen.getByRole('dialog', { name: '1 more' });
    expect(surface).toHaveClass(avatarGroupClassNames.surface);
    expect(within(surface).getByRole('list')).toHaveClass(avatarGroupClassNames.list);
    expect(within(surface).getByRole('listitem')).toHaveClass(avatarGroupClassNames.listItem);
  });

  it('Badge, CounterBadge (which also carries the Badge class) and PresenceBadge', () => {
    render(
      <>
        <Badge>New</Badge>
        <CounterBadge count={5} />
        <PresenceBadge status="busy" />
      </>,
    );
    expect(screen.getByText('New')).toHaveClass(badgeClassNames.root);
    expect(screen.getByText('New')).not.toHaveClass(counterBadgeClassNames.root);
    expect(screen.getByText('5')).toHaveClass(badgeClassNames.root, counterBadgeClassNames.root);
    const presence = screen.getByRole('img', { name: 'Busy' });
    expect(presence).toHaveClass(presenceBadgeClassNames.root);
    expect(presence.querySelector('svg')).toHaveClass(presenceBadgeClassNames.icon);
  });

  it('Tag: root, primary text, dismiss button and the default dismiss glyph', () => {
    render(
      <Tag dismissible onDismiss={() => {}}>
        Cherry
      </Tag>,
    );
    const content = screen.getByText('Cherry');
    expect(content).toHaveClass(tagClassNames.primaryText);
    expect(content.parentElement).toHaveClass(tagClassNames.root);
    const dismiss = screen.getByRole('button', { name: 'Dismiss Cherry' });
    expect(dismiss).toHaveClass(tagClassNames.dismissButton);
    expect(dismiss.querySelector('[data-wave-icon="dismiss"]')).toHaveClass(
      tagClassNames.dismissIcon,
    );
  });

  it('Tag: the dismiss icon part is the element `dismissIcon` renders, or a merged Button icon', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <Tag dismissible dismissIcon={<Glyph testId="kiwi-icon" />}>
          Kiwi
        </Tag>
        <Tag dismissible dismissIcon={{ className: 'text-error' }}>
          Plum
        </Tag>
        <Tag dismissible dismissIcon={<Button icon={<Glyph testId="fig-icon" />} />}>
          Fig
        </Tag>
      </>,
    );
    expect(iconBox('kiwi-icon')).toHaveClass(tagClassNames.dismissIcon);
    // A slot object without content wraps the default glyph: the wrapper is the part, once.
    const wrapper = screen
      .getByRole('button', { name: 'Dismiss Plum' })
      .querySelector('.text-error');
    expect(wrapper).toHaveClass(tagClassNames.dismissIcon);
    expect(wrapper?.querySelector('[data-wave-icon="dismiss"]')).not.toHaveClass(
      tagClassNames.dismissIcon,
    );
    expect(iconBox('fig-icon')).toHaveClass(tagClassNames.dismissIcon);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Tag: `dismissIcon` received a button. Its props were merged into the built-in dismiss button (a button cannot contain another button), which is named by its text label (or `dismissLabel`) and the tag content. Pass icon content instead, e.g. `dismissIcon={<CloseIcon />}`, and handle the dismissal in `onDismiss`.',
      ],
    ]);
  });

  it('Tag: the media, icon and secondary-text parts', () => {
    render(
      <>
        <Tag
          media={<Avatar name="Katri Athokas" />}
          icon={<Glyph testId="katri-icon" />}
          secondaryText="Designer"
        >
          Katri
        </Tag>
        <Tag
          media={{ className: 'text-error', children: <Avatar name="Ada Lovelace" /> }}
          // A void `as` takes the element's attributes (the slot is typed by its default span).
          icon={{ as: 'img', src: 'tag.svg', alt: '' } as Slot<'span'>}
        >
          Ada
        </Tag>
      </>,
    );
    expect(screen.getByRole('img', { name: 'Katri Athokas' }).parentElement).toHaveClass(
      tagClassNames.media,
    );
    expect(iconBox('katri-icon')).toHaveClass(tagClassNames.icon);
    expect(screen.getByText('Designer')).toHaveClass(tagClassNames.secondaryText);
    expect(screen.getByText('Katri')).toHaveClass(tagClassNames.primaryText);
    // A slot object keeps the part class on its own element.
    const media = screen.getByRole('img', { name: 'Ada Lovelace' }).parentElement;
    expect(media).toHaveClass(tagClassNames.media, 'text-error');
    const image = screen.getByText('Ada').parentElement?.querySelector('img');
    expect(image).toHaveClass(tagClassNames.icon);
    expect(image).toHaveAttribute('src', 'tag.svg');
  });

  it('TagGroup: root on the toolbar and on the list element', () => {
    render(
      <>
        <TagGroup aria-label="Filters" dismissible className="wave-test-toolbar">
          <Tag>Red</Tag>
        </TagGroup>
        <TagGroup role="list" aria-label="Skills" className="wave-test-list">
          <Tag>React</Tag>
        </TagGroup>
      </>,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Filters' });
    expect(toolbar).toHaveClass(tagGroupClassNames.root, 'wave-test-toolbar');
    expect(toolbar.classList[0]).toBe(tagGroupClassNames.root);
    const list = screen.getByRole('list', { name: 'Skills' });
    expect(list).toHaveClass(tagGroupClassNames.root, 'wave-test-list');
    // The tags keep their own root class, and no TagGroup class reaches them.
    expect(within(list).getByRole('listitem')).toHaveClass(tagClassNames.root);
    expect(within(list).getByRole('listitem')).not.toHaveClass(tagGroupClassNames.root);
  });

  it('InteractionTag: root, Primary and its slot parts, Secondary and its dismiss icon', () => {
    render(
      <>
        <InteractionTag className="wave-test-tag">
          <InteractionTag.Primary
            media={<Avatar name="Katri Athokas" />}
            icon={<Glyph testId="katri-icon" />}
            secondaryText="Designer"
          >
            Katri
          </InteractionTag.Primary>
          <InteractionTag.Secondary />
        </InteractionTag>
        <InteractionTag>
          <InteractionTag.Primary>Cherry</InteractionTag.Primary>
          <InteractionTag.Secondary>
            <Glyph testId="cherry-glyph" />
          </InteractionTag.Secondary>
        </InteractionTag>
      </>,
    );
    const primary = screen.getByRole('button', { name: 'Katri Designer' });
    const root = primary.parentElement as HTMLElement;
    expect(root).toHaveClass(interactionTagClassNames.root, 'wave-test-tag');
    expect(root.classList[0]).toBe(interactionTagClassNames.root);
    expect(primary).toHaveClass(interactionTagPrimaryClassNames.root);
    expect(primary.classList[0]).toBe(interactionTagPrimaryClassNames.root);
    expect(primary.querySelector('[role="img"]')?.parentElement).toHaveClass(
      interactionTagPrimaryClassNames.media,
    );
    expect(iconBox('katri-icon')).toHaveClass(interactionTagPrimaryClassNames.icon);
    expect(screen.getByText('Katri')).toHaveClass(interactionTagPrimaryClassNames.primaryText);
    expect(screen.getByText('Designer')).toHaveClass(interactionTagPrimaryClassNames.secondaryText);
    // The default glyph is the dismiss icon part; the children's wrapper is when it has children.
    const secondary = screen.getByRole('button', { name: 'Dismiss Katri' });
    expect(secondary).toHaveClass(interactionTagSecondaryClassNames.root);
    expect(secondary.classList[0]).toBe(interactionTagSecondaryClassNames.root);
    expect(secondary.querySelector('[data-wave-icon="dismiss"]')).toHaveClass(
      interactionTagSecondaryClassNames.dismissIcon,
    );
    expect(iconBox('cherry-glyph')).toHaveClass(interactionTagSecondaryClassNames.dismissIcon);
    expect(screen.getByTestId('cherry-glyph')).not.toHaveClass(
      interactionTagSecondaryClassNames.dismissIcon,
    );
    // No Tag class reaches them (Fluent's InteractionTag does not reuse Tag's either).
    for (const element of [root, primary, secondary]) {
      expect(element.className).not.toMatch(/\bwave-tag(?:__|\s|$)/);
    }
  });

  it('Persona: root, the built-in Avatar (its own classes plus the avatar part), the badge element and the texts', () => {
    render(
      <Persona
        name="Ada Lovelace"
        secondaryText="Engineer"
        status="available"
        data-testid="persona"
      />,
    );
    const persona = screen.getByTestId('persona');
    expect(persona).toHaveClass(personaClassNames.root);
    // The built-in Avatar is decorative: the first aria-hidden element of the persona.
    expect(persona.querySelector('[aria-hidden="true"]')).toHaveClass(
      avatarClassNames.root,
      avatarClassNames.visual,
      personaClassNames.avatar,
    );
    expect(screen.getByRole('img', { name: 'Available' }).parentElement).toHaveClass(
      personaClassNames.badge,
    );
    expect(screen.getByText('Ada Lovelace')).toHaveClass(personaClassNames.primaryText);
    expect(screen.getByText('Engineer')).toHaveClass(personaClassNames.secondaryText);
  });

  it('Persona: an `avatar` slot carries the avatar part', () => {
    render(<Persona name="Grace Hopper" avatar={<Glyph testId="custom-avatar" />} />);
    expect(iconBox('custom-avatar')).toHaveClass(personaClassNames.avatar);
  });

  it('Divider: the root in each layout; a labelled divider draws two lines around its label', () => {
    render(
      <>
        <Divider data-testid="rule" />
        <Divider orientation="vertical" data-testid="line" />
        <Divider data-testid="labelled">Or</Divider>
      </>,
    );
    expect(screen.getByTestId('rule')).toHaveClass(dividerClassNames.root);
    expect(screen.getByTestId('line')).toHaveClass(dividerClassNames.root);
    const labelled = screen.getByTestId('labelled');
    expect(labelled).toHaveClass(dividerClassNames.root);
    expect(screen.getByText('Or')).toHaveClass(dividerClassNames.label);
    const lines = Array.from(labelled.children).filter(
      (child) => child.getAttribute('aria-hidden') === 'true',
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toHaveClass(dividerClassNames.line);
  });

  it('InfoButton: root, the note (info) and its beak; the glyph, the hidden description and the wrapper in the note have no class', async () => {
    render(<InfoButton info="Invoices are sent monthly" />);
    const button = screen.getByRole('button', { name: 'Information' });
    expect(button).toHaveClass(infoButtonClassNames.root);
    // The glyph is the whole, uncontrolled content of the button (Appendix A, judgement 26).
    expect(button.querySelector('svg')?.getAttribute('class') ?? '').not.toMatch(/\bwave-/);
    // The hidden description is visually hidden text, not a part (spec D4).
    const description = button.nextElementSibling as HTMLElement;
    expect(description).toHaveAttribute('hidden');
    expect(description.className).toBe('');
    // Keyboard focus opens the note (no hover timers involved).
    act(() => {
      button.focus();
    });
    await act(async () => {});
    // The note is the `info` part (Fluent's `info` slot, the popover surface; judgement 24).
    const note = screen.getByRole('note', { name: 'Information' });
    expect(note).toHaveClass(infoButtonClassNames.info);
    // A standalone InfoButton carries none of InfoLabel's classes; the marker stays (as in 0.8).
    expect(note).toHaveAttribute('data-wave-infolabel-surface');
    expect(note).not.toHaveClass(infoLabelClassNames.info);
    expect(button).not.toHaveClass(infoLabelClassNames.infoButton);
    expect(note.querySelector('[data-wave-popover-arrow]')).toHaveClass(infoButtonClassNames.beak);
    // The element inside the note that holds `info` is a wrapper (judgement 27).
    expect(within(note).getByText('Invoices are sent monthly').className).toBe('');
  });

  it('InfoLabel: root, its Label and InfoButton with their part classes, and the note as the info part', async () => {
    render(<InfoLabel info="Used to sign in">Email</InfoLabel>);
    // A nested public component keeps its own classes and gets the parent's part class (D5).
    const label = screen.getByText('Email');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveClass(labelClassNames.root, infoLabelClassNames.label);
    expect(label.parentElement).toHaveClass(infoLabelClassNames.root);
    const button = screen.getByRole('button', { name: 'Email Information' });
    expect(button).toHaveClass(infoButtonClassNames.root, infoLabelClassNames.infoButton);
    act(() => {
      button.focus();
    });
    await act(async () => {});
    // The popup keeps 0.8's `info` class (the element with the data-wave-infolabel-surface
    // marker), next to InfoButton's own `info` class.
    const note = screen.getByRole('note', { name: 'Email Information' });
    expect(note).toHaveAttribute('data-wave-infolabel-surface');
    expect(note).toHaveClass(infoButtonClassNames.info, infoLabelClassNames.info);
  });

  it("InfoLabel: an InfoButton inside its info content does not take the label's info class", async () => {
    render(
      <InfoLabel info={<InfoButton id="inner" aria-label="More" info="Nested details" />}>
        Email
      </InfoLabel>,
    );
    const outer = screen.getByRole('button', { name: 'Email Information' });
    act(() => {
      outer.focus();
    });
    await act(async () => {});
    const inner = screen.getByRole('button', { name: 'More' });
    expect(inner).toHaveClass(infoButtonClassNames.root);
    expect(inner).not.toHaveClass(infoLabelClassNames.infoButton);
    act(() => {
      inner.focus();
    });
    await act(async () => {});
    const innerNote = screen.getByRole('note', { name: 'More' });
    expect(innerNote).toHaveClass(infoButtonClassNames.info);
    expect(innerNote).not.toHaveClass(infoLabelClassNames.info);
  });

  it('InfoLabel and InfoButton: the classes are in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(<InfoLabel info="Used to sign in">Email</InfoLabel>),
    );
    const root = host.firstElementChild as HTMLElement;
    expect(root).toHaveClass(infoLabelClassNames.root);
    expect(root.querySelector('label')).toHaveClass(
      labelClassNames.root,
      infoLabelClassNames.label,
    );
    expect(root.querySelector('button')).toHaveClass(
      infoButtonClassNames.root,
      infoLabelClassNames.infoButton,
    );
  });

  it('Image: the root on the img', () => {
    render(<Image src="chart.png" alt="Sales chart" />);
    expect(screen.getByRole('img', { name: 'Sales chart' })).toHaveClass(imageClassNames.root);
  });

  it('List and List.Item: root, item, content and action, as a list and as a grid', () => {
    const { unmount } = render(
      <List aria-label="Fruits">
        <List.Item action={<button type="button">Remove</button>}>Apple</List.Item>
      </List>,
    );
    expect(screen.getByRole('list', { name: 'Fruits' })).toHaveClass(listClassNames.root);
    expect(screen.getByRole('listitem')).toHaveClass(listItemClassNames.root);
    expect(screen.getByText('Apple')).toHaveClass(listItemClassNames.content);
    expect(screen.getByRole('button', { name: 'Remove' }).parentElement).toHaveClass(
      listItemClassNames.action,
    );
    unmount();

    render(
      <List selectable aria-label="Files">
        <List.Item value="report" action={<button type="button">Share</button>}>
          Report
        </List.Item>
      </List>,
    );
    expect(screen.getByRole('grid', { name: 'Files' })).toHaveClass(listClassNames.root);
    expect(screen.getByRole('row')).toHaveClass(listItemClassNames.root);
    expect(screen.getByText('Report')).toHaveClass(listItemClassNames.content);
    expect(screen.getByRole('button', { name: 'Share' }).parentElement).toHaveClass(
      listItemClassNames.action,
    );
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(<Persona name="Ada Lovelace" secondaryText="Engineer" status="available" />),
    );
    const persona = host.firstElementChild as HTMLElement;
    expect(persona).toHaveClass(personaClassNames.root);
    expect(persona.querySelector('[aria-hidden="true"]')).toHaveClass(
      avatarClassNames.root,
      avatarClassNames.visual,
      personaClassNames.avatar,
    );
    expect(persona.querySelector('[role="img"]')).toHaveClass(presenceBadgeClassNames.root);
  });
});
