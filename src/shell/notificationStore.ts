import { computed, reactive } from "vue"
import type { AlertInfo } from "@/shell/alerts"
import { createMockAlerts } from "@/shell/alerts"

export type NotificationType = "alert"

export type NotificationSeverity = "严重" | "中等" | "轻微"

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  createdAt: number
  read: boolean
  widget?: string
  payload?: {
    alert?: AlertInfo
  }
}

const readStorageKey = "notifications_read_ids_v1"

const state = reactive({
  initialized: false,
  items: [] as NotificationItem[],
  readSet: new Set<string>()
})

function loadReadSet(): Set<string> {
  try {
    const raw = localStorage.getItem(readStorageKey)
    const arr = raw ? JSON.parse(raw) : []
    if (Array.isArray(arr)) {
      return new Set(arr.map((x) => String(x)))
    }
  } catch {}
  return new Set()
}

function persistReadSet() {
  localStorage.setItem(readStorageKey, JSON.stringify(Array.from(state.readSet)))
}

function toMs(t: Date | string): number {
  if (t instanceof Date) {
    return t.getTime()
  }
  const d = new Date(t)
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : Date.now()
}

function formatTimeLabel(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const isSameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (isSameDay) {
    return `今天 ${hh}:${mm}`
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function sortByTimeDesc(items: NotificationItem[]) {
  items.sort((a, b) => b.createdAt - a.createdAt)
}

export function parseNotificationSeverity(title: string): NotificationSeverity {
  const match = title.match(/（(严重|中等|轻微)）/)
  if (match?.[1] === "严重" || match?.[1] === "中等" || match?.[1] === "轻微") {
    return match[1]
  }
  return "轻微"
}

export function getSeverityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case "严重":
      return "#CB272D"
    case "中等":
      return "#FF7D00"
    case "轻微":
      return "#FADC19"
    default:
      return "#FADC19"
  }
}

export function getSeverityRank(severity: NotificationSeverity): number {
  return { 严重: 3, 中等: 2, 轻微: 1 }[severity]
}

function initMockIfNeeded() {
  if (state.initialized) {
    return
  }
  state.readSet = loadReadSet()
  const alerts = createMockAlerts()
  const items = alerts.map((a) => {
    const createdAt = toMs(a.time)
    const id = `alert_${createdAt}_${a.location.replace(/\s+/g, "")}`
    const title = `${formatTimeLabel(createdAt)} 触发预告警通知（${a.degree}）`
    const read = state.readSet.has(id)
    return {
      id,
      type: "alert",
      title,
      createdAt,
      read,
      widget: "alert-confirm",
      payload: { alert: a }
    } satisfies NotificationItem
  })
  sortByTimeDesc(items)
  state.items = items
  state.initialized = true
}

function upsertAlert(alert: AlertInfo) {
  initMockIfNeeded()
  const createdAt = toMs(alert.time)
  const id = `alert_${createdAt}_${alert.location.replace(/\s+/g, "")}`
  const title = `${formatTimeLabel(createdAt)} 触发预告警通知（${alert.degree}）`
  const existing = state.items.find((x) => x.id === id)
  if (existing) {
    existing.title = title
    existing.createdAt = createdAt
    existing.payload = { alert }
    existing.widget = "alert-confirm"
  } else {
    state.items.unshift({
      id,
      type: "alert",
      title,
      createdAt,
      read: state.readSet.has(id),
      widget: "alert-confirm",
      payload: { alert }
    })
  }
  sortByTimeDesc(state.items)
}

function markRead(id: string) {
  initMockIfNeeded()
  state.readSet.add(id)
  persistReadSet()
  const it = state.items.find((x) => x.id === id)
  if (it) {
    it.read = true
  }
}

function markAllRead() {
  initMockIfNeeded()
  state.items.forEach((n) => {
    n.read = true
    state.readSet.add(n.id)
  })
  persistReadSet()
}

const listForView = computed(() => {
  initMockIfNeeded()
  return state.items.map((n) => ({
    ...n,
    timeLabel: formatTimeLabel(n.createdAt)
  }))
})

const unreadCount = computed(() => {
  initMockIfNeeded()
  return state.items.filter((n) => !n.read).length
})

function getById(id: string): NotificationItem | null {
  initMockIfNeeded()
  return state.items.find((x) => x.id === id) || null
}

export function useNotificationStore() {
  initMockIfNeeded()
  return {
    listForView,
    unreadCount,
    markRead,
    markAllRead,
    upsertAlert,
    getById
  }
}
