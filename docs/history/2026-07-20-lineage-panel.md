# 2026-07-20 Lineage Panel（血缘关系树状呈现）

## Modification purpose
- 将【数据集仓库】详情页「血缘关系」从平铺分区改为父子树状图
- 最多展示 3 级：父级/来源 → 当前 → 派生

## Modified files
- src/widgets/basic/dataset-repository/components/LineagePanel.vue

## Reason for change
- 原展示为父/来源/当前/派生分区列表，父子层级不够直观
- 产品要求以树状图呈现，并限制最多 3 层

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/LineagePanel.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅展示结构改为 a-tree；血缘数据加载与点击跳转仍沿用原逻辑，未改 API

## Completion status
- Completed
