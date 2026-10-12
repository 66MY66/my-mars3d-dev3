/**
 * index页面的widget配置
 * @copyright 火星科技 mars3d.cn
 * @author 火星渣渣灰 2022-02-19
 */
import { defineAsyncComponent, markRaw } from "vue"
import { WidgetState } from "@mars/common/store/widget"
import { StoreOptions } from "vuex"

const store: StoreOptions<WidgetState> = {
  state: {
    widgets: [
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/query-poi/index.vue"))),
        name: "query-poi",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/toolbar/index.vue"))),
        name: "toolbar",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/manage-basemap/index.vue"))),
        name: "manage-basemap",
        group: "right-panel"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/manage-layers/index.vue"))),
        name: "manage-layers",
        group: "right-panel",
        disableOther: ["roamLine"]
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/manage-tools/index.vue"))),
        name: "manage-tools",
        group: "right-panel"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/thematic-workbench/index.vue"))),
        name: "thematic-workbench",
        group: "right-panel",
        autoDisable: true,
        disableOther: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/analysis-tool/index.vue"))),
        name: "tool-params",
        group: "right-panel"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/analysis-tool/index.vue"))),
        name: "spatial-analysis",
        group: "right-panel"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/insar-profile/index.vue"))),
        name: "insar-profile",
        group: "right-panel"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/alert-confirm/index.vue"))),
        name: "alert-confirm",
        group: "manage",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/manage-layers/scene-tree.vue"))),
        name: "layer-scenetree"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/manage-layers/picture-heatmap.vue"))),
        name: "layer-picture-heatmap"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/manage-layers/picture-guihua.vue"))),
        name: "layer-picture-guihua"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/manage-layers/thermal-evolution.vue"))),
        name: "layer-thermal-evolution"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/location-point/index.vue"))),
        name: "location-point",
        group: "right-panel"
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/mid-short-macro/index.vue"))),
        name: "mid-short-macro",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/disaster-loss-assessment/index.vue"))),
        name: "disaster-loss-assessment",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/loss-assessment-blank/index.vue"))),
        name: "loss-assessment-blank",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/split-screen-compare/index.vue"))),
        name: "split-screen-compare",
        group: "right-panel",
        autoDisable: true,
        meta: {
          icon: "column",
          title: "分屏对比",
          description: "左右分屏对比两个影像"
        }
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/eoapi-timeline-player/index.vue"))),
        name: "eoapi-timeline-player",
        group: "right-panel",
        autoDisable: true,
        meta: {
          icon: "play",
          title: "时间轴演化",
          description: "按时间顺序播放影像演化过程"
        }
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/result-playback/index.vue"))),
        name: "result-playback",
        group: "right-panel",
        autoDisable: true,
        meta: {
          icon: "history",
          title: "成果回放",
          description: "保存并回放成果 URL"
        }
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/dataset-repository/index.vue"))),
        name: "dataset-repository",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/my-repository/index.vue"))),
        name: "my-repository",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/save-result/index.vue"))),
        name: "save-result",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/current-task/index.vue"))),
        name: "current-task",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/hazard-identification/index.vue"))),
        name: "hazard-identification",
        group: "right-panel",
        autoDisable: true
      },
      {
        component: markRaw(defineAsyncComponent(() => import("@mars/widgets/basic/knowledge-graph/index.vue"))),
        name: "knowledge-graph",
        group: "right-panel",
        autoDisable: true
      }
    ],
    openAtStart: []
  }
}

export default store
