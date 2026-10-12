# 专题制图工作台实施计划（落地版）

## 目标
- 模板库：形变图/热力图/分级设色等标准模板
- 样式编辑器：图例颜色、分级断点、透明度、单位、布局实时预览
- 整饰与版式：标题/图例/比例尺/指北针拖拽布局，A4横竖与16:9预设
- 导出与发布：PNG/PDF 导出含整饰要素，生成成果记录页
- 外部数据：导入向导→校验→字段映射/单位坐标适配→加工→推送到制图台并推荐模板

## 阶段与交付
- T1 模板与样式编辑（10天）
  - 模板元数据：`id,type,colorStops,breaks,opacity,legendLayout,units,sampleField`
  - 配置文件：`src/templates/registry.json`
  - 预览联动：编辑器变更 500ms 内响应地图渲染
- T2 整饰与版式（4天）
  - 整饰元素独立 UI 层，版式预设与对齐吸附
- T3 导出与发布（4天）
  - `exportPNG/exportPDF` 工具函数，成果记录结构 `{source, templateId, mapping, params, layers, time}`
- T4 外部数据适配（10天）
  - 导入向导、校验报告、字段映射模板、单位/坐标换算、标准化加工、推送制图台

## 接口与数据
- 模板接口：`getTemplates()/saveTemplate()`（`src/api/templates.ts`）
- 导出接口：`exportPNG(opts)/exportPDF(opts)`（`src/utils/export.ts`）
- 导入向导：`widgets/basic/import-wizard`（占位页）

## 验收
- 模板切换实时预览，图例随断点/色带变动同步更新
- 整饰拖拽与版式切换有效；导出 PNG/PDF 质量可调
- 外部数据导入失败给出可读原因，成功数据自动带入推荐模板
