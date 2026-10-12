# 右键“异常快速识别”实施方案（可落地）

目标：将右键“常用工具”中的“异常快速识别”从占位入口落地为可用能力，并支持后端接入（异步任务+结果展示），同时兼容当前“标记对象右键只显示常用工具”的交互逻辑。

---

## 1. 业务定义与范围（建议）

### 1.1 输入（前端提供给后端）
- `regionType`：固定 `"disaster"`（或后续扩展）
- `ring`：多边形外环坐标（WGS84，经纬度）`Array<[lng, lat]>`
- `category`：异常类型：`macro | precursor | deformation`
- `macroType/precursorType/deformationMethod`：不同异常类型对应的子类型/方法
- `timeRange`：可选，时间范围（如热异常/光学需要）
- `products`：可选，识别产品类型列表（热异常、形变异常、光学异常等）
- `thresholds`：可选，阈值参数（由后端定义）
- `clientContext`：可选，地图层/数据源选择等上下文

### 1.2 输出（后端返回给前端）
最小闭环建议返回：
- `jobId`：任务 id
- `status/progress`：任务状态/进度
- `summary`：摘要统计（如异常数量、异常面积、按类型统计、等级分布）
- `resultLayers`：可上图的结果（GeoJSON/矢量瓦片 URL/栅格服务 URL）
- `reportUrl`：可下载报告或详情页链接（可选）

建议按异常类型区分展示形态：
- 宏观异常（macro）：点位分布 + 列表（时间、地点、现象描述、观测者、照片/视频链接）
- 前兆异常（precursor）：点位/热力图 + 阈值/强度字段（必要时补充时间序列链接）
- 形变观测异常（deformation）：站点点位 + 置信度/方法 + 时间序列/报告链接

---

## 2. 前端改造点（基于当前代码）

### 2.1 入口与触发
入口位置：
- 右键命中标记对象后，仅显示常用工具条目（[mars-map.vue](file:///d:/work/mars3d/src/components/mars-work/mars-map.vue)）
- “异常快速识别”作为常用工具条目之一

触发条件：
- 必须命中“标记面区域”（ring 可用）
- 右键菜单里点“异常快速识别”后开始流程

### 2.2 参数面板（建议复用现有 widget）
建议使用“异常识别独立弹窗”，与“灾害区域统计”解耦：
- 异常类型（macro/precursor/deformation）与子类型/方法选择
- 时间范围选择
- 结果列表（TopN）与点击定位
- 导出 GeoJSON/CSV
- 宏观异常详情卡片：文字描述 + 照片/视频预览（后端返回 `mediaUrls`）

### 2.3 任务提交与进度
前端新增 API 文件（示例）：
- `src/api/quickIdentify.ts`

任务流程：
1. 组装请求：`{ ring, regionType, timeRange, products, thresholds }`
2. `POST /api/identify/quick` → `{ jobId }`
3. 轮询：`GET /api/identify/quick/{jobId}` → `{ status, progress, summary, resultLayers }`
4. 完成后：
   - 若 `resultLayers` 提供 URL：用现有 LayerUtil 加载到地图（建议加到一个独立图层组）
   - 若提供 GeoJSON：加载到 `GraphicLayer` 或单独 `GeoJsonLayer`

取消/清理：
- 任务取消：`DELETE /api/identify/quick/{jobId}`
- 前端提供“关闭所有”会清除标记与测量；需额外清理识别结果图层（建议增加“清理识别结果”按钮）

---

## 3. 后端接口契约（建议版）

### 3.1 创建任务
`POST /api/identify/quick`

请求：
```json
{
  "regionType": "disaster",
  "ring": [[117.1,31.8],[117.2,31.8],[117.2,31.9],[117.1,31.9]],
  "category": "precursor",
  "precursorType": "deformation",
  "timeRange": ["2026-01-01T00:00:00Z", "2026-01-31T23:59:59Z"],
  "products": ["precursor"],
  "thresholds": { "deformation": { "method": "nonTidal" } }
}
```

响应：
```json
{ "jobId": "qi_123", "status": "queued" }
```

## 3.4 Mock 策略（前端先联调）
- 通过环境变量 `API_LOCAL=1` 启用 mock（与现有 `keymap` 模块一致的开关模式）。
- mock 任务会返回 `jobId`，并在数秒内从 queued→running→done，返回 `resultGeojson`（点要素 FeatureCollection）用于上图验证全链路。

### 3.2 查询进度/结果
`GET /api/identify/quick/{jobId}`

响应：
```json
{
  "jobId": "qi_123",
  "status": "running",
  "progress": 0.6,
  "summary": {
    "anomalyAreaM2": 123456,
    "anomalyCount": 321
  },
  "resultLayers": []
}
```

完成态示例：
```json
{
  "jobId": "qi_123",
  "status": "done",
  "progress": 1,
  "summary": { "anomalyAreaM2": 123456, "anomalyCount": 321 },
  "resultLayers": [
    { "type": "geojson", "name": "热异常面", "url": "https://.../qi_123.geojson" }
  ],
  "reportUrl": "https://.../qi_123.pdf"
}
```

### 3.3 取消任务
`DELETE /api/identify/quick/{jobId}` → `{ "success": true }`

---

## 4. 数据准确性与坐标规范

- 前端传入的 `ring` 为 WGS84 经纬度。
- 后端若使用投影/栅格分析，应在服务端完成坐标转换并记录输出坐标系。
- 后端返回的 `resultLayers` 需要声明坐标系（默认 WGS84），避免加载偏移。

---

## 5. 性能与可靠性（必须项）

前端：
- 提交任务前校验 ring（点数≥3、经纬度合法）
- 防抖：右键重复点击不重复提交（可加幂等 key）
- 轮询间隔建议 1–2s，并在组件卸载/切换时停止轮询

后端：
- 幂等：支持 `Idempotency-Key`（可选，但强烈建议）
- 超时与失败：提供 `errorCode/errorMessage`，前端可提示并允许重试

---

## 6. UI/交互方案（与当前右键逻辑一致）

- 命中标记对象右键：只显示常用工具条目，其中“异常快速识别”可用
- “异常快速识别”点击后：
  - 打开参数面板（或直接使用默认参数提交）
  - 显示任务进度（可复用右上角“灾害区域统计”面板，增加一个“识别进度”区块）
  - 完成后自动上图并提供“导出结果/打开报告”

---

## 7. 验收清单（可执行）

- 标记受灾区域 → 右键 → 异常快速识别：能提交任务并获得 jobId
- 任务进度可见，失败可提示重试
- 完成后结果可上图（至少一种形式：GeoJSON 或瓦片服务）
- 支持导出结果（GeoJSON/CSV/报告链接至少一种）
- 清理功能可移除识别结果图层，不影响其他图层
