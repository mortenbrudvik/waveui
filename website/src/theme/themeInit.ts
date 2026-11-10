/**
 * The inline script the layout puts in the head, so the theme and direction are on `<html>` before
 * first paint. It is `resolveInitialChoice` (themeChoice.ts) in hand-minified form: a stored
 * choice if valid, else forced colors, a dark color scheme, then light; `dir` from storage or
 * `ltr`; a stored `"system"` is not a theme, so it follows the system like no choice at all. It
 * swaps the `wave-*` theme class (the library's theme classes) and keeps other classes. Storage and
 * `matchMedia` are used inside `try`. A test evaluates both on the same inputs.
 */
export const THEME_INIT_SCRIPT =
  '(function(){var h=document.documentElement,s={},t,m=function(q){try{return matchMedia(q).matches}catch(e){return!1}};' +
  'try{s=JSON.parse(localStorage.getItem("waveui-docs:choice"))||{}}catch(e){}' +
  't=["light","dark","high-contrast"].indexOf(s.theme)<0?m("(forced-colors: active)")?"high-contrast":m("(prefers-color-scheme: dark)")?"dark":"light":s.theme;' +
  'h.classList.remove("wave-light","wave-dark","wave-high-contrast");h.classList.add("wave-"+t);h.dir=s.dir=="rtl"?"rtl":"ltr"})()';

/**
 * The inline script at the end of the body: every example's static preview is server-rendered
 * light and left to right, in a provider root of its own (`data-wave-theme`), so a reader who
 * chose dark or right to left would see it change as its island hydrates. This copies the theme and
 * direction the head script put on `<html>` onto those roots before the first paint, and leaves
 * them alone when the page is light and left to right. The island reads the same `<html>` once it
 * hydrates and renders what the script already shows. Only the roots inside `[data-example-preview]`
 * are touched. A test evaluates it in jsdom.
 */
export const EXAMPLE_PREVIEW_SCRIPT =
  '(function(){var h=document.documentElement,c=h.classList,k=["light","dark","high-contrast"],d=h.dir=="rtl"?"rtl":"ltr",t,i,j;' +
  'for(i=0;i<3;i++)if(c.contains("wave-"+k[i]))t=k[i];' +
  'if(!t||t=="light"&&d=="ltr")return;' +
  'var r=document.querySelectorAll("[data-example-preview] .wave-root[data-wave-theme]");' +
  'for(i=0;i<r.length;i++){for(j=0;j<3;j++)r[i].classList.remove("wave-"+k[j]);r[i].classList.add("wave-"+t);r[i].setAttribute("data-wave-theme",t);r[i].dir=d}})()';
