<template>
  <input type="number" :aria-label="label" :value="draft" @input="draft = ($event.target as HTMLInputElement).value" @focus="editing = true" @change="commit" @blur="finish" @keydown.enter="finish" />
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
const props = defineProps<{ value: number; label: string }>()
const emit = defineEmits<{ change: [value: number] }>()
const draft = ref(String(props.value))
const editing = ref(false)
watch(() => props.value, value => { if (!editing.value) { draft.value = String(value) } })
function commit() {
  const value = Number(draft.value)
  if (draft.value !== "" && Number.isFinite(value)) { emit("change", value) }
}
async function finish() {
  commit()
  editing.value = false
  await nextTick()
  draft.value = String(props.value)
}
</script>
