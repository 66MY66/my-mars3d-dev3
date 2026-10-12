# 2026-07-20 Manage Layers（关闭后回到数据集详情）

## Modification purpose
- 从数据集仓库详情「更多 → 打开图层管理」进入图层弹窗后，点击右上角关闭应回到对应数据集详情页

## Modified files
- src/widgets/basic/dataset-repository/components/DatasetDetail.vue
- src/widgets/basic/manage-layers/index.vue
- src/widgets/basic/dataset-repository/index.vue

## Reason for change
- 图层与数据集仓库同属 right-panel，打开图层会隐藏仓库面板；关闭图层后未重新激活，导致无法回到详情

## Screenshot location
- Pending

## Rollback method
- 移除 `returnTo` / `returnCollectionId` 传参、`handleDialogClosed` 与 `restoreDetailIfNeeded`
- 或按文件分别 `git checkout HEAD -- <file>`

## Risk
- Level: Medium
- Notes: 涉及面板切换回跳；仅对带 `returnTo=dataset-repository` 的打开路径生效，不影响侧栏直接打开图层

## Completion status
- Completed
