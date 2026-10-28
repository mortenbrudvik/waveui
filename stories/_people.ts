/**
 * The people of the data-mode stories of Listbox, Combobox and Dropdown: 500 `ListboxItem`s,
 * every first name with every last name, in alphabetical order (`person-1` is "Ada Andersen",
 * `person-500` "Zoe Weber"), and the team of each one for a `renderOption` that shows more than
 * the label.
 */
import type { ListboxItem } from '../src';

const FIRST_NAMES = [
  'Ada',
  'Ben',
  'Chloe',
  'Daniel',
  'Elif',
  'Farah',
  'Gustav',
  'Hana',
  'Ivan',
  'Jonas',
  'Kai',
  'Lena',
  'Mateo',
  'Nora',
  'Oscar',
  'Priya',
  'Quinn',
  'Rosa',
  'Sami',
  'Tariq',
  'Uma',
  'Viktor',
  'Wen',
  'Yara',
  'Zoe',
];

const LAST_NAMES = [
  'Andersen',
  'Berg',
  'Costa',
  'Dahl',
  'Eriksen',
  'Fischer',
  'Garcia',
  'Haugen',
  'Ito',
  'Johansen',
  'Kim',
  'Larsen',
  'Moreau',
  'Nilsen',
  'Okafor',
  'Pedersen',
  'Rossi',
  'Silva',
  'Tanaka',
  'Weber',
];

const TEAMS = ['Design', 'Engineering', 'Finance', 'Marketing', 'Research', 'Support'];

/** 500 people, `person-1` … `person-500`. */
export const PEOPLE: readonly ListboxItem[] = FIRST_NAMES.flatMap((first, i) =>
  LAST_NAMES.map((last, j) => ({
    value: `person-${i * LAST_NAMES.length + j + 1}`,
    label: `${first} ${last}`,
  })),
);

/** The team of a person of {@link PEOPLE}, by value. */
export function teamOf(value: string): string {
  const number = Number(value.slice('person-'.length));
  return TEAMS[(number * 7) % TEAMS.length];
}
