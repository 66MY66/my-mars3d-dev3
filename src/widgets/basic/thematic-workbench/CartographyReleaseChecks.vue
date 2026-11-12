<template>
  <section class="release-checks" aria-label="出图问题分类">
    <p class="check-totals" role="status">{{ blockingGroups }} 类问题阻止正式出图 · {{ blockingDetails }} 条检查明细<span v-if="advisories"> · {{ advisories }} 条复核提醒</span></p>
    <details v-for="group in groups" :key="group.key" class="check-group">
      <summary><strong>{{ group.title }}</strong><span :class="group.blocking ? 'is-blocked' : 'is-advisory'">{{ group.blocking ? `${group.blocking} 条待处理` : '复核提醒' }}</span></summary>
      <p class="check-owner">处理方：{{ group.owner }}</p>
      <p>{{ group.action }}</p>
      <ul><li v-for="(issue, index) in group.issues" :key="index" :class="issue.severity === 'error' ? 'is-blocked' : 'is-advisory'"><b>{{ issue.clause }}</b> {{ issue.message }}</li></ul>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { DbtIssue } from "./dbt116-standard"
import { groupCartographyIssues } from "./cartography-release-checks"
const props = defineProps<{ issues: DbtIssue[] }>()
const groups = computed(() => groupCartographyIssues(props.issues))
const blockingGroups = computed(() => groups.value.filter(group => group.blocking).length)
const blockingDetails = computed(() => groups.value.reduce((sum, group) => sum + group.blocking, 0))
const advisories = computed(() => groups.value.reduce((sum, group) => sum + group.issues.length - group.blocking, 0))
</script>

<style scoped>
.release-checks { color: var(--thematic-ink); min-width: 0; line-height: 1.65; }
.check-totals { color: var(--thematic-muted); margin: 10px 0; }
.check-group { border-top: 1px solid var(--thematic-line); padding: 12px 0; }
.check-group summary { cursor: pointer; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; }
.check-group p { margin: 8px 0; overflow-wrap: anywhere; }
.check-owner { color: var(--thematic-muted); }
.check-group ul { padding-left: 20px; margin: 10px 0 0; }
.check-group li { margin: 7px 0; overflow-wrap: anywhere; }
.is-blocked { color: var(--thematic-danger); }
.is-advisory { color: var(--thematic-warning); }
</style>
