import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { flipIconInRtl } from '../flipIcon';
import { Button } from '../../components/button/Button';

const FLIP = 'wave:wave-rtl:-scale-x-100';

function Arrow({ className }: { className?: string }) {
  return <svg data-testid="arrow" className={className} aria-hidden="true" />;
}

describe('flipIconInRtl (foundation-42)', () => {
  it('adds the mirroring class to the element and keeps its own props', () => {
    const icon = flipIconInRtl(<Arrow className="mine" />);
    render(icon);
    expect(screen.getByTestId('arrow')).toHaveAttribute('class', `mine ${FLIP}`);
  });

  it('adds the class to an element without a className, an <svg> and an <img> included', () => {
    const { container } = render(
      <>
        {flipIconInRtl(<Arrow />)}
        {flipIconInRtl(<img alt="" src="data:," />)}
      </>,
    );
    expect(container.querySelector('svg')).toHaveAttribute('class', FLIP);
    expect(container.querySelector('img')).toHaveAttribute('class', FLIP);
  });

  it('returns an element that already has the class, and nodes that are not elements, as they are', () => {
    const flipped = <Arrow className={`a ${FLIP} b`} />;
    expect(flipIconInRtl(flipped)).toBe(flipped);
    const fragment = (
      <>
        <Arrow />
      </>
    );
    expect(flipIconInRtl(fragment)).toBe(fragment);
    expect(flipIconInRtl(null)).toBeNull();
    expect(flipIconInRtl(undefined)).toBeUndefined();
    expect(flipIconInRtl('text')).toBe('text');
    expect(flipIconInRtl(0)).toBe(0);
  });

  it('leaves an element whose className is not a string alone', () => {
    const odd = React.createElement(Arrow, { className: ['a'] as unknown as string });
    expect(flipIconInRtl(odd)).toBe(odd);
  });

  it('works where a component takes an icon (Button icon slot)', () => {
    render(<Button icon={flipIconInRtl(<Arrow />)}>Next</Button>);
    expect(screen.getByTestId('arrow')).toHaveClass(FLIP);
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });
});
