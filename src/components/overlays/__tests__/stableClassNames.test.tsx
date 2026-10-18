import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  buttonClassNames,
  dialogContentClassNames,
  dialogFooterClassNames,
  dialogTitleClassNames,
  drawerBodyClassNames,
  drawerClassNames,
  drawerFooterClassNames,
  drawerHeaderClassNames,
  drawerHeaderNavigationClassNames,
  drawerHeaderTitleClassNames,
  drawerTitleClassNames,
  popoverContentClassNames,
  teachingPopoverClassNames,
  tooltipClassNames,
} from '../../../lib/classNames';
import { Dialog } from '../Dialog';
import { Drawer } from '../Drawer';
import { Popover } from '../Popover';
import { TeachingPopover } from '../TeachingPopover';
import type { TeachingPopoverStep } from '../TeachingPopover';
import { Tooltip } from '../Tooltip';

const steps: TeachingPopoverStep[] = [
  { title: 'Welcome', body: 'Start here.' },
  { title: 'Share', body: 'Invite your team.' },
];

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): overlays folder', () => {
  it('Dialog.Content: surface root, backdrop, the title heading, the Close Button, body and footer', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content title="Edit profile">
          <p>Profile fields</p>
          <Dialog.Footer data-testid="footer">
            <button type="button">Save</button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>,
    );
    const surface = screen.getByRole('dialog', { name: 'Edit profile' });
    expect(surface).toHaveClass(dialogContentClassNames.root);
    // The backdrop is the positioner's sibling, behind it (P6-06 D93).
    expect(surface.parentElement).toHaveClass(dialogContentClassNames.positioner);
    expect(surface.parentElement?.previousElementSibling).toHaveClass(
      dialogContentClassNames.backdrop,
    );
    // The `title` prop's heading carries the Dialog.Title class (judgement 13).
    expect(screen.getByRole('heading', { name: 'Edit profile' })).toHaveClass(
      dialogTitleClassNames.root,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      buttonClassNames.root,
      dialogContentClassNames.closeButton,
    );
    expect(screen.getByText('Profile fields').parentElement).toHaveClass(
      dialogContentClassNames.body,
    );
    expect(screen.getByTestId('footer')).toHaveClass(dialogFooterClassNames.root);
  });

  it('Dialog.Content: positioner, the title-actions area, titleAction and Dialog.Title action (P6-06)', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content
          titleAction={
            <button type="button" aria-label="Expand">
              +
            </button>
          }
        >
          <Dialog.Title
            action={
              <button type="button" aria-label="More">
                …
              </button>
            }
          >
            Report
          </Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    const surface = screen.getByRole('dialog', { name: 'Report' });
    expect(surface.parentElement).toHaveClass(dialogContentClassNames.positioner);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.parentElement).toHaveClass(dialogContentClassNames.titleActions);
    expect(screen.getByRole('button', { name: 'Expand' }).parentElement).toHaveClass(
      dialogContentClassNames.titleAction,
    );
    expect(screen.getByRole('button', { name: 'More' }).parentElement).toHaveClass(
      dialogTitleClassNames.action,
    );
  });

  it('Drawer: the titleAction element in the built-in header (P6-06)', () => {
    render(
      <Drawer
        title="Filters"
        defaultOpen
        titleAction={
          <button type="button" aria-label="Pin">
            P
          </button>
        }
      >
        <p>Filter fields</p>
      </Drawer>,
    );
    const action = screen.getByRole('button', { name: 'Pin' }).parentElement;
    expect(action).toHaveClass(drawerClassNames.titleAction);
    expect(action?.parentElement).toHaveClass(drawerClassNames.header);
  });

  it('Dialog.Title: the root on the heading', () => {
    render(
      <Dialog defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Rename file</Dialog.Title>
          <p>Body</p>
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole('heading', { name: 'Rename file' })).toHaveClass(
      dialogTitleClassNames.root,
    );
  });

  it('Drawer: panel root while open, backdrop, header, the title heading, the Close Button and body', () => {
    render(
      <Drawer title="Filters" defaultOpen>
        <p>Filter fields</p>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    expect(panel).toHaveClass(drawerClassNames.root);
    // The backdrop is the panel's sibling, behind it (P6-06 D93).
    expect(panel.previousElementSibling).toHaveClass(drawerClassNames.backdrop);
    expect(screen.getByRole('heading', { name: 'Filters' })).toHaveClass(
      drawerTitleClassNames.root,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass(buttonClassNames.root, drawerClassNames.closeButton);
    expect(close.parentElement).toHaveClass(drawerClassNames.header);
    expect(screen.getByText('Filter fields').parentElement).toHaveClass(drawerClassNames.body);
  });

  it('Drawer.Header, HeaderTitle (heading, action, the Close Button), HeaderNavigation, Body and Footer', () => {
    render(
      <Drawer defaultOpen>
        <Drawer.Header data-testid="header">
          <Drawer.HeaderNavigation aria-label="Levels">
            <button type="button">Back</button>
          </Drawer.HeaderNavigation>
          <Drawer.HeaderTitle
            data-testid="title-row"
            action={
              <button type="button" aria-label="Expand">
                +
              </button>
            }
          >
            Settings
          </Drawer.HeaderTitle>
        </Drawer.Header>
        <Drawer.Body data-testid="body">
          <p>Settings fields</p>
        </Drawer.Body>
        <Drawer.Footer data-testid="footer">
          <button type="button">Apply</button>
        </Drawer.Footer>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Settings' });
    const header = screen.getByTestId('header');
    // A placed Header carries only its own class; the built-in row's class is not rendered.
    expect(header).toHaveClass(drawerHeaderClassNames.root);
    expect(header).not.toHaveClass(drawerClassNames.header);
    expect(panel.querySelector(`.${drawerClassNames.header}`)).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Levels' })).toHaveClass(
      drawerHeaderNavigationClassNames.root,
    );
    const row = screen.getByTestId('title-row');
    expect(row).toHaveClass(drawerHeaderTitleClassNames.root);
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveClass(
      drawerHeaderTitleClassNames.heading,
    );
    expect(screen.getByRole('button', { name: 'Expand' }).parentElement).toHaveClass(
      drawerHeaderTitleClassNames.action,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass(buttonClassNames.root, drawerClassNames.closeButton);
    expect(close.parentElement).toBe(row);
    // The placed Body's element is the scrolling body: both classes on one element.
    const body = screen.getByTestId('body');
    expect(body).toHaveClass(drawerClassNames.body, drawerBodyClassNames.root);
    expect(body.parentElement).toBe(panel);
    expect(screen.getByTestId('footer')).toHaveClass(drawerFooterClassNames.root);
  });

  it('Drawer.Title: the root on the heading', () => {
    render(
      <Drawer defaultOpen>
        <Drawer.Title>Settings</Drawer.Title>
        <p>Body</p>
      </Drawer>,
    );
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveClass(
      drawerTitleClassNames.root,
    );
  });

  it('Popover.Content: surface root, beak and title', async () => {
    render(
      <Popover defaultOpen>
        <Popover.Trigger>
          <button type="button">Details</button>
        </Popover.Trigger>
        <Popover.Content title="Shipping">Ships in 2 days</Popover.Content>
      </Popover>,
    );
    await act(async () => {});
    const surface = screen.getByRole('dialog', { name: 'Shipping' });
    expect(surface).toHaveClass(popoverContentClassNames.root);
    expect(surface.querySelector('[data-wave-popover-arrow]')).toHaveClass(
      popoverContentClassNames.beak,
    );
    expect(screen.getByRole('heading', { name: 'Shipping' })).toHaveClass(
      popoverContentClassNames.title,
    );
  });

  it('Tooltip: root on the wrapper, content on the surface', async () => {
    render(
      <Tooltip content="Saves the draft" defaultOpen>
        <button type="button">Save</button>
      </Tooltip>,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Save' }).parentElement).toHaveClass(
      tooltipClassNames.root,
    );
    expect(document.querySelector('[data-wave-tooltip-surface]')).toHaveClass(
      tooltipClassNames.content,
    );
  });

  it('TeachingPopover: root and every part of the surface; its Buttons carry the Button class', () => {
    render(<TeachingPopover steps={steps} />);
    const surface = screen.getByRole('dialog', { name: /^Welcome/ });
    expect(surface).toHaveClass(teachingPopoverClassNames.root);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      buttonClassNames.root,
      teachingPopoverClassNames.closeButton,
    );
    expect(screen.getByRole('heading', { name: /^Welcome/ })).toHaveClass(
      teachingPopoverClassNames.title,
    );
    expect(screen.getByText('Start here.')).toHaveClass(teachingPopoverClassNames.body);
    const dots = Array.from(surface.querySelectorAll('[data-wave-teaching-popover-dot]'));
    expect(dots).toHaveLength(2);
    for (const dot of dots) expect(dot).toHaveClass(teachingPopoverClassNames.dot);
    // dot → its row (a layout wrapper, judgement 27) → the footer row.
    expect(dots[0].parentElement?.parentElement).toHaveClass(teachingPopoverClassNames.footer);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass(
      buttonClassNames.root,
      teachingPopoverClassNames.backButton,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass(
      buttonClassNames.root,
      teachingPopoverClassNames.nextButton,
    );
  });

  it('TeachingPopover with a target: the beak', async () => {
    function Anchored() {
      const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
      return (
        <>
          <button type="button" ref={setTarget}>
            New feature
          </button>
          <TeachingPopover steps={steps} target={target} />
        </>
      );
    }
    render(<Anchored />);
    await act(async () => {});
    expect(document.querySelector('[data-wave-teaching-popover-arrow]')).toHaveClass(
      teachingPopoverClassNames.beak,
    );
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(
        <>
          <Tooltip content="Saves the draft">
            <button type="button">Save</button>
          </Tooltip>
          <TeachingPopover steps={steps} />
        </>,
      ),
    );
    expect(host.querySelector('button')?.parentElement).toHaveClass(tooltipClassNames.root);
    const surface = host.querySelector('[role="dialog"]');
    expect(surface).toHaveClass(teachingPopoverClassNames.root);
    expect(surface?.querySelector('h3')).toHaveClass(teachingPopoverClassNames.title);
  });
});
