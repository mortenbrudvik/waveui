import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { portalClassNames } from '../../../lib/classNames';
import { Portal } from '../Portal';

describe('stable class names (P3-00): portal folder', () => {
  it('Portal: the wrapper carries the root class and merges your className', () => {
    render(
      <Portal className="app-layer">
        <span>Inside</span>
      </Portal>,
    );
    expect(screen.getByText('Inside').parentElement).toHaveClass(
      portalClassNames.root,
      'app-layer',
    );
  });
});
