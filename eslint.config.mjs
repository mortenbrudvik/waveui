import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

/**
 * Node.js globals for the plain JavaScript build, verification and pack scripts (and fixtures) in
 * `scripts/`. The `globals` package is not a dependency (spec §3.4), so this is the list of
 * non-ECMAScript globals that Node 20 — the `engines` floor (>=20.19) — defines. ECMAScript
 * built-ins come from `ecmaVersion`. Globals that only newer Node versions define (`navigator`,
 * `WebSocket`) are deliberately absent, so a script that relies on them fails lint instead of
 * failing at runtime on Node 20.
 */
const nodeGlobals = Object.fromEntries(
  [
    'AbortController',
    'AbortSignal',
    'Blob',
    'BroadcastChannel',
    'Buffer',
    'ByteLengthQueuingStrategy',
    'CompressionStream',
    'CountQueuingStrategy',
    'Crypto',
    'CryptoKey',
    'CustomEvent',
    'DOMException',
    'DecompressionStream',
    'Event',
    'EventTarget',
    'File',
    'FormData',
    'Headers',
    'MessageChannel',
    'MessageEvent',
    'MessagePort',
    'Performance',
    'PerformanceEntry',
    'PerformanceMark',
    'PerformanceMeasure',
    'PerformanceObserver',
    'PerformanceObserverEntryList',
    'PerformanceResourceTiming',
    'ReadableByteStreamController',
    'ReadableStream',
    'ReadableStreamBYOBReader',
    'ReadableStreamBYOBRequest',
    'ReadableStreamDefaultController',
    'ReadableStreamDefaultReader',
    'Request',
    'Response',
    'SubtleCrypto',
    'TextDecoder',
    'TextDecoderStream',
    'TextEncoder',
    'TextEncoderStream',
    'TransformStream',
    'TransformStreamDefaultController',
    'URL',
    'URLSearchParams',
    'WebAssembly',
    'WritableStream',
    'WritableStreamDefaultController',
    'WritableStreamDefaultWriter',
    'atob',
    'btoa',
    'clearImmediate',
    'clearInterval',
    'clearTimeout',
    'console',
    'crypto',
    'fetch',
    'global',
    'performance',
    'process',
    'queueMicrotask',
    'setImmediate',
    'setInterval',
    'setTimeout',
    'structuredClone',
  ].map((name) => [name, 'readonly']),
);

/** Module-scope bindings Node adds to CommonJS files (e.g. a `.cjs` fixture asserting `require`). */
const commonJsGlobals = {
  __dirname: 'readonly',
  __filename: 'readonly',
  exports: 'writable',
  module: 'readonly',
  require: 'readonly',
};

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'storybook-static/', '*.config.*'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // react-hooks v7 recommended rules stay at their recommended severity (errors); spec C-HOOKS
      // lists the lint-compatible patterns and the only sites allowed to disable a rule.
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Declaration files mirror third-party typings (e.g. Vitest's `Assertion<T = any>`).
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['stories/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // Every `.js` file under scripts/ is linted as an ES module. That matches Node only while the
    // nearest package.json is the root one (`"type": "module"`); a nested package without it (such
    // as a pack fixture) makes its `.js` files CommonJS. So CommonJS files — e.g. a require()-based
    // smoke file in a fixture — use the `.cjs` extension: Node treats `.cjs` as CommonJS whatever
    // package.json says, and the next block lints it as CommonJS.
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...nodeGlobals, ...commonJsGlobals },
    },
    rules: {
      // `require()` is the module system of a CommonJS file, not a style choice.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettier,
);
