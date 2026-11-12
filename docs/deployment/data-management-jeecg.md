# 数据管理（Jeecg）部署说明

本项目已把“卫星遥感数据管理子系统”所需的 Jeecg Boot 3.5.3 后端、MySQL 初始化脚本、Redis 和 Nginx 网关纳入同一套 Docker Compose。服务器无需另外安装 Java、MySQL 或 Redis，但必须安装 Docker Engine 与 Docker Compose v2。

## 部署前提

- 建议使用 x86_64 Linux，开放内网访问端口 `8888`。
- 本方案把五套卫星数据接口配置为匿名完整 CRUD，仅适用于受控内网。不要把 `8888` 直接暴露到公网。
- 主入口是 `http://服务器地址:8888/mars3d/`。原来的 `5280` 是前端容器直连端口，会绕过数据管理代理，不应作为正式入口。

## 首次部署

在服务器项目目录执行：

```sh
cp .env.example .env
```

编辑 `.env`，把三个示例密码全部替换为强密码，然后执行：

```sh
docker compose config
docker compose up -d --build
docker compose ps
sh scripts/verify-data-management.sh http://127.0.0.1:8888
```

首次启动时，MySQL 会按文件名顺序执行：

- `deploy/mysql/init/00-jeecgboot-mysql-5.7.sql`：Jeecg 3.5.3 官方基础库；
- `deploy/mysql/init/10-satellite-data-management.sql`：五套卫星数据表和初始示例数据。

Jeecg 首次启动可能需要数分钟。可用以下命令查看状态：

```sh
docker compose logs -f mysql redis jeecg-backend gateway
```

## 已有部署或数据库卷

MySQL 的 `/docker-entrypoint-initdb.d` 只会在数据卷为空时执行。更新项目文件后，已有 `mysql-data` 卷不会自动重跑 SQL，这是正常行为。

不要为了重跑初始化而直接删除生产数据库卷。`00-jeecgboot-mysql-5.7.sql` 包含基础表重建语句，只适合全新空库。已有环境应先备份数据库，再由管理员仅评估并执行 `10-satellite-data-management.sql`：

```sh
docker compose exec -T mysql mysqldump -uroot -p jeecg-boot > jeecg-backup.sql
docker compose exec -T mysql mysql -uroot -p jeecg-boot < deploy/mysql/init/10-satellite-data-management.sql
```

以上命令会交互式询问密码。备份文件确认可用后再进行数据库操作。

## 更新与回退

普通代码更新：

```sh
docker compose up -d --build
sh scripts/verify-data-management.sh http://127.0.0.1:8888
```

如果新容器启动失败，保留数据库卷，恢复上一份项目目录后重新运行 `docker compose up -d --build`。不要执行 `docker compose down -v`，因为 `-v` 会删除 MySQL、Redis 和 Jeecg 持久化数据。

## 排查顺序

1. `docker compose ps`：确认五个服务已启动，核心服务为 healthy。
2. `docker compose logs --tail=200 jeecg-backend`：检查数据库、Redis 和 Java 启动错误。
3. `docker compose logs --tail=200 mysql`：检查初始化 SQL。
4. 执行 `scripts/verify-data-management.sh`，确认五个 `/list` 接口均返回 Jeecg JSON。
5. 浏览器必须从 `8888/mars3d/` 进入，再检查“数据管理”。

本地开发机未安装 Docker，因此仓库内完成了配置、SQL、制品和模拟端点验证；真正的容器构建及服务健康状态需在 Linux 服务器上执行上述命令确认。
