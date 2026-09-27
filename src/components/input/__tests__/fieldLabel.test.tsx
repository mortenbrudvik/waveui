import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { isFieldLabelElement, markFieldLabel } from '../fieldLabel';
import { Label } from '../Label';
import { asClientReference } from '../../../test-utils';

describe('field label marker (Phase 4 D32)', () => {
  it('recognizes a marked component, also as a client reference', () => {
    const Marked = markFieldLabel(function Marked() {
      return null;
    });
    expect(isFieldLabelElement(<Marked />)).toBe(true);
    const Reference = asClientReference(Marked);
    expect(isFieldLabelElement(<Reference />)).toBe(true);
  });

  it('Label is marked; other nodes are not', () => {
    expect(isFieldLabelElement(<Label>Name</Label>)).toBe(true);
    expect(isFieldLabelElement(<span>Name</span>)).toBe(false);
    expect(isFieldLabelElement('Name')).toBe(false);
    expect(isFieldLabelElement(null)).toBe(false);
  });
});
