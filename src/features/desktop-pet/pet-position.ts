export interface Size {
  width: number
  height: number
}

export interface Position {
  x: number
  y: number
}

export const PET_VIEWPORT_GAP = 12

export function clampPetPosition(position: Position, viewport: Size, pet: Size): Position {
  const maxX = Math.max(PET_VIEWPORT_GAP, viewport.width - pet.width - PET_VIEWPORT_GAP)
  const maxY = Math.max(PET_VIEWPORT_GAP, viewport.height - pet.height - PET_VIEWPORT_GAP)

  return {
    x: Math.min(Math.max(position.x, PET_VIEWPORT_GAP), maxX),
    y: Math.min(Math.max(position.y, PET_VIEWPORT_GAP), maxY)
  }
}

export function getDefaultPetPosition(viewport: Size, pet: Size): Position {
  return clampPetPosition(
    {
      x: viewport.width - pet.width - 24,
      y: viewport.height - pet.height - 24
    },
    viewport,
    pet
  )
}
