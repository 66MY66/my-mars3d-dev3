<template>
  <ShellLayout :sidebar-width="240">
    <template #nav>
      <TopModulesDropdown />
    </template>

    <template #sidebar>
      <aside class="sat-sidebar">
        <button
          class="sat-group-title"
          type="button"
          :aria-expanded="!groupCollapsed"
          @click="toggleGroup"
        >
          <DownOutlined class="sat-caret" :class="{ 'is-collapsed': groupCollapsed }" />
          <span class="sat-group-text">卫星遥感数据管理</span>
        </button>

        <div v-show="!groupCollapsed" class="sat-group-items">
          <button
            v-for="item in menus"
            :key="item.path"
            type="button"
            class="sat-menu-item"
            :class="{ active: isActive(item.path) }"
            @click="goTo(item.path)"
          >
            <span class="sat-menu-text">{{ item.label }}</span>
          </button>
        </div>
      </aside>
    </template>

    <div class="sat-page-host">
      <router-view />
    </div>
  </ShellLayout>
</template>

<script>
import { DownOutlined } from "@ant-design/icons-vue"
import ShellLayout from "@/shell/ShellLayout.vue"
import TopModulesDropdown from "@/shell/components/TopModulesDropdown.vue"

export default {
  name: "SatelliteLayout",
  components: {
    DownOutlined,
    ShellLayout,
    TopModulesDropdown
  },
  data() {
    return {
      groupCollapsed: false,
      menus: [
        { label: "卫星遥感数据资源池管理", path: "/satellite/data-pool" },
        { label: "卫星遥感元数据维护", path: "/satellite/metadata" },
        { label: "卫星遥感数据目录管理", path: "/satellite/catalog" },
        { label: "卫星遥感数据查询检索服务", path: "/satellite/query" },
        { label: "卫星遥感数据共享访问", path: "/satellite/share" }
      ]
    }
  },
  methods: {
    isActive(path) {
      return this.$route.path === path
    },
    toggleGroup() {
      this.groupCollapsed = !this.groupCollapsed
    },
    goTo(path) {
      if (this.$route.path !== path) {
        this.$router.push(path)
      }
    }
  }
}
</script>

<style scoped>
/* 侧栏尺寸与 mars3d 的展开态保持一致（240px / top 54px） */
.sat-sidebar {
  position: absolute;
  left: 0;
  top: 54px;
  bottom: 0;
  width: 240px;
  box-sizing: border-box;
  padding: 10px 8px;
  background: #ffffff;
  border-right: 1px solid #e5e6eb;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 20;
}

.sat-group-title {
  width: 100%;
  height: 42px;
  padding: 10px 12px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  color: var(--syc-menu-text-secondary, #4e5969);
  text-align: left;
  transition: color 0.2s, background 0.2s;
}

.sat-group-title:hover {
  color: var(--syc-menu-text, #1d2129);
  background: #f2f3f5;
}

.sat-caret {
  font-size: 12px;
  transition: transform 0.2s;
}

.sat-caret.is-collapsed {
  transform: rotate(-90deg);
}

.sat-group-text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
}

.sat-group-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
}

.sat-menu-item {
  width: 100%;
  height: 40px;
  padding: 0 8px;
  border: none;
  border-radius: 0;
  background: transparent;
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  outline: none;
  color: var(--syc-menu-text-secondary, #4e5969);
  text-align: left;
  transition: background 0.2s, color 0.2s;
}

.sat-menu-item:hover {
  color: var(--syc-menu-text, #1d2129);
  background: #f2f3f5;
}

.sat-menu-item.active {
  color: var(--syc-submenu-active, #165dff);
  background: var(--syc-menu-active-bg, #e8f3ff);
}

.sat-menu-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: var(--syc-submenu-active, #5cadff);
  border-radius: 2px;
}

.sat-menu-text {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  color: inherit;
  text-align: left;
}

/* ShellLayout 的 .map-slot 是 absolute inset:0，这里再包一层滚动容器 */
.sat-page-host {
  height: 100%;
  overflow: auto;
  background: #f0f2f5;
}
</style>
