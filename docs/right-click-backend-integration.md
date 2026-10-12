# 右键菜单与“常用工具/灾害区域标注”后端接入说明

本说明面向后续“从后端接入数据”的落地，覆盖当前右键行为、数据模型、事件触发点、持久化、以及推荐的后端接口契约与前端接入方式。

关联实现：
- 右键菜单基础配置（系统默认右键）：[getDefaultContextMenu.ts](file:///d:/work/mars3d/src/utils/getDefaultContextMenu.ts)
- 右键动态显示/仅显示常用工具、命中检测、hover 提示、区域持久化： [mars-map.vue](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue)
- 区域命中算法（点在多边形内）：[region-hit.ts](file:///d:/work/mars3d/src/utils/region-hit.ts)
- 灾害统计计算/格式化/导出：[disaster-metrics.ts](file:///d:/work/mars3d/src/utils/disaster-metrics.ts)
- 异常快速识别（mock/后端接口封装）：[quickIdentify.ts](file:///d:/work/mars3d/src/api/quickIdentify.ts)

---

## 1. 右键菜单现状（关键行为）

### 1.1 默认右键（空白地图）
默认右键菜单来自 `getDefaultContextMenu(map)`，包含（示例）：
- 坐标查看
- 图上量算
- 图上标记
- 图层切换/地形/图层等

说明：此前已移除的模块（不再出现）：
- “影响等级标记”
- “场景设置/场景（导出JSON、场景出图、日照/大气等）”

### 1.2 命中标记对象的右键（“只出现常用工具内容”）
当右键事件命中 `map.graphicLayer` 上的标记对象（或命中已持久化的标记面区域），右键菜单会切换为“仅展示常用工具条目”：
- 统计面板（右侧弹窗自动展示：面积/边界/人口/损失；并提供“准备数据提取”按钮）
- 形变时序分析（占位）
- 异常快速识别（可调用接口：mock/后端）
- 缓冲区/叠加/邻域分析（对接现有 widget）
- 关闭所有（清理标记与量算）

触发规则（见 [mars-map.vue:getContextMenu](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue#L335-L810)）：
- 优先以 `e.graphic` 命中 `map.graphicLayer` 的对象为准
- 对于“面标记”，若 `e.graphic` 未命中，会使用“点在多边形内”算法进行命中兜底（用于只在面内部右键也可触发）
- `Shift + 右键`：强制切换为“常用工具菜单”（用于快捷唤起）

### 1.3 悬停提示（视觉反馈）
鼠标移动到标记对象上时展示提示：`右键打开常用工具`，并将鼠标指针变为 `pointer`。
实现位于 [mars-map.vue](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue#L566-L637)，UI 样式为 `.mars3d-region-hover-tip`。

---

## 2. 标注体系（标记/受灾区域标注的合并）

### 2.1 入口
“受灾区域标注”已合并到默认右键的“图上标记”子菜单中：
- 菜单项：`图上标记 → 受灾区域标注`
- 行为：绘制 `polygon`，并写入 `attr.regionType = "disaster"`

实现： [getDefaultContextMenu.ts](file:///d:/work/mars3d/src/utils/getDefaultContextMenu.ts#L233-L275)

### 2.2 类型标识（后端接入时最重要的字段）
为确保后续后端按类型做计算/检索，建议统一使用：
- `graphic.attr.regionType = "disaster"`：受灾区域
- 其他标记可以不写或写为 `generic`

当前前端在提取区域索引时优先读取：
- `f.attr.regionType` 或 `f.properties.regionType`
并在缺失时用样式色值/文案进行兜底识别（建议后续逐步去掉兜底，完全依赖 `attr.regionType`）。

---

## 3. 区域数据模型与命中检测

### 3.1 Region / RegionIndex（前端内部）
定义： [region-hit.ts](file:///d:/work/mars3d/src/utils/region-hit.ts)

`Region`
- `id`: string（来自图形 id 或生成值）
- `type`: `"disaster" | "generic"`
- `ring`: Array<[lng, lat]>（外环坐标）
- `bbox`: 外接矩形（加速过滤）
- `updatedAt`: number（用于排序与回退）

`RegionIndex`
- `list`: Region[]（按 updatedAt 倒序）
- `version/updatedAt`: number

### 3.2 命中算法（点在多边形内）
命中流程：
1. bbox 快速过滤
2. ray-casting（射线法）判断点是否在 ring 内

核心 API：
- `hitTestRegions(index, point)`：返回命中的 Region 或 null
- `pointInRing(point, ring)`：基础点在多边形内判断

---

## 4. 灾害区域统计面板（实时+导出+单位切换）

### 4.1 面板触发方式
面板 UI 位于 [mars-map.vue](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue#L6-L88)。

触发点：
- 绘制“受灾区域标注”过程中：监听 `graphicLayer` 的标绘事件并实时更新
- 右键命中标记面对象：在常用工具里点击“查看分析数据”打开面板

事件监听实现： [mars-map.vue:installDisasterStats](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue#L812-L864)
监听事件：
- `drawStart / drawMouseMove / drawAddPoint / drawCreated`
- `editMovePoint / updatePosition`

### 4.2 指标计算（当前为前端本地计算 + 估算模型）
实现： [disaster-metrics.ts](file:///d:/work/mars3d/src/utils/disaster-metrics.ts)

输入：
- `ring`: Array<[lng, lat]>
- `model`：
  - `populationDensityPerKm2`
  - `lossPerPersonYuan`

输出（基础指标）：
- `areaM2`: 平方米
- `perimeterM`: 米
- `population`: 人
- `lossYuan`: 元

说明：
- 面积/周长采用 WebMercator（将经纬度转为米坐标）后使用鞋带公式/欧氏距离计算。
- 人口/损失为线性估算模型：
  - `population = area_km2 * populationDensityPerKm2`
  - `loss = population * lossPerPersonYuan`

### 4.3 单位切换与偏好持久化
偏好（单位 + 估算参数）存储键：
- `mars3d_disaster_stats_prefs_v1`

面板提供单位切换：
- 面积：m²/km²
- 长度：m/km
- 人口：人/万人
- 金额：元/万元/亿元

### 4.4 数据导出
导出由前端直接下载：
- JSON：`灾害区域统计_<timestamp>.json`
- CSV：`灾害区域统计_<timestamp>.csv`

导出内容：
- JSON：`{ ring, model, metrics, generatedAt }`
- CSV：key/value 形式的指标与参数

---

## 5. 其他右键子功能与后端衔接点

### 5.1 标记区域数据提取（后端任务化的典型入口）
“标记区域数据提取”当前行为：
- 读取命中的标记面 ring
- 写入 localStorage：`mars3d_region_extract_ready`
  - `{ region: ring, time: Date.now() }`

实现： [mars-map.vue](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue#L659-L678)

建议后续替换为：
- 前端：调用后端“提取任务创建接口”，返回 `jobId`
- 前端：轮询/订阅任务进度并展示结果（或跳转结果页面）

---

## 6. 推荐后端接口契约（建议版）

说明：当前前端已经具备 ring 数据与事件触发点，后端接入建议尽量“以 ring 为唯一几何输入”，避免耦合 mars3d 的内部对象结构。

### 6.1 灾害统计计算（同步）
`POST /api/disaster/metrics`

请求：
```json
{
  "regionType": "disaster",
  "ring": [[117.1,31.8],[117.2,31.8],[117.2,31.9],[117.1,31.9]],
  "model": {
    "populationDensityPerKm2": 1000,
    "lossPerPersonYuan": 5000
  }
}
```

响应（建议全部返回“基础单位”，前端负责显示单位切换）：
```json
{
  "areaM2": 123456.7,
  "perimeterM": 1234.5,
  "population": 4567,
  "lossYuan": 22835000,
  "extra": {
    "affectedBuildings": 12,
    "affectedRoadKm": 3.2
  }
}
```

前端接入建议：
- 在 `installDisasterStats()` 的 `updateFromEvent` 中加入防抖请求（例如 200ms），并对上一请求使用 AbortController 取消，避免绘制过程中堆积请求。
- 后端不可用/超时：回退本地估算（当前实现即为兜底方案）。

### 6.4 异常快速识别（已可 mock 联调）
- 前端已接入 `create/get/cancel` 三个接口封装，默认由 `API_LOCAL=1` 控制是否启用 mock。
- 已按业务拆分三类异常识别：
  - `macro`：宏观异常（地下水/生物/地声/地光/电磁/气象），输出点位+列表（含时间/描述/观测者等字段）
  - `precursor`：前兆异常（形变/电磁/流体/地震活动），输出点位+热力图（value/level）
  - `deformation`：形变观测异常（非潮汐/斜率差/自适应阈值/K-L拟合），输出站点点位+热力图（value/置信度）
- mock 模式下会在数秒内返回完成态，并提供 `resultGeojson`（点要素）用于验证“提交→轮询→上图→列表→导出→清理”的闭环流程。

### 6.2 区域数据提取（异步任务）
`POST /api/disaster/extract`

请求：
```json
{
  "ring": [[...]],
  "product": "analysis-data",
  "options": { "timeRange": ["2026-01-01","2026-01-31"] }
}
```

响应：
```json
{ "jobId": "job_123", "status": "queued" }
```

查询：
- `GET /api/disaster/extract/{jobId}` → `{ status, progress, resultUrl?, error? }`

### 6.3 区域要素统计（与人口/经济独立的通用能力）
`POST /api/region/stats`

用途：
- 对接人口栅格、经济栅格、行政区划、POI 等空间数据源
- 统一输出可扩展的指标集合（前端面板按 key 渲染）

---

## 7. 前端接入后端的实现建议（保证可靠性）

### 7.1 数据校验与安全
- 对 ring 做基本校验：点数≥3、经纬度为有限数值、经度[-180,180]纬度[-90,90]
- 对异常输入：后端返回 400，前端提示“区域数据异常”
- 严禁后端直接信任前端传来的 `populationDensityPerKm2/lossPerPersonYuan`（可作为参数，但需要后端做白名单/范围限制）

### 7.2 性能与节流
- 绘制过程事件频率高：必须防抖/取消请求
- 仅在 `regionType === "disaster"` 的 polygon 上触发统计请求
- 面板打开时才进行高成本计算/请求（当前实现即为“打开即算”）

### 7.3 一致性与幂等
- 统计接口建议幂等（同 ring、同参数返回相同结果）
- 任务接口建议支持幂等 key（避免重复创建任务）

---

## 8. 当前持久化键（便于后端联动/排查）
- `mars3d_region_markers_v1`：标记面索引（用于右键命中兜底与刷新恢复）
- `mars3d_disaster_stats_prefs_v1`：统计面板单位/估算参数偏好
- `mars3d_region_extract_ready`：区域数据提取准备数据（后续可替换为 jobId）

---

## 9. 变更记录（便于回溯）
- 右键精简：移除“影响等级标记”“场景设置/场景”
- 常用工具触发：命中标记对象后，右键只展示常用工具条目；空白地图右键仍为默认菜单
- 标记合并：受灾区域标注合并进“图上标记”，并写入 `attr.regionType = "disaster"`
- 统计面板：实时显示面积/周长/人口/损失（本地估算兜底）、单位切换、导出 JSON/CSV
