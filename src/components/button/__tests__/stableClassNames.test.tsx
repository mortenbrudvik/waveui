import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  buttonClassNames,
  compoundButtonClassNames,
  linkClassNames,
  menuButtonClassNames,
  splitButtonClassNames,
  toggleButtonClassNames,
  toolbarButtonClassNames,
  toolbarClassNames,
  toolbarDividerClassNames,
  toolbarGroupClassNames,
  toolbarRadioButtonClassNames,
  toolbarRadioGroupClassNames,
  toolbarToggleButtonClassNames,
} from '../../../lib/classNames';
import { Button } from '../Button';
import { CompoundButton } from '../CompoundButton';
import { Link } from '../Link';
import { MenuButton } from '../MenuButton';
import { SplitButton } from '../SplitButton';
import { ToggleButton } from '../ToggleButton';
import { Toolbar } from '../Toolbar';

/** A decorative glyph a test can find. */
const Glyph = ({ testId }: { testId: string }) => <svg data-testid={testId} aria-hidden="true" />;

/** The element a glyph sits in: the icon slot's element. */
const iconBox = (testId: string) => screen.getByTestId(testId).parentElement as HTMLElement;

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): button folder', () => {
  it('Button: the root on the rendered element, the icon on the icon element', () => {
    render(<Button icon={<Glyph testId="save-icon" />}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(buttonClassNames.root);
    expect(iconBox('save-icon')).toHaveClass(buttonClassNames.icon);
  });

  it('Button: the root follows `as`; an icon slot object that swaps the element keeps the icon class', () => {
    render(
      <Button as="a" href="#docs" icon={{ as: 'i', 'data-testid': 'docs-icon' }}>
        Docs
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveClass(buttonClassNames.root);
    const icon = screen.getByTestId('docs-icon');
    expect(icon.tagName).toBe('I');
    expect(icon).toHaveClass(buttonClassNames.icon);
  });

  it("CompoundButton: Button's classes and its own on the root, the icon box and the text parts", () => {
    render(
      <CompoundButton icon={<Glyph testId="mail-icon" />} secondaryText="Opens your mail app">
        Send mail
      </CompoundButton>,
    );
    const button = screen.getByRole('button', { name: /Send mail/ });
    expect(button).toHaveClass(buttonClassNames.root, compoundButtonClassNames.root);
    expect(iconBox('mail-icon')).toHaveClass(buttonClassNames.icon, compoundButtonClassNames.icon);
    expect(button.querySelector('[data-wave-compound-content]')).toHaveClass(
      compoundButtonClassNames.contentContainer,
    );
    expect(screen.getByText('Send mail')).toHaveClass(compoundButtonClassNames.primaryText);
    expect(screen.getByText('Opens your mail app')).toHaveClass(
      compoundButtonClassNames.secondaryText,
    );
  });

  it("CompoundButton icon-only: Button's icon element carries both icon classes", () => {
    render(<CompoundButton icon={<Glyph testId="solo-icon" />} aria-label="Send" />);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass(
      buttonClassNames.root,
      compoundButtonClassNames.root,
    );
    expect(iconBox('solo-icon')).toHaveClass(buttonClassNames.icon, compoundButtonClassNames.icon);
  });

  it("ToggleButton: Button's classes and its own on the root and the icon, also for a slot object", () => {
    render(
      <>
        <ToggleButton icon={<Glyph testId="bold-icon" />} aria-label="Bold" />
        <ToggleButton icon={{ as: 'i', 'data-testid': 'grid-icon' }} aria-label="Grid" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
    );
    expect(iconBox('bold-icon')).toHaveClass(buttonClassNames.icon, toggleButtonClassNames.icon);
    const slotIcon = screen.getByTestId('grid-icon');
    expect(slotIcon.tagName).toBe('I');
    expect(slotIcon).toHaveClass(buttonClassNames.icon, toggleButtonClassNames.icon);
  });

  it('MenuButton: root, icon, the default chevron and a custom indicator', () => {
    render(
      <>
        <MenuButton icon={<Glyph testId="actions-icon" />}>Actions</MenuButton>
        <MenuButton menuIcon={<Glyph testId="caret" />}>More</MenuButton>
      </>,
    );
    const actions = screen.getByRole('button', { name: 'Actions' });
    expect(actions).toHaveClass(buttonClassNames.root, menuButtonClassNames.root);
    expect(iconBox('actions-icon')).toHaveClass(buttonClassNames.icon, menuButtonClassNames.icon);
    expect(actions.querySelector('[data-wave-icon="chevron-down"]')).toHaveClass(
      menuButtonClassNames.menuIcon,
    );
    expect(iconBox('caret')).toHaveClass(menuButtonClassNames.menuIcon);
  });

  it("SplitButton: the group root, each half's own and part classes (consumer classes kept) and both icons", () => {
    render(
      <SplitButton
        icon={<Glyph testId="save-icon" />}
        menuIcon={<Glyph testId="menu-glyph" />}
        primaryActionButtonProps={{ className: 'consumer-primary' }}
        menuButtonProps={{ className: 'consumer-menu' }}
      >
        Save
      </SplitButton>,
    );
    expect(screen.getByRole('group')).toHaveClass(splitButtonClassNames.root);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.primaryActionButton,
      'consumer-primary',
    );
    expect(screen.getByRole('button', { name: 'More options' })).toHaveClass(
      buttonClassNames.root,
      splitButtonClassNames.menuButton,
      'consumer-menu',
    );
    expect(iconBox('save-icon')).toHaveClass(buttonClassNames.icon, splitButtonClassNames.icon);
    expect(iconBox('menu-glyph')).toHaveClass(
      buttonClassNames.icon,
      splitButtonClassNames.menuIcon,
    );
  });

  it("SplitButton: the default chevron's element carries the menu icon classes", () => {
    render(<SplitButton>Save</SplitButton>);
    const chevron = screen
      .getByRole('button', { name: 'More options' })
      .querySelector('[data-wave-icon="chevron-down"]');
    expect(chevron?.parentElement).toHaveClass(
      buttonClassNames.icon,
      splitButtonClassNames.menuIcon,
    );
  });

  it('Link: the root on the rendered element', () => {
    render(<Link href="#top">Back to top</Link>);
    expect(screen.getByRole('link', { name: 'Back to top' })).toHaveClass(linkClassNames.root);
  });

  it('Toolbar and its parts: roots and icons, with the classes of every component they render through', () => {
    render(
      <Toolbar aria-label="Formatting">
        <Toolbar.Button icon={<Glyph testId="cut-icon" />}>Cut</Toolbar.Button>
        <Toolbar.Button vertical icon={<Glyph testId="paste-icon" />}>
          Paste
        </Toolbar.Button>
        <Toolbar.ToggleButton name="format" value="bold" icon={<Glyph testId="bold-icon" />}>
          Bold
        </Toolbar.ToggleButton>
        <Toolbar.Divider />
        <Toolbar.RadioGroup aria-label="Alignment">
          <Toolbar.RadioButton name="align" value="left" icon={<Glyph testId="left-icon" />}>
            Left
          </Toolbar.RadioButton>
        </Toolbar.RadioGroup>
        <Toolbar.Group aria-label="Sharing">
          <Toolbar.Button>Share</Toolbar.Button>
        </Toolbar.Group>
      </Toolbar>,
    );
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toHaveClass(toolbarClassNames.root);

    expect(screen.getByRole('button', { name: 'Cut' })).toHaveClass(
      buttonClassNames.root,
      toolbarButtonClassNames.root,
    );
    expect(iconBox('cut-icon')).toHaveClass(buttonClassNames.icon, toolbarButtonClassNames.icon);
    // With `vertical` the icon box is Button's icon element: it keeps its box classes too.
    expect(iconBox('paste-icon')).toHaveClass(
      buttonClassNames.icon,
      toolbarButtonClassNames.icon,
      'size-6',
    );

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
      toolbarToggleButtonClassNames.root,
    );
    expect(iconBox('bold-icon')).toHaveClass(
      buttonClassNames.icon,
      toggleButtonClassNames.icon,
      toolbarToggleButtonClassNames.icon,
    );

    expect(screen.getByRole('radio', { name: 'Left' })).toHaveClass(
      buttonClassNames.root,
      toggleButtonClassNames.root,
      toolbarRadioButtonClassNames.root,
    );
    expect(iconBox('left-icon')).toHaveClass(
      buttonClassNames.icon,
      toggleButtonClassNames.icon,
      toolbarRadioButtonClassNames.icon,
    );

    expect(screen.getByRole('radiogroup', { name: 'Alignment' })).toHaveClass(
      toolbarRadioGroupClassNames.root,
    );
    expect(screen.getByRole('group', { name: 'Sharing' })).toHaveClass(toolbarGroupClassNames.root);
    expect(screen.getByRole('separator')).toHaveClass(toolbarDividerClassNames.root);
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(renderToString(<SplitButton>Save</SplitButton>));
    const [primary, menu] = Array.from(host.querySelectorAll('button'));
    expect(host.firstElementChild).toHaveClass(splitButtonClassNames.root);
    expect(primary).toHaveClass(buttonClassNames.root, splitButtonClassNames.primaryActionButton);
    expect(menu).toHaveClass(buttonClassNames.root, splitButtonClassNames.menuButton);
    expect(menu.firstElementChild).toHaveClass(
      buttonClassNames.icon,
      splitButtonClassNames.menuIcon,
    );
  });
});
