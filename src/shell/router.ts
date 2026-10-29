import { createRouter, createWebHashHistory, createWebHistory } from "vue-router"

export const router = createRouter({
  history:
    (process.env.ROUTER_MODE || "hash") === "history"
      ? createWebHistory(process.env.BASE_URL || "/")
      : createWebHashHistory(process.env.BASE_URL || "/"),
  routes: [
    {
      path: "/",
      component: () => import("@/pages/map/App.vue")
    },
    {
      path: "/cui-chat",
      component: () => import("@/cui-bridge/CuiChatPage.vue")
    },
    // 卫星遥感数据管理子系统（独立目录，删除 src/pages/satellite 并移除本块即可完全回滚）
    {
      path: "/satellite",
      component: () => import("@/pages/satellite/SatelliteLayout.vue"),
      redirect: "/satellite/data-pool",
      children: [
        {
          path: "data-pool",
          name: "satellite-data-pool",
          component: () => import("@/pages/satellite/views/SatelliteDataPoolLayout.vue")
        },
        {
          path: "metadata",
          name: "satellite-metadata",
          component: () => import("@/pages/satellite/views/SatelliteMetadataLayout.vue")
        },
        {
          path: "catalog",
          name: "satellite-catalog",
          component: () => import("@/pages/satellite/views/SatelliteDataCatalogLayout.vue")
        },
        {
          path: "query",
          name: "satellite-query",
          component: () => import("@/pages/satellite/views/SatelliteDataQueryLayout.vue")
        },
        {
          path: "share",
          name: "satellite-share",
          component: () => import("@/pages/satellite/views/SatelliteDataShareLayout.vue")
        }
      ]
    }
  ]
})
