# 2026-07-24 Stats Overlay（上图柱体 · 视图化）

## Modification purpose
- 将综合统计「上图展示」由地图米制三维柱改为视图像素柱
- 外观采用方案 A（圆角柱），颜色沿用原站 `getStatsGradientColor` 同系渐变

## Modified files
- src/components/mars-work/mars-map.vue

## Reason for change
- 原 BoxEntity 随地图尺度剧烈变化，阅读不稳定
- DivGraphic 以屏幕像素控制柱高/柱宽，更适合工作台视图
- 强弱分色保持原逻辑：#ff4d4f / #fa8c16 / #fadb14 / #13c2c2 / #2f54eb

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/components/mars-work/mars-map.vue`
- 或 `git revert <commit>`
- 手动回滚：恢复 `renderOverlayForCard` 中 BoxEntity + PointEntity 实现，并移除 `.stats-view-bar*` 样式

## Risk
- Level: Medium
- Notes: 改动位于共享 mars-map.vue，但仅影响综合统计上图渲染；数据与开关逻辑未改

## Completion status
- Completed

---

# 2026-07-24 Stats Overlay（回滚视图柱 · 恢复原柱体）

## Modification purpose
- 撤销 DivGraphic 视图柱改动，恢复原先 BoxEntity 地图三维柱形态

## Modified files
- src/components/mars-work/mars-map.vue

## Reason for change
- 视图柱实现有误，按用户要求恢复为改动前的柱状体形态

## Screenshot location
- Pending

## Rollback method
- 本次即为回滚；如需再回退到视图柱，可参考本文件上一节变更说明

## Risk
- Level: Low
- Notes: 恢复原渲染路径；上图开关与数据逻辑不变

## Completion status
- Completed

---

# 2026-07-24 Stats Overlay（视图尺度三维柱）

## Modification purpose
- 柱高按当前相机/视图高度计算，便于看出高低差
- 保留立体 BoxEntity；去掉描边；不透明度改为 1
- 相机移动结束后同步重绘已上图柱体

## Modified files
- src/components/mars-work/mars-map.vue

## Reason for change
- 原地面面积尺度导致柱体在常见视高下过矮，看不清高度差异
- 用户要求保持三维柱形态，仅改为基于当前视图生长，并去边框、不透明

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/components/mars-work/mars-map.vue`
- 或恢复 footprint/maxHeight 为 `√areaM2` 公式，并还原 outline/opacity

## Risk
- Level: Medium
- Notes: 缩放时会短暂重绘上图柱；颜色与顶标逻辑未改

## Completion status
- Completed

---

# 2026-07-24 Stats Overlay（柱体改沿视图 Y 轴生长）

## Modification purpose
- 将三维柱生长方向从地图海拔 Z 改为当前视图 Y（camera.up）
- 保持立体盒子、不透明、无描边

## Modified files
- src/components/mars-work/mars-map.vue

## Reason for change
- 用户坐标系约定：视图 X/Y，深度 Z；柱体应沿 Y 竖长生长，而非地图 Z 拔高

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/components/mars-work/mars-map.vue`
- 或恢复 `dimensions_z = height` + `position: [lng,lat,height/2]`，去掉 orientation

## Risk
- Level: Medium
- Notes: 相机移动后会重绘以保持 Y 轴对齐；俯视接近垂直时可能退化为 ENU 上方向

## Completion status
- Completed
