# 2026-07-17 Manage Layers

## Modification purpose
- 补齐图层树全层级引导线；分组吸顶；透明度滑栏改到图标+标题下方且勾选框不位移

## Modified files
- src/widgets/basic/manage-layers/index.vue

## Reason for change
- 树默认关闭连线，侧边层级引导不完整
- 「数据图层 / 三维数据」等分组滚动时需吸顶在系统图层下方，便于直接展开
- 勾选后透明度滑栏曾挤压勾选框并打断树线；改为标题下方左对齐布局

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/manage-layers/index.vue`
- 或对包含该文件的提交执行 `git revert <commit>`

## Risk
- Level: Medium
- Notes: 涉及树 showLine、sticky、节点布局；图层显隐/透明度业务逻辑未改

## Completion status
- Completed

---

# 2026-07-17 Manage Layers（引导线连续 / 分组依次吸顶）

## Modification purpose
- 透明度滑栏展开时侧边引导线保持连续；分类分组滑出可视区后依次叠在系统图层下方

## Modified files
- src/widgets/basic/manage-layers/index.vue

## Reason for change
- mars-tree 全局固定竖线高度导致滑栏行引导线中断
- 同级分组共用 top:28px 会互相遮挡；改为 i0/i1/i2… 依次递增吸顶偏移

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/manage-layers/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Medium
- Notes: 仅树视觉与 sticky 偏移；业务逻辑未改

## Completion status
- Completed

---

# 2026-07-17 Manage Layers（取消分组吸顶）

## Modification purpose
- 取消「数据图层 / 三维数据 / 基础底图」等分组滚动吸顶，恢复随列表正常滚动

## Modified files
- src/widgets/basic/manage-layers/index.vue

## Reason for change
- 用户明确要求取消该吸顶交互并恢复原状
- 保留引导线连续与透明度滑栏布局改动

## Screenshot location
- Pending

## Rollback method
- 如需恢复吸顶：重新引入 `applyTreeStickyClasses` 与 `.layer-tree-sticky*` 样式
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅移除 sticky；其他图层 UI 改动保留

## Completion status
- Completed
