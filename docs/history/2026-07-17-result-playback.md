# 2026-07-17 Result Playback

## Modification purpose
- 当前快照名称增加序号（上新下旧）；弹窗底部固定分页，每页 15 条

## Modified files
- src/widgets/basic/result-playback/index.vue

## Reason for change
- 快照名称需带数字序号，便于区分新旧；最新在顶部序号更大（如 2.xxx）
- 列表超过 15 条时需底部分页固定栏浏览

## Screenshot location
- Pending

## Rollback method
- `git checkout HEAD -- src/widgets/basic/result-playback/index.vue`
- 或对包含该文件的提交执行 `git revert <commit>`

## Risk
- Level: Low
- Notes: 仅展示层编号与分页；保存/回放逻辑未改

## Completion status
- Completed
