# 2026-07-18 Manage Basemap（地形开关样式）

## Modification purpose
- 标题栏「地形」文字在左、开关在右
- 开关改为圆柱/胶囊形（圆形滑钮）

## Modified files
- src/widgets/basic/manage-basemap/index.vue

## Reason for change
- 优化底图弹窗标题栏地形开关的布局与形态

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/manage-basemap/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅标题栏控件顺序与外观；地形开关业务逻辑未改

## Completion status
- Completed

---

# 2026-07-18 Manage Basemap（地形开关去背景框）

## Modification purpose
- 去掉标题栏「地形」文字 + 胶囊开关的背景框

## Modified files
- src/widgets/basic/manage-basemap/index.vue

## Reason for change
- 用户要求文字与开关无边框、无背景，仅保留控件本身

## Screenshot location
- Pending

## Rollback method
- 恢复 `.terrain-toggle` 的 border / background / padding
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅外观

## Completion status
- Completed
