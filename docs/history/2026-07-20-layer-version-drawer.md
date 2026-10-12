# 2026-07-20 Layer Version Drawer（深色可读性与圆角统一）

## Modification purpose
- 优化【图层与版本】弹窗在深色模式下的色号，避免浅色硬编码导致内容看不清
- 统一圆角为 `--popup-item-radius`，避免圆角与直角混用

## Modified files
- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue

## Reason for change
- 原样式大量使用 `#fff` / `#fafafa` / `rgba(0,0,0,*)`，深色主题下对比不足
- 内部出现 6px / 8px 混用圆角，与抽屉壳层圆角语言不一致

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue`
- 或恢复 `.block` / `.layer-row` 等为浅色硬编码样式
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅该弹窗 scoped 样式；版本/图层编辑业务逻辑未改。浅色模式改用 token 后仍可读

## Completion status
- Completed

---

# 2026-07-20 Layer Version Drawer（Tabs 固定 / Select 圆角 / 发布按钮）

## Modification purpose
- 「版本 / 图层」切换字号对齐数据集名称（16px/600），并固定在顶部不随内容滚动
- 下拉选择去掉直角双层边框，只保留圆角边框
- 「提交发布 / 取消申请 / 撤回发布」去掉外层板块框，三按钮等宽铺满左右对齐并加大按钮高度（字号不变）

## Modified files
- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue

## Reason for change
- Tabs 随内容滚动不便切换；Select 圆角与直角描边叠加；发布区外框冗余且按钮过窄

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅布局与样式；版本/发布业务逻辑未改

## Completion status
- Completed

---

# 2026-07-20 Layer Version Drawer（版本按钮左对齐 / 图层工具栏 / 列表项规范）

## Modification purpose
- 版本面板：创建/回滚/删除三按钮左对齐，间距统一 8px
- 图层面板：新建目录/新建图层/保存为新版本等宽铺满左右对齐
- 图层列表项（如「高德影像（本地）」）：标题左对齐、下方操作按钮左对齐，间距统一

## Modified files
- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue

## Reason for change
- 版本操作按钮间距过大；图层工具按钮宽度不一致；列表项标题与按钮层级不统一

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅布局与样式

## Completion status
- Completed

---

# 2026-07-20 Layer Version Drawer（图层列表左右对齐统一）

## Modification purpose
- 图层面板中目录层（底图/标注/热红外等）与图层项（高德影像等）内容左对齐统一

## Modified files
- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue

## Reason for change
- 原先按 `depth` 递增 `paddingLeft`，导致目录与叶子项左边不齐

## Screenshot location
- Pending

## Rollback method
- 恢复 `layer-row` 的 `:style="{ paddingLeft: \`\${12 + line.depth * 14}px\` }"`
- 或 `git checkout HEAD -- src/widgets/basic/dataset-repository/components/LayerVersionManagerDrawer.vue`

## Risk
- Level: Low
- Notes: 仅去掉层级缩进样式；父子数据关系未改

## Completion status
- Completed
