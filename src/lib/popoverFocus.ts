// Popovers portalled to <body> (so no sticky / overflow / stacking context they sit in can cover
// or clip them) leave their field's DOM subtree. This maps each one back to its field so
// "did focus leave this group?" checks still count focus inside the popover as inside.

const POPOVER_ATTR = 'data-portal-popover'
const popoverOwners = new WeakMap<Element, Element>()

/** Marks `popover` as belonging to `owner` (an element in the field's own subtree). */
export function registerPopover(popover: Element, owner: Element): void {
  popover.setAttribute(POPOVER_ATTR, '')
  popoverOwners.set(popover, owner)
}

/** `container.contains(node)`, also counting a registered popover as where its owner is. */
export function containsFocus(container: Element | null, node: Node | null): boolean {
  if (!container || !node) return false
  const popover = (node instanceof Element ? node : node.parentElement)?.closest(`[${POPOVER_ATTR}]`)
  const owner = popover ? popoverOwners.get(popover) : undefined
  return container.contains(owner ?? node)
}
