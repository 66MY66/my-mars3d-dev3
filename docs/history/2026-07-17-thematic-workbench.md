# 2026-07-17 Thematic Workbench

## Modification purpose
- 在「图表展示」面板增加「画板展示」模式，支持画板排布、缩放与继续添加图表

## Modified files
- src/widgets/basic/thematic-workbench/index.vue

## Reason for change
- 原图表面板仅为纵向列表，无法自由排布
- 在「添加图表」左侧增加「画板展示」图标按钮，切换后以网格画板呈现图表卡片
- 画板支持拖拽移动、右下角拉伸、滚轮/工具栏缩放，并保持「添加图表」可用

## Screenshot location
- Pending

## Rollback method
- 恢复 `src/widgets/basic/thematic-workbench/index.vue` 至修改前版本：
  - `git checkout HEAD -- src/widgets/basic/thematic-workbench/index.vue`
  - 或对包含该文件的提交执行 `git revert <commit>`

## Risk
- Level: Medium
- Notes: 新增画板交互与图表布局字段（x/y/w/h）；列表/画板切换时需 ECharts 重绘；未改模板/草稿/发布业务逻辑

## Completion status
- Completed

---

# 2026-07-17 Thematic Workbench（画板交互增强）

## Modification purpose
- 画板改为左键平移视图、滚轮缩放；工具栏居中增加下载与画板尺寸

## Modified files
- src/widgets/basic/thematic-workbench/index.vue

## Reason for change
- 提示与交互对齐：左键移动视图，滚轮缩放视图
- 同行居中增加「下载」「画板尺寸」下拉：当前视图/画板；1920*1080 / 1080*1080 / 自定义
- 保留缩放按钮、图表卡片、右下角拉伸等既有界面

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/thematic-workbench/index.vue`
- 或对该提交执行 `git revert <commit>`

## Risk
- Level: Medium
- Notes: 交互从卡片拖拽改为视口平移；新增本地 PNG 导出与画板尺寸状态；未改专题业务逻辑

## Completion status
- Completed

---

# 2026-07-17 Thematic Workbench（图表拖拽与头部按钮统一）

## Modification purpose
- 恢复画板图表拖拽移动；统一工作台右上角文字按钮圆角样式

## Modified files
- src/widgets/basic/thematic-workbench/index.vue

## Reason for change
- 此前左键仅平移视图，导致图表无法移动；现拖拽图表移动，空白处仍平移，右下角拉伸缩放
- 将入口标签 / 图表展示 / 保存草稿 / 最小化统一为 `header-text-btn` 圆角文字按钮

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/thematic-workbench/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅交互与头部样式；业务逻辑未改

## Completion status
- Completed

---

# 2026-07-17 Thematic Workbench（八角缩放 / 磁吸 / 下拉按钮）

## Modification purpose
- 画板图表支持四角等比、四边单向缩放；移动缩放带轻量磁吸；下载/画板尺寸改为下拉按钮样式

## Modified files
- src/widgets/basic/thematic-workbench/index.vue

## Reason for change
- 缩放手柄扩展为 8 个：角等比、边单向
- 移动与缩放时对其他图表与画板边界做 8px 上下左右磁吸对齐
- 「下载」「画板尺寸」增加右侧下拉箭头，圆角边框对齐站点下拉按钮

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/thematic-workbench/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Medium
- Notes: 交互复杂度上升；未改专题业务逻辑

## Completion status
- Completed
