# 专题制图工作台恢复与验证实施计划

**目标：** 补齐 2026-11 整合包的专题制图资源与运行链路，使工作台通过类型检查、专题制图测试并可进行浏览器演示。

**架构：** 先恢复静态演示资源，再统一 GeoJSON 与发布包的数据边界，随后恢复发布成果预览与整合包测试，最后执行构建、全量测试和浏览器验证。

**技术栈：** Vue 3、TypeScript、Vite、Vitest、JSZip、Mars3D、Playwright。

## 执行步骤

- [ ] 盘点并补齐整合包缺失的 `public/data` 数据与资源，先让资源依赖测试通过。
- [ ] 补齐 `geojson` 类型依赖，收窄专题制图目录中的 `unknown` 类型，统一模板与发布接口签名。
- [ ] 统一发布包内部使用 `Uint8Array`/`ArrayBuffer`，修复 Node/Vitest 与浏览器 Blob 的边界。
- [ ] 将整合包发布成果预览能力恢复到当前任务组件，并补齐对应测试。
- [ ] 恢复整合包中缺失的专题制图相关测试文件，按失败测试逐项修复。
- [ ] 运行完整 `vue-tsc`、专题制图全量 Vitest、生产构建和浏览器演示，记录剩余告警与阻塞。

## 验证命令

```powershell
.\node_modules\.bin\vue-tsc.CMD --noEmit --skipLibCheck
.\node_modules\.bin\vitest.CMD run src/widgets/basic/thematic-workbench src/widgets/basic/current-task --reporter=dot
.\node_modules\.bin\vite.CMD build
```
