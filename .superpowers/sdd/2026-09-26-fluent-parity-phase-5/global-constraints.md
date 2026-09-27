
## Global Constraints

- Worktree `C:\code\packages\wave-ui-react\.claude\worktrees\fluent-parity-phase-5`, branch `feat/fluent-parity-phase-5`, from `main` d5a84bd. Never switch branches in the main checkout.
- Release 0.10.0; CHANGELOG section `## [0.10.0] - Unreleased` (dated only by the release commit, not in this plan).
- Waves A–E build on the 0.7 API of the files they change: no P3-00 stable class names, no P4-01 `size`/`appearance`, no new tokens beyond spec §1.8 (spec rule 22). Wave F adapts.
- No new runtime dependency (the package keeps `@floating-ui/react-dom`, `clsx`, `tailwind-merge`).
- Every CLAUDE.md convention (C-REF … C-STORIES) applies; the conventions gate (`src/__tests__/conventions.test.ts`) and the stories axe gate (`src/__tests__/stories.a11y.test.tsx`) stay green for every touched file.
- React 19 ref as prop (no `forwardRef`); every component and sub-component sets `displayName`.
- Built-in strings are `labels` members with English defaults, exactly as spec D36 lists them.
- Every exported symbol has consumer JSDoc with `@default`; compound docblocks only on the exported `Object.assign(…)` const; no Tailwind utility as a bare word in `src/components`/`src/lib` comments and strings (spec rules 24, 26).
- TDD: a failing test first for every behaviour; test output clean (no act() warnings; every `[WaveUI]` warning asserted with its exact text); check with `--reporter=default`.
- Agents run no git write commands; the lead commits after each task (conventional-commit subject, no AI attribution trailer).
- `useListbox.test.tsx`, `DatePicker.test.tsx`, `SwatchPicker.test.tsx`, `Option.test.tsx` change only where spec §6.4 says; any other change to a 0.7 test is reported to the lead, not made.
- Verification per task: `npx vitest run <task test files> --reporter=default`, `npx vitest run src/__tests__/conventions.test.ts -t "<each touched source file>"`, `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, `npx eslint <touched files>`, `npx prettier --check <touched files>`.
