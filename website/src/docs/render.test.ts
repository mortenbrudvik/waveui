/**
 * The page pieces that show the library's own text (JSDoc descriptions, prop docs, story sources),
 * rendered with Astro's container API and parsed without running scripts: whatever the text holds,
 * it reaches the page as text, never as markup.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import Description from './Description.astro';
import PropsTable from './PropsTable.astro';
import type { PropDoc } from './props';
import StoryCode from './StoryCode.astro';

const SCRIPT = '</script><script>alert(1)</script>';
const IMG = '<img src=x onerror=alert(1)>';
const HOSTILE = `Before ${SCRIPT} middle ${IMG} after \`<b>code</b>\`.`;

async function render(
  component: Parameters<AstroContainer['renderToString']>[0],
  props: Record<string, unknown>,
): Promise<Document> {
  const container = await AstroContainer.create();
  const html = await container.renderToString(component, { props });
  return new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
}

/** No element the payload could have made, and no inline handler anywhere. */
function expectInert(document: Document) {
  expect(document.querySelectorAll('script, img, b, iframe, object, embed')).toHaveLength(0);
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of element.getAttributeNames()) {
      expect(attribute.startsWith('on'), `${element.tagName} ${attribute}`).toBe(false);
    }
  }
}

describe('hostile text renders inert', () => {
  it('Description shows `</script>` and a bare <img onerror> as text', async () => {
    const document = await render(Description, { text: HOSTILE, main: true });
    expectInert(document);
    const description = document.querySelector('[data-description]')!;
    expect(description.textContent).toContain(SCRIPT);
    expect(description.textContent).toContain(IMG);
    expect(description.querySelector('code')?.textContent).toBe('<b>code</b>');
    expect([...description.querySelectorAll('*')].map((el) => el.tagName)).toEqual(['P', 'CODE']);
  });

  it('the props table shows a hostile name, type, default, description and Deprecated: note as text', async () => {
    const prop: PropDoc = {
      name: `x${IMG}`,
      type: `'${SCRIPT}'`,
      required: false,
      default: IMG,
      description: HOSTILE,
      deprecated: `Use ${SCRIPT} or ${IMG}.`,
    };
    const document = await render(PropsTable, {
      label: `Props of ${IMG}`,
      props: [prop],
      nativeElement: IMG,
    });
    expectInert(document);
    const row = document.querySelector('tbody tr')!;
    const cells = [...row.children].map((cell) => cell.textContent ?? '');
    expect(cells[0]).toContain(IMG);
    expect(cells[1]).toContain(SCRIPT);
    expect(cells[3]).toContain(IMG);
    expect(cells[4]).toContain(SCRIPT);
    const deprecated = row.querySelector('[data-deprecated]')!;
    expect(deprecated.textContent).toBe(`Deprecated: Use ${SCRIPT} or ${IMG}.`);
    expect(document.querySelector('table')?.getAttribute('aria-label')).toBe(`Props of ${IMG}`);
    expect(document.body.textContent).toContain(`(${IMG})`);
  });

  it('StoryCode keeps a hostile story source as the exact text of its <pre><code>', async () => {
    const source = `export const X = () => <div>${SCRIPT}${IMG}</div>;\n  // second line`;
    const document = await render(StoryCode, { source });
    expectInert(document);
    expect(document.querySelectorAll('pre > code')).toHaveLength(1);
    expect(document.querySelector('pre > code')!.textContent).toBe(source);
  });
});
