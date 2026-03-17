import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from '../Breadcrumb';
import { testForwardRef, testRestSpread, testClassName } from '../../../test-utils';

describe('Breadcrumb', () => {
  testForwardRef(Breadcrumb, 'nav', {
    children: <Breadcrumb.Item>Home</Breadcrumb.Item>,
  });
  testRestSpread(Breadcrumb, {
    children: <Breadcrumb.Item>Home</Breadcrumb.Item>,
  });
  testClassName(Breadcrumb, {
    children: <Breadcrumb.Item>Home</Breadcrumb.Item>,
  });

  it('renders with aria-label="Breadcrumb"', () => {
    render(
      <Breadcrumb data-testid="bc">
        <Breadcrumb.Item>Home</Breadcrumb.Item>
      </Breadcrumb>,
    );
    expect(screen.getByTestId('bc')).toHaveAttribute('aria-label', 'Breadcrumb');
  });

  it('renders separator between items', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
        <Breadcrumb.Item current>Widget</Breadcrumb.Item>
      </Breadcrumb>,
    );
    // SVG chevron separators should be rendered (aria-hidden)
    const separators = document.querySelectorAll('[aria-hidden="true"]');
    expect(separators.length).toBe(2);
  });

  it('marks current item with aria-current="page"', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item current>Current</Breadcrumb.Item>
      </Breadcrumb>,
    );
    expect(screen.getByText('Current')).toHaveAttribute('aria-current', 'page');
  });

  it('renders non-current items as links', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/home">Home</Breadcrumb.Item>
      </Breadcrumb>,
    );
    const link = screen.getByText('Home');
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link).toHaveAttribute('href', '/home');
  });

  it('renders current item as span', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item current>Current</Breadcrumb.Item>
      </Breadcrumb>,
    );
    expect(screen.getByText('Current').tagName.toLowerCase()).toBe('span');
  });

  it('renders icon slot in BreadcrumbItem', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item icon={{ children: 'ico' }}>Home</Breadcrumb.Item>
      </Breadcrumb>,
    );
    expect(screen.getByText('ico')).toBeInTheDocument();
  });
});
