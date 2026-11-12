<template>
  <div class="flow-fields">
    <div v-for="key in orderedFlowFields(schema)" :key="key" class="field">
      <label :for="`${path}.${key}`">{{ flowFieldLabel(key, schema.properties![key]) }}<span v-if="schema.required?.includes(key)"> *</span></label>
      <select v-if="schema.properties![key].enum" :id="`${path}.${key}`" :value="encoded(modelValue[key])" :disabled="disabled" @change="set(key, JSON.parse(($event.target as HTMLSelectElement).value))"><option value="null">未设置</option><option v-for="option in schema.properties![key].enum" :key="encoded(option)" :value="encoded(option)">{{ option === '' ? '不启用' : option }}</option></select>
      <input v-else-if="schema.properties![key].type === 'boolean'" :id="`${path}.${key}`" type="checkbox" :checked="modelValue[key] === true" :disabled="disabled" @change="set(key, ($event.target as HTMLInputElement).checked)" />
      <div v-else-if="['bbox', 'region_bbox'].includes(key)" class="bbox" :aria-label="`${path}.${key}`"><label v-for="(name, i) in ['西', '南', '东', '北']" :key="name">{{ name }}<input type="number" step="any" :aria-label="`${path}.${key}.${name}`" :value="Array.isArray(modelValue[key]) ? (modelValue[key] as number[])[i] : ''" :disabled="disabled" @input="setBound(key, i, ($event.target as HTMLInputElement).value)" /></label></div>
      <input v-else-if="['integer', 'number'].includes(schema.properties![key].type || '')" :id="`${path}.${key}`" type="number" :step="schema.properties![key].type === 'integer' ? 1 : 'any'" :min="schema.properties![key].minimum" :max="schema.properties![key].maximum" :value="modelValue[key] ?? ''" :disabled="disabled" @input="set(key, ($event.target as HTMLInputElement).value === '' ? undefined : Number(($event.target as HTMLInputElement).value))" />
      <input v-else-if="schema.properties![key].type === 'string'" :id="`${path}.${key}`" :value="modelValue[key] ?? ''" :disabled="disabled" @input="set(key, ($event.target as HTMLInputElement).value)" />
      <textarea v-else-if="schema.properties![key].type === 'array' && schema.properties![key].items?.type === 'string'" :id="`${path}.${key}`" rows="2" :value="(modelValue[key] as string[] || []).join('\n')" :disabled="disabled" @input="set(key, ($event.target as HTMLTextAreaElement).value.split(/[,\n]/).map(v => v.trim()).filter(Boolean))"></textarea>
      <FlowParameterFields v-else-if="schema.properties![key].properties" :schema="schema.properties![key]" :model-value="objectValue(modelValue[key])" :path="`${path}.${key}`" :disabled="disabled" @update:model-value="set(key, $event)" />
      <textarea v-else :id="`${path}.${key}`" rows="4" spellcheck="false" :value="jsonText(key)" :disabled="disabled" @input="jsonInput(key, ($event.target as HTMLTextAreaElement).value)"></textarea>
      <small v-if="jsonErrors[key]" class="error" role="alert">{{ jsonErrors[key] }}</small>
      <details v-if="schema.properties![key].properties"><summary>附加参数 JSON</summary><textarea rows="4" :value="jsonText(key)" :disabled="disabled" :aria-label="`${path}.${key}.JSON`" @input="jsonInput(key, ($event.target as HTMLTextAreaElement).value)"></textarea></details>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue"
import { flowFieldLabel, orderedFlowFields, type FlowSchema } from "./flow-parameters"
const props = withDefaults(defineProps<{ schema: FlowSchema; modelValue: Record<string, unknown>; path?: string; disabled?: boolean }>(), { path: "flow" })
const emit = defineEmits<{ "update:modelValue": [value: Record<string, unknown>] }>()
const jsonErrors = ref<Record<string, string>>({}); const drafts = ref<Record<string, string>>({})
function encoded(value: unknown) { return JSON.stringify(value ?? null) }
function objectValue(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function set(key: string, value: unknown) { const next = { ...props.modelValue }; if (value === undefined || value === null) { delete next[key] } else { next[key] = value }; delete drafts.value[key]; delete jsonErrors.value[key]; emit("update:modelValue", next) }
function setBound(key: string, i: number, value: string) { const b = Array.isArray(props.modelValue[key]) ? [...props.modelValue[key] as unknown[]] : [null, null, null, null]; b[i] = value === "" ? null : Number(value); set(key, b) }
function jsonText(key: string) { return drafts.value[key] ?? (props.modelValue[key] === undefined ? "" : JSON.stringify(props.modelValue[key], null, 2)) }
function jsonInput(key: string, value: string) { try { if (!value.trim()) { set(key, undefined); return }; const data = JSON.parse(value); set(key, data) } catch { drafts.value[key] = value; jsonErrors.value[key] = "JSON 格式无效，提交前须修正"; emit("update:modelValue", { ...props.modelValue, [key]: value }) } }
</script>
<style scoped>
.flow-fields { display: grid; gap: 12px; min-width: 0; }.field { display: grid; gap: 6px; min-width: 0; }.flow-fields .flow-fields { border-left: 2px solid var(--thematic-line); padding-left: 10px; }
label { color: var(--thematic-ink); font-size: 13px; overflow-wrap: anywhere; } input,select,textarea { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid var(--thematic-line); padding: 8px 10px; background: var(--thematic-control); color: var(--thematic-ink); color-scheme: var(--thematic-scheme); font: inherit; border-radius: 3px; } input[type=checkbox] { width: 18px; height: 18px; } textarea { resize: vertical; } .bbox { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }.bbox label { display: grid; gap: 4px; } .error { color: var(--thematic-danger); } summary { cursor: pointer; font-size: 12px; color: var(--thematic-muted); }
</style>
