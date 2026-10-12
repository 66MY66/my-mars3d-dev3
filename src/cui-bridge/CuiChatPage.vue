<template>
  <div class="cui-page">
    <div class="cui-header">
      <div class="title">CUI 对话窗</div>
      <div class="meta">
        <span class="pill">{{ context.theme }}</span>
        <span class="pill">{{ context.pageId }}</span>
      </div>
    </div>

    <div class="prompts">
      <button class="prompt" type="button" @click="sendCmd('theme.switch', { mode: 'dark' })">切换暗色</button>
      <button class="prompt" type="button" @click="sendCmd('theme.switch', { mode: 'light' })">切换浅色</button>
      <button class="prompt" type="button" @click="sendCmd('sidebar.toggle')">折叠侧栏</button>
      <button class="prompt" type="button" @click="sendCmd('widget.refresh', { id: 'manage-layers' })">刷新图层</button>
    </div>

    <div class="messages">
      <div v-for="m in messages" :key="m.id" class="msg" :class="m.role">
        <div class="msg-title">{{ m.role === 'user' ? '你' : '系统' }}</div>
        <pre class="msg-body">{{ m.text }}</pre>
      </div>
    </div>

    <form class="composer" @submit.prevent="onSubmit">
      <input v-model="input" class="input" placeholder="输入命令，例如：theme.switch {mode:dark}" />
      <button class="send" type="submit">发送</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue"
import { v4 as uuidV4 } from "uuid"
import { protocolVersion } from "@/cui-bridge/protocol"
import type { AnyBridgeMessage, AppContextMessage, CmdExecuteMessage, CmdResultMessage } from "@/cui-bridge/protocol"

type Msg = { id: string; role: "user" | "system"; text: string }

const input = ref("")
const messages = ref<Msg[]>([])
const pending = new Map<string, string>()

const context = reactive({
  pageId: "unknown",
  userId: "unknown",
  theme: "dark" as "light" | "dark"
})

function push(role: Msg["role"], text: string) {
  messages.value.push({ id: uuidV4(), role, text })
}

function sendCmd(cmd: string, args?: any) {
  const requestId = uuidV4()
  const msg: CmdExecuteMessage = {
    version: protocolVersion,
    type: "cmd.execute",
    requestId,
    payload: { cmd, args }
  }
  pending.set(requestId, cmd)
  window.parent.postMessage(msg, "*")
  push("user", `${cmd}${args ? " " + JSON.stringify(args) : ""}`)
}

function onSubmit() {
  const raw = input.value.trim()
  if (!raw) {
    return
  }
  input.value = ""
  const [cmd, ...rest] = raw.split(" ")
  const argsText = rest.join(" ").trim()
  if (!argsText) {
    sendCmd(cmd)
    return
  }
  try {
    const args = JSON.parse(argsText)
    sendCmd(cmd, args)
  } catch {
    push("system", "参数必须是 JSON，例如：theme.switch {\"mode\":\"dark\"}")
  }
}

function applyContext(msg: AppContextMessage) {
  context.pageId = msg.data.pageId
  context.userId = msg.data.userId
  context.theme = msg.data.theme
  document.documentElement.dataset.theme = msg.data.theme
}

function handleResult(msg: CmdResultMessage) {
  const cmd = pending.get(msg.requestId || "") || msg.payload.cmd
  pending.delete(msg.requestId || "")
  if (msg.payload.success) {
    push("system", `${cmd} -> success ${msg.payload.data ? JSON.stringify(msg.payload.data) : ""}`.trim())
    return
  }
  push("system", `${cmd} -> fail ${msg.payload.error || ""}`.trim())
}

function onMessage(evt: MessageEvent) {
  const msg = evt.data as AnyBridgeMessage
  if (!msg || msg.version !== protocolVersion) {
    return
  }
  if (msg.type === "app.context") {
    applyContext(msg as AppContextMessage)
    return
  }
  if (msg.type === "cmd.result") {
    handleResult(msg as CmdResultMessage)
  }
}

onMounted(() => {
  window.addEventListener("message", onMessage)
})

onUnmounted(() => {
  window.removeEventListener("message", onMessage)
})
</script>

<style scoped>
.cui-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.cui-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.title {
  font-weight: 650;
  font-size: 14px;
}

.meta {
  display: flex;
  gap: 6px;
}

.pill {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
  color: var(--text-secondary);
}

.prompts {
  padding: 10px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--border-light);
}

.prompt {
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
  color: var(--text-primary);
  border-radius: var(--radius-8);
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}

.messages {
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-10);
  background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
  padding: 10px;
}

.msg.user {
  align-self: flex-end;
}

.msg-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.msg-body {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.composer {
  padding: 10px 12px;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 8px;
  background: var(--bg-overlay);
}

.input {
  flex: 1;
  height: 36px;
  border-radius: var(--radius-10);
  border: 1px solid var(--border-light);
  padding: 0 10px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  outline: none;
}

.send {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-10);
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
  color: var(--text-primary);
  cursor: pointer;
}
</style>
