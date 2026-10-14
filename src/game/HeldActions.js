/**
 * Named S-key actions can be shared by any number of objects.
 * Each pickup defines userData.actionId (e.g. 'verticalShake'). A future
 * one-off item can instead define userData.onAction(controller, item).
 *
 * New reusable actions: registerHeldAction('ringBell', (controller, item) => ...)
 * and assign item.userData.actionId = 'ringBell'.
 */
export const DEFAULT_HELD_ACTION = 'verticalShake';

const actions = new Map();

export function registerHeldAction(id, handler, label = 'アクション') {
  if (typeof id !== 'string' || !id || typeof handler !== 'function') {
    throw new TypeError('A held action needs a non-empty ID and a handler function.');
  }
  actions.set(id, { handler, label });
}

export function performHeldAction(controller, item) {
  if (!item) return false;

  // Specific behavior for a single object takes priority over its shared ID.
  if (typeof item.userData.onAction === 'function') {
    item.userData.onAction(controller, item);
    return true;
  }

  const id = item.userData.actionId ?? DEFAULT_HELD_ACTION;
  const action = actions.get(id);
  if (!action) return false; // Never silently perform an unrelated action.
  action.handler(controller, item);
  return true;
}

export function getHeldActionLabel(item) {
  if (!item) return '';
  if (item.userData.actionLabel) return item.userData.actionLabel;
  return actions.get(item.userData.actionId ?? DEFAULT_HELD_ACTION)?.label ?? 'アクション';
}

registerHeldAction(DEFAULT_HELD_ACTION, (controller) => controller.startVerticalShake(), '振る');
