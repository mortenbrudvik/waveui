# CLAUDE.md — waveui

## What is this?

A React component library (65 components) inspired by Fluent UI v2 design language, built with TypeScript, Tailwind CSS, and CSS custom properties. This is **not** the official `@fluentui/react-components` package from Microsoft.

## Commands

```bash
npm run build          # Type-check + Vite library build (ESM + CJS)
npm test               # Run all 928 unit tests (Vitest)
npm run dev            # Launch Storybook dev server on port 6006
npm run typecheck      # TypeScript type-check only
npm run lint           # ESLint (src/ + stories/)
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier format
npm run format:check   # Prettier check
```

## Architecture

- **Components**: `src/components/` organized by category (button, input, data-display, layout, navigation, feedback, overlays, table, typography, provider)
- **Hooks**: `src/hooks/` — useControllable, useId, useEventCallback, useRovingTabIndex
- **Utilities**: `src/lib/` — cn (class merge), slot system, shared types
- **Styles**: `src/styles/tokens.css` (CSS custom properties), `src/styles/globals.css`
- **Stories**: `stories/` — one file per component
- **Tests**: `src/components/*/__tests__/` — colocated with components

## Key Patterns

- All components use `React.forwardRef` + `displayName`
- Compound components use `Object.assign` (e.g., `Card.Header`)
- Slot system via `resolveSlot()` / `renderSlot()` for customizable sub-elements
- `useControllable()` for controlled/uncontrolled state
- `cn()` (clsx + tailwind-merge) for class merging — user classes always win
- Props interfaces extend native HTML attributes

## Styling

- CSS variables defined in `src/styles/tokens.css` (light, dark, high-contrast themes)
- Tailwind config maps tokens to utility classes in `tailwind.config.ts`
- Never use raw hex values — always reference CSS variables or Tailwind tokens
- 4px base unit spacing grid

## Testing

- Vitest + React Testing Library + jsdom
- Tests colocated in `__tests__/` directories next to components
- `src/test-utils.ts` for shared test helpers
