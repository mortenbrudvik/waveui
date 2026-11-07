/// <reference types="astro/client" />
// Astro's module types (`astro:container`, `import.meta.env`) for `npm run site:typecheck`, which
// runs before any build has generated `.astro/types.d.ts` in a fresh checkout.

// Plain `tsc` cannot read `.astro` files (Astro's editor plugin does); a test that renders a
// layout with the container API imports it as the component factory the container takes.
declare module '*.astro' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}
