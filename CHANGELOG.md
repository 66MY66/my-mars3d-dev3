# Changelog

## Unreleased

### Changed
- Stats Overlay（上图展示）：回滚圆锥，恢复原站 `BoxEntity` 方柱 + 顶部标签（`src/components/mars-work/mars-map.vue`）。
- Split Screen Compare：分割线仅实时演示显示并可拖动；工具栏增加时间轴演化入口；简化文案与表单行布局（`src/widgets/basic/split-screen-compare/index.vue`）。
- Sidebar：展开时底部收起图标右对齐；收起态仍居中（`src/shell/Sidebar.vue`）。
- Sidebar：「分屏对比」图标中竖线略加长（似「中」），尺寸不变（`src/shell/icons.ts`）。
- Manage Basemap：地形开关改为「文字左 / 开关右」，开关为圆柱胶囊形圆钮；去掉文字+开关背景框（`src/widgets/basic/manage-basemap/index.vue`）。
- Map 悬浮球：改为站点主色纯亮蓝实心圆，去掉渐变（`src/shell/components/MapFloatBall.vue`）。
- Manage Layers：取消「数据图层 / 三维数据 / 基础底图」等分组滚动吸顶，恢复随列表正常滚动；保留引导线与透明度滑栏布局改动（`src/widgets/basic/manage-layers/index.vue`）。

### Added
- Map：蓝色圆球悬浮按钮，可拖动并记忆位置（`src/shell/components/MapFloatBall.vue`，挂载于 `src/pages/map/App.vue`）。
- Theme variables and dark/light switch via `data-theme` in [theme.css](file:///d:/work/mars3d/src/styles/theme.css).
  - LocalStorage key: `theme`
  - Event: `window.dispatchEvent(new CustomEvent('themeChange'))`
- Collapsible left sidebar (60 FPS transform animation).
  - LocalStorage key: `sidebar_collapsed` (`1` collapsed, `0` expanded)
  - Event: `window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed } }))`
- Icon-based top toolbar driven by JSON config: [toolbar.json](file:///d:/work/mars3d/src/config/toolbar.json).
  - Supports permission code field `permission`
  - Supports action types: `widget.toggle`, `widget.open`, `widget.close`
- CUI iframe dock at `/cui-chat` with postMessage bridge (protocol v1.0.0).
  - Outbound context: `{ type:'app.context', data:{ pageId, userId, theme } }`
  - Inbound command: `{ type:'cmd.execute', payload:{ cmd, args } }`
  - Response: `{ type:'cmd.result', payload:{ cmd, success, data?, error? } }`

### Commands (MVP)
- `theme.switch` args: `{ mode: 'light' | 'dark' }`
- `sidebar.toggle` args: none
- `widget.refresh` args: `{ id: string }`

