# 2026-07-19 Map Task Center Bubble

## Modification purpose
- 将地图页亮蓝色正方体悬浮按钮明确为任务中心气泡入口。
- 将气泡从正方形视觉调整为圆形视觉，保留原亮蓝色。
- 点击气泡展开任务中心抽屉，用于展示生成 / 发布 / 导出任务进度占位内容。

## Modified files
- src/shell/components/MapFloatBall.vue
- docs/history/2026-07-19-map-task-center-bubble.md

## Reason for change
- 原悬浮按钮尚未接入功能，视觉语义不明确。
- 用户要求该入口作为任务中心气泡，并为后续图标动效、挤压呼吸感动效预留圆形容器。
- 当前只实现前端 UI 壳和占位进度内容，不接入真实任务接口或业务流程。

## Screenshot location
- Pending

## Rollback method
- 若需回滚，恢复 `MapFloatBall.vue` 中按钮自闭合结构，移除 `drawerOpen`、`taskGroups`、`drawerStyle` 和任务中心抽屉相关样式。
- 保留或恢复原 `map-float-ball` 的拖拽逻辑和 `localStorage` 位置存储即可。

## Risk
- Level: Low
- Notes: 仅修改独立的地图悬浮气泡组件，不影响 CUI 悬浮按钮、数据集仓库抽屉、Mars3D 原生三维/缩放/全屏控件，也不修改 API 和任务业务逻辑。

## Completion status
- Completed
