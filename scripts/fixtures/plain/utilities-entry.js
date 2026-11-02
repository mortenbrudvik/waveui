// An app entry that imports the token utilities without Tailwind, as documented (next to
// `@mortenbrudvik/waveui/styles`, which declares the tokens). scripts/pack-smoke.mjs builds it
// with Vite's defaults and checks the CSS the build emits.
import '@mortenbrudvik/waveui/utilities.css';
