import "mars3d-cesium/Build/Cesium/Widgets/widgets.css"
import "mars3d/mars3d.css"
import "font-awesome/css/font-awesome.css"

import "mars3d"
import "@mars/components/mars-work/expand/index"
import "@mars/styles/theme.css"
import "@mars/styles/popup-shell.css"

import { createApp } from "vue"
import Root from "@/shell/Root.vue"
import { injectState, key } from "@mars/common/store/widget"
import store from "./widget-store"
import MarsUIInstall from "@mars/components/mars-ui"
import "@mars/components/mars-ui/common"
import { router } from "@/shell/router"

const app = createApp(Root)

MarsUIInstall(app)

app.use(injectState(store), key)
app.use(router)

app.mount("#app")
