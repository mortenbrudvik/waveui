---
name: browser-check
description: Use when a WaveUI phase reaches the real-browser checklist of its spec in docs/superpowers/specs, or when a component's behavior depends on what jsdom cannot show — inert, getAnimations, :has() layout, hit testing, transition timing, forced colors, context-menu events — and has to be checked in Storybook in a real browser.
disable-model-invocation: true
argument-hint: <Component> [spec file or section]
---

# Real-browser check

Check `$ARGUMENTS` in Storybook in Chromium through the Playwright MCP, and record each result as exit evidence for the phase report.

## 1. The checklist

- The "Real-browser checklist" section of the phase spec: the newest `docs/superpowers/specs/*-design.md` unless the arguments name one (phase 2: §6.3), plus the cases the spec's implementation notes (§10) add.
- The per-theme check of the component's stories: light, dark and high-contrast, each in LTR and RTL.
- Keep the items that concern the component, and pick the story that shows each.

## 2. Storybook from this checkout

The stories must come from the checkout under test; another worktree's Storybook may already answer on port 6006.

1. Find a free port: `curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/index.json` prints `000` when nothing answers (try 6106, 6107, …).
2. From the checkout root, start Storybook with Bash `run_in_background: true`: `npx storybook dev -p <port> --ci --exact-port`.
3. Wait for it with Bash `run_in_background: true`: `until curl -sf http://localhost:<port>/index.json > /dev/null; do sleep 2; done`.
4. Story ids: the `entries` of `http://localhost:<port>/index.json` whose `title` is `Components/<Category>/<Name>` and `type` is `story`.

## 3. Drive the browser

Load the tools in one call: ToolSearch `select:mcp__plugin_playwright_playwright__browser_navigate,mcp__plugin_playwright_playwright__browser_emulate_media,mcp__plugin_playwright_playwright__browser_evaluate,mcp__plugin_playwright_playwright__browser_snapshot,mcp__plugin_playwright_playwright__browser_click,mcp__plugin_playwright_playwright__browser_hover,mcp__plugin_playwright_playwright__browser_press_key,mcp__plugin_playwright_playwright__browser_take_screenshot,mcp__plugin_playwright_playwright__browser_console_messages,mcp__plugin_playwright_playwright__browser_close`.

- **Story**: `browser_navigate` to `http://localhost:<port>/iframe.html?viewMode=story&id=<id>&globals=theme:<light|dark|high-contrast>;dir:<ltr|rtl>`. The bare iframe keeps Storybook's keyboard shortcuts away from the keys you press. The story renders after the page loads (and a fresh Storybook reloads once while Vite optimises dependencies), so wait for it and confirm the globals took effect in one call: `browser_evaluate` with `async () => { for (let i = 0; i < 100 && !document.querySelector('.wave-root'); i++) await new Promise((r) => setTimeout(r, 200)); const root = document.querySelector('.wave-root'); return [root?.dataset.waveTheme, root?.dir]; }`.
- **Media**: `browser_emulate_media` with `reducedMotion` (`'reduce'` / `'no-preference'`), `forcedColors` (`'active'` / `'none'`: Windows High Contrast emulation, separate from Wave's `high-contrast` theme) and `colorScheme`; `null` clears one.
- **Input**: `browser_snapshot` for element refs (`boxes: true` adds rectangles); `browser_click` with `button: 'right'` for a context menu and `modifiers` such as `['Control']` or `['ControlOrMeta']`; `browser_hover`; `browser_press_key` (`Tab`, `Escape`, `ArrowDown`, `Shift+F10`, `ContextMenu`, `Shift+Enter`).
- **State**: `browser_evaluate` for `document.activeElement`, `element.inert`, `element.getAnimations()`, `element.dataset.presence`, computed styles and rectangles. For events between calls, install listeners first (`focusin`; `contextmenu` with `isTrusted` and `defaultPrevented`; `transitionend`; a MutationObserver on `data-presence`) and read their log afterwards.
- **Timing**: an exit of 150 ms ends before the next call. To watch the phases, stretch the motion tokens (`--wave-duration-ultra-fast` … `--wave-duration-ultra-slow`), e.g. `document.documentElement.style.setProperty('--wave-duration-fast', '3s')`, and measure real timings inside one `browser_evaluate`.
- **Pointer paths**: a diagonal path, a small move or touch needs `browser_run_code_unsafe` (`page.mouse.move(x, y, { steps: 20 })`). It runs arbitrary code in the Playwright server: use it for these paths only.
- **Warnings**: `browser_console_messages` with `level: 'warning'` must show no `[WaveUI]` line (a 404 for `favicon.ico` is Storybook's, not a finding).
- **Evidence**: `browser_take_screenshot` with `scale: 'css'` and a relative `filename` such as `.playwright-mcp/<story>-<theme>-<dir>.png`, one per theme and direction. It is saved under the directory the session started in (`.playwright-mcp/` is gitignored at any depth); report the path the tool prints.

## 4. Report

One row per checklist item and condition:

| Item | Story, globals, media | Steps | Observed | Evidence | Result |
|---|---|---|---|---|---|

Result is PASS, FAIL or MANUAL. Mark MANUAL, with the steps a person takes, what this setup cannot run: Firefox and Safari (the Playwright MCP runs Chromium), real Windows High Contrast (only emulated here), macOS Ctrl+click, touch on a device, and screen readers. Name the stories a checklist item needs but that do not exist; do not add stories in this check.

## 5. Clean up

`browser_close`, then stop the Storybook you started. On Windows, TaskStop ends only the shell that ran `npx`; the Storybook process keeps the port. Find the process listening on the port (PowerShell `Get-NetTCPConnection -LocalPort <port> -State Listen`), confirm its command line is this checkout's `storybook … dev -p <port>` (`Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"`), stop it with `taskkill /PID <pid> /T /F`, and check the port is free again.
