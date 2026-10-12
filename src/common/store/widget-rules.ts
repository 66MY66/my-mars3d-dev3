const protectedWidgets = new Set<string>()

export function setWidgetProtected(name: string, protectedState: boolean): void {
  if (protectedState) {
    protectedWidgets.add(name)
  } else {
    protectedWidgets.delete(name)
  }
}

export function isWidgetProtected(name: string): boolean {
  return protectedWidgets.has(name)
}

export function shouldSkipMutualDisable(activatingName: string, candidateName: string): boolean {
  return (activatingName === "manage-layers" && candidateName === "current-task") || isWidgetProtected(candidateName)
}
