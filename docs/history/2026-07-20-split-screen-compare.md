# 2026-07-20 Split Screen Compare

## Modification purpose
- 正常态隐藏标题栏「时间轴演化」；仅「实时演示」态显示「时间轴演示」图标（侧栏 Play，暂不接功能）
- 双视图下底部经纬度状态条跨左右全宽，层级在视图之上，不随分屏比例变化

## Modified files
- src/widgets/basic/split-screen-compare/index.vue
- src/widgets/basic/split-screen-compare/map.ts

## Reason for change
- 时间轴入口应随实时演示态出现，避免正常浮动弹窗干扰
- locationBar 原挂在左侧地图容器内，分屏后仅覆盖左视图且宽度随滑块变化

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/split-screen-compare/index.vue src/widgets/basic/split-screen-compare/map.ts`
- 或 `git revert <commit>`
- 手动回滚：恢复标题栏 video/「时间轴演化」按钮与 `openTimelinePlayer`；移除 `pinLocationBarFullSpan` / `restoreLocationBarHost` 及相关 CSS

## Risk
- Level: Medium
- Notes: locationBar 会临时挂到双视图父容器，退出分屏时需还原；未改影像加载与分屏业务逻辑

## Completion status
- Completed

---

# 2026-07-20 Split Screen Compare（标题栏提示与图标）

## Modification purpose
- 实时演示态：将「拖动滑块或中间分割线…」提示移到标题栏并相对弹窗居中（字号/色号不变）
- 标题栏左侧显示有效图标（参照底图/图层弹窗）

## Modified files
- src/widgets/basic/split-screen-compare/index.vue
- src/pages/map/widget-store.ts

## Reason for change
- 提示原在内容区顶部，实时演示时更适合放在标题栏居中
- 原 `icon="compare"` 在 icon-park 中不存在，标题左侧图标空白；改为 `column` 与侧栏一致

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/split-screen-compare/index.vue src/pages/map/widget-store.ts`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅标题栏提示位置与图标名；无业务逻辑改动

## Completion status
- Completed

---

# 2026-07-20 Split Screen Compare（内容区左右边距对齐）

## Modification purpose
- 统一内容面板与弹窗边框的左右间距，与标题栏左右对齐

## Modified files
- src/widgets/basic/split-screen-compare/index.vue

## Reason for change
- 原先 `mars-dialog__content` 默认 padding 与 `.panel-body` 的 15px 叠加，左右边距大于标题栏且不统一

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/split-screen-compare/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅内边距；无业务逻辑改动

## Completion status
- Completed
