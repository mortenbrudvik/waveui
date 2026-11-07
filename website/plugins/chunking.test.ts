import { afterEach, describe, expect, it, vi } from 'vitest';
import * as dev from '../../src/lib/dev';
import { PURE_FUNCTIONS, siteChunking, staticClosure } from './chunking.mjs';

describe('PURE_FUNCTIONS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    dev.__resetWarnings();
  });

  it('names functions of src/lib/dev.ts that do nothing and return nothing in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    for (const name of PURE_FUNCTIONS) {
      const call = (dev as unknown as Record<string, (...args: string[]) => unknown>)[name];
      expect(call, name).toBeTypeOf('function');
      expect(call!('site:pure-check', 'message'), name).toBeUndefined();
    }
    expect(dev.hasWarned('site:pure-check')).toBe(false);
    expect(warn).not.toHaveBeenCalled();

    // Outside production they do warn, so the check above is not vacuous.
    vi.stubEnv('NODE_ENV', 'development');
    dev.devWarn('site pure check');
    dev.warnOnce('site:pure-check', 'site pure check once');
    expect(warn.mock.calls).toEqual([
      ['[WaveUI] site pure check'],
      ['[WaveUI] site pure check once'],
    ]);
  });
});

const GRAPH: Record<string, string[]> = {
  '/site/Shell.tsx': ['/lib/Button.tsx', '/lib/icons.tsx?wave-split=3'],
  '/site/Example.tsx': ['/lib/Button.tsx', '/site/runtime.tsx'],
  '/site/runtime.tsx': ['/lib/WaveProvider.tsx'],
  '/lib/Button.tsx': ['/lib/cn.ts'],
  '/lib/cn.ts': [],
  '/lib/icons.tsx?wave-split=3': [],
  '/lib/WaveProvider.tsx': [],
  '/lib/Menu.tsx': ['/lib/cn.ts', '/lib/popup.ts'],
  '/lib/popup.ts': [],
  '/stories/Menu.stories.tsx': ['/lib/Menu.tsx'],
};
const info = (id: string) => (GRAPH[id] ? { importedIds: GRAPH[id] } : null);

describe('staticClosure', () => {
  it('holds the roots and everything they import statically, and nothing else', () => {
    const closure = staticClosure(Object.keys(GRAPH), info, [
      '/site/Shell.tsx',
      '/site/Example.tsx',
    ]);
    expect([...closure].sort()).toEqual(
      [
        '/lib/Button.tsx',
        '/lib/WaveProvider.tsx',
        '/lib/cn.ts',
        '/lib/icons.tsx?wave-split=3',
        '/site/Example.tsx',
        '/site/Shell.tsx',
        '/site/runtime.tsx',
      ].sort(),
    );
  });

  it('matches a root written with backslashes', () => {
    const closure = staticClosure(['C:/site/Shell.tsx'], () => ({ importedIds: [] }), [
      'C:\\site\\Shell.tsx',
    ]);
    expect([...closure]).toEqual(['C:/site/Shell.tsx']);
  });

  it('fails when a root is not in the build', () => {
    expect(() => staticClosure(Object.keys(GRAPH), info, ['/site/Gone.tsx'])).toThrow(
      'The client build has no module /site/Gone.tsx',
    );
  });
});

describe('siteChunking', () => {
  type Group = { name: string; test: (id: string) => boolean; priority: number };
  const setup = () => {
    const plugin = siteChunking({ baseRoots: ['/site/Shell.tsx', '/site/Example.tsx'] });
    const configEnvironment = plugin.configEnvironment as (name: string) =>
      | {
          build: {
            rolldownOptions: {
              treeshake: { manualPureFunctions: string[] };
              output: { codeSplitting: { groups: Group[] } };
            };
          };
        }
      | undefined;
    const buildEnd = plugin.buildEnd as (this: unknown) => void;
    const context = (name: string) => ({
      environment: { name },
      getModuleIds: () => Object.keys(GRAPH)[Symbol.iterator](),
      getModuleInfo: info,
    });
    return { plugin, configEnvironment, buildEnd, context };
  };

  it('configures the client build only', () => {
    const { plugin, configEnvironment } = setup();
    expect(plugin.apply).toBe('build');
    expect(configEnvironment('ssr')).toBeUndefined();
    expect(configEnvironment('prerender')).toBeUndefined();
    const options = configEnvironment('client')!.build.rolldownOptions;
    expect(options.treeshake.manualPureFunctions).toEqual(PURE_FUNCTIONS);
    expect(PURE_FUNCTIONS).toEqual(['warnOnce', 'devWarn']);
    expect(options.output.codeSplitting.groups.map((group) => group.name)).toEqual([
      'react',
      'base',
    ]);
  });

  it('groups React, then the closure of the base roots once the client build has its graph', () => {
    const { configEnvironment, buildEnd, context } = setup();
    const [react, base] = configEnvironment('client')!.build.rolldownOptions.output.codeSplitting
      .groups as [Group, Group];
    expect(react.priority).toBeGreaterThan(base.priority);
    for (const id of [
      '/repo/node_modules/react/index.js',
      'C:\\repo\\node_modules\\react-dom\\cjs\\react-dom-client.production.js',
      '/repo/node_modules/scheduler/index.js',
      '/repo/node_modules/@astrojs/react/dist/client.js',
    ]) {
      expect(react.test(id), id).toBe(true);
    }
    expect(react.test('/repo/node_modules/react-is/index.js')).toBe(false);
    expect(react.test('/repo/src/components/react/Thing.tsx')).toBe(false);

    expect(base.test('/lib/Button.tsx')).toBe(false);
    buildEnd.call(context('ssr'));
    expect(base.test('/lib/Button.tsx')).toBe(false);
    buildEnd.call(context('client'));
    expect(base.test('/lib/Button.tsx')).toBe(true);
    expect(base.test('/lib/icons.tsx?wave-split=3')).toBe(true);
    expect(base.test('/lib/Menu.tsx')).toBe(false);
    expect(base.test('/stories/Menu.stories.tsx')).toBe(false);
  });
});
