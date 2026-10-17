import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { waveProviderClassNames } from '../../../lib/classNames';
import { WaveProvider } from '../WaveProvider';

describe('stable class names (P3-00): provider folder', () => {
  it('WaveProvider: the root class on its themed element, next to your className', () => {
    render(
      <WaveProvider data-testid="provider" className="app-shell">
        Content
      </WaveProvider>,
    );
    expect(screen.getByTestId('provider')).toHaveClass(waveProviderClassNames.root, 'app-shell');
  });

  it('renders the class in the server HTML', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<WaveProvider>Content</WaveProvider>);
    expect(host.firstElementChild).toHaveClass(waveProviderClassNames.root);
  });
});
