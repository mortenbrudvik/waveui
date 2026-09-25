/**
 * Minimal `process.env.NODE_ENV` typing for the bundler-injected development checks
 * (`process.env.NODE_ENV !== 'production'`).
 *
 * The declarations mirror `@types/node` exactly (`var process: NodeJS.Process` plus interface
 * merging), so they merge with Node's types instead of redeclaring `process` (TS2451). That keeps
 * both kinds of program valid: the library program (`tsconfig.json`, `types: []`, no Node types)
 * and the dev program (`tsconfig.dev.json`, which receives `@types/node` through Vite/Vitest).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
  }
  interface Process {
    env: ProcessEnv;
  }
}

// eslint-disable-next-line no-var -- must match the global `var process` declaration of @types/node
declare var process: NodeJS.Process;
