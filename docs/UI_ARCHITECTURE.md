# UI Architecture

## Scope

This document summarizes the current UI architecture of the project without changing any business code.

Project root:

- `P:\VS code\idex\my-mars3d\my-mars3d-dev`

Primary tech stack:

- Vue 3
- Vite
- Vue Router
- Vuex-based widget store
- Ant Design Vue
- Custom `mars-ui` component library
- Mars3D map runtime
- Less + CSS variables

## 1. Project Directory Overview

### Root directories

- `.claude`, `.cursor`
  - Local tool and editor metadata.
- `.github`
  - GitHub workflows and repository automation.
- `config`
  - Runtime and deployment-related configuration assets.
- `coverage`
  - Test coverage outputs.
- `dist`
  - Production build output.
- `docs`
  - Project documentation.
- `docx`
  - Document-related assets or exports.
- `e2e`, `e2e-test-report`, `test-results`
  - End-to-end testing and reports.
- `node_modules`
  - Dependencies.
- `patches`
  - Patched third-party packages.
- `public`
  - Static assets, config, Mars3D runtime assets, thumbnails, images.
- `scripts`
  - Utility scripts, measurement, helpers.
- `src`
  - Main application source.
- `temp_convert`
  - Temporary conversion workspace.

### `src` directories

- `api`
  - API wrappers and service requests.
- `assets`
  - App-level assets such as logo and icons.
- `common`
  - Shared stores, constants, lifecycle hooks, reusable utilities.
- `components`
  - Reusable UI building blocks and core visual containers.
- `config`
  - Frontend config such as toolbar/menu definitions.
- `cui-bridge`
  - Embedded CUI chat/dock integration layer.
- `misc`
  - Miscellaneous utilities or experiments.
- `pages`
  - Page-level entry points.
- `shell`
  - Application frame, top bar, sidebar, theme, notification and shell logic.
- `styles`
  - Global theme and popup shell styles.
- `templates`
  - Template resources.
- `types`
  - Shared TypeScript types.
- `utils`
  - Cross-cutting utilities.
- `widgets`
  - Main business UI modules rendered over the map.

## 2. Entry and Rendering Flow

### Production UI entry

- Entry file: [src/pages/map/main.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\main.ts)
- Root shell: [src/shell/Root.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\Root.vue)
- Router: [src/shell/router.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\router.ts)
- Main page route: [src/pages/map/App.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\App.vue)

### Runtime flow

1. `main.ts` creates the Vue app and installs router, widget store injection, Mars UI, global styles.
2. `Root.vue` renders `<router-view />` and mounts the global login modal.
3. `router.ts` routes `/` to the map workbench and `/cui-chat` to the CUI chat page.
4. `pages/map/App.vue` composes the shell layout, top module selector, map work area, and floating CUI dock.
5. `components/mars-work/main-view.vue` creates the map container and renders widget overlays.
6. `components/mars-work/mars-map.vue` hosts the Mars3D scene and map overlays.
7. `pages/map/widget-store.ts` registers all business UI widgets and maps them to actual components.

## 3. UI Architecture Tree

```text
UI Architecture
├── App Shell
│   ├── Router Root
│   ├── Shell Layout
│   ├── Theme System
│   ├── Notification System
│   └── Login Modal
├── Home / Map Workbench
│   ├── Header
│   │   ├── Brand
│   │   ├── Top Module Dropdown
│   │   ├── Status Bar
│   │   ├── Top Header Menus
│   │   ├── Notifications
│   │   ├── Settings
│   │   └── User Entry
│   ├── Sidebar
│   │   ├── Common Tools
│   │   ├── Thematic Tools
│   │   ├── Data / Repository Tools
│   │   ├── Risk / Monitoring Tools
│   │   └── Collapse Control
│   ├── Main Work Area
│   │   ├── Map Container
│   │   ├── Mars3D Scene
│   │   ├── Map Tooltip / Popup Layer
│   │   ├── Context Menu Layer
│   │   ├── Stats Overlay Panel
│   │   └── Identify Overlay Panel
│   ├── Widget Overlay System
│   │   ├── Toolbar
│   │   ├── Basemap Panel
│   │   ├── Layer Manager
│   │   ├── Query POI
│   │   ├── Tools Manager
│   │   ├── Analysis Tool
│   │   ├── Split Screen Compare
│   │   ├── Timeline Player
│   │   ├── Result Playback
│   │   ├── Dataset Repository
│   │   ├── My Repository
│   │   ├── Save Result
│   │   ├── Current Task
│   │   ├── Location Point
│   │   ├── InSAR Profile
│   │   ├── Thematic Workbench
│   │   ├── Mid-short Macro
│   │   ├── Disaster Loss Assessment
│   │   ├── Hazard Identification
│   │   ├── Knowledge Graph
│   │   └── Alert Confirm
│   └── Floating CUI Dock
│       ├── Dock Button
│       ├── Dock Window
│       └── Embedded CUI Chat Iframe
├── CUI Chat Page
│   └── Standalone embedded chat page
├── Global Design System
│   ├── Mars UI Components
│   ├── Dialog / Task Modal
│   ├── Buttons / Inputs / Selects / Trees
│   └── Theme Tokens
└── Demo Area
    ├── Demo Home
    ├── Demo Map
    └── Demo Widgets
```

## 4. Module Breakdown

### 4.1 App Shell

#### Module: Router Root

- Function
  - Provides top-level route rendering and mounts global page-independent UI.
- Responsible files
  - [src/shell/Root.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\Root.vue)
  - [src/shell/router.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\router.ts)
- Reference relationship
  - Imported by `src/pages/map/main.ts`.
  - Loads the main map page and CUI chat page via router.
- Dependencies
  - Vue Router
  - `LoginModal`
- Can be optimized independently
  - Yes, for route organization and app-level composition.
- Impacts other pages
  - Yes. Changes affect all routes.

#### Module: Shell Layout

- Function
  - Defines the persistent application frame: header, sidebar, content area, floating area.
- Responsible files
  - [src/shell/ShellLayout.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\ShellLayout.vue)
- Reference relationship
  - Used by `src/pages/map/App.vue`.
- Dependencies
  - `Sidebar.vue`
  - `TopStatusBar.vue`
  - `TopHeaderMenus.vue`
  - `TopNotificationsMenu.vue`
  - `TopSettingsMenu.vue`
  - `UserMenu.vue`
  - shell theme and widget store services
- Can be optimized independently
  - Yes, if layout contracts remain stable.
- Impacts other pages
  - High. It defines the main workbench frame.

#### Module: Theme System

- Function
  - Centralizes global color, typography, shadow, popup, radius, dark/light theme tokens.
- Responsible files
  - [src/styles/theme.css](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\styles\theme.css)
  - [src/styles/popup-shell.css](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\styles\popup-shell.css)
  - [src/shell/theme.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\theme.ts)
- Reference relationship
  - Imported globally in `src/pages/map/main.ts`.
  - Used across shell, widgets, dialogs and map overlays.
- Dependencies
  - CSS custom properties
  - Mars UI popup/dialog classes
- Can be optimized independently
  - Yes, but requires regression review.
- Impacts other pages
  - Very high. It affects nearly all visible UI.

#### Module: Notification System

- Function
  - Manages in-app notifications and the notifications dropdown/panel.
- Responsible files
  - [src/shell/notificationStore.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\notificationStore.ts)
  - [src/shell/components/TopNotificationsMenu.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\components\TopNotificationsMenu.vue)
- Reference relationship
  - Mounted in shell header.
- Dependencies
  - `HeaderIconButton.vue`
  - Widget activation service
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Medium. Mainly affects global header behavior.

#### Module: Login Modal

- Function
  - Global login entry modal opened from the header user button.
- Responsible files
  - [src/shell/components/LoginModal.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\components\LoginModal.vue)
  - [src/shell/UserMenu.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\UserMenu.vue)
- Reference relationship
  - `LoginModal` is mounted in `Root.vue`.
  - `UserMenu` emits `openLogin`.
- Dependencies
  - `mars-input`
  - `mars-button`
  - Mars UI message
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Low to medium. Global modal only.

### 4.2 Header Modules

#### Module: Brand Area

- Function
  - Displays product logo and title in the top bar.
- Responsible files
  - [src/shell/ShellLayout.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\ShellLayout.vue)
  - [src/assets/logo.svg](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\assets\logo.svg)
- Reference relationship
  - Inline within shell layout.
- Dependencies
  - Theme tokens
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Medium. Shared shell UI.

#### Module: Top Module Dropdown

- Function
  - Global module selector in the header, dispatches module change and opens corresponding widget.
- Responsible files
  - [src/shell/components/TopModulesDropdown.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\components\TopModulesDropdown.vue)
- Reference relationship
  - Injected into `ShellLayout` from `pages/map/App.vue`.
- Dependencies
  - Widget store
  - Mars UI message
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Medium.

#### Module: Top Status Bar

- Function
  - Shows active module label, sync state, accessibility switch, and current time.
- Responsible files
  - [src/shell/components/TopStatusBar.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\components\TopStatusBar.vue)
- Reference relationship
  - Rendered in shell header.
- Dependencies
  - Dataset sync service
  - Accessibility service
  - Ant switch
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Medium.

#### Module: Top Header Menus

- Function
  - Exposes high-level tool categories such as tool manager and alert confirmation.
- Responsible files
  - [src/shell/components/TopHeaderMenus.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\components\TopHeaderMenus.vue)
- Reference relationship
  - Rendered in shell header.
- Dependencies
  - Widget store
  - `manage-tools/config.ts`
  - Permission service
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Medium.

#### Module: Settings Menu

- Function
  - Theme switching and workspace/session cleanup action.
- Responsible files
  - [src/shell/components/TopSettingsMenu.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\components\TopSettingsMenu.vue)
- Reference relationship
  - Rendered in shell header.
- Dependencies
  - `shell/theme.ts`
  - current dataset service
  - Mars UI message
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Medium to high because it alters theme and session state.

### 4.3 Sidebar Modules

#### Module: Sidebar Navigation

- Function
  - Main left-side navigation for business widgets and grouped tools.
- Responsible files
  - [src/shell/Sidebar.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\Sidebar.vue)
  - [src/config/toolbar.json](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\config\toolbar.json)
  - [src/shell/sidebar.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\sidebar.ts)
- Reference relationship
  - Mounted by `ShellLayout.vue`.
  - Reads toolbar config and opens widgets via widget store.
- Dependencies
  - Permission service
  - Widget store
  - Current dataset service
  - Icon registry
  - Ant tooltip
- Can be optimized independently
  - Yes, if widget names and config contracts remain stable.
- Impacts other pages
  - High for the map workbench.

#### Module: Toolbar Config

- Function
  - Declares sidebar menu item labels, icons, groups, and widget actions.
- Responsible files
  - [src/config/toolbar.json](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\config\toolbar.json)
  - [src/shell/toolbar.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\toolbar.ts)
- Reference relationship
  - Consumed by `Sidebar.vue`.
- Dependencies
  - Widget names from `widget-store.ts`
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Medium to high.

### 4.4 Main Work Area

#### Module: Map Page

- Function
  - Main application page for the production workbench.
- Responsible files
  - [src/pages/map/App.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\App.vue)
  - [src/pages/map/main.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\main.ts)
- Reference relationship
  - Routed from `/`.
- Dependencies
  - Shell layout
  - Main view
  - CUI dock
- Can be optimized independently
  - Partially. It is a page composition layer.
- Impacts other pages
  - High for the main application only.

#### Module: Main View

- Function
  - Wraps the map instance and renders all registered widget overlays.
- Responsible files
  - [src/components/mars-work/main-view.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-work\main-view.vue)
  - [src/components/mars-work/widget.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-work\widget.vue)
- Reference relationship
  - Rendered by `pages/map/App.vue`.
  - Pulls widget definitions from the widget store.
- Dependencies
  - Ant Design Vue `ConfigProvider`
  - widget store
  - Mars map component
- Can be optimized independently
  - Yes, with care around widget lifecycle.
- Impacts other pages
  - High on the map workbench.

#### Module: Mars Map Core

- Function
  - Hosts the actual Mars3D scene, context menu, map overlays, identify panel, stats panel, and map-specific interactions.
- Responsible files
  - [src/components/mars-work/mars-map.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-work\mars-map.vue)
  - [src/components/mars-work/expand](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-work\expand)
- Reference relationship
  - Mounted by `main-view.vue`.
- Dependencies
  - Mars3D
  - ECharts
  - XLSX
  - shell permission/current dataset
  - map services under `src/api` and `src/utils`
- Can be optimized independently
  - Limited. It is central and tightly coupled to map runtime behavior.
- Impacts other pages
  - Very high for all map interactions.

### 4.5 Widget Overlay System

#### Module: Widget Registry

- Function
  - Central registry that maps widget names to asynchronously loaded Vue components.
- Responsible files
  - [src/pages/map/widget-store.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\widget-store.ts)
  - [src/common/store/widget.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\common\store\widget.ts)
- Reference relationship
  - Read by `main-view.vue`, `Sidebar.vue`, header menus, notifications and shell shortcuts.
- Dependencies
  - Vuex
  - all widgets under `src/widgets/basic`
- Can be optimized independently
  - Yes, structurally.
- Impacts other pages
  - Very high on the map workbench.

#### Business widget groups

##### A. Search and quick actions

- `query-poi`
  - Function: POI query panel and popup.
  - Files: [src/widgets/basic/query-poi/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\query-poi\index.vue), [src/widgets/basic/query-poi/query-popup.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\query-poi\query-popup.vue)
  - Dependencies: map runtime, popup styling.
  - Independent optimization: Yes.
  - Cross-page impact: Low outside map page.

- `toolbar`
  - Function: Basic floating map toolbar.
  - Files: [src/widgets/basic/toolbar/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\toolbar\index.vue)
  - Dependencies: widget store, map runtime.
  - Independent optimization: Yes.
  - Cross-page impact: Low.

##### B. Map configuration

- `manage-basemap`
  - Function: Basemap switching and background map presentation.
  - Files: [src/widgets/basic/manage-basemap/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-basemap\index.vue)
  - Dependencies: map runtime, thumbnails in `public`.
  - Independent optimization: Yes.
  - Cross-page impact: Medium within map workbench.

- `manage-layers`
  - Function: Layer tree, layer style, scene tree, thermal and image layer management.
  - Files: [src/widgets/basic/manage-layers/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-layers\index.vue), [scene-tree.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-layers\scene-tree.vue), [picture-heatmap.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-layers\picture-heatmap.vue), [picture-guihua.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-layers\picture-guihua.vue), [thermal-evolution.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-layers\thermal-evolution.vue)
  - Dependencies: map runtime, Mars UI, style editor, related map services.
  - Independent optimization: Partially. Large module with many sub-panels.
  - Cross-page impact: High within map workbench.

##### C. Analysis and comparison

- `manage-tools`
  - Function: Tool catalog / algorithm manager.
  - Files: [src/widgets/basic/manage-tools/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-tools\index.vue), [config.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-tools\config.ts), [KeyMapAction.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\manage-tools\KeyMapAction.vue)
  - Dependencies: tool config, widget store.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

- `analysis-tool`
  - Function: Analysis parameter panel.
  - Files: [src/widgets/basic/analysis-tool/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\analysis-tool\index.vue)
  - Dependencies: map runtime, related analysis APIs.
  - Independent optimization: Partially.
  - Cross-page impact: Medium to high.

- `split-screen-compare`
  - Function: Side-by-side comparison workspace.
  - Files: [src/widgets/basic/split-screen-compare/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\split-screen-compare\index.vue)
  - Dependencies: map runtime and comparison scene controls.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

- `insar-profile`
  - Function: InSAR profile and chart analysis panel.
  - Files: [src/widgets/basic/insar-profile/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\insar-profile\index.vue)
  - Dependencies: map runtime, chart utilities.
  - Independent optimization: Yes.
  - Cross-page impact: Low to medium.

##### D. Timeline and playback

- `eoapi-timeline-player`
  - Function: Time-based playback UI for EO data.
  - Files: [src/widgets/basic/eoapi-timeline-player/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\eoapi-timeline-player\index.vue)
  - Dependencies: timeline state, map runtime.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

- `result-playback`
  - Function: Saved result playback and revisit.
  - Files: [src/widgets/basic/result-playback/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\result-playback\index.vue)
  - Dependencies: playback state and result data.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

##### E. Data, repository, task flow

- `dataset-repository`
  - Function: Dataset repository, import/export, preview, lineage, revisions, panelized asset management.
  - Files: [src/widgets/basic/dataset-repository/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\dataset-repository\index.vue) and subcomponents under `src/widgets/basic/dataset-repository/components`
  - Dependencies: EOAPI services, workspace services, artifacts, dialogs, tables, upload flows.
  - Independent optimization: Partially. It is a large subsystem.
  - Cross-page impact: High within repository and task-related flows.

- `my-repository`
  - Function: User-centric repository management panel.
  - Files: [src/widgets/basic/my-repository/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\my-repository\index.vue)
  - Dependencies: dataset state, tags, table/list UI.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

- `save-result`
  - Function: Save current analysis result.
  - Files: [src/widgets/basic/save-result/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\save-result\index.vue)
  - Dependencies: current task and repository services.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

- `current-task`
  - Function: Current dataset/task context panel.
  - Files: [src/widgets/basic/current-task/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\current-task\index.vue)
  - Dependencies: current dataset service.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

- `import-wizard`
  - Function: Import workflow UI.
  - Files: [src/widgets/basic/import-wizard/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\import-wizard\index.vue)
  - Dependencies: upload/import pipeline.
  - Independent optimization: Yes.
  - Cross-page impact: Low.

- `DatasetImportModal`
  - Function: File upload modal for dataset import.
  - Files: [src/components/Dataset/DatasetImportModal.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\Dataset\DatasetImportModal.vue)
  - Dependencies: `mars-task-modal`, upload services, `shpjs`.
  - Independent optimization: Yes.
  - Cross-page impact: Medium where import is used.

##### F. Monitoring, alerting and thematic panels

- `alert-confirm`
  - Function: Alert confirmation and response UI.
  - Files: [src/widgets/basic/alert-confirm/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\alert-confirm\index.vue)
  - Dependencies: notification flow and task context.
  - Independent optimization: Yes.
  - Cross-page impact: Medium.

- `mid-short-macro`
  - Function: Mid-short macro anomaly monitoring panel.
  - Files: [src/widgets/basic/mid-short-macro/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\mid-short-macro\index.vue)
  - Dependencies: map context and related services.
  - Independent optimization: Yes.
  - Cross-page impact: Low.

- `disaster-loss-assessment`
  - Function: Disaster loss assessment panel.
  - Files: [src/widgets/basic/disaster-loss-assessment/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\disaster-loss-assessment\index.vue)
  - Dependencies: analytics services and map context.
  - Independent optimization: Yes.
  - Cross-page impact: Low.

- `hazard-identification`
  - Function: Hazard identification panel.
  - Files: [src/widgets/basic/hazard-identification/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\hazard-identification\index.vue)
  - Dependencies: map and task context.
  - Independent optimization: Yes.
  - Cross-page impact: Low.

- `knowledge-graph`
  - Function: Knowledge graph panel.
  - Files: [src/widgets/basic/knowledge-graph/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\knowledge-graph\index.vue)
  - Dependencies: graph data and panel UI.
  - Independent optimization: Yes.
  - Cross-page impact: Low.

- `thematic-workbench`
  - Function: Thematic workbench for template- or thematic-oriented workflows.
  - Files: [src/widgets/basic/thematic-workbench/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\thematic-workbench\index.vue)
  - Dependencies: dataset context, template and workbench state.
  - Independent optimization: Partially.
  - Cross-page impact: Medium.

##### G. Location and utility panels

- `location-point`
  - Function: Location/position point tooling.
  - Files: [src/widgets/basic/location-point/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\widgets\basic\location-point\index.vue)
  - Dependencies: map runtime.
  - Independent optimization: Yes.
  - Cross-page impact: Low.

### 4.6 Floating CUI Dock and Chat

#### Module: CUI Dock

- Function
  - A draggable, resizable floating dock that embeds the CUI chat UI in an iframe.
- Responsible files
  - [src/cui-bridge/CuiDock.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\cui-bridge\CuiDock.vue)
  - [src/cui-bridge/shellBridge.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\cui-bridge\shellBridge.ts)
  - [src/cui-bridge/protocol.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\cui-bridge\protocol.ts)
  - [src/cui-bridge/commandBus.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\cui-bridge\commandBus.ts)
- Reference relationship
  - Rendered in the `right-floating` slot of `pages/map/App.vue`.
- Dependencies
  - Theme service
  - localStorage persistence
  - iframe route `/cui-chat`
- Can be optimized independently
  - Yes, mostly.
- Impacts other pages
  - Low outside map page.

#### Module: CUI Chat Page

- Function
  - Standalone route used inside the embedded CUI iframe.
- Responsible files
  - [src/cui-bridge/CuiChatPage.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\cui-bridge\CuiChatPage.vue)
- Reference relationship
  - Routed via `/cui-chat`.
- Dependencies
  - CUI bridge protocol and shell bridge.
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Low.

### 4.7 Global Design System

#### Module: Mars UI

- Function
  - Reusable shared component library for buttons, dialogs, messages, forms, trees, tables and task modals.
- Responsible files
  - `src/components/mars-ui/*`
- Key component directories
  - `mars-dialog`
  - `mars-task-modal`
  - `mars-button`
  - `mars-input`
  - `mars-select`
  - `mars-table`
  - `mars-tree`
  - `themes`
- Reference relationship
  - Used across shell, widgets and modals.
- Dependencies
  - Ant Design Vue
  - global theme tokens
- Can be optimized independently
  - Yes, but this is a design-system-level change.
- Impacts other pages
  - Very high.

#### Module: Dialog / Modal Shell

- Function
  - Unifies popup visual shell, draggable dialogs, floating task modals and popup framing.
- Responsible files
  - [src/components/mars-ui/mars-dialog/index.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-ui\mars-dialog\index.vue)
  - [src/styles/popup-shell.css](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\styles\popup-shell.css)
- Reference relationship
  - Used by many business widgets and modal interactions.
- Dependencies
  - Mars UI tokens
  - global theme styles
- Can be optimized independently
  - Yes, with full visual QA.
- Impacts other pages
  - Very high.

### 4.8 Demo Area

#### Module: Demo Pages

- Function
  - Sandbox/demo pages for sample widgets and experimental UI.
- Responsible files
  - [src/pages/demo/main.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\demo\main.ts)
  - [src/pages/demo/App.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\demo\App.vue)
  - [src/pages/demo/routes.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\demo\routes.ts)
  - `src/widgets/demo/*`
- Reference relationship
  - Separate demo route system, not the main production shell.
- Dependencies
  - Demo widget store
  - demo widgets
- Can be optimized independently
  - Yes.
- Impacts other pages
  - Low on production UI.

## 5. Module Dependency Summary

### High-coupling core modules

- `src/shell/ShellLayout.vue`
- `src/components/mars-work/main-view.vue`
- `src/components/mars-work/mars-map.vue`
- `src/pages/map/widget-store.ts`
- `src/common/store/widget.ts`
- `src/styles/theme.css`
- `src/components/mars-ui/*`

These modules are architectural centers. Visual or structural changes here ripple across many widgets and shell modules.

### Medium-coupling modules

- `src/shell/Sidebar.vue`
- `src/shell/components/TopHeaderMenus.vue`
- `src/shell/components/TopStatusBar.vue`
- `src/shell/components/TopNotificationsMenu.vue`
- `src/widgets/basic/manage-layers/*`
- `src/widgets/basic/dataset-repository/*`
- `src/widgets/basic/manage-tools/*`
- `src/cui-bridge/CuiDock.vue`

These are strong feature hubs but can still be evolved with bounded regression scope.

### Low-coupling modules

- `src/shell/components/LoginModal.vue`
- `src/shell/components/TopSettingsMenu.vue`
- `src/widgets/basic/query-poi/*`
- `src/widgets/basic/location-point/*`
- `src/widgets/basic/result-playback/*`
- `src/widgets/basic/save-result/*`
- `src/widgets/basic/my-repository/*`

These are relatively safe to optimize independently, assuming shared tokens and widget contracts are preserved.

## 6. Independent Optimization Guidance

### Safe to optimize first

- Header dropdowns and utility panels
- Login modal
- Notification panel
- CUI dock visuals
- Individual lightweight widgets
- Global documentation and visual token audits

### Optimize with caution

- Sidebar structure and grouping
- Widget registry and store contracts
- Global theme tokens
- Dialog shell behavior
- Dataset repository subsystem
- Manage layers subsystem
- Mars map core and in-map overlays

## 7. Suggested Future UI Workstreams

This section is descriptive only and does not imply code changes were made.

- Workstream A: Shell polish
  - Header density
  - Sidebar information architecture
  - Brand and module navigation consistency

- Workstream B: Design system consolidation
  - Radius strategy
  - typography ladder
  - hover and active states
  - popup shell consistency

- Workstream C: Widget standardization
  - unify panel header behavior
  - unify table/list card patterns
  - unify empty/loading/error states

- Workstream D: Large subsystem cleanup
  - dataset repository
  - manage layers
  - analysis tool ecosystem

## 8. Quick File Index

### Main page and shell

- [src/pages/map/main.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\main.ts)
- [src/pages/map/App.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\App.vue)
- [src/shell/Root.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\Root.vue)
- [src/shell/router.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\router.ts)
- [src/shell/ShellLayout.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\ShellLayout.vue)
- [src/shell/Sidebar.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\shell\Sidebar.vue)

### Map work area

- [src/components/mars-work/main-view.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-work\main-view.vue)
- [src/components/mars-work/mars-map.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-work\mars-map.vue)
- [src/components/mars-work/widget.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-work\widget.vue)

### Widget registry

- [src/pages/map/widget-store.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\pages\map\widget-store.ts)
- [src/common/store/widget.ts](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\common\store\widget.ts)

### Design system and styles

- [src/styles/theme.css](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\styles\theme.css)
- [src/styles/popup-shell.css](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\styles\popup-shell.css)
- [src/components/mars-ui](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\components\mars-ui)

### CUI bridge

- [src/cui-bridge/CuiDock.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\cui-bridge\CuiDock.vue)
- [src/cui-bridge/CuiChatPage.vue](P:\VS code\idex\my-mars3d\my-mars3d-dev\src\cui-bridge\CuiChatPage.vue)

