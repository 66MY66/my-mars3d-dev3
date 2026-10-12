# 2026-07-18 Anomaly Identify

## Modification purpose
- 优化“异常识别”弹窗的标题栏、按钮区、圆角边框、滚动区域和拖拽边界，使其符合既定 UI 设计系统。

## Modified files
- src/components/mars-work/mars-map.vue
- docs/history/2026-07-18-anomaly-identify.md

## Reason for change
- 弹窗标题需要始终停留在顶部，关闭按钮需要符合统一的图标按钮尺寸、圆角和高亮反馈。
- 弹窗内图例、输入框、结果项、详情卡片等边框存在直角视觉，需要统一圆角。
- “开始识别 / 清理”和“导出GeoJSON / 导出CSV”需要左对齐，“综合统计面板”需要独立成一行并与弹窗内容宽度对齐。
- “Top”文字与右侧数字输入框需要稳定的横向间距。
- 标题栏不应出现右侧滚动条，弹窗内容需要在标题栏下方独立滚动。
- 弹窗拖拽和缩放范围需要限制在地图页面容器内，避免越出地图工作区。

## Screenshot location
- Pending

## Rollback method
- 使用 `git diff src/components/mars-work/mars-map.vue docs/history/2026-07-18-anomaly-identify.md` 查看本次改动。
- 若需手动回滚，恢复 `src/components/mars-work/mars-map.vue` 中异常识别弹窗模板的按钮分组、滚动容器、`.identify-panel` 相关样式块，以及 `getPanelBounds` / `clampIdentifyPanelToMap` / 拖拽缩放边界计算到修改前状态，并移除本 history 文件。
- 若本次改动已提交，优先使用 `git revert <commit>` 回滚该提交。

## Risk
- Level: Low
- Notes: 仅调整“异常识别”弹窗的模板分组、局部样式、滚动区域和 UI 拖拽边界，不修改业务逻辑、API、数据结构或地图运行流程。

## Completion status
- Completed
