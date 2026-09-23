import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import type { PluginOption } from 'vite';

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
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  /**
   * The library build compiles no CSS (scripts/build-css.mjs does), so Storybook adds the
   * Tailwind plugin itself: it compiles `.storybook/preview.css`, the library stylesheet plus
   * the stories as a source (scripts/verify-storybook.mjs checks the result).
   */
  async viteFinal(viteConfig) {
    const plugins = await withoutDts(viteConfig.plugins ?? []);
    if (!hasTailwind(plugins)) plugins.push(tailwindcss());
    return { ...viteConfig, plugins };
  },
};

export default config;
