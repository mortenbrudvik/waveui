/**
 * The navigation's way in before the shell island runs, and if it never does (its script failed
 * to load). Below 48rem with scripts on, the navigation pane is a drawer that only the island's
 * hamburger opens; until the island has hydrated, that hamburger is disabled. This link, rendered
 * on the server with no script, lies over it with the same look and name: it goes to
 * `#components-nav`, and site.css shows the pane, in the page above the content, while it is the
 * target (`:target`). The browser scrolls to the pane, and the next Tab goes into it.
 *
 * site.css shows the link only below 48rem, with scripts on, while the window has no
 * `data-shell-ready` (the island sets it once it has hydrated). It is out of the flow (its wrapper
 * has no height), so hiding it moves nothing.
 */
// The library's modules, not its barrel, as in CommandBar.tsx.
import { Button } from '../../../src/components/button/Button';
import { NavigationIcon } from '../../../src/lib/icons';
import { SHELL_IDS } from './ids';

export function NavFallbackLink() {
  return (
    <div className="shell-nav-fallback relative h-0">
      <Button
        as="a"
        href={`#${SHELL_IDS.nav}`}
        appearance="subtle"
        aria-label="Navigation"
        icon={<NavigationIcon size={20} />}
        className="absolute start-2 top-1 z-20"
      />
    </div>
  );
}
