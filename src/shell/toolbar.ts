export type ToolbarAction =
  | { type: "widget.toggle"; widget: string }
  | { type: "widget.open"; widget: string }
  | { type: "widget.close"; widget: string }

export interface ToolbarItemConfig {
  id: string
  label: string
  icon: string
  group?: string
  permission?: string
  action: ToolbarAction
}
