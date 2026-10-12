# 2026-07-20 Dataset Detail（更多菜单去分隔线）

## Modification purpose
- 【更多】菜单中删除「下载ZIP」与「图层/版本」之间的分隔线

## Modified files
- src/widgets/basic/dataset-repository/components/DatasetDetail.vue

## Reason for change
- 两项同属操作列表，无需中间分割

## Screenshot location
- Pending

## Rollback method
- 在 downloadZip 与 layerVersion 之间恢复 `<a-menu-divider />`
- 或 `git checkout HEAD -- src/widgets/basic/dataset-repository/components/DatasetDetail.vue`

## Risk
- Level: Low

## Completion status
- Completed
