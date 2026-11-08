/**
 * Playwright's global teardown: joins the real-browser budget's rows of each viewport
 * (`e2e/budget.spec.ts`, `.cache/real-browser-budget/<viewport>.json`) into one table,
 * `.cache/real-browser-budget.json`: per page and viewport, the real first load, the static worst
 * case and their difference, sorted by page, then viewport. Nothing is written when no budget test
 * ran (a run of other specs).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REAL_BROWSER_LIMIT } from '../scripts/real-browser-budget.mjs';
import { BUDGET_ROWS_DIR, BUDGET_TABLE } from './site';

interface RowsFile {
  measuredAt: string;
  rows: { page: string; viewport: string; firstLoadGzip: number }[];
}

export default function teardown(): void {
  if (!existsSync(BUDGET_ROWS_DIR)) return;
  const files = readdirSync(BUDGET_ROWS_DIR).filter((name) => name.endsWith('.json'));
  if (files.length === 0) return;
  const runs = files.map(
    (name) => JSON.parse(readFileSync(join(BUDGET_ROWS_DIR, name), 'utf8')) as RowsFile,
  );
  const rows = runs
    .flatMap((run) => run.rows)
    .sort((a, b) => a.page.localeCompare(b.page) || a.viewport.localeCompare(b.viewport));
  const over = (viewport: string) =>
    rows.filter((row) => row.viewport === viewport && row.firstLoadGzip > REAL_BROWSER_LIMIT)
      .length;
  const viewports = [...new Set(rows.map((row) => row.viewport))];
  const table = {
    limitGzip: REAL_BROWSER_LIMIT,
    measuredAt: Object.fromEntries(
      files.map((name, index) => [name.replace(/\.json$/, ''), runs[index]!.measuredAt]),
    ),
    overLimit: Object.fromEntries(viewports.map((viewport) => [viewport, over(viewport)])),
    rows,
  };
  writeFileSync(BUDGET_TABLE, `${JSON.stringify(table, null, 2)}\n`);
}
