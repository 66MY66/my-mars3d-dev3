<template>
  <teleport to="body">
    <div v-if="visible" class="mask" @click.self="close">
      <div class="panel" role="dialog" aria-modal="true" aria-label="login">
        <div class="header">
          <div class="title">登录</div>
          <button class="close" type="button" @click="close">×</button>
        </div>

        <div class="body">
          <div class="field">
            <div class="label">账号</div>
            <mars-input v-model:value="username" placeholder="请输入账号" :allowClear="true" />
          </div>
          <div class="field">
            <div class="label">密码</div>
            <mars-input v-model:value="password" type="password" placeholder="请输入密码" :allowClear="true" />
          </div>
        </div>

        <div class="footer">
          <mars-button @click="close">取消</mars-button>
          <mars-button type="primary" @click="submit">登录</mars-button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { $message } from "@mars/components/mars-ui/index"

const visible = ref(false)
const username = ref("")
const password = ref("")

function open() {
  visible.value = true
}

function close() {
  visible.value = false
  password.value = ""
}

function submit() {
  if (!username.value.trim() || !password.value.trim()) {
    $message("请输入账号和密码", "warning")
    return
  }
  $message("登录成功（占位）", "success")
  close()
}

function onOpenLogin() {
  open()
}

onMounted(() => {
  window.addEventListener("openLogin", onOpenLogin as EventListener)
})

onUnmounted(() => {
  window.removeEventListener("openLogin", onOpenLogin as EventListener)
})
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0 0 0 / 35%);
  display: grid;
  place-items: center;
  z-index: 10000;
}

.panel {
  width: min(420px, calc(100vw - 32px));
  border-radius: var(--popup-radius, 8px);
  border: 1px solid var(--layout-border);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-2);
  overflow: hidden;
  backdrop-filter: blur(var(--overlay-blur));
}

.header {
  height: 48px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--layout-border);
  background: var(--bg-overlay);
}

.title {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-primary);
}

.close {
  width: 32px;
  height: 32px;
  border-radius: calc(var(--popup-radius, 8px) - 2px);
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 20px;
  line-height: 1;
}

.close:hover {
  background: rgba(45 140 240 / 0.08);
  color: var(--text-primary);
}

.body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  color: var(--text-secondary);
}

.footer {
  padding: 12px 14px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--layout-border);
}

:deep(.mars-input),
:deep(.ant-input-affix-wrapper) {
  border-radius: var(--popup-radius, 8px) !important;
}

:deep(.mars-input .ant-input) {
  border-radius: var(--popup-radius, 8px) !important;
}

:deep(.mars-button) {
  border-radius: var(--popup-radius, 8px) !important;
}
</style>
