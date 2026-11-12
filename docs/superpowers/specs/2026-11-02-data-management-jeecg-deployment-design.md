# 数据管理 Jeecg 一体化部署设计

## 目的

让当前项目整体上传到 Linux 服务器后，能够以同一套 Docker Compose 配置启动前端、Jeecg 数据管理后端、MySQL、Redis 和入口 Nginx，使现有 `/api/data-management` 请求真正到达项目二的五套卫星遥感 CRUD 接口。

## 已确认现状

- 当前前端五个数据管理页面已经调用 Jeecg 风格接口，不修改 UI 和页面交互。
- 前端固定通过 `/api/data-management/ai2/...` 访问五类资源。
- 项目二现有 `jeecg-system-start-3.5.3.jar`，大小约 175 MiB，Java 目标版本为 8，服务端口 9100，上下文为 `/jeecg-boot`。
- 项目二没有可用的完整 Jeecg 基础建库 SQL；现有 JAR 的卫星代码来自项目二未提交工作区，因此交付必须记录来源和校验值。
- 当前项目已有 Dockerfile、Docker Compose 和入口 Nginx 配置，但 Compose 只启动前端，Nginx 也没有数据管理代理。

## 目标

1. 当前项目包含可复现上传的 Jeecg 运行产物和配置。
2. Docker Compose 统一编排前端、入口 Nginx、Jeecg、MySQL 和 Redis。
3. `/api/data-management/` 被转发到 `/jeecg-boot/`，前端代码无需改变。
4. 五张卫星业务表可重复初始化，并提供演示种子数据，首次部署页面不是空白。
5. 密码通过 `.env` 注入，不提交真实凭据。
6. 提供 Linux 部署、升级、回滚、日志和接口检查说明。

## 非目标

- 不改变数据管理 UI、路由或字段适配器。
- 不把项目二完整 Java 源码复制到当前项目。
- 不承诺仅上传文件即可自动运行；服务器仍需执行 Docker Compose 命令。
- 不覆盖未知的服务器宿主机 Nginx 配置。
- 不伪造 Jeecg 全量系统库。若现有 JAR 无法在精简数据库上启动，应明确阻断交付，而不是声称可部署。

## 架构

浏览器访问入口 Nginx。Nginx 将 `/mars3d/` 转发给前端容器，将 `/api/data-management/` 转发给 Jeecg 容器；Jeecg 使用 Compose 内部 MySQL 和 Redis。MySQL 首次启动时执行项目内 SQL。

```text
Browser -> gateway:8888
             |-- /mars3d/             -> mars3d-frontend:3000
             `-- /api/data-management -> jeecg-backend:9100/jeecg-boot
                                               |-> mysql:3306
                                               `-> redis:6379
```

## 文件边界

- `docker-compose.yml`：编排五个服务、健康检查、依赖和持久卷。
- `nginx.conf`：新增数据管理反向代理，保留现有 eoAPI/TiTiler 转发。
- `.env.example`：仅包含可安全提交的变量名和开发默认值。
- `deploy/jeecg/Dockerfile`：以 Java 8 运行项目二 JAR。
- `deploy/jeecg/jeecg-system-start-3.5.3.jar`：项目二构建产物。
- `deploy/jeecg/application-docker.yml`：通过环境变量配置 MySQL、Redis和必要开关。
- `deploy/mysql/init/`：基础依赖 SQL（若能合法、完整取得）及卫星表/种子数据。
- `deploy/scripts/verify-data-management.ps1` 与 `.sh`：检查五组列表接口和返回结构。
- `docs/deployment/data-management-jeecg.md`：Linux 运维步骤及限制。

## 数据策略

卫星表使用 `CREATE TABLE IF NOT EXISTS` 和幂等种子插入。种子只用于证明链路，不代替生产遥感数据。Jeecg 基础系统表必须来自与 3.5.3 匹配的官方/项目原始脚本或现有数据库导出；如果无法取得，不能把仅有五张业务表描述为完整可运行数据库。

## 配置与安全

- MySQL root 密码、业务用户密码和 Redis 密码从服务器 `.env` 读取。
- MySQL、Redis默认不映射宿主机端口，只允许 Compose 内网访问。
- Jeecg 9100 默认也不对公网发布，由 Nginx 代理。
- 不复用项目二 `application-dev.yml` 中的外部数据库凭据。
- 健康检查不得输出密码或完整连接串。
- 用户确认服务器位于受控内网；五组 `/ai2/satellite*/**` 接口允许匿名完整 CRUD，以保持现有前端无需登录即可查询、新增、编辑、删除和导出。部署文档必须显著标注该策略不得用于公网暴露。

## 验收

1. `docker compose config` 成功且无未解析关键变量。
2. 前端构建和现有单元测试通过。
3. Jeecg 镜像可以构建，JAR校验值写入文档。
4. 全套服务在干净卷启动成功。
5. 五个 `/list?pageNo=1&pageSize=10` 请求均返回 HTTP 200、`success: true` 和分页 `records`。
6. 至少资源池和元数据接口返回种子记录，页面不再为空。
7. 重启服务后数据仍存在。

## 失败与回滚

- 若 JAR 依赖缺失的 Jeecg 基础表导致启动失败，停止在验证阶段并报告缺失表，不能通过删除错误或放宽健康检查掩盖。
- 回滚时恢复原 `docker-compose.yml` 和 `nginx.conf`，新增持久卷需人工确认后才能删除。
- 不自动删除数据库卷。

## 实施选择

采用当前仓库内一体化部署，而不是单独压缩包。用户重新上传整个项目；服务器优先使用 Docker Compose 启动。保留清晰的 JAR、配置和 SQL目录，以便后续由运维人员改成传统 Java 服务部署。
