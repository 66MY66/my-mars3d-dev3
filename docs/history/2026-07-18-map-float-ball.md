# 2026-07-18 Map Float Ball（蓝色悬浮球）

## Modification purpose
- 地图页面增加可拖动的蓝色圆球悬浮按钮

## Modified files
- src/shell/components/MapFloatBall.vue（新建）
- src/pages/map/App.vue

## Reason for change
- 提供可自然拖动的蓝色圆形悬浮按钮

## Screenshot location
- Pending

## Rollback method
- 移除 App.vue 中的 MapFloatBall 引用，并删除 MapFloatBall.vue
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 纯 UI；位置持久化 localStorage key: `map_float_ball_pos_v1`；暂无业务点击逻辑

## Completion status
- Completed

---

# 2026-07-18 Map Float Ball（纯色亮蓝）

## Modification purpose
- 悬浮球改为纯色亮蓝实心圆，去掉渐变/高光立体效果

## Modified files
- src/shell/components/MapFloatBall.vue

## Reason for change
- 对齐站点主色 `--color-primary`（#2d8cf0）

## Screenshot location
- Pending

## Rollback method
- 恢复渐变背景样式，或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅外观

## Completion status
- Completed
