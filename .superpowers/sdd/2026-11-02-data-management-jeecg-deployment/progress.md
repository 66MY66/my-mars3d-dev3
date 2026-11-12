# SDD ledger — plan: docs/superpowers/plans/2026-11-02-data-management-jeecg-deployment.md

Pre-flight: Task 1 artifacts feed Tasks 3 and 4; exact JAR checksum and official v3.5.3 schema source are binding.
Pre-flight: Task 2 SQL feeds Task 4 MySQL initialization; scripts must be MySQL 5.7 compatible and idempotent.
Pre-flight: Task 3 runtime feeds Task 4 health/dependency graph; service path remains port 9100 with `/jeecg-boot` context.
Pre-flight: Task 4 gateway feeds Task 5 verification; public contract remains `/api/data-management/ai2/...`.
Ruling: Current branch is already a feature branch and the user explicitly chose direct modification of this local project; preserve all unrelated dirty changes and edit only deployment-scoped files.
Task 1: complete (tests: tests/deployment/artifacts.test.ps1 -> pass; JAR and official v3.5.3 schema checksums recorded).
Task 2: complete (tests: tests/deployment/satellite-sql.test.ps1 -> pass; five MySQL 5.7 tables and idempotent seeds added).
Task 3: complete (tests: tests/deployment/jeecg-config.test.ps1 -> pass; Java 8 runtime and exact anonymous controller prefixes configured).
Task 4: Ruling: add root `.dockerignore` although omitted from the file list, because the frontend root build context would otherwise resend the 175 MiB backend JAR; cost if wrong: deployment-only files are unavailable to the frontend image, which does not consume them.
Task 4: complete (tests: tests/deployment/compose-gateway.test.ps1 -> pass; gateway, private MySQL/Redis, Jeecg dependencies, health checks, and persistent volumes added).
Task 5: complete (tests: tests/deployment/verification-scripts.test.ps1 -> pass against a live local mock HTTP server; Linux and PowerShell checks plus deployment/runbook documentation added).
Verification: all five deployment tests pass in isolated PowerShell processes; `npm exec vite build -- --logLevel error` exits 0. Docker is unavailable on this workstation, so container build/health verification is explicitly deferred to the Linux server runbook.
