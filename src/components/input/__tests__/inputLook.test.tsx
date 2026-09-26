import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useInputLook, type InputLookOptions } from '../inputLook';
import { WaveProvider } from '../../provider/WaveProvider';
import { renderWithFieldContext } from '../../../test-utils-field';
import type { InputAppearance, Size } from '../../../lib/types';

function Probe<S extends Size>(props: {
  size?: S;
  appearance?: InputAppearance;
  options?: InputLookOptions<S>;
}) {
  const look = useInputLook(props.size, props.appearance, props.options);
  return <output>{`${look.size} ${look.appearance}`}</output>;
}
const look = () => screen.getByRole('status').textContent;

describe('useInputLook (Phase 4 D6)', () => {
  it('defaults to medium outline', () => {
    render(<Probe />);
    expect(look()).toBe('medium outline');
  });

  it('own props win over the Field and the provider', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'small', appearance: 'underline' }}>
        <Probe size="large" appearance="filled-lighter" />
      </WaveProvider>,
      { size: 'small' },
    );
    expect(look()).toBe('large filled-lighter');
  });

  it('the Field size wins over the provider size; the provider appearance still applies', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'small', appearance: 'filled-darker' }}>
        <Probe />
      </WaveProvider>,
      { size: 'large' },
    );
    expect(look()).toBe('large filled-darker');
  });

  it('falls back to the provider without a Field size, also in a 0.6-shaped context', () => {
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'small' }}>
        <Probe />
      </WaveProvider>,
    );
    expect(look()).toBe('small outline');
  });

  it('explicit undefined props fall through like absent ones (Review Focus 1)', () => {
    renderWithFieldContext(<Probe size={undefined} appearance={undefined} />, { size: 'large' });
    expect(look()).toBe('large outline');
  });

  it('skips a Field or provider size outside the supported sizes', () => {
    const options = {
      sizes: ['medium', 'large', 'extra-large'] as const,
      defaultSize: 'medium' as const,
    };
    renderWithFieldContext(
      <WaveProvider inputDefaults={{ size: 'large' }}>
        <Probe options={options} />
      </WaveProvider>,
      { size: 'small' },
    );
    expect(look()).toBe('large outline');
  });

  it('falls back to the default size when neither fits', () => {
    const options = { sizes: ['medium', 'large', 'extra-large'] as const };
    renderWithFieldContext(<Probe options={options} />, { size: 'small' });
    expect(look()).toBe('medium outline');
  });

  it('skips a provider size outside the supported sizes and uses defaultSize', () => {
    const options = {
      sizes: ['medium', 'large', 'extra-large'] as const,
      defaultSize: 'extra-large' as const,
    };
    render(
      <WaveProvider inputDefaults={{ size: 'small' }}>
        <Probe options={options} />
      </WaveProvider>,
    );
    expect(look()).toBe('extra-large outline');
  });
});
