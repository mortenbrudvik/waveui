import { describe, it, expect, expectTypeOf } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import { flattenChildren, getElementType, isElementOfType } from '../children';

function Item({ children }: { children?: React.ReactNode }) {
  return <li>{children}</li>;
}

function Note({ children }: { children?: React.ReactNode }) {
  return <p>{children}</p>;
}

type ItemModule = { default: typeof Item };

/**
 * The shape React Flight gives a client component written in a Server Component: a lazy element
 * type whose chunk has already loaded, so its `_init` returns the component synchronously.
 */
function preResolvedLazy(component: typeof Item) {
  const resolved = {
    then(onFulfilled: (module: ItemModule) => void) {
      onFulfilled({ default: component });
    },
  };
  return React.lazy(() => resolved as unknown as Promise<ItemModule>);
}

/** A lazy element type whose chunk is still loading; `load()` resolves it. */
function pendingLazy(component: typeof Item) {
  const listeners: Array<(module: ItemModule) => void> = [];
  const thenable = {
    then(onFulfilled: (module: ItemModule) => void) {
      listeners.push(onFulfilled);
    },
  };
  const Lazy = React.lazy(() => thenable as unknown as Promise<ItemModule>);
  const load = () => listeners.splice(0).forEach((listener) => listener({ default: component }));
  return { Lazy, thenable, load };
}

/** A lazy element type whose chunk failed to load: its `_init` throws the Error. */
function rejectedLazy(error: Error) {
  const rejected = {
    then(_onFulfilled: unknown, onRejected: (reason: Error) => void) {
      onRejected(error);
    },
  };
  return React.lazy(() => rejected as unknown as Promise<ItemModule>);
}

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw');
}

/** A minimal compound that counts and classifies its direct children the way Wave's roots do. */
function Items({ children }: { children?: React.ReactNode }) {
  const entries = flattenChildren(children);
  const items = entries.filter(({ node }) => isElementOfType(node, Item));
  const notes = entries.filter(({ node }) => isElementOfType(node, Note));
  return (
    <section aria-label={`${items.length} items`}>
      <ul>
        {items.map(({ key, node }) => (
          <React.Fragment key={key}>{node}</React.Fragment>
        ))}
      </ul>
      {notes.map(({ key, node }) => (
        <React.Fragment key={key}>{node}</React.Fragment>
      ))}
    </section>
  );
}

describe('getElementType', () => {
  it('returns undefined for anything that is not an element', () => {
    for (const node of [null, undefined, true, false, 'text', 0, 42, [<Item key="a" />]]) {
      expect(getElementType(node)).toBeUndefined();
    }
  });

  it('returns the type of a plain element: component, intrinsic tag or Fragment', () => {
    expect(getElementType(<Item />)).toBe(Item);
    expect(getElementType(<li />)).toBe('li');
    expect(getElementType(<></>)).toBe(React.Fragment);
  });

  it('unwraps a pre-resolved lazy type (the Flight client-reference shape) to the component', () => {
    const LazyItem = preResolvedLazy(Item);
    expect(getElementType(<LazyItem />)).toBe(Item);
    // Resolving again returns the same component.
    expect(getElementType(<LazyItem>again</LazyItem>)).toBe(Item);
  });

  it('rethrows the thenable of a lazy type that is still loading, so the caller suspends', () => {
    const { Lazy, thenable } = pendingLazy(Item);
    expect(thrownBy(() => getElementType(<Lazy />))).toBe(thenable);
  });

  it('returns the lazy object itself when its init throws anything but a thenable', () => {
    const Broken = rejectedLazy(new Error('chunk failed'));
    expect(getElementType(<Broken />)).toBe(Broken);
  });
});

describe('isElementOfType', () => {
  it('is true when the element type is one of the given types', () => {
    expect(isElementOfType(<Item />, Item)).toBe(true);
    expect(isElementOfType(<Note />, Item, Note)).toBe(true);
    expect(isElementOfType(<Note />, Item)).toBe(false);
    expect(isElementOfType(<Item />)).toBe(false);
  });

  it('is false for non-elements, even when undefined is one of the types', () => {
    expect(isElementOfType('text', Item, undefined)).toBe(false);
    expect(isElementOfType(null, undefined)).toBe(false);
    expect(isElementOfType(undefined, undefined)).toBe(false);
  });

  it('matches through a pre-resolved lazy type', () => {
    const LazyItem = preResolvedLazy(Item);
    expect(isElementOfType(<LazyItem />, Item)).toBe(true);
    expect(isElementOfType(<LazyItem />, Note)).toBe(false);
  });

  it('matches Fragments and intrinsic tags', () => {
    expect(isElementOfType(<></>, React.Fragment)).toBe(true);
    expect(isElementOfType(<li />, 'li')).toBe(true);
    expect(isElementOfType(<li />, 'ul', React.Fragment)).toBe(false);
  });

  it('narrows the node to an element with the given props', () => {
    const node: React.ReactNode = <Item>label</Item>;
    if (isElementOfType<{ children?: React.ReactNode }>(node, Item)) {
      expectTypeOf(node.props.children).toEqualTypeOf<React.ReactNode>();
      expect(node.props.children).toBe('label');
    } else {
      throw new Error('expected an Item element');
    }
  });
});

describe('flattenChildren', () => {
  it('flattens Fragments recursively and drops null, undefined and booleans', () => {
    const entries = flattenChildren([
      <Item key="a">A</Item>,
      null,
      false,
      'text',
      <>
        <Item>B</Item>
        {undefined}
        {true}
        <>
          <Item key="c">C</Item>
        </>
      </>,
      <React.Fragment key="f">
        <Item>D</Item>
      </React.Fragment>,
    ]);
    expect(entries.map(({ key }) => key)).toEqual(['.$a', '1', '.4/.0', '.4/.3/.$c', '.$f/.0']);
    expect(
      entries.map(({ node }) =>
        React.isValidElement<{ children?: React.ReactNode }>(node) ? node.props.children : node,
      ),
    ).toEqual(['A', 'text', 'B', 'C', 'D']);
  });

  it('keeps keys unique when Fragments reuse a consumer key', () => {
    const entries = flattenChildren(
      <>
        <>
          <Item key="x">1</Item>
        </>
        <>
          <Item key="x">2</Item>
        </>
      </>,
    );
    const keys = entries.map(({ key }) => key);
    expect(keys).toEqual(['.0/.0/.$x', '.0/.1/.$x']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('prefixes every key with the given prefix', () => {
    const entries = flattenChildren([<Item key="a" />, <Item key="b" />], 'root/');
    expect(entries.map(({ key }) => key)).toEqual(['root/.$a', 'root/.$b']);
  });

  it('returns an empty list for empty children', () => {
    expect(flattenChildren(null)).toEqual([]);
    expect(flattenChildren([undefined, false])).toEqual([]);
  });

  it('keeps a lazy element as one node (it is not a Fragment)', () => {
    const LazyItem = preResolvedLazy(Item);
    const entries = flattenChildren([<LazyItem key="a">A</LazyItem>]);
    expect(entries).toHaveLength(1);
    expect(isElementOfType(entries[0]!.node, Item)).toBe(true);
  });
});

describe('server rendering', () => {
  it('renders the same markup with lazy (Flight) part types as with the plain types', () => {
    const LazyItem = preResolvedLazy(Item);
    const LazyNote = preResolvedLazy(Note);
    const plain = renderToString(
      <Items>
        <Item>One</Item>
        <>
          <Item>Two</Item>
          <Note>Aside</Note>
        </>
      </Items>,
    );
    const lazy = renderToString(
      <Items>
        <LazyItem>One</LazyItem>
        <>
          <LazyItem>Two</LazyItem>
          <LazyNote>Aside</LazyNote>
        </>
      </Items>,
    );
    expect(plain).toBe(
      '<section aria-label="2 items"><ul><li>One</li><li>Two</li></ul><p>Aside</p></section>',
    );
    expect(lazy).toBe(plain);
  });

  it('suspends the classifying parent while a part type is still loading, then renders it', async () => {
    const { Lazy, load } = pendingLazy(Item);
    render(
      <React.Suspense fallback={<p>Loading</p>}>
        <Items>
          <Lazy>One</Lazy>
        </Items>
      </React.Suspense>,
    );
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await act(async () => load());
    expect(screen.getByRole('region', { name: '1 items' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('One');
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });
});
