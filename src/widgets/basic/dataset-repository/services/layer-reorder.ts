export type ReorderLayer = {
  id: string
  pid?: string | null
  order?: number
  [key: string]: unknown
}

export type DropPosition = "before" | "after"

/** Reorders two nodes in the same directory and normalizes that directory's order values. */
export function reorderLayerByDrop<T extends ReorderLayer>(layers: T[], draggedId: string, targetId: string, position: DropPosition): T[] {
  const dragged = layers.find((layer) => String(layer.id) === String(draggedId))
  const target = layers.find((layer) => String(layer.id) === String(targetId))
  if (!dragged || !target || dragged.id === target.id) {
    return layers
  }

  const parentOf = (layer: ReorderLayer) => (layer.pid == null || layer.pid === "" ? "__root__" : String(layer.pid))
  if (parentOf(dragged) !== parentOf(target)) {
    return layers
  }

  const siblings = layers
    .filter((layer) => parentOf(layer) === parentOf(target))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  const fromIndex = siblings.findIndex((layer) => String(layer.id) === String(draggedId))
  const targetIndex = siblings.findIndex((layer) => String(layer.id) === String(targetId))
  if (fromIndex < 0 || targetIndex < 0) {
    return layers
  }

  const [moved] = siblings.splice(fromIndex, 1)
  let insertIndex = siblings.findIndex((layer) => String(layer.id) === String(targetId))
  if (position === "after") {
    insertIndex += 1
  }
  siblings.splice(Math.max(0, insertIndex), 0, moved)

  const nextOrder = new Map(siblings.map((layer, index) => [String(layer.id), index]))
  return layers.map((layer) => {
    const order = nextOrder.get(String(layer.id))
    return order === undefined ? layer : { ...layer, order }
  })
}
