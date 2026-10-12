export type IdentifyFocusAction = "focus" | "restore"

export function getIdentifyFocusAction(category: string, currentIdx: number | null, nextIdx: number): IdentifyFocusAction {
  return category === "precursor" && currentIdx === nextIdx ? "restore" : "focus"
}
