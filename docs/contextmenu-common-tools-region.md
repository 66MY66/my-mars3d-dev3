# 右键常用工具：基于“图上标记”对象的动态显示

## 目标
- 无任何图上标记：右键不展示“常用工具”菜单（仍保留系统默认右键菜单项）。
- 存在图上标记：仅当鼠标位于标记对象上并右键时展示“常用工具”菜单。
- 快捷方式：Shift + 右键强制展示“常用工具”菜单（便于快速创建/操作）。

## 标记与受灾区域标注
- “受灾区域标注”已合并进右键“图上标记”菜单中（以面多边形形式绘制，并写入 `attr.regionType = "disaster"` 用于识别）。

## 实现位置
- 右键菜单组装与显示控制：[mars-map.vue](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue)
- 区域命中算法与索引结构：[region-hit.ts](file:///d:/work/mars3d/src/utils/region-hit.ts)

## 区域数据模型
`Region`
- `id`: 区域唯一标识
- `type`: `disaster | generic`
- `ring`: 多边形外环坐标（lng/lat 数组）
- `bbox`: 外接矩形（用于快速过滤）
- `updatedAt`: 更新时间（用于排序/回退）

`RegionIndex`
- `list`: 已排序的区域列表（最新在前）
- `version / updatedAt`: 索引版本信息

## 公共 API（可复用）
- `buildRegionIndex(regions)`：构建索引（自动计算 bbox 并按 updatedAt 排序）
- `hitTestRegions(index, point)`：命中检测（bbox 预过滤 + point-in-polygon）
- `pointInRing(point, ring)`：射线法点在多边形内判断
- `normalizeRing(input)`：将输入坐标归一化为 `[lng, lat]` 数组

## 持久化策略
- 存储键：`mars3d_region_markers_v1`
- 写入：每次刷新区域索引时写入（从当前 `graphicLayer.toJSON()` 提取后落库）
- 恢复：页面刷新后，若 `graphicLayer` 为空且存储存在，则自动恢复为多边形图形并加入 `graphicLayer`

## 扩展点
- 多类型工具集：目前通过 `style/attr` 进行粗粒度判定（`ff7f50` 视为 `disaster`），可在图形 `attr.regionType` 里明确标注以提升准确性。
- 工具禁用态：若需在菜单中展示禁用项，需要确认 mars3d contextmenu 是否支持 `disabled` 字段；当前实现按“菜单组是否展示 + 回退提示”处理。
