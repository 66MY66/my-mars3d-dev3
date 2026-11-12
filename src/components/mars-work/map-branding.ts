interface PrimitiveCollection {
  readonly length: number
  get(index: number): unknown
  primitiveAdded: { addEventListener(listener: (primitive: unknown) => void): () => void }
}

/** Hides the animated branding quad emitted by the bundled Mars3D 3.10.12 SDK. */
export function suppressAnimatedMapBranding(primitives: PrimitiveCollection, version: string): () => void {
  if (version !== "3.10.12") { return () => {} }
  const hideBranding = (primitive: unknown) => {
    if (!primitive || typeof primitive !== "object") { return }
    const overlay = primitive as { _mhan?: boolean; show?: boolean; material?: { type?: string }; rectangle?: { _random?: boolean } }
    if (overlay._mhan === true && overlay.material?.type === "Image2" && overlay.rectangle?._random === true) { overlay.show = false }
  }
  const stop = primitives.primitiveAdded.addEventListener(hideBranding)
  for (let i = 0; i < primitives.length; i++) { hideBranding(primitives.get(i)) }
  return stop
}
