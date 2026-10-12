const storageKey = "user_permissions"

export function getPermissionSet(): Set<string> {
  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    return new Set()
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v) => typeof v === "string"))
    }
    return new Set()
  } catch {
    return new Set()
  }
}

export function hasPermission(code?: string): boolean {
  if (!code) {
    return true
  }
  const perms = getPermissionSet()
  if (perms.size === 0) {
    return true
  }
  return perms.has(code)
}

export function isSuperAdmin(): boolean {
  const perms = getPermissionSet()
  if (perms.has("super_admin") || perms.has("super-admin") || perms.has("admin")) {
    return true
  }
  const role = String(localStorage.getItem("user_role") || localStorage.getItem("userRole") || "").trim().toLowerCase()
  return role === "admin" || role === "super-admin"
}
