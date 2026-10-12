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
    }
  ]
})
