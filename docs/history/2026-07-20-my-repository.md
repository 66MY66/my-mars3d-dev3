# 2026-07-20 My Repository（个人数据集分页固定底部）

## Modification purpose
- 参照【数据集仓库】弹窗底部分页设计，将【我的仓库】个人数据集列表的分页固定在弹窗底部
- 拉长列表可滚动区域，占满标题/筛选下方的剩余空间

## Modified files
- src/widgets/basic/my-repository/index.vue

## Reason for change
- 原分页位于列表滚动容器内部，随列表滚动；列表另有 `max-height: 520px` 限制，未充分利用抽屉高度
- 与数据集仓库的「列表区滚动 + 底部分页固定」结构不一致

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/my-repository/index.vue`
- 或手动恢复：
  - 去掉 `.list-section`，将分页放回 `.list` 内
  - 恢复 `.list { max-height: 520px; overflow: auto; }`
  - 恢复分页为 `:current` + `@change="onPageChange"`，去掉 `size="small"` / `show-less-items` / `show-total`
  - 去掉面板 `height: 100%` 与 `:deep(.mars-dialog__content)` 相关样式
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅列表态布局与分页展示；分页数据逻辑、详情页及其他功能未改

## Completion status
- Completed

---

# 2026-07-20 My Repository（加载态 / 筛选控件 / 排序方向）

## Modification purpose
- 加载图标居中，对齐【数据集仓库】
- 【全部状态】【更新时间】下拉与左侧搜索框边框形态一致
- 缩窄排序下拉，右侧增加正序/倒序图标按钮

## Modified files
- src/widgets/basic/my-repository/index.vue

## Reason for change
- `mars-state` 加载态未居中，图标落在左上角
- 下拉使用 `size="small"`，与搜索框高度/边框不一致
- 排序文案原先写死“倒序”，缺少独立正序/倒序切换

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/my-repository/index.vue`
- 或 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅列表态加载展示与筛选/排序 UI；默认仍为更新时间倒序；详情页与 API 未改

## Completion status
- Completed
