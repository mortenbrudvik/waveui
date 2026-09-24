import { getGlobalRegistry } from './globalRegistry';

const PREFIX = '[WaveUI] ';

/**
 * Reads the bundler-injected `process.env.NODE_ENV` at call time. The expression is written out
 * literally so bundlers replace it (Vite, webpack, esbuild, Rollup); when no bundler replaced it and
 * `process` does not exist (an unbundled ESM import in the browser), development mode is assumed.
 */
function isDevEnvironment(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
}

/**
 * `true` unless the consumer builds with `NODE_ENV=production`. Guard development-only work with
 * it (`if (isDev) { … }`). The warning helpers below already check the environment themselves.
 */
export const isDev: boolean = isDevEnvironment();

function getWarnedKeys(): Set<string> {
  return getGlobalRegistry('warnings', () => new Set<string>());
}

/**
 * Logs a development warning prefixed with `[WaveUI] `. Not deduplicated; prefer {@link warnOnce}
 * for anything that can happen on every render. No-op in production.
 *
 * @param message The message without the prefix.
 */
export function devWarn(message: string): void {
  if (!isDevEnvironment()) return;
  console.warn(PREFIX + message);
}

/**
 * Logs a development warning once per `key` per page. The set of emitted keys lives in the global
 * registry (`getGlobalRegistry('warnings')`), so duplicate copies of the library share it, and it
 * is cleared between tests by {@link __resetWarnings}. No-op in production (the key is not consumed).
 *
 * Component diagnostics belong in effects (C-DEV). Because it is idempotent, the pure helpers built
 * on it — {@link resolveDeprecatedProp}, `resolveSlot`/`renderSlot` and `renderTrigger` — warn at
 * call time, which is safe during render: StrictMode double renders, discarded concurrent renders
 * and re-renders all log the key once.
 *
 * @param key     Deduplication key, e.g. `'Tooltip:children'`.
 * @param message The message without the prefix.
 */
export function warnOnce(key: string, message: string): void {
  if (!isDevEnvironment()) return;
  const warned = getWarnedKeys();
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(PREFIX + message);
}

/**
 * Whether {@link warnOnce} already emitted `key` (in any copy of the library, since the set lives
 * in the shared `'warnings'` global registry). A pure read: it never consumes the key, so a later
 * `warnOnce(key, …)` still warns when this returns `false`.
 *
 * Use it to skip development-only DOM work in an effect (a subtree scan, a focus-order check) once
 * its warning has fired. It returns `false` in production, where `warnOnce` consumes no key, so
 * guard that work with {@link isDev} as well.
 *
 * @param key The deduplication key passed to `warnOnce`, e.g. `'Card:nested-interactive'`.
 */
export function hasWarned(key: string): boolean {
  return getWarnedKeys().has(key);
}

/**
 * Warns once per (component, prop) that a prop or value is deprecated (§5.10 format):
 *
 * `[WaveUI] TabList: \`selectedValue\` is deprecated and will be removed in 1.0. Use \`value\` instead.`
 *
 * @param component The public component name, e.g. `'TabList'`.
 * @param oldName   The deprecated prop or value.
 * @param newName   Its replacement.
 * @param extra     Optional extra sentence appended to the message.
 */
export function warnDeprecated(
  component: string,
  oldName: string,
  newName: string,
  extra?: string,
): void {
  const message =
    `${component}: \`${oldName}\` is deprecated and will be removed in 1.0. Use \`${newName}\` instead.` +
    (extra ? ` ${extra}` : '');
  warnOnce(`deprecated:${component}:${oldName}`, message);
}

/**
 * Resolves a renamed prop: returns `newValue` when it is defined, otherwise `oldValue`. Warns once
 * (via {@link warnDeprecated}) whenever the deprecated prop is used, including when both are given
 * (the new value wins, C-NAMING).
 *
 * The warning is emitted at call time, and calling it during render is the intended use: the
 * warn-once key makes it idempotent, so StrictMode double renders and re-renders log once per page
 * (a C-DEV call-time exception, like `resolveSlot` and `renderTrigger`). A component that must
 * warn from an effect instead resolves `newValue !== undefined ? newValue : oldValue` itself and
 * calls {@link warnDeprecated} in that effect.
 *
 * @example
 * const orientation = resolveDeprecatedProp('Stack', props.orientation, props.direction, 'direction', 'orientation') ?? 'vertical';
 */
export function resolveDeprecatedProp<T>(
  component: string,
  newValue: T | undefined,
  oldValue: T | undefined,
  oldName: string,
  newName: string,
): T | undefined {
  if (oldValue !== undefined) warnDeprecated(component, oldName, newName);
  return newValue !== undefined ? newValue : oldValue;
}

/**
 * Test-only: forgets every emitted warn-once key so each test starts clean (called from
 * `src/test-setup.ts` after each test).
 */
export function __resetWarnings(): void {
  getWarnedKeys().clear();
}
