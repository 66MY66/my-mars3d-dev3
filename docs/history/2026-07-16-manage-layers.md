# 2026-07-16 图层弹窗（manage-layers）

## Modification purpose
- 底部固定提示栏在弹窗拉宽时支持两行换行，栏高随文字内容自适应。
- 透明度滑条（透明栏）随弹窗宽度拉伸而自适应变宽。
- 树状列表层级连接线改动已按用户要求恢复为原状态。

## Modified files
- `src/widgets/basic/manage-layers/index.vue`
- `docs/history/2026-07-16-manage-layers.md`

## Reason for change
- 底部 `.tips` 使用绝对定位且 footer 固定高度，窄弹窗时提示文字被裁切。
- `.tree-slider-row` 固定 `width: 112px` 且 `left: -28px`，弹窗拉宽后透明度滑条未跟随内容区伸展。
- 用户确认树列连接线（`show-line`）不符合预期，已撤销该部分改动。

## Screenshot location
- Pending

## Rollback method
- 完全回滚本次修改：
  - `git checkout HEAD -- src/widgets/basic/manage-layers/index.vue`
  - `git checkout HEAD -- docs/history/2026-07-16-manage-layers.md`
- 仅撤销底部栏与透明滑条改动：
  - 恢复 `.tips` 绝对定位与 `.tree-slider-row` 的 `left: -28px; width: 112px`；
  - 移除 `.manage-layer_pannel .mars-dialog__footer` 与 `.mars-dialog__content` 的 flex 高度覆盖。

## Risk
- Level: Low
- Notes: 仅图层弹窗视觉与布局；未改动图层勾选、排序、API 或 widget store 逻辑。

## Completion status
- Completed（底部提示栏、透明滑条保留；树列连接线已恢复原版）
