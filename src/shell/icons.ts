import {
  Alarm,
  Layers,
  Local,
  MapTwo,
  Tool,
  User,
  Moon,
  SunOne,
  Left,
  Right,
  FullScreen,
  OffScreen,
  SettingTwo,
  Workbench,
  Box,
  PreviewOpen,
  Save,
  History,
  DataSwitching,
  Play,
  BookOpen
} from "@icon-park/svg"

/** 分屏对比：外框 + 略加长的中竖线（似「中」），尺寸与同级 outline 图标一致 */
function Column(options: { theme?: string; size?: number } = {}) {
  const size = options.size ?? 16
  return `<?xml version="1.0" encoding="UTF-8"?><svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M39.3 8H8.7C7.20883 8 6 9.20883 6 10.7V37.3C6 38.7912 7.20883 40 8.7 40H39.3C40.7912 40 42 38.7912 42 37.3V10.7C42 9.20883 40.7912 8 39.3 8Z" stroke="currentColor" stroke-width="4"/><path d="M24 4L24 44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`
}

export const icons = {
  Alarm,
  Layers,
  Local,
  MapTwo,
  Tool,
  User,
  Moon,
  SunOne,
  Left,
  Right,
  FullScreen,
  OffScreen,
  SettingTwo,
  Workbench,
  Box,
  PreviewOpen,
  Save,
  History,
  DataSwitching,
  Column,
  Play,
  BookOpen
} as const

export type IconName = keyof typeof icons
