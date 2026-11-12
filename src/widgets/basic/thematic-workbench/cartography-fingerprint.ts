function canonical(value: any): string {
  if (Array.isArray(value)) { return `[${value.map(canonical).join(",")}]` }
  if (value && typeof value === "object") { return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` }
  return JSON.stringify(value)
}

export async function cartographyFingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : canonical(value))
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("")
}
