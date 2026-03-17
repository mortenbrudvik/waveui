import type { ArgTypes } from '@storybook/react';

export const sizeArgType: ArgTypes = {
  size: {
    control: 'select',
    options: ['extra-small', 'small', 'medium', 'large', 'extra-large'],
  },
};

export const appearanceArgType: ArgTypes = {
  appearance: {
    control: 'select',
    options: ['primary', 'outline', 'subtle', 'transparent'],
  },
};

export const badgeAppearanceArgType: ArgTypes = {
  appearance: {
    control: 'select',
    options: ['filled', 'tint', 'outline'],
  },
};

export const badgeColorArgType: ArgTypes = {
  color: {
    control: 'select',
    options: ['brand', 'success', 'warning', 'danger', 'important', 'informative'],
  },
};
