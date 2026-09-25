import * as React from 'react';
import {
  usePresence,
  type UsePresenceOptions,
  type UsePresenceResult,
} from '../../hooks/usePresence';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { warnOnce } from '../../lib/dev';

/** Properties for the Presence component. */
export interface PresenceProps extends UsePresenceOptions {
  /** Whether the content is shown; changes run the enter and exit phases. */
  visible: boolean;
  /**
   * A single element, which receives the presence attributes and ref (merged with its own ref and
   * props: its own `inert` and `hidden` apply while the presence sets none), or a render function
   * that receives the presence result.
   */
  children: React.ReactElement | ((presence: UsePresenceResult) => React.ReactNode);
}

type ChildProps = {
  ref?: React.Ref<HTMLElement>;
  inert?: boolean;
  hidden?: boolean;
};

/** The single element of `children` (a Fragment around one element is unwrapped), else `null`. */
function singleElement(children: React.ReactNode): React.ReactElement<ChildProps> | null {
  if (!React.isValidElement<ChildProps & { children?: React.ReactNode }>(children)) return null;
  if (children.type !== React.Fragment) return children;
  return singleElement(children.props.children);
}

/**
 * Shows and hides its child with CSS enter and exit motion: the child stays mounted while its exit
 * motion runs, `inert` and marked `data-presence="exiting"`, and unmounts when it ends (at once
 * under reduced motion or without motion). Style the phases on the child: a transition with the
 * `duration-wave-*` and `ease-wave-*` tokens, its start with the `starting:` variant, its exit
 * with `data-[presence=exiting]:` classes, and a `motion-reduce:` counterpart (the `usePresence`
 * JSDoc and the Presence stories show complete class lists).
 *
 * - The child is a single element (it must accept a `ref`, as DOM elements and ref-forwarding
 *   components do), which receives `data-presence`, `inert` while exiting and the presence ref,
 *   merged with its own ref and props; or a render function called with the presence result
 *   (`isMounted`, `phase`, `ref`, `presenceProps`) to spread yourself.
 * - `appear` runs the enter phase on mount (never on the server or when hydrating),
 *   `unmountOnExit={false}` keeps the exited child mounted, `hidden` and `inert`, and `onEntered`
 *   and `onExited` report the end of a phase (see {@link usePresence}).
 * - Renders nothing while the child is not mounted. Other children (text, several elements) are
 *   rendered as given, without the presence attributes, and a development warning is logged.
 *
 * @example
 * <Presence visible={open}>
 *   <div className={fadeClasses}>Saved</div>
 * </Presence>
 */
export const Presence = ({
  visible,
  children,
  appear,
  unmountOnExit,
  onEntered,
  onExited,
}: PresenceProps): React.ReactNode => {
  const { isMounted, phase, ref, presenceProps } = usePresence(visible, {
    appear,
    unmountOnExit,
    onEntered,
    onExited,
  });
  const isRenderFunction = typeof children === 'function';
  const element = isRenderFunction ? null : singleElement(children);
  const mergedRef = useMergedRefs<HTMLElement>(ref, element?.props.ref);
  const invalidChildren = !isRenderFunction && element === null;

  React.useEffect(() => {
    if (!invalidChildren) return;
    warnOnce(
      'Presence:children',
      'Presence: expected a single element or a render function as its child; other children are rendered as given, without the presence attributes, and their enter and exit phases end at once.',
    );
  }, [invalidChildren]);

  if (!isMounted) return null;
  if (isRenderFunction) return children({ isMounted, phase, ref, presenceProps });
  if (!element) return children as React.ReactNode;
  // Merged by hand (no mergeProps: the presence core stays free of the class merger).
  return React.cloneElement(element, {
    'data-presence': presenceProps['data-presence'],
    inert: presenceProps.inert ?? element.props.inert,
    hidden: presenceProps.hidden ?? element.props.hidden,
    ref: mergedRef,
  } as ChildProps);
};
Presence.displayName = 'Presence';
