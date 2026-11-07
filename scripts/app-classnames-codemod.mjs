#!/usr/bin/env node
/**
 * The codemod that wires `WaveProvider classNames` into the components (1.1; repo-internal, never
 * packed). Every component that puts a stable root class first in its `wcn()` reads the app-wide
 * classes of that root class from the provider's context and composes them into the same `wcn()`:
 *
 *   const appClassName = useAppClassName(buttonClassNames.root);   // first statement of the function
 *   wcn(buttonClassNames.root, base, appClassName, className)      // before the consumer's className
 *
 * A variant passes the root classes of the components it is built on first (`VARIANT_BASES`, as the
 * registry's "also carries" column), so a key such as `wave-button` reaches ToggleButton and the
 * other buttons. A function with several root signatures names each variable after its last constant
 * (`appDialogContent`). Idempotent: a function that already calls `useAppClassName` is skipped.
 *
 * The sites it cannot reach (a root class passed down as a prop or an object member) are listed
 * by `src/__tests__/classNames.test.ts`, which requires every root constant to be wired or
 * excused; wire those by hand.
 *
 * Usage:  node scripts/app-classnames-codemod.mjs [--write] [dir]...   (default dir: src/components;
 *         a dry run lists what it would change)
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** The roots a variant's root element also carries, base first (test-utils `VARIANT_BASES`). */
const VARIANT_BASES = {
  compoundButtonClassNames: ['buttonClassNames'],
  toggleButtonClassNames: ['buttonClassNames'],
  menuButtonClassNames: ['buttonClassNames'],
  toolbarButtonClassNames: ['buttonClassNames'],
  toolbarToggleButtonClassNames: ['buttonClassNames', 'toggleButtonClassNames'],
  toolbarRadioButtonClassNames: ['buttonClassNames', 'toggleButtonClassNames'],
  counterBadgeClassNames: ['badgeClassNames'],
  colorPickerSwatchesClassNames: ['swatchPickerClassNames'],
  menuItemCheckboxClassNames: ['menuItemClassNames'],
  menuItemRadioClassNames: ['menuItemClassNames'],
  menuItemSwitchClassNames: ['menuItemClassNames'],
  menuItemLinkClassNames: ['menuItemClassNames'],
  tagPickerOptionClassNames: ['optionClassNames'],
  tagPickerGroupClassNames: ['tagGroupClassNames'],
  navDrawerClassNames: ['drawerClassNames'],
  hamburgerClassNames: ['buttonClassNames'],
  teachingPopoverSurfaceClassNames: ['teachingPopoverClassNames'],
};

const args = process.argv.slice(2);
const write = args.includes('--write');
const dirs = args.filter((arg) => !arg.startsWith('--'));
if (dirs.length === 0) dirs.push('src/components');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const pascal = (name) => name[0].toUpperCase() + name.slice(1);
const rootConstant = (node) =>
  ts.isPropertyAccessExpression(node) &&
  node.name.text === 'root' &&
  ts.isIdentifier(node.expression) &&
  node.expression.text.endsWith('ClassNames')
    ? node.expression.text
    : undefined;

let changedFiles = 0;
let wiredFunctions = 0;

// WaveProvider reads its own merged map, not the context above it.
const SKIP = new Set(['WaveProvider.tsx']);

for (const file of dirs.flatMap((dir) => walk(dir))) {
  if (SKIP.has(path.basename(file))) continue;
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  /** function node → { calls: [{ call, signature }], signatures: [signature] } */
  const functions = new Map();
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'wcn' &&
      node.arguments.length > 0 &&
      rootConstant(node.arguments[0])
    ) {
      // The call's root constants: its first argument and any other `<x>ClassNames.root` argument (a
      // variant that composes its base's root first writes its own second).
      const signature = node.arguments
        .map((argument) => rootConstant(argument))
        .filter(Boolean)
        .join('|');
      let parent = node.parent;
      while (parent && !ts.isFunctionLike(parent)) parent = parent.parent;
      if (parent) {
        const entry = functions.get(parent) ?? { calls: [], signatures: [] };
        entry.calls.push({ call: node, signature });
        if (!entry.signatures.includes(signature)) entry.signatures.push(signature);
        functions.set(parent, entry);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (functions.size === 0) continue;

  const edits = []; // { start, end, text }
  const neededConstants = new Set();
  let needsHookImport = false;

  for (const [fn, { calls, signatures }] of functions) {
    if (fn.body && text.slice(fn.body.getStart(), fn.body.getEnd()).includes('useAppClassName(')) {
      continue; // already wired
    }
    // A signature names its variable after its last (most specific) constant.
    const ownerOf = (signature) => signature.split('|').at(-1);
    const variableOf = (signature) =>
      signatures.length === 1
        ? 'appClassName'
        : `app${pascal(ownerOf(signature).replace(/ClassNames$/, ''))}`;
    // The roots whose classes apply: the call's own, each after the roots it is built on.
    const hookArgs = (signature) => {
      const list = [];
      for (const constant of signature.split('|')) {
        for (const name of [...(VARIANT_BASES[constant] ?? []), constant]) {
          if (!list.includes(name)) list.push(name);
        }
      }
      list.forEach((name) => neededConstants.add(name));
      return list.map((name) => `${name}.root`).join(', ');
    };
    const declarations = signatures
      .map(
        (signature) => `const ${variableOf(signature)} = useAppClassName(${hookArgs(signature)});`,
      )
      .join('\n');
    needsHookImport = true;
    wiredFunctions += 1;

    // The edits of the wcn() calls of this function (positions in the original text).
    const callEdits = [];
    for (const { call, signature } of calls) {
      const last = call.arguments[call.arguments.length - 1];
      const variable = variableOf(signature);
      if (ts.isIdentifier(last) && last.text === 'className' && call.arguments.length > 1) {
        callEdits.push({ start: last.getStart(), end: last.getStart(), text: `${variable}, ` });
      } else {
        const end = last.getEnd();
        callEdits.push({ start: end, end, text: `, ${variable}` });
      }
    }

    if (ts.isBlock(fn.body)) {
      const open = fn.body.getStart() + 1;
      edits.push({ start: open, end: open, text: `\n${declarations}\n` }, ...callEdits);
    } else {
      // An arrow function with an expression body becomes a block: the call edits are applied to
      // the body's text first, then the body is replaced as a whole.
      let body = fn.body;
      while (ts.isParenthesizedExpression(body)) body = body.expression;
      const bodyStart = body.getStart();
      let bodyText = text.slice(bodyStart, body.getEnd());
      for (const edit of [...callEdits].sort((x, y) => y.start - x.start)) {
        bodyText =
          bodyText.slice(0, edit.start - bodyStart) +
          edit.text +
          bodyText.slice(edit.end - bodyStart);
      }
      edits.push({
        start: fn.body.getStart(),
        end: fn.body.getEnd(),
        text: `{\n${declarations}\nreturn ${bodyText};\n}`,
      });
    }
  }
  if (edits.length === 0) continue;

  // The imports: the hook, and the constants a variant's bases need.
  const importDeclarations = source.statements.filter(ts.isImportDeclaration);
  const classNamesImport = importDeclarations.find((declaration) =>
    declaration.moduleSpecifier.getText().includes('lib/classNames'),
  );
  const imported = new Set();
  const bindings = classNamesImport?.importClause?.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) imported.add(element.name.text);
  }
  const missing = [...neededConstants].filter((name) => !imported.has(name));
  if (missing.length > 0 && bindings && ts.isNamedImports(bindings)) {
    const last = bindings.elements[bindings.elements.length - 1];
    edits.push({ start: last.getEnd(), end: last.getEnd(), text: `, ${missing.join(', ')}` });
  } else if (missing.length > 0) {
    throw new Error(`${file}: no lib/classNames import to extend for ${missing.join(', ')}`);
  }
  if (needsHookImport && !text.includes("useAppClassName'")) {
    const relative = path
      .relative(path.dirname(file), path.join('src', 'hooks', 'useAppClassName'))
      .split(path.sep)
      .join('/');
    const lastImport = importDeclarations[importDeclarations.length - 1];
    edits.push({
      start: lastImport.getEnd(),
      end: lastImport.getEnd(),
      text: `\nimport { useAppClassName } from '${relative.startsWith('.') ? relative : `./${relative}`}';`,
    });
  }

  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let output = text;
  for (const { start, end, text: replacement } of edits) {
    output = output.slice(0, start) + replacement + output.slice(end);
  }
  changedFiles += 1;
  if (write) fs.writeFileSync(file, output);
  else console.log(`${file}: ${functions.size} function(s)`);
}

console.log(
  `${write ? 'wired' : 'would wire'} ${wiredFunctions} function(s) in ${changedFiles} file(s)`,
);
