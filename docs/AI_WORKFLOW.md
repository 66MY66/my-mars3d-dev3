# AI Workflow

## Purpose

This document defines the mandatory workflow Codex must follow before making any future code changes in this project.

It is intended to keep UI optimization controlled, reversible, low-risk, and easy to review.

## Core Rules

Codex must follow all of the rules below for every future modification task.

### 1. One UI module at a time

- Only one UI module may be modified in a single change cycle.
- A single task must not mix multiple major UI areas such as:
  - header
  - sidebar
  - map area
  - popup
  - repository panel
  - toolbar
  - settings panel

If multiple modules need changes, they must be split into separate iterations.

### 2. No business logic changes

- Do not modify business logic.
- Do not change functional workflows.
- Do not alter data processing behavior.
- Do not change task execution logic.

Allowed changes are limited to:

- UI layout
- visual style
- spacing
- typography
- colors
- icons
- component appearance
- interaction presentation

### 3. No API changes

- Do not modify API request logic.
- Do not change request parameters.
- Do not change response handling contracts.
- Do not add or remove API endpoints.

### 4. No database changes

- Do not modify database structure.
- Do not modify persistence schema.
- Do not change storage models.
- Do not change data migration behavior.

### 5. No file deletion

- Do not delete files.
- Do not remove directories.
- Do not replace a file by deleting and recreating it unless explicitly approved.

If cleanup is needed, it must be discussed first.

## Pre-change Requirements

Before making any code changes, Codex must tell the user:

### Required pre-change disclosure

1. Which files will be modified
2. Why these files need to be modified
3. The expected impact

Codex must provide this before editing any file.

### Required format before editing

Codex should clearly state:

- Target module
- Files to be modified
- Reason for modification
- Expected impact scope
- Whether the change is low, medium, or high risk

### Example structure

```md
Target module:
- Header

Files to be modified:
- src/shell/ShellLayout.vue
- src/shell/components/TopHeaderMenus.vue

Why modify:
- Unify header spacing, typography, and hover style with the design system

Expected impact:
- Only affects the top header UI
- No business logic changes
- No API impact

Risk:
- Low
```

## Change Scope Restrictions

Each modification must satisfy all of the following:

- limited to one UI module
- visual or structural UI adjustment only
- no business logic edits
- no API edits
- no DB edits
- no file deletion

If a requested change would cross these boundaries, Codex must stop and ask for confirmation before proceeding.

## Post-change Requirements

After each change is completed, Codex must output:

### Required output after modification

- `CHANGELOG`

The changelog should summarize:

1. What was changed
2. Which files were changed
3. What the visual effect is
4. What was intentionally not changed
5. Risks or follow-up notes

### Example CHANGELOG structure

```md
## CHANGELOG

### Modified module
- Header

### Modified files
- src/shell/ShellLayout.vue
- src/shell/components/TopHeaderMenus.vue

### What changed
- Adjusted header spacing
- Unified menu hover style
- Updated title typography

### Not changed
- Business logic
- API
- widget behavior

### Risk
- Low
```

## History Documentation Requirement

For every single modification, Codex must also create a history record under:

- `docs/history/`

### File naming rule

The file name must use the format:

```text
YYYY-MM-DD-module.md
```

Example:

```text
2026-07-15-header.md
2026-07-15-sidebar.md
2026-07-16-popup.md
```

## Required history document structure

Each history file must contain:

### 1. Modification purpose

- What this change is trying to improve

### 2. Modified files

- Exact file list

### 3. Reason for change

- Why those files were touched
- Why the previous UI needed adjustment

### 4. Screenshot location

- Where the before/after screenshots are stored
- If no screenshot exists yet, explicitly state:
  - `Pending`

### 5. Rollback method

- How to revert the change safely
- Prefer:
  - git revert
  - manual rollback by file

### 6. Risk

- Low / Medium / High
- Include specific risk notes

### 7. Completion status

- Completed
- Partially completed
- Pending verification
- Rolled back

## Standard history template

```md
# YYYY-MM-DD Module Name

## Modification purpose
- 

## Modified files
- 

## Reason for change
- 

## Screenshot location
- 

## Rollback method
- 

## Risk
- Level:
- Notes:

## Completion status
- 
```

## Screenshot Rule

If screenshots are generated during a change cycle:

- their storage path must be written into the corresponding history file
- if screenshots are not generated, the history file must explicitly state:
  - `Pending`

## Rollback Rule

Every change history must contain a rollback note.

Rollback instructions must be practical and specific.

Preferred rollback methods:

1. Revert the exact commit if committed
2. Restore only the modified UI files
3. Re-apply the previous token or style values manually

Rollback notes must not say only:

- `use git`

They must explain the concrete rollback path.

## Risk Classification

Codex should use the following risk levels:

### Low

- isolated style update
- spacing update
- typography update
- color/token update
- single component visual adjustment

### Medium

- layout changes affecting nested components
- popup shell changes
- shared design token changes
- sidebar or header structural adjustment

### High

- changes that may affect multiple widgets visually
- changes to shared base components
- changes to shared shell architecture

If the risk is medium or high, Codex must clearly say so before editing.

## Non-compliance Rule

If the requested task violates this workflow, Codex must not silently proceed.

Codex must pause and explain which rule is being crossed.

Examples:

- more than one UI module in one task
- request requires business logic change
- request requires API change
- request implies file deletion

## Mandatory Behavior Summary

Before any future code change, Codex must:

1. Identify exactly one UI module
2. Announce which files will be changed
3. Explain why
4. Explain expected impact
5. Wait for alignment if scope is ambiguous or risky

After any future code change, Codex must:

1. Output `CHANGELOG`
2. Create a history markdown file in `docs/history/`
3. Include:
   - modification purpose
   - modified files
   - reason
   - screenshot location
   - rollback method
   - risk
   - completion status

## Applies To

This workflow applies to all future Codex modification tasks in this repository unless the user explicitly overrides it.

