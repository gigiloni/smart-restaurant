import type { ProductType } from '../products/product-type.schema.js';
import type { OrderItemStatus } from './order-item-status.schema.js';

/**
 * The order every item travels in. Position in this array is what "forward"
 * and "back" mean; REMAKE sits off the chain and carries its own edges.
 */
export const ORDER_ITEM_CHAIN = ['OPEN', 'IN_PROGRESS', 'READY', 'SERVED'] as const;

export type OrderItemChainStatus = (typeof ORDER_ITEM_CHAIN)[number];

/**
 * Products whose items may jump forward past intermediate steps: a bottle needs
 * no preparation, so making it walk the kitchen workflow is bookkeeping only.
 */
export const SKIPPING_PRODUCT_TYPES: readonly ProductType[] = ['DRINK'];

/** Statuses an item can be rejected from. Nothing is sent back before it exists. */
const SEND_BACK_FROM: readonly OrderItemStatus[] = ['READY', 'SERVED'];

/** What a REMAKE resolves into: a fresh attempt, or the guest keeping it. */
const REMAKE_RESOLUTIONS = {
  IN_PROGRESS: 'remake',
  SERVED: 'keep',
} as const satisfies Partial<Record<OrderItemStatus, string>>;

export type OrderItemTransitionKind =
  | 'unchanged'
  | 'forward'
  | 'skip'
  | 'undo'
  | 'send-back'
  | 'remake'
  | 'keep';

/**
 * What each kind of move means. Keyed by the value `classifyOrderItemTransition`
 * returns, so the API documentation and the frontend describe moves the same way.
 */
export const ORDER_ITEM_TRANSITION_KINDS = {
  unchanged:
    'Re-sending the status an item already has. Accepted as a no-op so a retried request is safe.',
  forward: 'The next step along OPEN to IN_PROGRESS to READY to SERVED.',
  skip: 'A forward jump past one or more steps. Only for DRINK items, which need no preparation.',
  undo: 'Exactly one step back, to correct a mis-tap. Never more than one step, for any product type.',
  'send-back':
    'READY or SERVED to REMAKE, when an item is rejected at the pass or sent back by the guest.',
  remake: 'REMAKE to IN_PROGRESS, when the kitchen starts the replacement.',
  keep: 'REMAKE to SERVED, when the guest accepts the item after all.',
} as const satisfies Record<OrderItemTransitionKind, string>;

const chainPosition = (status: OrderItemStatus): number =>
  (ORDER_ITEM_CHAIN as readonly OrderItemStatus[]).indexOf(status);

/**
 * Classifies a requested status change, or returns `null` when it is not
 * permitted. The product type only ever widens what is allowed: it decides
 * whether a forward jump counts as a legal skip.
 */
export const classifyOrderItemTransition = (
  from: OrderItemStatus,
  to: OrderItemStatus,
  productType: ProductType,
): OrderItemTransitionKind | null => {
  if (from === to) {
    return 'unchanged';
  }

  if (from === 'REMAKE') {
    return REMAKE_RESOLUTIONS[to as keyof typeof REMAKE_RESOLUTIONS] ?? null;
  }

  if (to === 'REMAKE') {
    return SEND_BACK_FROM.includes(from) ? 'send-back' : null;
  }

  const step = chainPosition(to) - chainPosition(from);

  if (step === 1) {
    return 'forward';
  }

  if (step === -1) {
    return 'undo';
  }

  // Jumping forward is a skip; rewinding more than one step never is, which is
  // why a drink that skipped ahead still unwinds one step at a time.
  if (step > 1 && SKIPPING_PRODUCT_TYPES.includes(productType)) {
    return 'skip';
  }

  return null;
};

export const isOrderItemTransitionPermitted = (
  from: OrderItemStatus,
  to: OrderItemStatus,
  productType: ProductType,
): boolean => classifyOrderItemTransition(from, to, productType) !== null;

/**
 * Every move that would actually change the item, with the meaning of each.
 * `from` itself is left out: re-sending it is accepted, but it is not a move.
 */
export const permittedOrderItemTransitions = (
  from: OrderItemStatus,
  productType: ProductType,
): { status: OrderItemStatus; kind: OrderItemTransitionKind }[] =>
  ([...ORDER_ITEM_CHAIN, 'REMAKE'] as OrderItemStatus[])
    .filter((status) => status !== from)
    .map((status) => ({ status, kind: classifyOrderItemTransition(from, status, productType) }))
    .filter(
      (entry): entry is { status: OrderItemStatus; kind: OrderItemTransitionKind } =>
        entry.kind !== null,
    );

export const permittedOrderItemTargets = (
  from: OrderItemStatus,
  productType: ProductType,
): OrderItemStatus[] =>
  permittedOrderItemTransitions(from, productType).map((entry) => entry.status);
