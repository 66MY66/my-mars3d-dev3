# 2026-07-20 Dataset Entry（排序正序/倒序按钮）

## Modification purpose
- 参照【我的仓库】，在数据集仓库排序下拉右侧增加正序/倒序图标按钮
- 缩短标签筛选宽度，为排序控件腾出空间

## Modified files
- src/widgets/basic/dataset-repository/components/DatasetEntry.vue

## Reason for change
- 数据集仓库原先仅支持固定倒序，缺少与「我的仓库」一致的排序方向切换

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/DatasetEntry.vue`
- 或移除 `sortOrder` / `toggleSortOrder` / `.sort-order-btn`，恢复标签 `max-tag-count="2"` 与原排序逻辑
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅筛选排序方向与布局；列表数据加载与业务逻辑未改

## Completion status
- Completed

---

# 2026-07-20 Dataset Entry（排序按钮去边框与标签栏拉宽）

## Modification purpose
- 去掉正序/倒序图标按钮的正方形背景边框
- 拉长标签筛选宽度，使标签筛选、排序下拉、排序按钮同行左右对齐

## Modified files
- src/widgets/basic/dataset-repository/components/DatasetEntry.vue

## Reason for change
- 方框按钮视觉过重；标签筛选过窄导致同行控件未铺满对齐

## Screenshot location
- Pending

## Rollback method
- 恢复 `.sort-order-btn` 的 border/background/radius，并为 `.tag-select` 加回 `max-width: 42%`
- 或 `git checkout HEAD -- src/widgets/basic/dataset-repository/components/DatasetEntry.vue`

## Risk
- Level: Low
- Notes: 仅筛选区布局与按钮外观

## Completion status
- Completed
