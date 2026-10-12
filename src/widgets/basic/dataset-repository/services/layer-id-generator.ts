import { generateUUID } from "../../../../common/utils/uuid"

type ParsedLayerId = {
  timestamp: Date
  random: string
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function formatTimestamp(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("")
}

export function generateLayerId(now = new Date()): string {
  return `LAYER_${formatTimestamp(now)}_${generateUUID()}`
}

export function parseLayerId(id: string): ParsedLayerId | null {
  const match = String(id || "").match(/^LAYER_(\d{14})_([0-9a-f]{8})$/i)
  if (!match) {
    return null
  }

  const [, timestampStr, random] = match
  const year = Number(timestampStr.slice(0, 4))
  const month = Number(timestampStr.slice(4, 6)) - 1
  const day = Number(timestampStr.slice(6, 8))
  const hour = Number(timestampStr.slice(8, 10))
  const minute = Number(timestampStr.slice(10, 12))
  const second = Number(timestampStr.slice(12, 14))
  const timestamp = new Date(year, month, day, hour, minute, second)
  if (Number.isNaN(timestamp.getTime())) {
    return null
  }

  return { timestamp, random }
}
