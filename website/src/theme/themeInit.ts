/**
 * The inline script the layout puts in the head, so the theme and direction are on `<html>` before
 * first paint. It is `resolveInitialChoice` (themeChoice.ts) in hand-minified form: a stored
 * choice if valid, else forced colors, a dark color scheme, then light; `dir` from storage or
 * `ltr`. It swaps the `wave-*` theme class (the library's theme classes) and keeps other classes.
 * Storage and `matchMedia` are used inside `try`. A test evaluates both on the same inputs.
 */
export const THEME_INIT_SCRIPT =
  '(function(){var h=document.documentElement,s={},t,m=function(q){try{return matchMedia(q).matches}catch(e){return!1}};' +
  'try{s=JSON.parse(localStorage.getItem("waveui-docs:choice"))||{}}catch(e){}' +
  't=["light","dark","high-contrast"].indexOf(s.theme)<0?m("(forced-colors: active)")?"high-contrast":m("(prefers-color-scheme: dark)")?"dark":"light":s.theme;' +
  'h.classList.remove("wave-light","wave-dark","wave-high-contrast");h.classList.add("wave-"+t);h.dir=s.dir=="rtl"?"rtl":"ltr"})()';
