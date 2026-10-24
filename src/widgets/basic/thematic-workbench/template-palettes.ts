import { interpolateColor } from "./render-style"

export const mapTemplatePalettes: Record<string, string[]> = {
  "sequential-blue": ["#d8f3ff", "#8ed8f8", "#3aa9d8", "#1678a8", "#0b3f6b"],
  categorical: ["#46c2cb", "#ffd166", "#ef476f", "#8f7ee7", "#65c18c"],
  heat: ["#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"],
  terrain: ["#173f5f", "#2a9d8f", "#90be6d", "#f9c74f", "#f9844a"],
  threshold: ["#2f80ed", "#85c7f2", "#f4d35e", "#ee964b", "#d1495b"]
}

export function templateHeatGradient(colors: string[]) {
  return Object.fromEntries(colors.map((color, index) => [0.1 + 0.9 * index / Math.max(1, colors.length - 1), color]))
}

export function sampleTemplatePalette(stops: string[], fraction: number) {
  const position = Math.max(0, Math.min(1, fraction)) * (stops.length - 1)
  const index = Math.floor(position)
  return interpolateColor(stops[index], stops[Math.min(index + 1, stops.length - 1)], position - index)
}
