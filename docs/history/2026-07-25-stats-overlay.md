# 2026-07-25 Stats Overlay（山锥上图）

## Modification purpose
- 上图展示改为底宽顶尖的圆锥/山锥形态（参考用户提供示意图）
- 关键信息移至锥底；保留原站五档语义色与站点浮层文字风格
- 生长轴仍对齐当前视图 Y

## Modified files
- src/components/mars-work/mars-map.vue

## Reason for change
- 用户要求参照 GIS 山锥示意图优化三维柱形态
- 关键信息在底部更贴近基座阅读习惯，并与深色浮层 UI 一致

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/components/mars-work/mars-map.vue`
- 或恢复 BoxEntity + 顶部标签实现

## Risk
- Level: Medium
- Notes: CylinderEntity 圆锥；相机移动后重绘；颜色档位未改

## Completion status
- Completed

---

# 2026-07-25 Stats Overlay（细长锥 + 面积粗细 + 斜俯视）

## Modification purpose
- 底半径按体积约 1/5 缩细（高度不变）
- 锥底粗细随 `metrics.areaM2`（√面积）联动
- 锥体改地理直立；首次上图在过俯视/过平时轻推至约 -48° 斜俯视

## Modified files
- src/components/mars-work/mars-map.vue

## Reason for change
- 用户反馈锥体过粗，需细长造型；粗细应反映统计区面积；需要俯视倾斜立体感

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/components/mars-work/mars-map.vue`
- 或恢复上一版 view-Y 姿态与较大底半径

## Risk
- Level: Medium
- Notes: 仅上图视觉；首次上图可能微调相机 pitch；五档色与数据逻辑未改

## Completion status
- Completed

---

# 2026-07-25 Stats Overlay（回滚圆锥 · 恢复方柱）

## Modification purpose
- 撤销 CylinderEntity 山锥及相关姿态/斜俯视逻辑
- 恢复原站 BoxEntity 方柱 + 顶部标签（半透明、白描边、面积尺度）

## Modified files
- src/components/mars-work/mars-map.vue

## Reason for change
- 用户明确要求恢复正常柱状体，不再使用圆锥

## Screenshot location
- Pending

## Rollback method
- 本次即为回滚；如需再回到山锥，参考本文件前两节

## Risk
- Level: Low
- Notes: 仅上图渲染路径；数据与开关逻辑未改

## Completion status
- Completed
