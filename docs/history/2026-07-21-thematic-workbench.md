# 2026-07-21 Thematic Workbench（未保存提示面板）

## Modification purpose
- 优化深色主题下「存在未保存编辑内容」提示面板可读性

## Modified files
- src/widgets/basic/thematic-workbench/index.vue

## Reason for change
- 深色版式下 ant-alert 默认底色/文字对比不足，提示难以辨认
- 参照分屏对比弹窗 tip 面板：蓝透底、边框与高对比文字

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/thematic-workbench/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅未保存提示面板视觉；未改草稿保存/关闭确认逻辑

## Completion status
- Completed

---

# 2026-07-21 Thematic Workbench（标题栏按钮 / 页签 / 画板工具栏）

## Modification purpose
- 标题栏「图表展示 / 保存草稿 / 最小化」改为圆角背景框按钮
- 「模板库 / 编辑 / 发布」页签字体对齐弹窗标题
- 画板「下载 / 画板尺寸」由居中改为右对齐

## Modified files
- src/widgets/basic/thematic-workbench/index.vue

## Reason for change
- 标题栏按钮需明确圆角背景框（10px），非胶囊弱边框
- 页签需与「专题制图工作台」标题字号/字重一致（16px / 600）
- 画板操作区应靠右，避免中间打断提示文案

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/thematic-workbench/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅视觉与工具栏布局；下载 / 画板尺寸 / 缩放逻辑未改

## Completion status
- Completed
