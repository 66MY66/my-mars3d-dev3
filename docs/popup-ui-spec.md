# 弹窗 UI 统一规范（Mars Popup Shell v1）

> 目标：统一所有功能弹窗的**视觉外壳**（圆角、标题栏、内容区、表单控件、按钮），不改变功能逻辑、入口与后端接口。

## 1. 适用范围

| 容器 | 组件 | 自动挂载类名 |
|------|------|-------------|
| 主功能浮窗 | `mars-dialog` | `mars-popup-shell`（自动） |
| 次级确认/表单弹窗 | `mars-task-modal` | `mars-popup-shell`（自动） |
| 右侧抽屉 | `mars-dialog` + `ksh002-drawer` | 同上 + 抽屉变体样式 |
| 右键菜单 | `.mars3d-contextmenu-ul` | 独立样式（`theme.css`） |

**不在本规范范围（保持现状）：** 地图内 Cesium 原生 popup、Ant Design Dropdown（图层树右键）等嵌入式菜单。

## 2. 设计 Token

沿用 `theme.css` 中已有变量：

| Token | 默认值 | 用途 |
|-------|--------|------|
| `--popup-radius` | `8px` | 弹窗外壳圆角 |
| `--popup-item-radius` | `8px` | 内部卡片/输入框圆角 |
| `--popup-header-height` | `44px` | 标题栏高度 |
| `--popup-header-padding` | `0 12px` | 标题栏内边距 |
| `--popup-body-padding` | `14px` | 内容区内边距 |
| `--popup-surface` | 主题背景 | 内容区填充 |
| `--popup-border` | 主题边框 | 外框/分割线 |
| `--popup-title-font-size` | `16px` | 标题字号 |
| `--popup-title-font-weight` | `600` | 标题字重 |

## 3. 布局变体（Layout Variants）

在保留原有 `customClass`（如 `ksh002-drawer`、`manage-basemap-pannel`）的前提下，通过组合类区分布局：

| 变体 | 类名组合 | 说明 |
|------|----------|------|
| **浮动面板** | `mars-dialog mars-popup-shell` | 默认；四角圆角，可拖拽/缩放 |
| **右侧抽屉** | `mars-dialog mars-popup-shell ksh002-drawer` | 贴右全高，仅左侧圆角 |
| **贴底面板** | `mars-dialog mars-popup-shell split-compare-panel--bottom-dock` | 分屏对比等特殊 dock，保留组件内布局样式 |

**原则：** `mars-popup-shell` 管视觉；`*-pannel` / `*-panel` 只管业务布局（宽度、grid、特殊 dock）。

## 4. 标题栏规范

- 左：图标（可选）+ 标题文字
- 右：`#headerRight` 插槽操作区 + 关闭按钮 `×`
- 标题栏按钮统一使用 `.mars-popup-header-btn`（28×28，圆角，hover 高亮）
- 关闭按钮：透明背景，hover 浅色底

## 5. 内容区规范

- 内边距：`var(--popup-body-padding)`
- 表单控件（input/select/button）：`border-radius: var(--popup-item-radius)`
- 工作流向导面板推荐复用内容类：
  - `.object-meta` — 对象信息卡片
  - `.param-card` — 参数配置卡片
  - `.step-footer` — 底部步骤按钮区

## 6. 开发约定

1. **新弹窗**：使用 `mars-dialog` / `mars-task-modal` 即可，无需重复写圆角/标题栏样式。
2. **业务 customClass 保留**：如 `manage-basemap-pannel` 仅写布局与业务样式，不写圆角/标题栏重复规则。
3. **禁止**在单个 widget 内覆盖 `border-radius: 0`。
4. **不改 widget 名、入口、API 调用**。

## 7. 迁移清单（进行中）

- [x] `mars-dialog` 自动挂载 `mars-popup-shell`
- [x] `mars-task-modal` 自动挂载 `mars-popup-shell`
- [x] 全局样式 `src/styles/popup-shell.css`
- [ ] 逐步删除各 widget 内重复的 header/圆角 scoped 样式（保留布局类）
