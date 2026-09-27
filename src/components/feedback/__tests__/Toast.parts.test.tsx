import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Toast, ToastBody, ToastFooter, ToastTitle } from '../Toast';
import {
  toastBodyClassNames,
  toastClassNames,
  toastFooterClassNames,
  toastTitleClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  expectThrows,
  testCompoundExposure,
  testSystemProps,
} from '../../../test-utils';

/** Renders a part inside a standalone Toast, the host its context needs. */
function ToastWrapper({ children }: { children: React.ReactNode }) {
  return <Toast>{children}</Toast>;
}

const unscanned = (part: 'Title' | 'Body' | 'Footer') =>
  `[WaveUI] Toast.${part} is not a direct child of Toast, so it renders inside the body that Toast makes for its children. Make it a direct child of Toast.`;

describe('Toast parts (P3-02, toast-2)', () => {
  describe('ToastTitle', () => {
    testSystemProps(ToastTitle, {
      expectedTag: 'div',
      displayName: 'ToastTitle',
      defaultProps: { children: 'Saved' },
      wrapper: ToastWrapper,
    });
  });

  describe('ToastBody', () => {
    testSystemProps(ToastBody, {
      expectedTag: 'div',
      displayName: 'ToastBody',
      defaultProps: { children: 'Your changes were saved.' },
      wrapper: ToastWrapper,
    });
  });

  describe('ToastFooter', () => {
    testSystemProps(ToastFooter, {
      expectedTag: 'div',
      displayName: 'ToastFooter',
      defaultProps: { children: <button type="button">Undo</button> },
      wrapper: ToastWrapper,
    });
  });

  testCompoundExposure(Toast, ['Title', 'Body', 'Footer']);

  it('exports every part under its flat name (C-COMPOUND)', () => {
    expect(ToastTitle).toBe(Toast.Title);
    expect(ToastBody).toBe(Toast.Body);
    expect(ToastFooter).toBe(Toast.Footer);
  });

  it('renders the title row, the body with its subtitle and the footer in the content column', () => {
    render(
      <Toast status="success" data-testid="toast">
        <Toast.Title action={<a href="#details">Details</a>}>Backup complete</Toast.Title>
        <Toast.Body subtitle="2 minutes ago">All files were copied.</Toast.Body>
        <Toast.Footer>
          <button type="button">Open archive</button>
        </Toast.Footer>
      </Toast>,
    );
    const content = screen.getByTestId('toast').querySelector(`.${toastClassNames.content}`);
    const label = screen.getByText('Backup complete');
    const row = label.parentElement;
    expect(label).toHaveClass(toastTitleClassNames.label);
    expect(row).toHaveClass(toastTitleClassNames.root);
    expect(screen.getByRole('link', { name: 'Details' }).parentElement).toHaveClass(
      toastTitleClassNames.action,
    );
    const body = screen.getByText('All files were copied.');
    expect(body).toHaveClass(toastBodyClassNames.root);
    expect(within(body).getByText('2 minutes ago')).toHaveClass(toastBodyClassNames.subtitle);
    const footer = screen.getByRole('button', { name: 'Open archive' }).parentElement;
    expect(footer).toHaveClass(toastFooterClassNames.root);
    // After the visually hidden severity text, in the order given.
    expect(content?.firstElementChild).toHaveTextContent('Success:');
    expect(Array.from(content?.children ?? []).slice(1)).toEqual([row, body, footer]);
  });

  it('renders no action element for an action that renders nothing, and no empty subtitle', () => {
    render(
      <Toast>
        <Toast.Title action={false}>Saved</Toast.Title>
        <Toast.Body subtitle="">Done.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved').parentElement?.children).toHaveLength(1);
    expect(screen.getByText('Done.').children).toHaveLength(0);
  });

  it('renders the 0.5 title prop and plain children through the Title and Body parts', () => {
    render(<Toast title="Saved">Your changes were saved.</Toast>);
    expect(screen.getByText('Saved')).toHaveClass(toastTitleClassNames.label);
    expect(screen.getByText('Your changes were saved.')).toHaveClass(toastBodyClassNames.root);
  });

  it('renders the title prop as a Title next to Body and Footer parts', () => {
    render(
      <Toast title="Upload failed">
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Upload failed')).toHaveClass(toastTitleClassNames.label);
    expect(screen.getByText('The file is too large.')).toHaveClass(toastBodyClassNames.root);
  });

  it('finds parts inside a Fragment (no body around them, no warning)', () => {
    const warn = vi.spyOn(console, 'warn');
    render(
      <Toast>
        <>
          <Toast.Title>Saved</Toast.Title>
          <Toast.Body>Done.</Toast.Body>
        </>
      </Toast>,
    );
    expect(screen.getByText('Saved').closest(`.${toastBodyClassNames.root}`)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('finds parts written in a Server Component (client references): the same markup', () => {
    const Title = asClientReference(Toast.Title);
    const Body = asClientReference(Toast.Body);
    const Footer = asClientReference(Toast.Footer);
    const plain = renderToString(
      <Toast>
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body>Done.</Toast.Body>
        <Toast.Footer>
          <button type="button">Undo</button>
        </Toast.Footer>
      </Toast>,
    );
    const lazy = renderToString(
      <Toast>
        <Title>Saved</Title>
        <Body>Done.</Body>
        <Footer>
          <button type="button">Undo</button>
        </Footer>
      </Toast>,
    );
    expect(lazy).toBe(plain);
  });

  it.each(['Title', 'Body', 'Footer'] as const)(
    'warns once when Toast.%s is not a direct child: it renders inside the body',
    (part) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function AppPart() {
        if (part === 'Title') return <Toast.Title>Saved</Toast.Title>;
        if (part === 'Body') return <Toast.Body>Saved</Toast.Body>;
        return (
          <Toast.Footer>
            <button type="button">Saved</button>
          </Toast.Footer>
        );
      }
      render(
        <Toast>
          <AppPart />
        </Toast>,
      );
      // The part's element sits inside the body the Toast made for its children.
      const element = screen.getByText('Saved');
      expect(element.parentElement?.closest(`.${toastBodyClassNames.root}`)).not.toBeNull();
      expect(warn.mock.calls).toEqual([[unscanned(part)]]);
      warn.mockRestore();
    },
  );

  it('prefers a Toast.Title part over the title prop, with a development warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Toast title="Prop title">
        <Toast.Title>Part title</Toast.Title>
      </Toast>,
    );
    expect(screen.queryByText('Prop title')).not.toBeInTheDocument();
    expect(screen.getByText('Part title')).toHaveClass(toastTitleClassNames.label);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toast: `title` is ignored because a Toast.Title is among the children. Remove one of them.',
      ],
    ]);
    warn.mockRestore();
  });

  it.each([
    ['Toast.Title', <Toast.Title key="title">Saved</Toast.Title>],
    ['Toast.Body', <Toast.Body key="body">Done.</Toast.Body>],
    ['Toast.Footer', <Toast.Footer key="footer" />],
  ])('%s throws outside a Toast (C-CONTEXT)', (name, ui) => {
    expectThrows(ui, `[WaveUI] ${name} must be used within <Toast>`);
  });

  it('uses a consumer id on Toast.Body, and a generated one otherwise', () => {
    const { unmount } = render(
      <Toast>
        <Toast.Body id="save-details">Saved to Documents.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved to Documents.')).toHaveAttribute('id', 'save-details');
    unmount();
    render(
      <Toast>
        <Toast.Body>Saved to Documents.</Toast.Body>
      </Toast>,
    );
    expect(screen.getByText('Saved to Documents.').id).not.toBe('');
  });

  it('renders its parts on the server and hydrates without warnings', async () => {
    const ui = (
      <Toast status="success">
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body>Your changes were saved.</Toast.Body>
      </Toast>
    );
    const host = document.createElement('div');
    host.innerHTML = renderToString(ui);
    document.body.append(host);
    const error = vi.spyOn(console, 'error');
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, ui);
      });
      expect(error).not.toHaveBeenCalled();
      expect(within(host).getByText('Saved')).toHaveClass(toastTitleClassNames.label);
    } finally {
      act(() => root?.unmount());
      error.mockRestore();
      host.remove();
    }
  });
});
