import * as THREE from "three"
import * as mars3d from "mars3d"
import { defaultEffectSettings, evaluateQuality, initialQuality, inBounds, orderedTracks, scanTargets, QUALITY_PRESETS, type DisplayPoint, type DisplayPolygon, type EffectSettings, type Quality } from "./display-model"
import type { GeoBounds } from "./earthquake-analysis"

export type EffectStatus = { quality: Quality; fps: number | null; optimized: boolean; count: number; error?: string }

export class Thematic3D {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera()
  private content = new THREE.Group()
  private origin = new THREE.Matrix4()
  private inverseOrigin: mars3d.Cesium.Matrix4 | null = null
  private settings = defaultEffectSettings()
  private points: DisplayPoint[] = []
  private polygons: DisplayPolygon[] = []
  private bounds: GeoBounds | null = null
  private quality: Quality = "high"
  private rings: Array<{ mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; radius: number; phase: number }> = []
  private flows: Array<{ curve: THREE.CurvePath<THREE.Vector3>; geometry: THREE.BufferGeometry; count: number }> = []
  private removeRender: () => void
  private raf = 0
  private previous = 0
  private windowStart = 0
  private frames = 0
  private slowWindows = 0
  private elapsed = 0
  private disposed = false
  private report: EffectStatus = { quality: "high", fps: null, optimized: false, count: 0 }
  private resizedPixels = 0

  constructor(private map: mars3d.Map, private notify: (status: EffectStatus) => void) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.canvas = this.renderer.domElement
    this.canvas.className = "thematic-three-overlay"
    this.canvas.setAttribute("aria-label", "专题三维数据图层")
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "2" })
    map.scene.canvas.parentElement!.appendChild(this.canvas)
    this.canvas.addEventListener("webglcontextlost", this.onContextLost)
    this.scene.add(this.content)
    this.removeRender = map.scene.postRender.addEventListener(this.render)
    this.raf = requestAnimationFrame(this.tick)
  }

  private onContextLost = (event: Event) => {
    event.preventDefault()
    this.settings.enabled = false
    this.canvas.style.display = "none"
    this.notify({ ...this.report, error: "3D 图形上下文已丢失，已保留二维结果；关闭后重新启用 3D 可重试。" })
  }

  update(points: DisplayPoint[], polygons: DisplayPolygon[], bounds: GeoBounds, settings: EffectSettings) {
    const sourceChanged = this.points !== points || this.polygons !== polygons || JSON.stringify(this.bounds) !== JSON.stringify(bounds)
    const modeChanged = this.settings.quality !== settings.quality || !this.settings.enabled
    const settingsChanged = JSON.stringify(this.settings) !== JSON.stringify(settings)
    this.points = points
    this.polygons = polygons
    this.bounds = { ...bounds }
    this.settings = { ...settings, effects: [...settings.effects] }
    const size = this.map.scene.canvas
    const pixels = size.clientWidth * size.clientHeight * Math.min(devicePixelRatio || 1, 2) ** 2
    if (modeChanged) {
      this.quality = settings.quality === "auto" ? initialQuality(pixels, settings.effects.length) : settings.quality
      this.slowWindows = 0
      this.windowStart = 0
      this.frames = 0
    } else if (settings.quality === "auto" && this.quality === "high" && initialQuality(pixels, settings.effects.length) === "medium") {
      this.quality = "medium"
    }
    this.report = { ...this.report, quality: this.quality, optimized: settings.quality === "auto" && this.quality !== "high" }
    this.canvas.style.display = settings.enabled ? "block" : "none"
    if (sourceChanged || settingsChanged) { this.rebuild() }
    this.notify({ ...this.report })
    this.map.scene.requestRender()
  }

  setClip(bounds: { left: number; top: number; width: number; height: number } | null) {
    const rect = this.map.scene.canvas.getBoundingClientRect()
    this.canvas.style.clipPath = bounds
      ? `inset(${Math.max(0, bounds.top - rect.top)}px ${Math.max(0, rect.right - bounds.left - bounds.width)}px ${Math.max(0, rect.bottom - bounds.top - bounds.height)}px ${Math.max(0, bounds.left - rect.left)}px)`
      : "inset(100%)"
  }

  private local(point: DisplayPoint, altitude = 0) {
    const world = mars3d.Cesium.Cartesian3.fromDegrees(point.lon, point.lat, altitude)
    const result = mars3d.Cesium.Matrix4.multiplyByPoint(this.inverseOrigin!, world, new mars3d.Cesium.Cartesian3())
    return new THREE.Vector3(result.x, result.y, result.z)
  }

  private disposeContent() {
    this.content.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (object instanceof THREE.InstancedMesh) { object.dispose() }
      mesh.geometry?.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.filter(Boolean).forEach((material) => {
        ;(material as THREE.SpriteMaterial).map?.dispose()
        material.dispose()
      })
      if (object instanceof THREE.Light && "shadow" in object) { (object as THREE.DirectionalLight).shadow?.dispose() }
    })
    this.content.clear()
    this.rings = []
    this.flows = []
  }

  private rebuild() {
    this.disposeContent()
    if (!this.bounds || !this.settings.enabled) { return }
    const C = mars3d.Cesium
    const center = C.Cartesian3.fromDegrees((this.bounds.west + this.bounds.east) / 2, (this.bounds.south + this.bounds.north) / 2)
    const enu = C.Transforms.eastNorthUpToFixedFrame(center)
    this.origin.fromArray(C.Matrix4.toArray(enu))
    this.inverseOrigin = C.Matrix4.inverseTransformation(enu, new C.Matrix4())
    const points = this.points.filter((point) => inBounds(point, this.bounds!) && Number.isFinite(point.value))
    const range = Math.max(100, C.Cartesian3.distance(C.Cartesian3.fromDegrees(this.bounds.west, this.bounds.south), C.Cartesian3.fromDegrees(this.bounds.east, this.bounds.north)))
    const radius = range * 0.006
    const maximum = Math.max(1e-8, ...points.map((point) => Math.abs(point.value)))
    const positiveMaximum = Math.max(1e-8, ...points.map(point => Math.max(0, point.value)))
    const preset = QUALITY_PRESETS[this.quality]
    const height = (point: DisplayPoint) => range * 0.15 * this.settings.height * Math.abs(point.value) / maximum
    this.renderer.shadowMap.enabled = this.settings.shadows && preset.shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.content.add(new THREE.AmbientLight(0xffffff, 2))
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(-range / 2, -range / 3, range)
    sun.castShadow = this.renderer.shadowMap.enabled
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -range, right: range, top: range, bottom: -range, near: 1, far: range * 4 })
    sun.shadow.camera.updateProjectionMatrix()
    this.content.add(sun)

    if (this.settings.effects.includes("extrusion")) {
      const polygons = this.polygons.filter((item) => Number.isFinite(item.value) && item.rings[0]?.length >= 4)
      const polygonMaximum = Math.max(1e-8, ...polygons.map((item) => Math.abs(item.value)))
      for (const item of polygons) {
        const outer = item.rings[0]
        const lon = outer.reduce((sum, point) => sum + point[0], 0) / outer.length
        const lat = outer.reduce((sum, point) => sum + point[1], 0) / outer.length
        const localFrame = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(lon, lat))
        const inverseFrame = C.Matrix4.inverseTransformation(localFrame, new C.Matrix4())
        const shape = new THREE.Shape()
        item.rings.forEach((ring, ringIndex) => {
          const path = ringIndex ? new THREE.Path() : shape
          ring.forEach(([x, y], index) => {
            const world = C.Cartesian3.fromDegrees(x, y)
            const local = C.Matrix4.multiplyByPoint(inverseFrame, world, new C.Cartesian3())
            if (index === 0) { path.moveTo(local.x, local.y) } else { path.lineTo(local.x, local.y) }
          })
          if (ringIndex) { shape.holes.push(path as THREE.Path) }
        })
        const depth = Math.max(range * 0.001, range * 0.15 * this.settings.height * Math.abs(item.value) / polygonMaximum)
        const color = new THREE.Color(item.color)
        const material = [
          new THREE.MeshStandardMaterial({ color, transparent: true, opacity: this.settings.opacity, side: THREE.DoubleSide, depthWrite: this.settings.opacity >= 0.95 }),
          new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.66), transparent: true, opacity: this.settings.opacity, side: THREE.DoubleSide, depthWrite: this.settings.opacity >= 0.95 })
        ]
        const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 }), material)
        mesh.castShadow = sun.castShadow
        const transform = C.Matrix4.multiply(this.inverseOrigin!, localFrame, new C.Matrix4())
        mesh.matrixAutoUpdate = false
        mesh.matrix.fromArray(C.Matrix4.toArray(transform))
        this.content.add(mesh)
        if (this.settings.labels && polygons.length <= 40) { this.addLabel(item.value.toFixed(2), this.local({ lon, lat } as DisplayPoint, depth + radius), range) }
      }
    }

    for (const kind of ["columns", "heat"] as const) {
      if (!this.settings.effects.includes(kind)) { continue }
      const rows = kind === "heat" ? points.filter((point) => point.value > 0) : points
      const geometry = kind === "columns" ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.55, 1, 1, preset.segments)
      if (kind === "heat") { geometry.rotateX(Math.PI / 2) }
      const Material = this.settings.lighting ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial
      const material = new Material({ transparent: true, opacity: this.settings.opacity, depthWrite: this.settings.opacity >= 0.95 })
      const mesh = new THREE.InstancedMesh(geometry, material, rows.length)
      mesh.castShadow = sun.castShadow
      const dummy = new THREE.Object3D()
      rows.forEach((point, index) => {
        const h = Math.max(range * 0.001, kind === "heat" ? range * 0.15 * this.settings.height * point.value / positiveMaximum : height(point))
        dummy.position.copy(this.local(point, h / 2))
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.local(point, h).sub(this.local(point)).normalize())
        dummy.scale.set(radius * (kind === "heat" ? 1.6 : 1), radius * (kind === "heat" ? 1.6 : 1), h)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
        mesh.setColorAt(index, new THREE.Color(kind === "heat" ? heatColor(point.value / positiveMaximum) : point.color))
        if (this.settings.labels && index < 40 && kind === this.settings.effects.find((effect) => effect === "heat" || effect === "columns")) {
          this.addLabel(point.value.toFixed(2), this.local(point, h + radius * 3), range)
        }
      })
      mesh.instanceMatrix.needsUpdate = true
      this.content.add(mesh)
    }

    if (sun.castShadow) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(range * 2, range * 2), new THREE.ShadowMaterial({ opacity: 0.18 }))
      plane.receiveShadow = true
      plane.position.z = -radius
      this.content.add(plane)
    }
    if (this.settings.effects.includes("trajectory")) {
      for (const track of orderedTracks(points)) {
        const path = new THREE.CurvePath<THREE.Vector3>()
        for (let i = 1; i < track.length; i++) {
          path.add(new THREE.LineCurve3(this.local(track[i - 1], radius * 3), this.local(track[i], radius * 3)))
        }
        if (path.getLength() === 0) { continue }
        this.content.add(new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, Math.min(256, track.length * 4)), radius * 0.3, preset.segments, false), new THREE.MeshBasicMaterial({ color: "#27b6bc", transparent: true, opacity: this.settings.opacity * 0.5 })))
        const count = Math.max(4, Math.min(preset.particles, this.settings.density))
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3))
        this.content.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#ffdf80", size: 4, sizeAttenuation: false, transparent: true, opacity: this.settings.opacity })))
        this.flows.push({ curve: path, geometry, count })
      }
    }
    if (this.settings.effects.includes("scan")) {
      const marked = scanTargets(points).slice(0, preset.particles)
      marked.forEach((point, index) => {
        for (let wave = 0; wave < 2; wave++) {
          const mesh = new THREE.Mesh(new THREE.RingGeometry(0.91, 1, preset.segments * 3), new THREE.MeshBasicMaterial({ color: point.color, transparent: true, opacity: this.settings.opacity, side: THREE.DoubleSide, depthWrite: false }))
          mesh.position.copy(this.local(point, radius))
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.local(point, radius * 2).sub(this.local(point)).normalize())
          this.content.add(mesh)
          this.rings.push({ mesh, radius: radius * 9, phase: wave * 0.5 + index * 0.08 })
        }
      })
    }
    this.report.count = points.length + (this.settings.effects.includes("extrusion") ? this.polygons.length : 0)
    this.canvas.dataset.effects = this.settings.effects.join(",")
    this.canvas.dataset.quality = this.quality
    this.canvas.dataset.pointCount = String(points.length)
  }

  private addLabel(text: string, position: THREE.Vector3, range: number) {
    const canvas = document.createElement("canvas")
    canvas.width = 192
    canvas.height = 48
    const context = canvas.getContext("2d")!
    context.fillStyle = "rgba(14,24,32,0.9)"
    context.fillRect(0, 0, 192, 48)
    context.fillStyle = "#ffffff"
    context.font = "28px sans-serif"
    context.textAlign = "center"
    context.fillText(text, 96, 34)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }))
    sprite.position.copy(position)
    sprite.scale.set(range * 0.05, range * 0.0125, 1)
    this.content.add(sprite)
  }

  private tick = (now: number) => {
    if (this.disposed) { return }
    this.raf = requestAnimationFrame(this.tick)
    if (!this.settings.enabled || document.hidden) { this.previous = 0; this.windowStart = 0; this.frames = 0; this.slowWindows = 0; return }
    const delta = this.previous ? Math.min(0.1, (now - this.previous) / 1000) : 0
    this.previous = now
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduced) { this.elapsed += delta * this.settings.speed }
    for (const ring of this.rings) {
      const phase = (this.elapsed * 0.35 + ring.phase) % 1
      ring.mesh.scale.setScalar((0.15 + phase * 0.85) * ring.radius)
      ring.mesh.material.opacity = (1 - phase) * this.settings.opacity
    }
    for (const flow of this.flows) {
      const attribute = flow.geometry.getAttribute("position") as THREE.BufferAttribute
      for (let i = 0; i < flow.count; i++) {
        const t = (this.elapsed * 0.08 + i / flow.count * this.settings.tail) % 1
        const point = flow.curve.getPoint(t)
        attribute.setXYZ(i, point.x, point.y, point.z)
      }
      attribute.needsUpdate = true
    }
    this.map.scene.requestRender()
  }

  private render = () => {
    if (!this.settings.enabled || document.hidden || this.disposed) { return }
    const source = this.map.scene.canvas
    if (this.map.scene.mode !== mars3d.Cesium.SceneMode.SCENE3D) { this.canvas.style.display = "none"; return }
    this.canvas.style.display = "block"
    const width = source.clientWidth
    const height = source.clientHeight
    if (!width || !height) { return }
    const ratio = Math.min(devicePixelRatio || 1, 2) * QUALITY_PRESETS[this.quality].resolution
    if (this.canvas.width !== Math.floor(width * ratio) || this.canvas.height !== Math.floor(height * ratio)) {
      this.renderer.setPixelRatio(ratio)
      this.renderer.setSize(width, height, false)
      this.canvas.style.width = `${width}px`
      this.canvas.style.height = `${height}px`
    }
    const pixels = width * height * Math.min(devicePixelRatio || 1, 2) ** 2
    if (pixels !== this.resizedPixels) {
      this.resizedPixels = pixels
      if (this.settings.quality === "auto" && this.quality === "high" && initialQuality(pixels, this.settings.effects.length) !== "high") { this.degrade("medium") }
    }
    this.camera.projectionMatrix.fromArray(mars3d.Cesium.Matrix4.toArray(this.map.camera.frustum.projectionMatrix))
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert()
    this.camera.matrixWorldInverse.fromArray(mars3d.Cesium.Matrix4.toArray(this.map.camera.viewMatrix)).multiply(this.origin)
    this.camera.matrixWorld.copy(this.camera.matrixWorldInverse).invert()
    this.camera.matrix.copy(this.camera.matrixWorld)
    this.camera.matrixWorld.decompose(this.camera.position, this.camera.quaternion, this.camera.scale)
    this.camera.matrixAutoUpdate = false
    this.renderer.render(this.scene, this.camera)
    this.frames++
    const now = performance.now()
    if (!this.windowStart) { this.windowStart = now; this.frames = 0 }
    if (now - this.windowStart >= 1200) {
      const fps = Math.round(this.frames * 1000 / (now - this.windowStart))
      if (this.settings.quality === "auto") {
        const next = evaluateQuality(this.quality, fps, this.slowWindows)
        this.slowWindows = next.slowWindows
        if (next.changed) { this.degrade(next.quality) }
      }
      this.report = { ...this.report, fps }
      this.notify({ ...this.report })
      this.windowStart = now
      this.frames = 0
    }
  }

  private degrade(quality: Quality) {
    this.quality = quality
    this.report = { ...this.report, quality, optimized: true }
    this.rebuild()
    this.notify({ ...this.report })
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.removeRender()
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost)
    this.disposeContent()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.canvas.remove()
  }
}

function heatColor(value: number) {
  return new THREE.Color("#ffdf66").lerp(new THREE.Color("#c72626"), Math.max(0, Math.min(1, value)))
}
