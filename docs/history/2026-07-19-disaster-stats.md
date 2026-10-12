# 2026-07-19 Disaster Stats

## Modification purpose
- 还原综合统计面板五个统计卡片列表的右侧短线式快速定位导航。
- 恢复为正常的列表滚动方式，保留标题栏刷新图标恢复弹窗初始位置的交互。

## Modified files
- `src/components/mars-work/mars-map.vue`
- `docs/history/2026-07-19-disaster-stats.md`

## Reason for change
- 上一轮为五个统计卡片增加了类似 Codex 任务历史记录的右侧短线导航，但当前需求要求恢复正常列表滑动方式。
- 综合统计面板卡片列表应继续使用原有滚轮和滚动条上下浏览，避免额外的右侧跳转入口影响列表区域。

## Screenshot location
- Pending

## Rollback method
- 如需回到本次还原前的短线导航方案，可重新恢复 `statsScrollEl`、`statsCardEls`、`setStatsCardEl`、`scrollToStatsCard`、模板中的 `stats-section-rail` 区块，以及 `.stats-section-*` 样式。
- 如需完整撤销当前仍保留的标题栏位置复位按钮，可将 `src/components/mars-work/mars-map.vue` 中标题栏刷新按钮的 `@click` 从 `resetStatsPanelPosition` 改回 `refreshStats`，并移除 `resetStatsPanelPosition` 函数。

## Risk
- Level: Low
- Notes: 仅移除综合统计面板内短线导航相关模板、局部状态、跳转函数和样式；未修改统计计算、API、导出、上图展示、自动刷新和地图业务逻辑。

## Completion status
- Completed

---

# 2026-07-19 Disaster Stats Message Layer Correction

## Modification purpose
- 恢复导出 JSON、导出 CSV、保存快照的原有全局文字提示弹窗。
- 将刷新复位和自动刷新开关提示改为同样使用原有 `$message` 弹窗。
- 提升全局 message 层级，避免被左上角综合统计面板遮挡。

## Modified files
- `src/components/mars-work/mars-map.vue`
- `src/styles/theme.css`
- `docs/history/2026-07-19-disaster-stats.md`

## Reason for change
- 上一轮误将导出与保存快照提示改成综合面板局部提示，偏离了“参考原有文字提示弹窗”的要求。
- 问题本质是提示弹窗在图层层级上被综合统计面板遮挡，应调整 message 层级，而不是替换提示机制。

## Screenshot location
- Pending

## Rollback method
- 如需撤销 message 层级调整，删除 `src/styles/theme.css` 中 `.ant-message { z-index: 11000 !important; }`。
- 如需恢复局部提示方案，重新加入 `statsResetToastVisible`、`statsResetToastText`、`showStatsPanelToast`、模板中的 `.stats-reset-toast`，并把指定操作改回 `showStatsPanelToast(...)`。

## Risk
- Level: Medium
- Notes: 涉及全局 message 层级，但仅改变文字提示弹窗的遮挡顺序；未修改统计计算、导出内容、保存快照数据、自动刷新定时逻辑、API 或地图业务逻辑。

## Completion status
- Completed

---

# 2026-07-19 Disaster Stats Panel Toast Consolidation

## Modification purpose
- 统一综合统计面板内刷新、自动刷新、导出 JSON、导出 CSV、保存快照的文字提示位置。
- 确保这些提示都浮于综合统计面板上方。

## Modified files
- `src/components/mars-work/mars-map.vue`
- `docs/history/2026-07-19-disaster-stats.md`

## Reason for change
- 之前仅刷新复位使用局部提示，其余操作仍走全局 `$message`，提示位置不一致。
- 自动刷新开关缺少打开/关闭后的明确文字反馈。
- 导出与保存快照按钮的成功、失败或无数据提示应与综合统计面板绑定显示。

## Screenshot location
- Pending

## Rollback method
- 如需恢复全局提示，将 `exportJSON`、`exportCSV`、`saveStatsPlayback`、`resetStatsPanelPosition` 和 `handleStatsAutoRefreshChange` 中的 `showStatsPanelToast(...)` 改回对应 `$message(...)` 调用。
- 如需撤销自动刷新开关提示，移除 `a-switch` 上的 `@change="handleStatsAutoRefreshChange"`，并删除 `handleStatsAutoRefreshChange` 函数。
- 如需恢复固定复位提示文本，移除 `statsResetToastText`，并将模板中的 `{{ statsResetToastText }}` 改回静态文案。

## Risk
- Level: Low
- Notes: 仅复用综合统计面板局部提示层；未修改导出内容、保存快照数据、自动刷新定时逻辑、统计计算、API 或地图业务逻辑。

## Completion status
- Completed

---

# 2026-07-19 Disaster Stats Refresh Button And Title State

## Modification purpose
- 将综合统计面板标题栏左侧于关闭按钮的刷新图标按钮名称恢复为“刷新”。
- 保留点击刷新图标后的“已恢复弹窗初始位置”文字提示，并让提示浮于综合统计面板上方。
- 修复点击刷新图标后标题文字或标题区域出现高亮背景的问题。

## Modified files
- `src/components/mars-work/mars-map.vue`
- `docs/history/2026-07-19-disaster-stats.md`

## Reason for change
- 刷新图标按钮虽用于恢复弹窗位置，但按钮名称仍应显示为“刷新”，符合用户识别习惯。
- 提示文字需要作为综合统计面板的局部浮层存在，而不是被删除或退回全局消息。
- 标题栏作为拖拽区域时不应触发文字选择或点击高亮，标题视觉状态应保持稳定。

## Screenshot location
- Pending

## Rollback method
- 如需恢复按钮旧命名，将刷新图标按钮的 `title` 和 `aria-label` 从 `刷新` 改回 `恢复初始位置`。
- 如需恢复全局消息提示，删除模板中的 `.stats-reset-toast`，恢复 `resetStatsPanelPosition` 内的 `$message("已恢复弹窗初始位置", "success")`。
- 如需撤销标题防高亮样式，移除 `.stats-toolbar` 和 `.stats-title` 上新增的 `user-select`、`focus/active/selection` 规则。

## Risk
- Level: Low
- Notes: 仅调整综合统计面板标题栏按钮命名、局部提示浮层和标题点击状态；未修改统计计算、API、导出、自动刷新、上图展示和地图业务逻辑。

## Completion status
- Completed

---

# 2026-07-19 Disaster Stats Switch Override And Local Toast

## Modification purpose
- 强制将自动刷新开关本体渲染为胶囊开关。
- 将点击标题栏刷新图标后的“已恢复弹窗初始位置”提示改为综合面板上方的局部浮层。

## Modified files
- `src/components/mars-work/mars-map.vue`
- `docs/history/2026-07-19-disaster-stats.md`

## Reason for change
- 全局按钮和 Ant Design Vue 默认开关样式会覆盖弱选择器，上一轮样式没有稳定作用到 `a-switch` 根节点和滑块。
- 全局 `$message` 提示位置不跟随综合统计面板，无法满足提示浮于弹窗上方的要求。

## Screenshot location
- Pending

## Rollback method
- 如需撤销开关本体强覆盖，移除 `stats-auto-refresh-switch` class 以及 `.disaster-stats .stats-auto-refresh-switch.*` 样式规则。
- 如需恢复全局消息提示，删除 `statsResetToastVisible`、`statsResetToastTimer`、`statsResetToastStyle`、`showStatsResetToast` 和模板中的 `.stats-reset-toast`，并在 `resetStatsPanelPosition` 中重新调用 `$message("已恢复弹窗初始位置", "success")`。

## Risk
- Level: Low
- Notes: 仅调整综合统计面板标题栏开关外观和复位提示展示层；未修改自动刷新逻辑、统计计算、API、导出、上图展示和地图业务逻辑。

## Completion status
- Completed

---

# 2026-07-19 Disaster Stats Switch And Initial Position

## Modification purpose
- 修正自动刷新控件的胶囊设计，仅将开关本体改为胶囊开关。
- 将综合统计面板默认初始位置调整为地图页面左上角贴边。

## Modified files
- `src/components/mars-work/mars-map.vue`
- `docs/history/2026-07-19-disaster-stats.md`

## Reason for change
- 上一轮误将自动刷新文字和外层容器做成胶囊按钮边框，不符合“开关按钮本体改为胶囊开关”的要求。
- 综合统计面板首次打开和点击标题栏刷新图标复位时，应出现在地图区域左上角贴边，而不是保留 12px 间距。

## Screenshot location
- Pending

## Rollback method
- 如需撤销开关本体胶囊样式，恢复 `.auto-refresh :deep(.ant-switch)` 和 `.ant-switch-handle` 的原始圆角与尺寸规则。
- 如需恢复非贴边初始位置，将 `.disaster-stats` 的 `top: 0; left: 0;` 改回 `top: 12px; left: 12px;`。
- 如需撤销整个统计面板复位逻辑，将标题栏刷新按钮的 `@click` 从 `resetStatsPanelPosition` 改回 `refreshStats`，并移除 `resetStatsPanelPosition` 函数。

## Risk
- Level: Low
- Notes: 仅调整综合统计面板标题栏开关视觉和弹窗默认定位；未修改自动刷新状态逻辑、统计计算、API、导出、上图展示和地图业务逻辑。

## Completion status
- Completed

---

# 2026-07-19 Disaster Stats UI Position And Toolbar

## Modification purpose
- 将综合统计面板标题栏的自动刷新控件调整为胶囊样式。
- 将综合统计面板初始位置重新定义为地图区域左上角。
- 将综合统计面板拖拽活动空间限制在地图页面内，避免超出地图右侧边界。

## Modified files
- `src/components/mars-work/mars-map.vue`
- `docs/history/2026-07-19-disaster-stats.md`

## Reason for change
- 裸开关样式与标题栏其他工具按钮层级不够统一，需要使用胶囊容器提升可识别性。
- 原默认 CSS 使用右上角定位，点击标题栏刷新图标恢复位置时会回到右侧，不符合当前“左上角为初始位置”的预期。
- 统计面板拖拽边界原先按浏览器窗口计算，在地图不是完整窗口宽度时可能越过地图容器右侧。

## Screenshot location
- Pending

## Rollback method
- 如需撤销自动刷新胶囊样式，移除 `.auto-refresh-pill` 和 `.auto-refresh-text` 结构及样式，恢复为仅包裹 `a-switch` 的 `.auto-refresh`。
- 如需恢复右上角初始位置，将 `.disaster-stats` 的 `left: 12px; right: auto;` 改回 `right: 12px;`，并让标题栏复位按钮继续清空 `statsPanelPos.left/top`。
- 如需撤销地图容器边界限制，将 `getPanelBounds("stats")` 恢复为使用 `window.innerWidth/window.innerHeight`，并移除 `clampStatsPanelToMap` 在打开与 resize 时的调用。

## Risk
- Level: Medium
- Notes: 修改位于地图核心组件，但仅影响综合统计面板弹窗 UI、初始定位和拖拽边界；未修改统计计算、API、导出、上图展示和自动刷新业务逻辑。

## Completion status
- Completed
