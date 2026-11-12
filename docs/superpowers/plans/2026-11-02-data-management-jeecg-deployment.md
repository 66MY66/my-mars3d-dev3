# Data Management Jeecg Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository uploadable as a Docker Compose stack whose existing data-management UI reaches the project-2 Jeecg satellite CRUD APIs backed by persistent MySQL and Redis.

**Architecture:** Add a pinned Java 8 Jeecg service, pinned MySQL/Redis services, and the existing Nginx gateway to the repository Compose stack. Bootstrap Jeecg from the official v3.5.3 schema plus idempotent satellite tables/seed data, and preserve the frontend `/api/data-management` contract.

**Tech Stack:** Docker Compose, Nginx, Eclipse Temurin Java 8, Jeecg Boot 3.5.3, MySQL 5.7, Redis 6, PowerShell/Bash verification scripts.

**Spec:** `docs/superpowers/specs/2026-11-02-data-management-jeecg-deployment-design.md`

## Global Constraints

- Do not change data-management UI, routes, or frontend API paths.
- Use the project-2 JAR with SHA-256 `2C903050660F5AAAFB05A03286CC2EF000D6991F3C107887F846D2884DAF928F`.
- Obtain the Jeecg base schema only from the official `v3.5.3` tag.
- Keep secrets out of tracked files; commit only `.env.example` placeholders/defaults.
- MySQL and Redis stay private to the Compose network.
- Anonymous full CRUD is allowed only for the five satellite resource prefixes because the user confirmed a controlled intranet deployment.
- Never delete an existing Docker volume automatically.

## Review Focus

- A populated existing MySQL volume must not be mistaken for a freshly initialized database; documentation must provide a non-destructive migration check.
- Missing `.env` secrets must make Compose validation fail or be called out clearly, never silently use production-looking credentials.
- Anonymous access must be limited to the five satellite controllers, not all `/ai2/**` endpoints.
- Nginx path rewriting must preserve `/jeecg-boot/ai2/...` exactly and reject accidental frontend HTML responses.
- JAR startup failures caused by optional integrations or schema mismatch must surface in health/log checks.

---

### Task 1: Pin and verify Jeecg artifacts

**Files:**
- Create: `deploy/jeecg/jeecg-system-start-3.5.3.jar`
- Create: `deploy/mysql/init/00-jeecgboot-mysql-5.7.sql`
- Create: `deploy/jeecg/SHA256SUMS`
- Create: `tests/deployment/artifacts.test.ps1`

**Interfaces:**
- Consumes: project-2 JAR and official JeecgBoot v3.5.3 database artifact.
- Produces: immutable local build inputs for later Docker and database tasks.

- [ ] Write an artifact test that requires the exact JAR SHA-256 and checks the SQL identifies Jeecg 3.5.3/base system tables.
- [ ] Run the test and verify it fails because deployment artifacts are absent.
- [ ] Copy the JAR, download/extract the official v3.5.3 MySQL script, and record source URL plus checksums.
- [ ] Run the artifact test and verify it passes.

### Task 2: Add satellite schema and deterministic seed data

**Files:**
- Create: `deploy/mysql/init/10-satellite-data-management.sql`
- Create: `tests/deployment/satellite-sql.test.ps1`

**Interfaces:**
- Consumes: exact entity fields from the five project-2 satellite entities.
- Produces: five tables and non-empty pool/metadata seed records.

- [ ] Write a test asserting all five tables, required primary keys, and idempotent seed keys exist.
- [ ] Run the test and verify it fails.
- [ ] Implement MySQL 5.7-compatible table DDL and idempotent seed inserts.
- [ ] Run the test and verify it passes.

### Task 3: Build a container-safe Jeecg runtime

**Files:**
- Create: `deploy/jeecg/Dockerfile`
- Create: `deploy/jeecg/application-docker.yml`
- Create: `tests/deployment/jeecg-config.test.ps1`

**Interfaces:**
- Consumes: `deploy/jeecg/jeecg-system-start-3.5.3.jar`, Compose environment variables.
- Produces: `jeecg-backend:9100/jeecg-boot` with only five satellite prefixes anonymous.

- [ ] Write configuration tests for Java 8 pinning, datasource/Redis environment overrides, context path, and exact Shiro exclusions.
- [ ] Run the test and verify it fails.
- [ ] Add the runtime image and external Spring profile/configuration, disabling nonessential startup checks where supported.
- [ ] Run the test and verify it passes.

### Task 4: Extend the Compose stack and gateway

**Files:**
- Modify: `docker-compose.yml`
- Modify: `nginx.conf`
- Create: `.env.example`
- Create: `tests/deployment/compose-gateway.test.ps1`

**Interfaces:**
- Consumes: frontend image, Jeecg runtime, SQL init scripts.
- Produces: gateway on port 8888 and private service network/volumes.

- [ ] Write tests for pinned images, service dependencies/health checks, private DB/cache ports, persistent volumes, required variables, and exact Nginx rewrite.
- [ ] Run the tests and verify they fail.
- [ ] Add gateway, Jeecg, MySQL and Redis services and the `/api/data-management/` route.
- [ ] Run static deployment tests and `docker compose config`; verify success.

### Task 5: Add operational verification and documentation

**Files:**
- Create: `deploy/scripts/verify-data-management.sh`
- Create: `deploy/scripts/verify-data-management.ps1`
- Create: `docs/deployment/data-management-jeecg.md`
- Modify: `README.md`
- Test: `tests/deployment/*.test.ps1`

**Interfaces:**
- Consumes: running gateway URL, five known resource names.
- Produces: repeatable HTTP checks and Linux upload/start/upgrade/rollback instructions.

- [ ] Write script-content tests requiring all five endpoints, HTTP/JSON validation, and failure on HTML/unauthorized responses.
- [ ] Run the tests and verify they fail.
- [ ] Implement Bash/PowerShell verification scripts and deployment documentation, including first-run versus existing-volume behavior and intranet-only warning.
- [ ] Run all deployment tests, frontend unit tests, lint/build, and Docker Compose validation.
- [ ] If Docker is available, build/start clean volumes, verify five endpoints and persistence across restart; otherwise report the unexecuted runtime gate explicitly.
