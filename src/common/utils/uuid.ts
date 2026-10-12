export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return Number(array[0]).toString(16).padStart(8, "0").slice(-8)
  }

  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0")
    .slice(-8)
}
