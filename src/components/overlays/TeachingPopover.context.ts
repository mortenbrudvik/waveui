import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { SlotObject } from '../../lib/slot';
import type { PopupAlign, PopupPositioning, PopupSide, VirtualElement } from '../../lib/types';

/*
 * The TeachingPopover's public types and its context. Imports no component: the root and the parts
 * read it, never the reverse.
 */

/**
 * A footer action of a TeachingPopover (`primaryAction`, `secondaryAction`): the label content, or
 * a Button-like slot (a `Button`, `<button>` or `<a>` element, or a slot object such as
 * `{ as: 'a', href, children }`; `as` changes the element, which stays a Wave Button).
 *
 * The consumer's `onClick` runs first; then the step's normal action runs (Next or Done for the
 * primary action, Back for the secondary one) unless the handler called `event.preventDefault()`.
 */
export type TeachingPopoverAction =
  | React.ReactNode
  | (SlotObject<'button'> &
      Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'download'>);

/** Defines a single step in a teaching popover sequence. */
export interface TeachingPopoverStep {
  /** Title text for the step. */
  title: string;
  /** Body content for the step. */
  body: React.ReactNode;
  /**
   * Replaces the Next (or, on the last step, Done) button on this step; wins over the
   * popover's `primaryAction`.
   */
  primaryAction?: TeachingPopoverAction;
  /**
   * Replaces the Back button on this step (also on a single-step popover, which has no Back);
   * wins over the popover's `secondaryAction`.
   */
  secondaryAction?: TeachingPopoverAction;
}

/** The built-in text of a TeachingPopover, for localization (see `TeachingPopoverProps.labels`). */
export interface TeachingPopoverLabels {
  /** Text of the Back button.
   * @default 'Back'
   */
  back?: string;
  /** Text of the Next button.
   * @default 'Next'
   */
  next?: string;
  /** Text of the button that replaces Next on the last step.
   * @default 'Done'
   */
  done?: string;
  /**
   * The position of the step at `index` (zero-based, like `activeStep`) out of `count` steps. It
   * follows the step title, after a comma, in the visually hidden part of the heading and in the
   * announcement of a step change.
   * @default (index, count) => `step ${index + 1} of ${count}`
   */
  step?: (index: number, count: number) => string;
  /** Name of the group of step buttons that `TeachingPopover.CarouselNav` renders.
   * @default 'Choose step'
   */
  nav?: string;
  /**
   * Name of the `TeachingPopover.CarouselNav` button that shows the step at `index` (zero-based,
   * like `activeStep`) out of `count` steps.
   * @default (index, count) => `Step ${index + 1} of ${count}`
   */
  navButton?: (index: number, count: number) => string;
}

/** What the surface points at: the `target` prop's forms (internal). */
export type TeachingPopoverTarget =
  React.RefObject<HTMLElement | null> | HTMLElement | VirtualElement | null;

/**
 * What the TeachingPopover root provides to its parts: one state for the `steps` form and the
 * parts, and the current step resolved once, so every part renders what the `steps` form renders.
 */
export interface TeachingPopoverContextValue {
  /** The open state (`open`/`defaultOpen`). */
  open: boolean;
  /** Open with at least one step: the surface renders. */
  shown: boolean;
  /** Opens the popover (the Trigger). */
  requestOpen: () => void;
  /**
   * Close, Escape, the Trigger and a CarouselFooter's `initialStepText` button: closes, then calls
   * `onDismiss`.
   */
  dismiss: () => void;
  /** Done, or a primary action on the last step: closes, then calls `onFinish` (and `onDismiss`). */
  finish: () => void;
  /** How many steps there are. */
  count: number;
  /** The clamped index of the current step (`0` without steps). */
  index: number;
  /** The current step; `undefined` without steps. */
  step: TeachingPopoverStep | undefined;
  isFirst: boolean;
  isLast: boolean;
  /** The position of the current step (`labels.step`); `''` without steps. */
  stepPosition: string;
  /** Back: the previous step (nothing on the first one). */
  goBack: () => void;
  /** Next: the next step, or `finish` on the last one. */
  goNext: () => void;
  /** A step button of TeachingPopover.CarouselNav: the step at `index` (nothing for the current one). */
  goToStep: (index: number) => void;
  /** The current step's primary action: its own, else the popover's; `undefined` for Next/Done. */
  primaryAction: TeachingPopoverAction | undefined;
  /** The current step's secondary action: its own, else the popover's; `undefined` for Back. */
  secondaryAction: TeachingPopoverAction | undefined;
  /** The popover's `footerLayout`. */
  footerLayout: 'horizontal' | 'vertical';
  /** The text of the Back, Next, Done and Close buttons, English unless localized. */
  backLabel: string;
  nextLabel: string;
  doneLabel: string;
  closeLabel: string;
  /** The names of TeachingPopover.CarouselNav's group and of its step buttons (`labels`). */
  navLabel: string;
  navButtonLabel: (index: number, count: number) => string;
  /** The id of the step title's heading, which names the surface. */
  titleId: string;
  /**
   * What the surface points at: `target`, else `positioning.target`, else the Trigger's element
   * (`null` until it attaches); `undefined` renders the surface in place.
   */
  target: TeachingPopoverTarget | undefined;
  side: PopupSide;
  align: PopupAlign;
  positioning: PopupPositioning | undefined;
  /** Whether a Trigger is a direct child or has attached its element. */
  hasTrigger: boolean;
  /** The Trigger's ref callback: its element is the surface's target when `target` is unset. */
  triggerElementRef: React.RefCallback<HTMLElement>;
  /** The Trigger's element (`null` without one), where focus returns when the popover closes. */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** The surface's id for the Trigger's `aria-controls`: the consumer's, else a generated one. */
  surfaceId: string;
  /** A TeachingPopover.Surface reports its `id` (`undefined` without one, or when it unmounts). */
  setCustomSurfaceId: (id: string | undefined) => void;
  /**
   * A TeachingPopover.Surface registers while it is mounted, wherever it is among the children:
   * the root then renders no surface of its own, and warns when more than one registers.
   */
  registerSurface: () => () => void;
}

export const TeachingPopoverContext = React.createContext<TeachingPopoverContextValue | null>(null);
TeachingPopoverContext.displayName = 'TeachingPopoverContext';

/** What a part reads outside a TeachingPopover in production (C-CONTEXT): closed, inert. */
const inertTeachingPopoverContext: TeachingPopoverContextValue = {
  open: false,
  shown: false,
  requestOpen: () => {},
  dismiss: () => {},
  finish: () => {},
  count: 0,
  index: 0,
  step: undefined,
  isFirst: true,
  isLast: true,
  stepPosition: '',
  goBack: () => {},
  goNext: () => {},
  goToStep: () => {},
  primaryAction: undefined,
  secondaryAction: undefined,
  footerLayout: 'horizontal',
  backLabel: 'Back',
  nextLabel: 'Next',
  doneLabel: 'Done',
  closeLabel: 'Close',
  navLabel: 'Choose step',
  navButtonLabel: (index, count) => `Step ${index + 1} of ${count}`,
  titleId: '',
  target: undefined,
  side: 'bottom',
  align: 'center',
  positioning: undefined,
  hasTrigger: false,
  triggerElementRef: () => {},
  triggerRef: { current: null },
  surfaceId: '',
  setCustomSurfaceId: () => {},
  registerSurface: () => () => {},
};

/**
 * C-CONTEXT: the enclosing TeachingPopover's context. Outside one it throws
 * `[WaveUI] <componentName> must be used within TeachingPopover` in development; in production it
 * logs once and returns an inert value.
 */
export function useTeachingPopoverContext(componentName: string): TeachingPopoverContextValue {
  const context = React.useContext(TeachingPopoverContext);
  if (context) return context;
  reportMissingContext(componentName, 'TeachingPopover');
  return inertTeachingPopoverContext;
}

/** The title registry of one surface (see {@link TeachingPopoverSurfaceContext}). */
export interface TeachingPopoverSurfaceContextValue {
  /** A TeachingPopover.Title registers its id while its element is mounted; returns the release. */
  registerTitle: (id: string) => () => void;
}

/**
 * What a surface with children of yours gives the titles among them: a TeachingPopover.Title
 * registers its id, and the first registered one names the surface (`aria-labelledby`). `null`
 * outside a surface and inside the content a surface shows without children, whose title id it
 * knows while rendering. Optional (a title outside a surface names nothing), so there is no hook
 * that reports a missing provider.
 */
export const TeachingPopoverSurfaceContext =
  React.createContext<TeachingPopoverSurfaceContextValue | null>(null);
TeachingPopoverSurfaceContext.displayName = 'TeachingPopoverSurfaceContext';
