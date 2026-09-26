// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  changelogCriteria,
  exceptionProblems,
  formatSummary,
  planSteps,
  runGate,
  testOutputWarnings,
  untrackedAsDiff,
} from '../claude/gate.mjs';

const ALL = [
  'typecheck',
  'lint',
  'format:check',
  'test',
  'build-storybook',
  'build',
  'verify-dist',
  'check:package',
  'test:pack',
];

describe('planSteps', () => {
  it('plans the nine exit-gate commands of docs/ROADMAP.md §3 by default', () => {
    expect(planSteps({}).map((step) => step.name)).toEqual(ALL);
  });

  it('narrows the plan with --only and --skip', () => {
    expect(planSteps({ only: ['test', 'lint'] }).map((step) => step.name)).toEqual([
      'lint',
      'test',
    ]);
    expect(planSteps({ skip: ['test:pack', 'build-storybook'] }).map((step) => step.name)).toEqual(
      ALL.filter((name) => name !== 'test:pack' && name !== 'build-storybook'),
    );
  });

  it('rejects a step name it does not know, naming the known ones', () => {
    expect(() => planSteps({ only: ['tests'] })).toThrow(/tests.*typecheck/s);
    expect(() => planSteps({ skip: ['pack'] })).toThrow(/pack/);
  });
});

/** A runStep double: each call resolves after `delay` ms with the listed status (default passed). */
function fakeRunner(statuses = {}, delay = 5) {
  const events = [];
  let active = 0;
  let maxActive = 0;
  const runStep = async (step) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    events.push(['start', step.name]);
    await new Promise((resolve) => setTimeout(resolve, delay));
    active -= 1;
    events.push(['end', step.name]);
    const status = statuses[step.name] ?? 0;
    return { status, seconds: 1, logFile: `/logs/${step.name}.log`, tail: `tail of ${step.name}` };
  };
  return { runStep, events, maxActive: () => maxActive };
}

describe('runGate', () => {
  it('runs the independent checks together and the build chain afterwards, one at a time', async () => {
    const runner = fakeRunner();
    const results = await runGate(planSteps({}), runner);

    expect(results.map((result) => [result.name, result.result])).toEqual(
      ALL.map((name) => [name, 'passed']),
    );
    const order = runner.events;
    const lastWave1End = Math.max(
      ...['typecheck', 'lint', 'format:check', 'test', 'build-storybook'].map((name) =>
        order.findIndex(([kind, step]) => kind === 'end' && step === name),
      ),
    );
    const firstWave2Start = order.findIndex(([kind, step]) => kind === 'start' && step === 'build');
    expect(firstWave2Start).toBeGreaterThan(lastWave1End);
    expect(order.slice(firstWave2Start)).toEqual([
      ['start', 'build'],
      ['end', 'build'],
      ['start', 'verify-dist'],
      ['end', 'verify-dist'],
      ['start', 'check:package'],
      ['end', 'check:package'],
      ['start', 'test:pack'],
      ['end', 'test:pack'],
    ]);
    expect(runner.maxActive()).toBe(5);
  });

  it('skips the steps that need a failed build and still runs the others', async () => {
    const runner = fakeRunner({ build: 1, lint: 1 });
    const results = await runGate(planSteps({}), runner);
    const byName = Object.fromEntries(results.map((result) => [result.name, result]));

    expect(byName.lint.result).toBe('failed');
    expect(byName.test.result).toBe('passed');
    expect(byName.build.result).toBe('failed');
    for (const name of ['verify-dist', 'check:package', 'test:pack']) {
      expect(byName[name]).toMatchObject({ result: 'skipped', reason: 'build failed' });
    }
    expect(
      runner.events.filter(([kind]) => kind === 'start').map(([, name]) => name),
    ).not.toContain('verify-dist');
  });

  it('runs a step that needs the build when the build is not part of the plan', async () => {
    const runner = fakeRunner();
    const results = await runGate(planSteps({ only: ['verify-dist'] }), runner);
    expect(results.map((result) => [result.name, result.result])).toEqual([
      ['verify-dist', 'passed'],
    ]);
  });
});

const CHANGELOG = `# Changelog

## [0.8.0] - Unreleased

Intro.

### Added

- a

### Changed

- b

### Size

| x | y |

## [0.7.0] - Unreleased

### Added
### Changed
### Deprecated
### Size
`;

describe('changelogCriteria', () => {
  it('checks the topmost version section, the release in progress, and names what it lacks', () => {
    // package.json keeps the last release's version until the release commit, so the section
    // of the phase is the one on top, not the one of package.json.
    expect(changelogCriteria(CHANGELOG)).toEqual({
      version: '0.8.0',
      section: true,
      missing: ['Deprecated'],
    });
  });

  it('reports a changelog without a version section', () => {
    expect(changelogCriteria('# Changelog\n\nNothing yet.\n')).toEqual({
      version: null,
      section: false,
      missing: ['Added', 'Changed', 'Deprecated', 'Size'],
    });
  });
});

const DIFF = `diff --git a/src/components/a/A.tsx b/src/components/a/A.tsx
index 1..2 100644
--- a/src/components/a/A.tsx
+++ b/src/components/a/A.tsx
@@ -10,0 +11,2 @@ export const A
+  // wave-allow-physical: the popup's arrow points at a physical edge
+  <div className="ml-2" /> {/* wave-allow-physical: */}
@@ -40 +42,3 @@ export const A
-  const x = 1;
+  const color = value; // wave-allow-color:
+  // eslint-disable-next-line react-hooks/refs
+  // eslint-disable-next-line react-hooks/set-state-in-effect -- the listed useTriggerElement site
diff --git a/stories/A.stories.tsx b/stories/A.stories.tsx
--- a/stories/A.stories.tsx
+++ b/stories/A.stories.tsx
@@ -5,0 +6 @@
+const swatches = ['#fff']; // wave-allow-color: fixture
+const x = 'wave-allow-motion'; // wave-allow-motion
`;

describe('exceptionProblems', () => {
  it('lists each added exception without a reason, with its file and new line number', () => {
    expect(exceptionProblems(DIFF)).toEqual([
      'src/components/a/A.tsx:12 wave-allow-physical has no reason',
      'src/components/a/A.tsx:42 wave-allow-color has no reason',
      'src/components/a/A.tsx:43 eslint-disable has no `-- reason`',
      'stories/A.stories.tsx:7 wave-allow-motion has no reason',
    ]);
  });

  it('finds nothing in a diff without exceptions', () => {
    expect(exceptionProblems('')).toEqual([]);
  });
});

describe('untrackedAsDiff', () => {
  it('turns new files into added lines, so their exceptions are checked too', () => {
    const diff = untrackedAsDiff([
      { path: 'stories/B.stories.tsx', content: 'const a = 1;\n// wave-allow-motion\n' },
    ]);
    expect(exceptionProblems(diff)).toEqual([
      'stories/B.stories.tsx:2 wave-allow-motion has no reason',
    ]);
  });
});

const TEST_LOG = ` RUN  v4.1.0 C:/wave

stderr | src/components/navigation/__tests__/Menu.test.tsx > Menu > opens on hover
An update to MenuRoot inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

stderr | src/components/input/__tests__/Switch.test.tsx > Switch > warns about a missing label
[WaveUI] Switch: pass a label or aria-label.

stdout | src/components/overlays/__tests__/Popover.test.tsx > Popover > logs
plain output

 ✓ src/components/navigation/__tests__/Menu.test.tsx (412 tests) 9021ms
`;

describe('testOutputWarnings', () => {
  it('counts act() and [WaveUI] warnings of passing tests, naming the test of each', () => {
    expect(testOutputWarnings(TEST_LOG)).toEqual({
      act: 1,
      waveui: 1,
      examples: [
        'src/components/navigation/__tests__/Menu.test.tsx > Menu > opens on hover: An update to MenuRoot inside a test was not wrapped in act(...).',
        'src/components/input/__tests__/Switch.test.tsx > Switch > warns about a missing label: [WaveUI] Switch: pass a label or aria-label.',
      ],
    });
  });

  it('finds nothing in a clean log', () => {
    expect(testOutputWarnings(' ✓ a.test.ts (3 tests)\n')).toEqual({
      act: 0,
      waveui: 0,
      examples: [],
    });
  });
});

describe('formatSummary', () => {
  const docs = {
    base: 'main',
    changelog: { version: '0.8.0', section: true, missing: ['Deprecated'] },
    exceptions: ['src/components/a/A.tsx:12 wave-allow-physical has no reason'],
    changedDocs: ['README.md'],
    unchangedDocs: ['docs/WAVE-UI-GUIDE.md', 'CLAUDE.md'],
    testOutput: {
      act: 1,
      waveui: 0,
      examples: [
        'src/x.test.tsx > X > opens: An update to X inside a test was not wrapped in act(...).',
      ],
    },
  };

  it('names the failed and skipped steps, with the tail of each failed log', () => {
    const summary = formatSummary(
      [
        { name: 'lint', result: 'passed', seconds: 12, logFile: '/logs/lint.log' },
        {
          name: 'build',
          result: 'failed',
          seconds: 30,
          logFile: '/logs/build.log',
          tail: 'error TS2322: Type string is not assignable',
        },
        { name: 'verify-dist', result: 'skipped', reason: 'build failed' },
      ],
      docs,
    );
    expect(summary).toMatch(/FAILED/);
    expect(summary).toMatch(/build[^\n]*failed/i);
    expect(summary).toContain('error TS2322: Type string is not assignable');
    expect(summary).toContain('/logs/build.log');
    expect(summary).toMatch(/verify-dist[^\n]*skipped[^\n]*build failed/);
    expect(summary).toMatch(/0\.8\.0[^\n]*Deprecated/);
    expect(summary).toContain('src/components/a/A.tsx:12 wave-allow-physical has no reason');
    expect(summary).toContain('docs/WAVE-UI-GUIDE.md');
    expect(summary).toMatch(/1 act\(\) warning\b/);
    expect(summary).toContain('src/x.test.tsx > X > opens');
  });

  it('reports a gate where every step passed and the output is clean', () => {
    const summary = formatSummary(
      [{ name: 'lint', result: 'passed', seconds: 12, logFile: '/logs/lint.log' }],
      {
        ...docs,
        changelog: { version: '0.8.0', section: true, missing: [] },
        exceptions: [],
        testOutput: { act: 0, waveui: 0, examples: [] },
      },
    );
    expect(summary).toMatch(/PASSED/);
    expect(summary).not.toMatch(/FAILED/);
    expect(summary).toMatch(/clean/i);
    expect(summary).not.toMatch(/act\(\) warning/);
  });
});
