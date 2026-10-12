<template>
  <mars-dialog :draggable="false" customClass="base-pannel" right="10" top="10">
    <template v-for="(item, i) in data" :key="i">
      <div
        v-if="item.widget && !item.children"
        :class="['toolbar-item', activeTools.includes(item.widget) ? 'active' : '']"
        @mouseenter="enterWidget(item.widget ?? i)"
        @mouseleave="leaveWidget(item.widget ?? i)"
        @click="showWidget(item.widget)"
      >
        <mars-icon v-if="item.icon" :icon="item.icon" width="18"></mars-icon>
        <!-- <img v-if="item.img && !activeTools.includes(item.widget)" :src="item.img" class="image" />
        <img v-if="item.activeImg && activeTools.includes(item.widget)" :src="item.activeImg" class="image" /> -->

        <span class="title">{{ item.name }}</span>
      </div>

      <mars-dropdown-menu v-if="item.children && !item.widget" trigger="hover" placement="bottom">
        <div
          :class="['toolbar-item', isIncludesMenu(item.children, i) ? 'active' : '']"
          @mouseenter="enterWidget(item.widget ?? i)"
          @mouseleave="leaveWidget(item.widget ?? i)"
        >
          <mars-icon v-if="item.icon" :icon="item.icon" width="18"></mars-icon>
          <!-- <img v-if="item.img && !isIncludesMenu(item.children, i)" :src="item.img" class="image" />
          <img v-if="item.activeImg && isIncludesMenu(item.children, i)" :src="item.activeImg" class="image" /> -->

          <span class="title">
            {{ item.name }}
          </span>
        </div>
        <template #overlay>
          <a-menu @click="(data) => clickMenu(data, i)">
            <a-menu-item v-for="child in item.children" :key="child.widget" :title="child.name">
              <mars-icon v-if="child.icon" :icon="child.icon" width="18"></mars-icon>
              <span>{{ child.name }}</span>
            </a-menu-item>
          </a-menu>
        </template>
      </mars-dropdown-menu>
    </template>
  </mars-dialog>
</template>

<script setup lang="ts">
/**
 * 导航菜单按钮 （右上角）
 * @copyright 火星科技 mars3d.cn
 * @author 火星渣渣灰 2022-01-10
 */
import { ref } from "vue"
import { useWidget } from "@mars/common/store/widget"

const { currentWidget, activate, isActivate, disable } = useWidget()

currentWidget.onUpdate((widget: string | any) => {
  setTimeout(() => {
    if (widget && typeof widget === "string") {
      leaveWidget(widget)
    } else if (widget.enter) {
      enterWidget(widget.name)
    }
  }, 5)
})

const data: any = [
  { name: "底图", icon: "international", widget: "manage-basemap" },
  { name: "图层", icon: "layers", widget: "manage-layers" },
  { name: "eoAPI", icon: "global", widget: "eoapi-workbench" }
]

const activeTools = ref<any[]>([])

const isIncludesMenu = (menu: any, index: string | number) => {
  if (menu.filter((child) => activeTools.value.includes(child.widget) || activeTools.value.includes(index))?.length) {
    return true
  }
  return false
}

const enterWidget = (widget: string | number) => {
  activeTools.value = activeTools.value.filter((item, index) => item !== widget)
  activeTools.value.push(widget)
}

const leaveWidget = (widget: string | number) => {
  // 激活 widget 弹窗同时高亮
  activeTools.value.forEach((tool, index) => {
    // 肯定为组件
    if (typeof tool === "string") {
      if (isActivate(tool)) {
        return
      } else if (tool !== widget) {
        activeTools.value.splice(index, 1)
      }
    }
    if (tool === widget) {
      activeTools.value.splice(index, 1)
    }
  })

  // 仅移入移出高亮
  // const index = activeTools.value.indexOf(widget)
  // if (index !== -1) { activeTools.value.splice(index, 1) }
}

const showWidget = (widget: string) => {
  // 实现菜单互斥：点击一个菜单时，关闭其他 toolbar 菜单
  const otherWidgets = data
    .filter((item: any) => item.widget && item.widget !== widget)
    .map((item: any) => item.widget)
  
  // 如果当前 widget 已激活，则关闭它；否则先关闭其他菜单再激活当前菜单
  if (isActivate(widget)) {
    disable(widget)
  } else {
    otherWidgets.forEach((w: string) => {
      if (isActivate(w)) {
        disable(w)
      }
    })
    activate(widget)
  }
}

const clickMenu = ({ key }: any, index: string | number) => {
  // 功能菜单弹窗出现，工具栏高亮,如不需要注释
  leaveWidget(index)
  enterWidget(key)
  
  // 关闭其他 toolbar 菜单
  const otherWidgets = data
    .filter((item: any) => item.widget)
    .map((item: any) => item.widget)
  
  otherWidgets.forEach((w: string) => {
    if (isActivate(w)) {
      disable(w)
    }
  })
  
  activate(key)
}
</script>

<style lang="less">
.base-pannel {
  height: 38px;
  background: var(--mars-poi-border) !important;

  .mars-dialog__content {
    padding: 0 !important;
    background-image: none !important;
    overflow: hidden !important;
    border: none;
    background-color: var(--mars-bg-base);
    height: 40px;
    border-radius: 4px;
  }

  .toolbar-item {
    width: 85px;
    text-align: center;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: var(--mars-text-color);
    font-family: var(--mars-font-family);
    font-size: 14px;
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
    gap: 6px;

    &:hover {
      background-color: var(--mars-list-select);
      color: var(--mars-text-color);
    }

    .mars-icon {
      color: var(--mars-control-icon);
      transition: color 0.2s ease;
    }

    .title {
      padding-left: 0;
      padding-bottom: 0;
      line-height: 1;
    }

    &:first-child {
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
    }

    &:last-child {
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
    }
  }

  .ant-dropdown-open {
    .active();
  }

  .active {
    background-color: var(--mars-hover-color);
    color: #ffffff;

    .mars-icon {
      color: #ffffff;
    }
  }
}
</style>
