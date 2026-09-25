import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { encodeIdPart, getPartId } from '../disclosureIds';
import { Accordion } from '../Accordion';
import { TabList } from '../TabList';

describe('encodeIdPart (C-IDS)', () => {
  it('keeps letters, digits and hyphens', () => {
    expect(encodeIdPart('Overview-2')).toBe('Overview-2');
  });

  it('encodes every other character, the underscore included, as _<hex code>_', () => {
    expect(encodeIdPart('a b')).toBe('a_20_b');
    expect(encodeIdPart('a.b')).toBe('a_2e_b');
    expect(encodeIdPart('a_b')).toBe('a_5f_b');
    expect(encodeIdPart('')).toBe('');
  });

  it('keeps values that differ only in punctuation or spaces distinct', () => {
    const encoded = ['a b', 'a.b', 'a_b', 'a_20_b', 'a-b'].map(encodeIdPart);
    expect(new Set(encoded).size).toBe(encoded.length);
  });
});

describe('getPartId (C-IDS)', () => {
  it('joins the instance base id, the part and the encoded value', () => {
    expect(getPartId('wave-accordion-1', 'trigger', 'a b')).toBe('wave-accordion-1-trigger-a_20_b');
  });

  it('Accordion and TabList derive their ids with it, so both encode a value the same way', () => {
    render(
      <>
        <Accordion defaultOpenItem="a.b">
          <Accordion.Item value="a.b">
            <Accordion.Trigger>Item</Accordion.Trigger>
            <Accordion.Panel>Item panel</Accordion.Panel>
          </Accordion.Item>
        </Accordion>
        <TabList defaultValue="a.b">
          <TabList.Tab value="a.b">Tab</TabList.Tab>
          <TabList.Panel value="a.b">Tab panel</TabList.Panel>
        </TabList>
      </>,
    );
    const suffix = (part: string) => `-${part}-${encodeIdPart('a.b')}`;
    expect(screen.getByRole('button', { name: 'Item' }).id).toMatch(
      new RegExp(`${suffix('trigger')}$`),
    );
    expect(screen.getByRole('region', { name: 'Item' }).id).toMatch(
      new RegExp(`${suffix('panel')}$`),
    );
    expect(screen.getByRole('tab', { name: 'Tab' }).id).toMatch(new RegExp(`${suffix('tab')}$`));
    expect(screen.getByRole('tabpanel', { name: 'Tab' }).id).toMatch(
      new RegExp(`${suffix('panel')}$`),
    );
  });
});
