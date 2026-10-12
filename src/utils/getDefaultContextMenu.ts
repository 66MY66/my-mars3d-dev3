import * as mars3d from "mars3d"
import { $alert as globalAlert } from "@mars/components/mars-ui/index"
import {
  Local,
  PreviewOpen,
  Forbid,
  Cube,
  MultiTriangular,
  Close,
  MapDistance,
  Ruler,
  Texture,
  AutoHeightOne,
  Compass,
  DeleteKey,
  Mark,
  Label,
  Change,
  BringToFrontOne,
  Asterisk,
  Rectangle,
  Editor,
  Export,
  ClearFormat,
  Effects,
  LightRain,
  Snow as SnowIcon,
  Fog as FogIcon,
  Halo,
  Brightness as BrightnessIcon,
  DarkMode,
  Blackboard,
  HighLight,
  Config,
  LandSurveying,
  TwoTriangles,
  Sun,
  FlightAirflow,
  AddPicture,
  SwitchThemes,
  Agreement,
  TakeOff,
  KeyboardOne,
  RecentViewsSort,
  MoveInOne,
  ExclusiveGateway,
  CloseOne,
  LockOne,
  Box,
  MonitorOff,
  MapTwo,
  International,
  DatabaseForbid
} from "@icon-park/svg"

const iconStyle: any = { theme: "outline", fill: "currentColor", size: "18" }

const Cesium = mars3d.Cesium
const { LngLatPoint, Icon, CRS } = mars3d
const { downloadFile, formatNum } = mars3d.Util
const { addPositionsHeight } = mars3d.PointUtil
const { proj4Trans } = mars3d.PointTrans
const { logInfo } = mars3d.Log
const { RotatePoint, Measure, KeyboardRoam } = mars3d.thing
const { Bloom, Brightness, BlackAndWhite, NightVision, Outline, Rain, Snow, Fog } = mars3d.effect

const dropletMarkerUrl = new URL("../components/mars-ui/assets/images/query-site-text_num.png", import.meta.url).href



// 给【Map】绑定默认右键菜单
export function getDefaultContextMenu(map) {
  const that = map.contextmenu

  const that_thing = map.thing
  const that_effect = map.effect

  return [
    {
      text: function () {
        return map.getLangText("_查看此处坐标")
      },
      icon: Local(iconStyle),
      show: function (e) {
        return Cesium.defined(e.cartesian)
      },
      callback: function (e) {
        // 经纬度
        const mpt = LngLatPoint.fromCartesian(e.cartesian)

        const ptNew = proj4Trans([mpt.lng, mpt.lat], "EPSG:4326", CRS.CGCS2000_GK_Zone_3)

        const inhtml = `
         ${map.getLangText("_经度")}:${mpt.lng}, ${map.getLangText("_纬度")}:${mpt.lat}, ${map.getLangText("_海拔")}:${mpt.alt},
         ${map.getLangText("_横坐标")}:${ptNew[0].toFixed(1)}, ${map.getLangText("_纵坐标")}:${ptNew[1].toFixed(1)} (CGCS2000)
        `
        globalAlert(inhtml, map.getLangText("_位置信息"))

        logInfo(mpt.toString()) // 打印方便测试
      }
    },
    {
      text: function () {
        return map.getLangText("_查看区域面积")
      },
      icon: PreviewOpen(iconStyle),
      callback: function (e) {
        const mpt = JSON.stringify(map.getCameraView())
        globalAlert(mpt, map.getLangText("_当前视角信息"))

        logInfo(mpt)
      }
    },
    // 下面是工具类
    {
      text: function () {
        return map.getLangText("_图上量算")
      },
      icon: Ruler(iconStyle),
      children: [
        {
          text: function () {
            return map.getLangText("_距离")
          },
          icon: MapDistance(iconStyle),
          callback: function (e) {
            if (!that_thing.measure) {
              that_thing.measure = new Measure()
              map.addThing(that_thing.measure)
            }
            that_thing.measure.distance()
          }
        },
        {
          text: function () {
            return map.getLangText("_面积")
          },
          icon: Texture(iconStyle),
          callback: function (e) {
            if (!that_thing.measure) {
              that_thing.measure = new Measure()
              map.addThing(that_thing.measure)
            }
            that_thing.measure.area()
          }
        },
        {
          text: function () {
            return map.getLangText("_高度差")
          },
          icon: AutoHeightOne(iconStyle),
          callback: function (e) {
            if (!that_thing.measure) {
              that_thing.measure = new Measure()
              map.addThing(that_thing.measure)
            }
            that_thing.measure.heightTriangle()
          }
        },
        {
          text: function () {
            return map.getLangText("_角度")
          },
          icon: Compass(iconStyle),
          callback: function (e) {
            if (!that_thing.measure) {
              that_thing.measure = new Measure()
              map.addThing(that_thing.measure)
            }
            that_thing.measure.angle()
          }
        },
        {
          text: function () {
            return map.getLangText("_删除测量")
          },
          icon: DeleteKey(iconStyle),
          show: function (e) {
            return that_thing.measure && that_thing.measure.hasMeasure
          },
          callback: function (e) {
            if (that_thing.measure) {
              that_thing.measure.clear()
            }
          }
        }
      ]
    },
    {
      text: function () {
        return map.getLangText("_图上标记")
      },
      icon: Mark(iconStyle),
      children: [
        {
          text: function () {
            return map.getLangText("_标记点")
          },
          icon: Label(iconStyle),
          callback: function (e) {
            map.graphicLayer.startDraw({
              type: "billboard",
              style: {
                image: dropletMarkerUrl,
                scale: 0.65,
                hasPixelOffset: true,
                pixelOffsetY: -10,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                clampToGround: true,
                visibleDepth: false
              },
              success: function (graphic) {
                // eslint-disable-next-line no-console
                logInfo(JSON.stringify(graphic.coord))
              }
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_标记线")
          },
          icon: Change(iconStyle),
          callback: function (e) {
            map.graphicLayer.startDraw({
              type: "polyline",
              style: {
                color: "#55ff33",
                width: 3
                // arcType: Cesium.ArcType.NONE
              },
              success: function (graphic) {
                // eslint-disable-next-line no-console
                logInfo(JSON.stringify(graphic.coord))
              }
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_标记面")
          },
          icon: BringToFrontOne(iconStyle),
          callback: function (e) {
            map.graphicLayer.startDraw({
              type: "polygon",
              style: {
                color: "#29cf34",
                opacity: 0.5,
                outline: true,
                outlineWidth: 2.0
              },
              success: function (graphic) {
                // eslint-disable-next-line no-console
                logInfo(JSON.stringify(graphic.coord))
              }
            })
          }
        },
        {
          text: "受灾区域标注",
          icon: BringToFrontOne(iconStyle),
          callback: function () {
            map.graphicLayer.startDraw({
              type: "polygon",
              attr: { regionType: "disaster", time: Date.now() },
              style: {
                color: "#ff7f50",
                opacity: 0.5,
                outline: true,
                outlineWidth: 2.0
              },
              success: function (graphic) {
                try {
                  graphic.attr = { ...(graphic.attr || {}), regionType: "disaster", time: Date.now() }
                } catch {}
                // eslint-disable-next-line no-console
                logInfo(JSON.stringify(graphic.coord))
              }
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_标记圆")
          },
          icon: Asterisk(iconStyle),
          callback: function (e) {
            map.graphicLayer.startDraw({
              type: "circle",
              style: {
                color: "#ffff00",
                opacity: 0.6
              },
              addHeight: 1,
              success: function (graphic) {
                // eslint-disable-next-line no-console
                logInfo(JSON.stringify(graphic.coord))
              }
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_标记矩形")
          },
          icon: Rectangle(iconStyle),
          callback: function (e) {
            map.graphicLayer.startDraw({
              type: "rectangle",
              style: {
                color: "#ffff00",
                opacity: 0.6
              },
              success: function (graphic) {
                // eslint-disable-next-line no-console
                logInfo(JSON.stringify(graphic.coord))
              }
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_文本标注")
          },
          icon: Label(iconStyle),
          callback: function (e) {
            map.graphicLayer.startDraw({
              type: "label",
              style: {
                text: "Mars3D",
                color: "#ffffff",
                opacity: 1,
                font_size: 30,
                font_family: "微软雅黑",
                outline: true,
                outlineColor: "#000000",
                outlineWidth: 2,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
              },
              success: function (graphic) {
                // eslint-disable-next-line no-console
                logInfo(JSON.stringify(graphic.coord))
                graphic.bindContextMenu([
                  {
                    text: map.getLangText("_删除对象"),
                    icon: "fa fa-trash-o",
                    callback: (e) => graphic.remove()
                  },
                  {
                    text: map.getLangText("_修改文本"),
                    icon: "fa fa-edit",
                    callback: (e) => {
                      const text = prompt("请输入新的文本", graphic.style.text)
                      if (text) {
                        graphic.style = { text }
                      }
                    }
                  },
                  {
                    text: map.getLangText("_修改大小"),
                    icon: "fa fa-font",
                    callback: (e) => {
                      const size = prompt("请输入新的字体大小", graphic.style.font_size || 30)
                      if (size && !isNaN(Number(size))) {
                        graphic.style = { font_size: Number(size) }
                      }
                    }
                  }
                ])
              }
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_允许编辑")
          },
          icon: Editor(iconStyle),
          show: function (e) {
            return !map.graphicLayer.isAutoEditing
          },
          callback: function (e) {
            map.graphicLayer.isAutoEditing = true
          }
        },
        {
          text: function () {
            return map.getLangText("_禁止编辑")
          },
          icon: DatabaseForbid(iconStyle),
          show: function (e) {
            return map.graphicLayer.isAutoEditing
          },
          callback: function (e) {
            map.graphicLayer.isAutoEditing = false
          }
        },
        {
          text: function () {
            return map.getLangText("_导出JSON")
          },
          icon: Export(iconStyle),
          show: function (e) {
            return map.graphicLayer.length > 0
          },
          callback: function (e) {
            const json = map.graphicLayer.toJSON()
            logInfo(json)
            downloadFile("标绘图层数据.json", JSON.stringify(json))
          }
        },
        {
          text: function () {
            return map.getLangText("_清除标记")
          },
          icon: ClearFormat(iconStyle),
          show: function (e) {
            return map.graphicLayer.length > 0
          },
          callback: function (e) {
            map.graphicLayer.clear()
          }
        }
      ]
    },

    { type: "line" }, // 间隔线

    // 视角
    {
      text: function () {
        return map.getLangText("_图层切换")
      },
      icon: SwitchThemes(iconStyle),
      children: [
        {
          text: function () {
            return map.getLangText("_遥感图层")
          },
          icon: Agreement(iconStyle),
          show: function (e) {
            return map.scene.screenSpaceCameraController.enableCollisionDetection
          },
          callback: function (e) {
            map.scene.screenSpaceCameraController.enableCollisionDetection = false
          }
        },
        {
          text: function () {
            return map.getLangText("_禁止进入地下")
          },
          icon: Forbid(iconStyle),
          show: function (e) {
            return !map.scene.screenSpaceCameraController.enableCollisionDetection
          },
          callback: function (e) {
            map.scene.screenSpaceCameraController.enableCollisionDetection = true
          }
        },
        {
          text: function () {
            return map.getLangText("_绕此处环绕飞行")
          },
          icon: TakeOff(iconStyle),
          show: function (e) {
            return e.cartesian && (!that_thing.rotatePoint || !that_thing.rotatePoint?.isStart)
          },
          callback: function (e) {
            if (!that_thing.rotatePoint) {
              that_thing.rotatePoint = new RotatePoint()
              map.addThing(that_thing.rotatePoint)
            }
            that_thing.rotatePoint.start(e.cartesian)
          }
        },
        {
          text: function () {
            return map.getLangText("_关闭环绕飞行")
          },
          icon: CloseOne(iconStyle),
          show: function (e) {
            return that_thing.rotatePoint?.isStart
          },
          callback: function (e) {
            if (that_thing.rotatePoint) {
              that_thing.rotatePoint.stop()
            }
          }
        },

        {
          text: function () {
            return map.getLangText("_移动到此处")
          },
          icon: MoveInOne(iconStyle),
          show: function (e) {
            return Cesium.defined(e.cartesian)
          },
          callback: function (e) {
            const cameraDistance = Cesium.Cartesian3.distance(e.cartesian, map.camera.positionWC) * 0.1

            map.flyToPoint(e.cartesian, {
              radius: cameraDistance, // 距离目标点的距离
              maximumHeight: map.camera.positionCartographic.height
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_第一视角站到此处")
          },
          icon: RecentViewsSort(iconStyle),
          show: function (e) {
            return Cesium.defined(e.cartesian)
          },
          callback: function (e) {
            map.camera.flyTo({
              destination: addPositionsHeight(e.cartesian, 10), // 升高10米
              orientation: {
                heading: map.camera.heading,
                pitch: 0.0,
                roll: 0.0
              },
              maximumHeight: map.camera.positionCartographic.height
            })
          }
        },
        {
          text: function () {
            return map.getLangText("_开启键盘漫游")
          },
          icon: KeyboardOne(iconStyle),
          show: function (e) {
            return !that_thing.keyboardRoam || !that_thing.keyboardRoam.enabled
          },
          callback: function (e) {
            if (!that_thing.keyboardRoam) {
              that_thing.keyboardRoam = new KeyboardRoam()
              map.addThing(that_thing.keyboardRoam)
            }
            that_thing.keyboardRoam.enabled = true
          }
        },
        {
          text: function () {
            return map.getLangText("_关闭键盘漫游")
          },
          icon: CloseOne(iconStyle),
          show: function (e) {
            return that_thing.keyboardRoam?.enabled
          },
          callback: function (e) {
            that_thing.keyboardRoam.enabled = false
          }
        },
        {
          text: function () {
            return map.getLangText("_跟踪锁定")
          },
          icon: LockOne(iconStyle),
          show: function (e) {
            const graphic = e.graphic
            if (!graphic) {
              return false
            }

            if (graphic.entity instanceof Cesium.Entity) {
              return true
            } else if (graphic.trackedEntity instanceof Cesium.Entity) {
              return true
            }

            return false
          },
          callback: function (e) {
            map.trackedEntity = e.graphic
            that.trackedGraphic = e.graphic
          }
        },
        {
          text: function () {
            return map.getLangText("_取消锁定")
          },
          icon: LockOne(iconStyle),
          show: function (e) {
            return that.trackedGraphic === e.graphic && map.trackedEntity !== undefined
          },
          callback: function (e) {
            map.trackedEntity = undefined
            that.trackedGraphic = undefined
          }
        }
      ]
    },
    // 地形
    {
      text: function () {
        return map.getLangText("_地形")
      },
      icon: International(iconStyle),
      show: function (e) {
        return Cesium.defined(e.cartesian)
      },
      children: [
        {
          text: function () {
            return map.getLangText("_开启地形")
          },
          icon: MapTwo(iconStyle),
          show: function (e) {
            return !map.hasTerrain
          },
          callback: function (e) {
            map.hasTerrain = true
          }
        },
        {
          text: function () {
            return map.getLangText("_关闭地形")
          },
          icon: CloseOne(iconStyle),
          show: function (e) {
            return map.hasTerrain
          },
          callback: function (e) {
            map.hasTerrain = false
          }
        },
        {
          text: function () {
            return map.getLangText("_显示三角网")
          },
          icon: MultiTriangular(iconStyle),
          show: function (e) {
            return !map.scene.globe._surface.tileProvider._debug.wireframe
          },
          callback: function (e) {
            map.scene.globe._surface.tileProvider._debug.wireframe = true
          }
        },
        {
          text: function () {
            return map.getLangText("_关闭三角网")
          },
          icon: CloseOne(iconStyle),
          show: function (e) {
            return map.scene.globe._surface.tileProvider._debug.wireframe
          },
          callback: function (e) {
            map.scene.globe._surface.tileProvider._debug.wireframe = false
          }
        }
      ]
    },
    // 图层
    {
      text: function () {
        return map.getLangText("_图层")
      },
      icon: Cube(iconStyle),
      show: function (e) {
        return Cesium.defined(e.layer)
      },
      children: [
        {
          text: function () {
            return map.getLangText("_显示三角网")
          },
          icon: MultiTriangular(iconStyle),
          show: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            if (!model) {
              return false
            }
            return !model.debugWireframe && model._enableDebugWireframe
          },
          callback: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            model.debugWireframe = true
          }
        },
        {
          text: function () {
            return map.getLangText("_关闭三角网")
          },
          icon: CloseOne(iconStyle),
          show: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            if (!model) {
              return false
            }
            return model.debugWireframe && model._enableDebugWireframe
          },
          callback: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            model.debugWireframe = false
          }
        },
        {
          text: function () {
            return map.getLangText("_显示包围盒")
          },
          icon: Box(iconStyle),
          show: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            if (!model) {
              return false
            }
            return !model.debugShowBoundingVolume
          },
          callback: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            model.debugShowBoundingVolume = true
          }
        },
        {
          text: function () {
            return map.getLangText("_关闭包围盒")
          },
          icon: MonitorOff(iconStyle),
          show: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            if (!model) {
              return false
            }
            return model.debugShowBoundingVolume
          },
          callback: function (e) {
            const model = map.pick3DTileset(e.cartesian) // 拾取绘制返回的模型
            model.debugShowBoundingVolume = false
          }
        },
        {
          text: function () {
            return map.getLangText("_导出JSON")
          },
          icon: Export(iconStyle),
          show: function (e) {
            return e.layer.toJSON
          },
          callback: function (e) {
            const json = e.layer.toJSON()
            logInfo(json)
            downloadFile("layer图层配置.json", JSON.stringify(json))
          }
        }
      ]
    }
 
  ]
}
