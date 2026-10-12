export type NavChild = {
  id: string
  label: string
  widget: string
}

export type NavSection = {
  id: string
  label: string
  widget: string
  children?: NavChild[]
}

export const navSections: NavSection[] = [
  {
    id: "risk",
    label: "风险区域监测",
    widget: "mid-short-macro",
    children: [
      { id: "risk-overview", label: "总览", widget: "mid-short-macro" }
    ]
  },
  {
    id: "station",
    label: "地面站预处理",
    widget: "disaster-loss-assessment",
    children: [
      { id: "station-overview", label: "总览", widget: "disaster-loss-assessment" }
    ]
  }
]

