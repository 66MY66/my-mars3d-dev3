# 2026-07-20 Dataset Detail（同步提示条深色可读）

## Modification purpose
- 深色模式下优化详情页「检测到数据集更新，已自动刷新」提示条 UI
- 参照保存成果弹窗草稿提示条样式，文字内容不变；文字与按钮间不加分割线

## Modified files
- src/widgets/basic/dataset-repository/components/DatasetDetail.vue

## Reason for change
- 原 a-alert 使用浅色硬编码，深色主题下可读性差

## Screenshot location
- Pending

## Rollback method
- 恢复为 `a-alert.sync-hint` 结构与原浅色样式
- 或 `git checkout HEAD -- src/widgets/basic/dataset-repository/components/DatasetDetail.vue`

## Risk
- Level: Low
- Notes: 仅提示条外观；刷新/关闭逻辑未改

## Completion status
- Completed
