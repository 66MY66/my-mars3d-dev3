import type { CompositionItem } from "./composition-model"

// Serialized snapshots isolate history from Vue's live, mutable element objects.
export function compositionHistory(limit = 100) {
  let entries: string[] = []
  let cursor = -1
  return {
    get canUndo() { return cursor > 0 },
    get canRedo() { return cursor < entries.length - 1 },
    reset(items: CompositionItem[]) { entries = [JSON.stringify(items)]; cursor = 0 },
    record(items: CompositionItem[]) {
      const snapshot = JSON.stringify(items)
      if (snapshot === entries[cursor]) { return }
      entries = entries.slice(0, cursor + 1)
      entries.push(snapshot)
      if (entries.length > limit + 1) { entries.shift() }
      cursor = entries.length - 1
    },
    step(direction: -1 | 1): CompositionItem[] | null {
      const next = cursor + direction
      if (next < 0 || next >= entries.length) { return null }
      cursor = next
      return JSON.parse(entries[cursor])
    }
  }
}
