# 2026-07-21 Dataset Repository（详情「更多」菜单图标）

## Modification purpose
- 美化列表详情页「更多」下拉中 5 个操作的线性图标
- 删除「专题制图」与「清除导入」之间的分割线

## Modified files
- src/widgets/basic/dataset-repository/components/DatasetDetail.vue

## Reason for change
- 原菜单使用 emoji，与站点 mars-icon 线性风格不一致
- 图标应对齐侧栏/图层树既有语义：下载、图层叶子、图层、工作台、删除

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/DatasetDetail.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅「更多」菜单图标与分割线；菜单 key / 点击逻辑未改

## Completion status
- Completed

---

# 2026-07-21 Dataset Repository（导入成功面板）

## Modification purpose
- 美化列表详情页「导入成功」提示面板视觉与间距

## Modified files
- src/widgets/basic/dataset-repository/components/ImportSuccessToast.vue

## Reason for change
- 去掉成功对勾圆形图标，标题左对齐
- 去掉左侧强调边线
- 三个操作用圆角背景按钮并左右铺齐
- 与下方「保存成果」信息面板拉开 16px 间距

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/dataset-repository/components/ImportSuccessToast.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅导入成功面板 UI；定位 / 打开图层 / 撤销逻辑未改

## Completion status
- Completed
