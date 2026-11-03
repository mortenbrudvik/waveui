/** The named colors of an Avatar: the persona palette (`--wave-palette-<name>` tokens). */
export type AvatarNamedColor =
  | 'red'
  | 'pumpkin'
  | 'gold'
  | 'forest'
  | 'teal'
  | 'blue'
  | 'navy'
  | 'lavender'
  | 'purple'
  | 'magenta'
  | 'brown'
  | 'steel';

/** The color of an Avatar that shows initials: a look, `colorful` (hashed), or a named color. */
export type AvatarColor = 'neutral' | 'brand' | 'colorful' | AvatarNamedColor;

/** The named colors in a fixed order: `colorful` indexes into it, so the order never changes. */
export const AVATAR_NAMED_COLORS: readonly AvatarNamedColor[] = [
  'red',
  'pumpkin',
  'gold',
  'forest',
  'teal',
  'blue',
  'navy',
  'lavender',
  'purple',
  'magenta',
  'brown',
  'steel',
];

/** Fill and text classes of each resolved color. Literal strings only (Tailwind scans them). */
export const avatarColorClasses: Readonly<Record<Exclude<AvatarColor, 'colorful'>, string>> = {
  neutral: 'wave:bg-muted wave:text-muted-foreground',
  brand: 'wave:bg-primary wave:text-primary-foreground',
  red: 'wave:bg-palette-red wave:text-palette-red-foreground',
  pumpkin: 'wave:bg-palette-pumpkin wave:text-palette-pumpkin-foreground',
  gold: 'wave:bg-palette-gold wave:text-palette-gold-foreground',
  forest: 'wave:bg-palette-forest wave:text-palette-forest-foreground',
  teal: 'wave:bg-palette-teal wave:text-palette-teal-foreground',
  blue: 'wave:bg-palette-blue wave:text-palette-blue-foreground',
  navy: 'wave:bg-palette-navy wave:text-palette-navy-foreground',
  lavender: 'wave:bg-palette-lavender wave:text-palette-lavender-foreground',
  purple: 'wave:bg-palette-purple wave:text-palette-purple-foreground',
  magenta: 'wave:bg-palette-magenta wave:text-palette-magenta-foreground',
  brown: 'wave:bg-palette-brown wave:text-palette-brown-foreground',
  steel: 'wave:bg-palette-steel wave:text-palette-steel-foreground',
};

/**
 * The named color a string stands for: a 32-bit FNV-1a hash of its UTF-16 code units, modulo the
 * number of named colors. Stable across runs, the server and the client, and releases.
 */
export function hashToNamedColor(key: string): AvatarNamedColor {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return AVATAR_NAMED_COLORS[(hash >>> 0) % AVATAR_NAMED_COLORS.length]!;
}

/**
 * Resolves the `color` prop: `colorful` becomes the named color of `idForColor`, else of `name`,
 * else `brand`.
 */
export function resolveAvatarColor(
  color: AvatarColor,
  idForColor: string | undefined,
  name: string | undefined,
): Exclude<AvatarColor, 'colorful'> {
  if (color !== 'colorful') return color;
  const key = idForColor?.trim() || name?.trim();
  return key ? hashToNamedColor(key) : 'brand';
}
