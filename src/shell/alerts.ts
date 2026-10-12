export type AlertInfo = {
  time: Date | string
  location: string
  degree: string
  duration: string
  scope: string
}

export function createMockAlerts(): AlertInfo[] {
  return [
    {
      time: new Date("2024-12-18T18:32:25"),
      location: "116.39, 39.90",
      degree: "严重",
      duration: "4小时",
      scope: "5平方公里"
    },
    {
      time: new Date("2024-12-18T16:10:00"),
      location: "117.12, 40.01",
      degree: "中等",
      duration: "2小时",
      scope: "2平方公里"
    },
    {
      time: new Date("2024-12-17T09:20:00"),
      location: "115.92, 39.51",
      degree: "轻微",
      duration: "1小时",
      scope: "1平方公里"
    }
  ]
}

