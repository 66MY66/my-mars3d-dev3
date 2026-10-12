# 2026-07-20 EOAPI Timeline Player

## Modification purpose
- Optimize the UI of the timeline evolution popup.
- Align icon button centering, text spacing, date picker presentation, and the keyframe-only switch with the existing UI design system.
- Refine the date selection highlight, keyframe-only switch background, playback slider alignment, and image drawer search/list alignment.
- Fix the image drawer search input double-background issue and add configurable pagination.
- Convert the image list popup to a module-scoped resizable popup with a two-row minimum size and a default restore action.
- Anchor the image list popup to the map work area, refine the keyframe settings popup spacing, and place the color picker popup below the keyframe settings field.
- Align the image list popup default position and layer with the keyframe settings task-modal behavior.
- Move the image list popup out of the timeline dialog DOM tree so it renders as an independent map-level overlay.

## Modified files
- src/widgets/basic/eoapi-timeline-player/index.vue
- src/components/mars-ui/mars-color-picker/index.ts
- docs/history/2026-07-20-eoapi-timeline-player.md

## Reason for change
- Header toolbar icons and control icons needed explicit center alignment so icons sit visually centered in their button backgrounds.
- The keyframe-only control used the default small switch plus separate text, which did not read as a unified capsule switch.
- The start and end date picker dropdowns needed module-scoped calendar layout rules so the month grid keeps normal calendar ordering and non-current-month dates do not visually fill every row.
- Date cells needed a visible hover/selected background when users choose a day.
- The keyframe-only switch needed its shared rectangular wrapper removed while keeping the switch thumb and label.
- The playback progress value text needed the same right-side width as the opacity value text so both slider tracks end on the same vertical line.
- The image drawer search input and list needed one outer input container and a shared left alignment baseline.
- The image drawer search input needed the inner Ant Design input background removed so only one outer search field frame remains visible.
- The image drawer pagination needed to default to 10 items per page, support 10/20/50 items per page, and show current page, total pages, and total item count.
- The image list popup needed a controlled initial/minimum layout that fully shows two list rows, supports dragging and resizing, and can restore its default size and position from the header.
- The image list popup needed its initial position and drag/resize bounds to be based on the map work area rather than the full browser viewport.
- The keyframe settings popup needed tighter form spacing and control sizing to match the project UI design system.
- The color picker popup needed to open below and left-aligned with the color field, with a higher layer than the keyframe settings popup.
- The image list popup position and layer needed to follow the keyframe settings popup pattern without changing its internal UI.
- The image list popup needed to render above the timeline dialog as an independent layer and use the full map page as its movement and resize boundary.

## Screenshot location
- Pending

## Rollback method
- If committed, revert the exact commit that contains this change.
- Manual rollback: restore `src/widgets/basic/eoapi-timeline-player/index.vue` to the previous switch/date-picker/template and style values, then restore this history file to its previous content.
- No API, data, or business workflow rollback is required because this change only touches UI presentation.

## Risk
- Level: Low
- Notes: The calendar dropdown rules are isolated with `timeline-player-datepicker-dropdown`, so other date pickers should not be affected. The switch still writes to the existing `onlyKeyframes` state and does not change playback logic.
影像列表样式只作用于当前弹窗内的 drawer content，不影响其他列表。

## Completion status
- Completed
- Verification: `npx eslint src/widgets/basic/eoapi-timeline-player/index.vue` passed. `git diff --check` passed. `npx vue-tsc --noEmit --skipLibCheck` is still blocked by an existing unrelated `prevBodyOverflow` error in `src/widgets/basic/current-task/index.vue`.
