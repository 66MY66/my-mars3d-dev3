<template>
  <router-view />
  <LoginModal />
  <DesktopPetHost />
</template>

<script setup lang="ts">
import LoginModal from "@/shell/components/LoginModal.vue"
import DesktopPetHost from "@/features/desktop-pet/DesktopPetHost.vue"
import { registerShellCommands } from "@/shell/commandHandlers"

registerShellCommands()
</script>
