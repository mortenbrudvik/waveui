import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { textClassNames } from '../../../lib/classNames';
import { Text } from '../Text';

describe('stable class names (P3-00): typography folder', () => {
  it('Text: the root on the rendered element, also with `as`', () => {
    render(
      <>
        <Text>Plain text</Text>
        <Text as="h2" variant="title-2">
          Settings
        </Text>
      </>,
    );
    expect(screen.getByText('Plain text')).toHaveClass(textClassNames.root);
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveClass(textClassNames.root);
  });

  it('renders the class in the server HTML', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<Text>Plain text</Text>);
    expect(host.firstElementChild).toHaveClass(textClassNames.root);
  });
});
