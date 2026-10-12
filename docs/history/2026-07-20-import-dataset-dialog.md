# 2026-07-20 Import Dataset Dialog（导入使用标题与分割线）

## Modification purpose
- 同层级面板标题字号在现有基础上 +2px
- 标题下方增加左右留白的分割线（不贴边）

## Modified files
- src/widgets/basic/dataset-repository/components/ImportDatasetDialog.vue

## Reason for change
- 导入来源、导入策略等同层级区块区分不够清晰
- 仅做轻量视觉调整，不改布局结构与功能

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/ImportDatasetDialog.vue`
- 或移除 `.import-use-form` 相关样式与 `class="import-use-form"`，恢复 `.fine-tune-panel__title` 为 `font-size: 13px` 并无 `::after`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅样式与 class；表单字段与提交流程未改

## Completion status
- Completed

---

# 2026-07-20 Import Dataset Dialog（分割线位置修正）

## Modification purpose
- 将分割线从「标题与内容之间」改为「同级板块与板块之间」

## Modified files
- src/widgets/basic/dataset-repository/components/ImportDatasetDialog.vue

## Reason for change
- 分割线应出现在例如「导入来源」整块与「导入策略」整块之间，而不是标题与控件之间

## Screenshot location
- Pending

## Rollback method
- 恢复 `.import-use-form :deep(.ant-form-item-label)::after` 标题下分割线，并移除板块间 `ant-form-item::after`
- 或 `git checkout HEAD -- src/widgets/basic/dataset-repository/components/ImportDatasetDialog.vue`

## Risk
- Level: Low
- Notes: 仅分割线位置样式

## Completion status
- Completed
