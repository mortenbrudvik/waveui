import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { buttonIconRenders, rendersContent } from '../Button.utils';
import type { Slot } from '../../../lib/types';

const Gear = () => <svg data-testid="gear" viewBox="0 0 16 16" width="16" height="16" />;

/**
 * Icon values paired with a factory (a generator is one-shot, so every render gets a fresh one).
 * The list covers every branch of the rule: nothing, empty shorthand, content, slot objects and
 * iterables that are never iterated.
 */
const ICON_CASES: ReadonlyArray<readonly [string, () => Slot<'span'> | undefined]> = [
  ['undefined', () => undefined],
  ['null', () => null],
  ['false', () => false],
  ['true', () => true],
  ['an empty string', () => ''],
  ['an empty array', () => []],
  ['an empty Fragment', () => <></>],
  ['an array of empty values', () => [<React.Fragment key="a" />, '', null, false]],
  ['a Fragment of empty values', () => <>{['', null]}</>],
  ['an element', () => <Gear />],
  ['a string', () => '⚙'],
  ['zero', () => 0],
  ['an array with an element', () => ['', <Gear key="gear" />]],
  [
    'a Fragment with an element',
    () => (
      <>
        <Gear />
      </>
    ),
  ],
  ['a slot object', () => ({ children: <Gear /> })],
  ['an empty slot object', () => ({})],
  ['a Set', () => new Set([<Gear key="gear" />])],
  [
    'a generator',
    () =>
      (function* icons() {
        yield <Gear key="gear" />;
      })(),
  ],
];

const LABEL_CASES: ReadonlyArray<readonly [string, React.ReactNode]> = [
  ['undefined', undefined],
  ['null', null],
  ['false', false],
  ['an empty string', ''],
  ['an empty array', []],
  ['an empty Fragment', <></>],
  ['nested empty values', [<React.Fragment key="a">{''}</React.Fragment>, null]],
  ['text', 'Save'],
  ['zero', 0],
  ['an element', <span key="label">Save</span>],
  ['a Fragment with text', <>Save</>],
];

describe('Button.utils: the shared button content rule (button-provider#21)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(ICON_CASES)(
    'buttonIconRenders(%s) matches whether Button renders its icon element',
    (_name, makeIcon) => {
      render(<Button icon={makeIcon()} aria-label="Settings" />);
      const renders = screen.getByRole('button', { name: 'Settings' }).childNodes.length > 0;
      expect(buttonIconRenders(makeIcon())).toBe(renders);
    },
  );

  it('never iterates a one-shot generator (it stays intact for renderSlot)', () => {
    function* icons() {
      yield <Gear key="gear" />;
    }
    const icon = icons();
    expect(buttonIconRenders(icon)).toBe(true);
    expect(Array.from(icon)).toHaveLength(1);
  });

  it.each(LABEL_CASES)(
    'rendersContent(%s) matches whether Button counts it as a label (icon-only warning)',
    (_name, label) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Button icon={<Gear />}>{label}</Button>);
      const warned = warn.mock.calls.some((call) => String(call[0]).includes('no accessible name'));
      expect(rendersContent(label)).toBe(!warned);
    },
  );
});
