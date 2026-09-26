import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import type { PluginOption } from 'vite';
import { exportDocblockPlugin, STORYBOOK_DOCGEN_PLUGIN } from './exportDocblocks';

/**
 * Removes the `vite:dts` plugin from a (nested, possibly promised) Vite plugin list. Storybook's
 * Vite builder loads the plugins of the library config (vite.config.ts), never its `build`
 * block; the declaration build and its `afterBuild` copy step belong to the library build only.
 */
async function withoutDts(plugins: PluginOption[]): Promise<PluginOption[]> {
  const kept: PluginOption[] = [];
  for (const plugin of await Promise.all(plugins)) {
    if (Array.isArray(plugin)) kept.push(...(await withoutDts(plugin)));
    else if (plugin && plugin.name !== 'vite:dts') kept.push(plugin);
  }
  return kept;
}

/**
 * Adds the export-docblock plugin (`./exportDocblocks.ts`) right after Storybook's docgen plugin,
 * whose `__docgenInfo` output it completes: compounds and other components documented on their
 * export get that JSDoc as their autodocs description. Without a react-docgen plugin it goes last.
 */
function withExportDocblocks(plugins: PluginOption[]): PluginOption[] {
  const docgen = plugins.findIndex(
    (plugin) =>
      typeof plugin === 'object' &&
      plugin !== null &&
      'name' in plugin &&
      plugin.name === STORYBOOK_DOCGEN_PLUGIN,
  );
  const at = docgen === -1 ? plugins.length : docgen + 1;
  return [...plugins.slice(0, at), exportDocblockPlugin(), ...plugins.slice(at)];
}

function hasTailwind(plugins: PluginOption[]): boolean {
  return plugins.some((plugin) => {
    if (Array.isArray(plugin)) return hasTailwind(plugin);
    return (
      typeof plugin === 'object' &&
      plugin !== null &&
      'name' in plugin &&
      plugin.name.startsWith('@tailwindcss/vite')
    );
  });
}

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-mcp'],
  /**
   * The component manifest feeds the MCP server of `@storybook/addon-mcp` (`/mcp` on the dev
   * server, registered for Claude Code in .mcp.json): an agent reads each component's props,
   * docs and stories from it, and finds the stories that a change affects.
   */
  features: { componentsManifest: true },
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  /**
   * The library build compiles no CSS (scripts/build-css.mjs does), so Storybook adds the
   * Tailwind plugin itself: it compiles `.storybook/preview.css`, the library stylesheet plus
   * the stories as a source (scripts/verify-storybook.mjs checks the result). The autodocs
   * description of a component documented on its export comes from `withExportDocblocks`.
   */
  async viteFinal(viteConfig) {
    const plugins = await withoutDts(viteConfig.plugins ?? []);
    if (!hasTailwind(plugins)) plugins.push(tailwindcss());
    return { ...viteConfig, plugins: withExportDocblocks(plugins) };
  },
};

export default config;
