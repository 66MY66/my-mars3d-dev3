# 交互式灾害区域标注与统计面板

## 功能概述
- 在右键“图上标记 → 受灾区域标注”绘制受灾多边形时，实时计算并展示统计指标：
  - 区域面积
  - 边界长度
  - 受影响人口（估算）
  - 经济损失（估算）
- 支持单位切换：
  - 面积：m² / km²
  - 长度：m / km
  - 人口：人 / 万人
  - 金额：元 / 万元 / 亿元
- 支持导出：JSON / CSV
- 数据与偏好持久化（localStorage）：刷新页面后仍保留标注与统计参数

## 使用方式
1. 在地图上右键 → 图上标记 → 受灾区域标注
2. 绘制多边形过程中会弹出“灾害区域统计”面板并实时更新
3. 绘制完成后，面板继续显示最终统计结果
4. 将鼠标移动到已标注的面对象上右键，统计面板会自动展示（如已关闭，可再次右键唤起）

快捷键：
- Shift + 右键：强制进入“常用工具”菜单

## 技术实现
### 标注识别
- 受灾区域标注绘制时写入：`attr.regionType = "disaster"`
- 地图组件通过 `graphicLayer` 的 `drawStart/drawMouseMove/drawAddPoint/drawCreated/editMovePoint/updatePosition` 事件监听绘制与编辑过程

### 指标计算
- 面积/周长使用 WebMercator (EPSG:3857) 平面计算（射影到米坐标后使用鞋带公式/欧氏距离累加）
- 人口/经济损失为估算模型：
  - `population = area_km2 * populationDensityPerKm2`
  - `loss = population * lossPerPersonYuan`

### 参数与持久化
- 统计面板偏好（单位与估算参数）存储键：`mars3d_disaster_stats_prefs_v1`
- 标注区域存储键：`mars3d_region_markers_v1`

## 导出格式
### JSON
- 文件名：`灾害区域统计_<timestamp>.json`
- 内容：
  - `ring`: 多边形外环坐标（lng/lat）
  - `model`: 估算参数（人口密度/人均损失）
  - `metrics`: 计算结果（面积m²/周长m/人口/损失元）
  - `generatedAt`: ISO 时间戳

### CSV
- 文件名：`灾害区域统计_<timestamp>.csv`
- 内容：`key,value` 形式的指标与参数
