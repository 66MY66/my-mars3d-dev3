# 2026-07-18 Context Menu

## Modification purpose
- Resolve the duplicate map right-click menu issue and keep only one UI list for the same menu functions.

## Modified files
- `config/config.json`
- `public/config/config.json`
- `src/components/mars-work/mars-map.vue`

## Reason for change
- The Mars3D default context menu and the project custom context menu were both active.
- Both menus exposed overlapping actions such as thematic mapping, marking, drawing, anomaly detection, and workspace cleanup, causing two visually different lists to appear.
- The development runtime may load the public config copy, so the default menu must also be disabled in `public/config/config.json`.

## Screenshot location
- Pending

## Rollback method
- Set `control.contextmenu.hasDefault` in `config/config.json` back to `true`.
- Set `control.contextmenu.hasDefault` in `public/config/config.json` back to `true`.
- Remove `e.stopPropagation()` and `e.stopImmediatePropagation()` from the `canvas.oncontextmenu` handler in `src/components/mars-work/mars-map.vue`.

## Risk
- Level: Medium
- Notes: The change touches the central map component, but only right-click menu initialization/event handling is affected. Existing menu callbacks, API calls, data processing, and other panels are not changed.

## Completion status
- Pending verification
