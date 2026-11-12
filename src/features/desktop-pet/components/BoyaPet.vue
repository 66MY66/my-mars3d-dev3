<script setup lang="ts">
import { computed } from "vue"

type PetMode =
  | "idle"
  | "hover"
  | "curious"
  | "greet"
  | "tickle"
  | "jump"
  | "dragging"
  | "guide"
  | "thinking"
  | "listening"
  | "sleepy"
  | "peek"
  | "proud"
  | "stretch";

const props = withDefaults(defineProps<{
  lookX?: number;
  lookY?: number;
  mode?: PetMode;
  speech?: string;
}>(), {
  lookX: 0,
  lookY: 0,
  mode: "idle",
  speech: "我在这儿，慢慢说。"
})

const emit = defineEmits<{
  click: [];
  doubleClick: [];
  contextMenu: [event: MouseEvent];
  dragStart: [event: PointerEvent];
  dragMove: [event: PointerEvent];
  dragEnd: [];
}>()

const assetBase = `${import.meta.env.BASE_URL}assets/desktop-pet/boya`

const layers = [
  ["left-leg", "left_leg.png"],
  ["right-leg", "right_leg.png"],
  ["body-torso", "body_torso.png"],
  ["left-arm", "left_arm.png"],
  ["right-arm", "right_arm.png"],
  ["left-arm-lift", "left_arm_pose_lift.png"],
  ["right-arm-lift", "right_arm_pose_lift.png"],
  ["left-arm-wave-a", "left_arm_pose_wave_a.png"],
  ["left-arm-wave-b", "left_arm_pose_wave_b.png"],
  ["right-arm-wave-a", "right_arm_pose_wave_a.png"],
  ["right-arm-wave-b", "right_arm_pose_wave_b.png"],
  ["collar", "collar.png"],
  ["left-ear", "left_ear.png"],
  ["right-ear", "right_ear.png"],
  ["left-horn", "horn_pair-left.png"],
  ["right-horn", "horn_pair-right.png"],
  ["head", "head_base.png"],
  ["mouth-laugh", "mouth_laugh.png"],
  ["left-eye-socket", "eye_socket-left.png"],
  ["right-eye-socket", "eye_socket-right.png"],
  ["left-pupil", "pupil_pair-left.png"],
  ["right-pupil", "pupil_pair-right.png"],
  ["forehead-mark", "forehead_mark.png"]
] as const

const visualState = computed<PetMode>(() => {
  if (props.mode === "hover") { return "curious" }
  return props.mode
})

const petStyle = computed(() => ({
  "--boya-look-x": props.lookX.toFixed(3),
  "--boya-look-y": props.lookY.toFixed(3)
}) as Record<string, string>)

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit("contextMenu", event)
}

function handlePointerDown(event: PointerEvent) {
  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  } catch {
    // Some synthetic pointer events cannot be captured; dragging still works inside the pet.
  }
  emit("dragStart", event)
}

function handlePointerMove(event: PointerEvent) {
  emit("dragMove", event)
}

function handlePointerEnd(event: PointerEvent) {
  try {
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)
  } catch {
    // Ignore release failures for pointers that were never captured.
  }
  emit("dragEnd")
}
</script>

<template>
  <div
    class="boya-slot-pet"
    :data-state="visualState"
    :style="petStyle"
    role="img"
    aria-label="玻尔慧临 IP"
    @click.stop="emit('click')"
    @dblclick.stop="emit('doubleClick')"
    @contextmenu="handleContextMenu"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerEnd"
    @pointercancel="handlePointerEnd"
  >
    <span class="boya-bubble is-visible">{{ speech }}</span>

    <div class="boya-pet-stage">
      <img
        v-for="[name, file] in layers"
        :key="name"
        class="boya-layer"
        :class="`boya-layer-${name}`"
        :src="`${assetBase}/${file}`"
        alt=""
        draggable="false"
      />
      <span class="boya-eye-line boya-eye-line-left" aria-hidden="true"></span>
      <span class="boya-eye-line boya-eye-line-right" aria-hidden="true"></span>
      <span class="boya-closed-eye boya-closed-eye-left" aria-hidden="true"></span>
      <span class="boya-closed-eye boya-closed-eye-right" aria-hidden="true"></span>
    </div>
  </div>
</template>

<style scoped>
.boya-slot-pet {
  --boya-look-x: 0;
  --boya-look-y: 0;
  --boya-green: #4da334;
  --boya-ink: #111811;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 220px;
  cursor: pointer;
  user-select: none;
}

.boya-pet-stage {
  position: absolute;
  left: 50%;
  top: 52%;
  width: 78%;
  aspect-ratio: 1086 / 1448;
  transform: translate(-50%, -50%);
  transform-origin: 50% 82%;
  animation: boya-breathe 5.4s ease-in-out infinite;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  will-change: transform;
}

.boya-slot-pet[data-state="dragging"] .boya-pet-stage {
  cursor: grabbing;
  animation: boya-drag 1.2s ease-in-out infinite;
}

.boya-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
  transform-origin: 50% 72%;
  will-change: transform, translate, rotate, opacity;
}

.boya-layer-left-leg,
.boya-layer-right-leg {
  z-index: 1;
  animation: none !important;
  transform: none !important;
}

.boya-layer-body-torso {
  z-index: 2;
}

.boya-layer-left-arm,
.boya-layer-right-arm,
.boya-layer-left-arm-lift,
.boya-layer-right-arm-lift,
.boya-layer-left-arm-wave-a,
.boya-layer-left-arm-wave-b,
.boya-layer-right-arm-wave-a,
.boya-layer-right-arm-wave-b {
  z-index: 1;
}

.boya-layer-collar {
  z-index: 4;
}

.boya-layer-head,
.boya-layer-mouth-laugh,
.boya-layer-left-ear,
.boya-layer-right-ear,
.boya-layer-left-horn,
.boya-layer-right-horn,
.boya-layer-left-eye-socket,
.boya-layer-right-eye-socket,
.boya-layer-left-pupil,
.boya-layer-right-pupil,
.boya-layer-forehead-mark {
  z-index: 5;
}

.boya-layer-mouth-laugh {
  z-index: 70;
  opacity: 0;
  scale: 1;
  transform-origin: 50% 53.6%;
  transition: opacity 120ms ease;
}

.boya-layer-body-torso {
  transform-origin: 50% 72%;
}

.boya-layer-left-leg {
  transform-origin: 43.2% 73.2%;
}

.boya-layer-right-leg {
  transform-origin: 56.8% 73.2%;
}

.boya-layer-head,
.boya-layer-mouth-laugh,
.boya-layer-left-ear,
.boya-layer-right-ear,
.boya-layer-left-horn,
.boya-layer-right-horn,
.boya-layer-forehead-mark,
.boya-layer-left-eye-socket,
.boya-layer-right-eye-socket {
  transform:
    rotate(calc(var(--boya-look-x) * .26deg))
    translate(
      calc(var(--boya-look-x) * .28px),
      calc(var(--boya-look-y) * .20px)
    );
  transition: transform 90ms linear;
}

.boya-layer-left-pupil,
.boya-layer-right-pupil {
  transform:
    translate(
      calc(var(--boya-look-x) * 2.1px),
      calc(var(--boya-look-y) * .9px)
    );
  scale: 1 1;
  animation: boya-pupil-soft-blink 6.4s ease-in-out infinite;
  transition:
    transform 120ms cubic-bezier(.2, .8, .2, 1),
    opacity 140ms ease;
}

.boya-layer-left-eye-socket,
.boya-layer-right-eye-socket {
  scale: 1 1;
  animation: boya-eye-socket-soft-blink 6.4s ease-in-out infinite;
  transition: transform 90ms linear;
}

.boya-layer-left-eye-socket {
  transform-origin: 37.7% 46%;
}

.boya-layer-right-eye-socket {
  transform-origin: 62.3% 46%;
}

.boya-layer-left-pupil {
  transform-origin: 39.2% 46.8%;
}

.boya-layer-right-pupil {
  transform-origin: 60.8% 46.8%;
}

.boya-eye-line {
  position: absolute;
  top: 46.1%;
  z-index: 73;
  width: 8.8%;
  height: 2.7%;
  border: 0;
  border-bottom: 2.2px solid rgba(8, 13, 9, .82);
  border-radius: 0 0 999px 999px;
  opacity: 0;
  pointer-events: none;
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, .42));
  transform-origin: 50% 50%;
  will-change: opacity, transform, translate, rotate;
}

.boya-eye-line-left {
  left: 35%;
  transform: rotate(5deg) scaleX(.78);
}

.boya-eye-line-right {
  left: 56.3%;
  transform: rotate(-5deg) scaleX(.78);
}

.boya-eye-line::before,
.boya-eye-line::after {
  content: "";
  position: absolute;
  top: 55%;
  width: 20%;
  height: 1.7px;
  border-radius: 999px;
  background: rgba(8, 13, 9, .72);
}

.boya-eye-line::before {
  left: 9%;
  transform: rotate(24deg);
  transform-origin: 100% 50%;
}

.boya-eye-line::after {
  right: 9%;
  transform: rotate(-24deg);
  transform-origin: 0 50%;
}

.boya-closed-eye {
  position: absolute;
  top: 45.8%;
  z-index: 74;
  width: 8.6%;
  height: 2.8%;
  opacity: 0;
  pointer-events: none;
  filter: drop-shadow(0 .8px 0 rgba(255, 255, 255, .44));
  transform-origin: 50% 50%;
  will-change: opacity, translate, scale;
}

.boya-closed-eye::before {
  content: "";
  position: absolute;
  inset: 0;
  border-bottom: 2.2px solid rgba(8, 13, 9, .78);
  border-radius: 0 0 999px 999px;
}

.boya-closed-eye::after {
  content: none;
}

.boya-closed-eye-left {
  left: 35.25%;
  transform: rotate(4deg) scaleX(.9);
}

.boya-closed-eye-right {
  left: 56.15%;
  transform: rotate(-4deg) scaleX(.9);
}

.boya-layer-left-arm {
  transform-origin: 41.6% 58.8%;
}

.boya-layer-right-arm {
  transform-origin: 58.4% 58.8%;
}

.boya-layer-left-arm-lift,
.boya-layer-left-arm-wave-a,
.boya-layer-left-arm-wave-b {
  opacity: 0;
  transform-origin: 41.6% 58.8%;
}

.boya-layer-right-arm-lift,
.boya-layer-right-arm-wave-a,
.boya-layer-right-arm-wave-b {
  opacity: 0;
  transform-origin: 58.4% 58.8%;
}

.boya-pet-stage::after {
  content: "";
  position: absolute;
  left: 50.1%;
  top: var(--boya-mouth-top, 52.92%);
  z-index: 72;
  width: var(--boya-mouth-width, 13px);
  height: var(--boya-mouth-height, 5px);
  border: 0;
  border-bottom: var(--boya-mouth-stroke, 2px) solid var(--boya-mouth-color, rgba(9, 14, 10, .78));
  border-radius: 0 0 18px 18px;
  background: transparent;
  opacity: var(--boya-mouth-opacity, .96);
  transform:
    translate(-50%, -50%)
    scale(var(--boya-mouth-scale-x, 1), var(--boya-mouth-scale-y, 1));
  transform-origin: 50% 50%;
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, .34));
  pointer-events: none;
  transition:
    top 160ms ease,
    width 160ms ease,
    height 160ms ease,
    border-color 160ms ease,
    opacity 160ms ease,
    transform 160ms ease;
}

.boya-slot-pet[data-state="idle"] .boya-pet-stage::after {
  animation: boya-mouth-soft-smile 5.2s ease-in-out infinite;
}

.boya-bubble {
  position: absolute;
  left: calc(50% + 108px);
  top: -6px;
  z-index: 8;
  width: max-content;
  min-width: 104px;
  max-width: min(360px, 52vw);
  padding: 9px 18px;
  border: 1px solid rgba(80, 146, 67, .26);
  border-radius: 18px 18px 18px 6px;
  background: rgba(255, 255, 255, .94);
  color: var(--boya-ink);
  font-size: 14px;
  line-height: 1.45;
  font-weight: 500;
  text-align: center;
  white-space: normal;
  box-shadow: 0 16px 34px rgba(33, 74, 38, .11);
  pointer-events: none;
  transform: translate(-50%, 0);
  backdrop-filter: blur(12px);
  animation: boya-bubble-float 3.2s ease-in-out infinite;
}

.boya-bubble::after {
  content: "";
  position: absolute;
  left: 14px;
  bottom: -7px;
  width: 13px;
  height: 13px;
  border-right: 1px solid rgba(80, 146, 67, .24);
  border-bottom: 1px solid rgba(80, 146, 67, .24);
  background: rgba(255, 255, 255, .94);
  transform: rotate(45deg);
}

.boya-slot-pet[data-state="curious"] .boya-pet-stage {
  animation: boya-alert 3s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-layer-left-ear,
.boya-slot-pet[data-state="idle"] .boya-layer-right-ear {
  animation: boya-ear-idle 5.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-layer-body-torso {
  animation: boya-body-idle-rich 7.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-layer-left-arm {
  animation: boya-left-arm-idle-rich 7.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-layer-right-arm {
  animation: boya-right-arm-idle-rich 7.4s ease-in-out infinite;
  animation-delay: -1.4s;
}

.boya-slot-pet[data-state="idle"] .boya-layer-left-leg {
  animation: boya-left-leg-idle-rich 7.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-layer-right-leg {
  animation: boya-right-leg-idle-rich 7.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-closed-eye,
.boya-slot-pet[data-state="curious"] .boya-closed-eye,
.boya-slot-pet[data-state="thinking"] .boya-closed-eye {
  animation: boya-closed-eye-soft-blink 6.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="curious"] .boya-layer-left-ear,
.boya-slot-pet[data-state="curious"] .boya-layer-right-ear {
  animation: boya-ear-curious 3.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="curious"] .boya-layer-right-arm {
  animation: boya-curious-hand 2.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="curious"] .boya-layer-left-leg,
.boya-slot-pet[data-state="guide"] .boya-layer-left-leg,
.boya-slot-pet[data-state="thinking"] .boya-layer-left-leg {
  animation: boya-left-leg-tap 2.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="thinking"] .boya-layer-right-leg {
  animation: boya-right-leg-ready 2.4s ease-in-out infinite;
  animation-delay: -1.1s;
}

.boya-slot-pet[data-state="listening"] .boya-layer-right-leg,
.boya-slot-pet[data-state="dragging"] .boya-layer-right-leg {
  animation: boya-right-leg-ready 1.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="greet"] .boya-pet-stage {
  animation: boya-greet 1250ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="greet"] .boya-layer-right-arm {
  animation: boya-right-hand-hello 1250ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="curious"] .boya-layer-right-arm-wave-a,
.boya-slot-pet[data-state="curious"] .boya-layer-right-arm-wave-b,
.boya-slot-pet[data-state="guide"] .boya-layer-right-arm-wave-a,
.boya-slot-pet[data-state="guide"] .boya-layer-right-arm-wave-b,
.boya-slot-pet[data-state="greet"] .boya-layer-right-arm-wave-a,
.boya-slot-pet[data-state="greet"] .boya-layer-right-arm-wave-b {
  opacity: 0;
  animation: none;
}

.boya-slot-pet[data-state="guide"] .boya-pet-stage,
.boya-slot-pet[data-state="listening"] .boya-pet-stage {
  animation: boya-listening 2.6s ease-in-out infinite;
}

.boya-slot-pet[data-state="guide"] .boya-layer-body-torso,
.boya-slot-pet[data-state="listening"] .boya-layer-body-torso {
  animation: boya-body-listening 2.6s ease-in-out infinite;
}

.boya-slot-pet[data-state="guide"] .boya-layer-right-arm,
.boya-slot-pet[data-state="listening"] .boya-layer-right-arm {
  animation: boya-guide-hand 2.6s ease-in-out infinite;
}

.boya-slot-pet[data-state="listening"] .boya-layer-left-arm {
  animation: boya-listening-left-hand 2.6s ease-in-out infinite;
}

.boya-slot-pet[data-state="tickle"] .boya-pet-stage {
  animation: boya-tickle-body 760ms cubic-bezier(.34, .9, .2, 1);
  filter: none;
  transform: translate(-50%, -50%);
  opacity: 1;
}

.boya-slot-pet[data-state="tickle"] {
  opacity: 1;
  filter: none;
}

.boya-slot-pet[data-state="tickle"] .boya-layer {
  filter: none;
  mix-blend-mode: normal;
}

.boya-slot-pet[data-state="tickle"] .boya-layer-left-arm-lift,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-arm-lift,
.boya-slot-pet[data-state="tickle"] .boya-layer-left-arm-wave-a,
.boya-slot-pet[data-state="tickle"] .boya-layer-left-arm-wave-b,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-arm-wave-a,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-arm-wave-b {
  opacity: 0;
  animation: none;
}

.boya-slot-pet[data-state="tickle"] .boya-layer-left-arm,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-arm {
  animation: boya-arm-tickle 1200ms cubic-bezier(.34, .9, .2, 1);
}

.boya-slot-pet[data-state="dragging"] .boya-layer-body-torso {
  animation: boya-body-drag 1.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="dragging"] .boya-layer-left-arm {
  animation: boya-drag-left-arm 1.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="dragging"] .boya-layer-right-arm {
  animation: boya-drag-right-arm 1.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="dragging"] .boya-layer-left-leg {
  animation: boya-left-leg-drag 1.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="dragging"] .boya-layer-right-leg {
  animation: boya-right-leg-drag 1.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="curious"] .boya-pet-stage::after {
  --boya-mouth-width: 11px;
  --boya-mouth-height: 4px;
  --boya-mouth-stroke: 1.8px;
  --boya-mouth-opacity: .86;
  --boya-mouth-scale-y: .92;
}

.boya-slot-pet[data-state="greet"] .boya-pet-stage::after,
.boya-slot-pet[data-state="guide"] .boya-pet-stage::after {
  --boya-mouth-top: 52.96%;
  --boya-mouth-width: 10px;
  --boya-mouth-height: 4px;
  --boya-mouth-stroke: 1.8px;
  --boya-mouth-opacity: .88;
  --boya-mouth-scale-y: .88;
}

.boya-slot-pet[data-state="listening"] .boya-pet-stage::after {
  --boya-mouth-top: 53.02%;
  --boya-mouth-width: 7px;
  --boya-mouth-height: 4px;
  --boya-mouth-stroke: 0;
  --boya-mouth-opacity: .82;
  border-radius: 999px;
  background: rgba(9, 14, 10, .76);
  box-shadow:
    inset 0 -1px 0 rgba(255, 255, 255, .18),
    0 1px 0 rgba(255, 255, 255, .32);
  animation: boya-css-mouth-talk 1.18s ease-in-out infinite;
}

.boya-slot-pet[data-state="thinking"] .boya-pet-stage::after {
  --boya-mouth-top: 53.04%;
  --boya-mouth-width: 8px;
  --boya-mouth-height: 3px;
  --boya-mouth-stroke: 1.7px;
  --boya-mouth-opacity: .72;
  --boya-mouth-scale-y: .68;
}

.boya-slot-pet[data-state="dragging"] .boya-pet-stage::after {
  --boya-mouth-top: 53.02%;
  --boya-mouth-width: 9px;
  --boya-mouth-height: 4px;
  --boya-mouth-stroke: 1.8px;
  --boya-mouth-opacity: .82;
  --boya-mouth-scale-y: .78;
}

.boya-slot-pet[data-state="jump"] .boya-pet-stage::after,
.boya-slot-pet[data-state="proud"] .boya-pet-stage::after,
.boya-slot-pet[data-state="tickle"] .boya-pet-stage::after,
.boya-slot-pet[data-state="greet"] .boya-pet-stage::after {
  --boya-mouth-opacity: 0;
}

.boya-slot-pet[data-state="jump"] .boya-layer-mouth-laugh,
.boya-slot-pet[data-state="proud"] .boya-layer-mouth-laugh,
.boya-slot-pet[data-state="tickle"] .boya-layer-mouth-laugh,
.boya-slot-pet[data-state="greet"] .boya-layer-mouth-laugh {
  opacity: .96;
  animation: boya-mouth-laugh-pop 1.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="tickle"] .boya-bubble {
  filter: none;
}

.boya-slot-pet[data-state="jump"] .boya-pet-stage {
  animation: boya-jump 920ms cubic-bezier(.2, .9, .2, 1);
}

.boya-slot-pet[data-state="jump"] .boya-layer-left-arm,
.boya-slot-pet[data-state="jump"] .boya-layer-right-arm {
  animation: boya-jump-arms 920ms cubic-bezier(.2, .9, .2, 1);
  opacity: 1;
}

.boya-slot-pet[data-state="jump"] .boya-layer-left-arm-lift,
.boya-slot-pet[data-state="jump"] .boya-layer-right-arm-lift {
  animation: none;
  opacity: 0;
  transform: none;
}

.boya-slot-pet[data-state="jump"] .boya-layer-left-arm {
  --boya-jump-arm-rotate: 4deg;
  --boya-jump-arm-rotate-small: 2deg;
}

.boya-slot-pet[data-state="jump"] .boya-layer-right-arm {
  --boya-jump-arm-rotate: -4deg;
  --boya-jump-arm-rotate-small: -2deg;
}

.boya-slot-pet[data-state="jump"] .boya-layer-left-leg {
  animation: none;
  transform: none;
}

.boya-slot-pet[data-state="jump"] .boya-layer-right-leg {
  animation: none;
  transform: none;
}

.boya-slot-pet[data-state="proud"] .boya-pet-stage {
  animation: boya-proud 1600ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="proud"] .boya-layer-left-arm,
.boya-slot-pet[data-state="proud"] .boya-layer-right-arm {
  animation: boya-proud-arms 1600ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="proud"] .boya-layer-left-arm-lift,
.boya-slot-pet[data-state="proud"] .boya-layer-right-arm-lift {
  opacity: 0;
  animation: none;
  transform: none;
}

.boya-slot-pet[data-state="proud"] .boya-layer-body-torso {
  animation: boya-body-proud 1600ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="proud"] .boya-layer-left-arm {
  --boya-proud-arm-rotate: 7deg;
}

.boya-slot-pet[data-state="proud"] .boya-layer-right-arm {
  --boya-proud-arm-rotate: -7deg;
}

.boya-slot-pet[data-state="proud"] .boya-layer-left-leg {
  animation: boya-left-leg-proud 1600ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="proud"] .boya-layer-right-leg {
  animation: boya-right-leg-proud 1600ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-pet-stage {
  animation: boya-stretch-body 2200ms cubic-bezier(.2, .86, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-layer-body-torso {
  animation: boya-body-stretch 2200ms cubic-bezier(.2, .86, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-layer-left-arm {
  animation: boya-left-arm-stretch 2200ms cubic-bezier(.2, .86, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-layer-right-arm {
  animation: boya-right-arm-stretch 2200ms cubic-bezier(.2, .86, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-layer-left-arm-lift,
.boya-slot-pet[data-state="stretch"] .boya-layer-right-arm-lift {
  opacity: 0;
  animation: none;
  transform: none;
}

.boya-slot-pet[data-state="stretch"] .boya-layer-left-leg {
  animation: boya-left-leg-stretch 2200ms cubic-bezier(.2, .86, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-layer-right-leg {
  animation: boya-right-leg-stretch 2200ms cubic-bezier(.2, .86, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-layer-left-ear,
.boya-slot-pet[data-state="stretch"] .boya-layer-right-ear {
  animation: boya-ear-stretch 2200ms cubic-bezier(.2, .86, .2, 1);
}

.boya-slot-pet[data-state="stretch"] .boya-pet-stage::after {
  --boya-mouth-top: 53.03%;
  --boya-mouth-width: 9px;
  --boya-mouth-height: 8px;
  --boya-mouth-stroke: 0;
  --boya-mouth-opacity: .84;
  border-radius: 999px;
  background: rgba(9, 14, 10, .76);
  box-shadow:
    inset 0 -1px 0 rgba(255, 255, 255, .18),
    0 1px 0 rgba(255, 255, 255, .32);
  animation: boya-mouth-pucker 1.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="thinking"] .boya-pet-stage {
  animation: boya-thinking 2.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="thinking"] .boya-layer-right-arm {
  animation: boya-thinking-hand 2.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="thinking"] .boya-layer-left-arm {
  animation: boya-thinking-left-hand 2.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="thinking"] .boya-layer-body-torso {
  animation: boya-body-thinking 2.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="thinking"] .boya-layer-forehead-mark {
  animation: boya-thinking-mark 2.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="sleepy"] .boya-pet-stage {
  animation: boya-sleep 5.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="sleepy"] .boya-layer-body-torso {
  animation: boya-body-sleepy 5.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="sleepy"] .boya-layer-left-arm,
.boya-slot-pet[data-state="sleepy"] .boya-layer-right-arm {
  animation: boya-sleepy-arms 5.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="sleepy"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="sleepy"] .boya-layer-right-eye-socket {
  scale: 1 1;
  opacity: 0;
  animation: none;
}

.boya-slot-pet[data-state="sleepy"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="sleepy"] .boya-layer-right-pupil {
  opacity: 0;
  animation: none;
}

.boya-slot-pet[data-state="sleepy"] .boya-closed-eye {
  opacity: .95;
  animation: boya-closed-eye-sleepy 5.2s ease-in-out infinite;
}

.boya-slot-pet[data-state="sleepy"] .boya-pet-stage::after {
  --boya-mouth-top: 53.0%;
  --boya-mouth-width: 9px;
  --boya-mouth-height: 3px;
  --boya-mouth-stroke: 1.6px;
  --boya-mouth-opacity: .62;
  --boya-mouth-scale-y: .56;
}

.boya-slot-pet[data-state="peek"] .boya-pet-stage {
  animation: boya-peek 2.2s cubic-bezier(.2, .85, .2, 1) infinite;
}

.boya-slot-pet[data-state="peek"] .boya-layer-right-arm {
  animation: boya-peek-hand 2.2s cubic-bezier(.2, .85, .2, 1) infinite;
}

.boya-slot-pet[data-state="peek"] .boya-layer-left-ear,
.boya-slot-pet[data-state="peek"] .boya-layer-right-ear {
  animation: boya-ear-curious 2.8s ease-in-out infinite;
}

.boya-slot-pet[data-state="peek"] .boya-pet-stage::after {
  --boya-mouth-top: 53.0%;
  --boya-mouth-width: 8px;
  --boya-mouth-height: 7px;
  --boya-mouth-stroke: 0;
  --boya-mouth-opacity: .82;
  border-radius: 999px;
  background: rgba(9, 14, 10, .76);
  box-shadow:
    inset 0 -1px 0 rgba(255, 255, 255, .18),
    0 1px 0 rgba(255, 255, 255, .32);
  animation: boya-mouth-pucker 1.9s ease-in-out infinite;
}

.boya-slot-pet[data-state="greet"] .boya-layer-head,
.boya-slot-pet[data-state="greet"] .boya-layer-left-ear,
.boya-slot-pet[data-state="greet"] .boya-layer-right-ear,
.boya-slot-pet[data-state="greet"] .boya-layer-left-horn,
.boya-slot-pet[data-state="greet"] .boya-layer-right-horn,
.boya-slot-pet[data-state="greet"] .boya-layer-forehead-mark,
.boya-slot-pet[data-state="greet"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="greet"] .boya-layer-right-eye-socket {
  animation: boya-head-nod 1250ms cubic-bezier(.2, .85, .2, 1);
}

.boya-slot-pet[data-state="dragging"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="dragging"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="dragging"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="dragging"] .boya-layer-right-pupil {
  animation-play-state: paused;
}

.boya-slot-pet[data-state="greet"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="greet"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="greet"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="greet"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="guide"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="guide"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="guide"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="guide"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="listening"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="listening"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="listening"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="listening"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="jump"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="jump"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="jump"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="jump"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="proud"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="proud"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="proud"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="proud"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="tickle"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="tickle"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="stretch"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="stretch"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="stretch"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="stretch"] .boya-layer-right-pupil {
  animation-name: none;
}

.boya-slot-pet[data-state="idle"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="idle"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="curious"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="curious"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="thinking"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="thinking"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="guide"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="guide"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="listening"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="listening"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="jump"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="jump"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="proud"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="proud"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="tickle"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-eye-socket,
.boya-slot-pet[data-state="stretch"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="stretch"] .boya-layer-right-eye-socket {
  animation: boya-eye-socket-soft-blink 6.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="greet"] .boya-layer-left-eye-socket,
.boya-slot-pet[data-state="greet"] .boya-layer-right-eye-socket {
  animation:
    boya-head-nod 1250ms cubic-bezier(.2, .85, .2, 1),
    boya-eye-socket-soft-blink 6.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="idle"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="curious"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="curious"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="thinking"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="thinking"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="guide"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="guide"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="listening"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="listening"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="greet"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="greet"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="jump"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="jump"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="proud"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="proud"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="tickle"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="tickle"] .boya-layer-right-pupil,
.boya-slot-pet[data-state="stretch"] .boya-layer-left-pupil,
.boya-slot-pet[data-state="stretch"] .boya-layer-right-pupil {
  animation: boya-pupil-soft-blink 6.4s ease-in-out infinite;
}

.boya-slot-pet[data-state="idle"] .boya-closed-eye,
.boya-slot-pet[data-state="curious"] .boya-closed-eye,
.boya-slot-pet[data-state="thinking"] .boya-closed-eye,
.boya-slot-pet[data-state="guide"] .boya-closed-eye,
.boya-slot-pet[data-state="listening"] .boya-closed-eye,
.boya-slot-pet[data-state="greet"] .boya-closed-eye,
.boya-slot-pet[data-state="jump"] .boya-closed-eye,
.boya-slot-pet[data-state="proud"] .boya-closed-eye,
.boya-slot-pet[data-state="tickle"] .boya-closed-eye,
.boya-slot-pet[data-state="stretch"] .boya-closed-eye {
  animation: boya-closed-eye-soft-blink 6.4s ease-in-out infinite;
}

@keyframes boya-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  48% { transform: translate(-50%, calc(-50% - 3px)) scale(1.008, .996); }
}

@keyframes boya-alert {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  50% {
    transform:
      translate(-50%, calc(-50% - 3px))
      rotate(calc(var(--boya-look-x) * .45deg))
      scale(1.004);
  }
}

@keyframes boya-greet {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  18% { transform: translate(-50%, calc(-50% + 1px)) rotate(0deg) scale(1.006, .996); }
  46% { transform: translate(-50%, calc(-50% - 6px)) rotate(-.28deg) scale(1.006); }
  70% { transform: translate(-50%, calc(-50% - 3px)) rotate(.18deg) scale(1.002); }
}

@keyframes boya-jump {
  0% { transform: translate(-50%, -50%); }
  18% { transform: translate(-50%, calc(-50% + 1px)); }
  44% { transform: translate(-50%, calc(-50% - 16px)); }
  72% { transform: translate(-50%, calc(-50% + 1px)); }
  100% { transform: translate(-50%, -50%); }
}

@keyframes boya-proud {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  20% { transform: translate(-50%, calc(-50% + 2px)) scale(1.02, .97); }
  44% { transform: translate(-50%, calc(-50% - 13px)) rotate(-.6deg) scale(.99, 1.025); }
  64% { transform: translate(-50%, calc(-50% - 8px)) rotate(.45deg) scale(1.006); }
  82% { transform: translate(-50%, calc(-50% + 1px)) scale(1.018, .982); }
}

@keyframes boya-body-listening {
  0%, 100% { transform: translate(0, 0) scale(1); }
  42% { transform: translate(0, -1px) scale(1.006, .997); }
  72% { transform: translate(0, -.3px) scale(1.002, .999); }
}

@keyframes boya-body-thinking {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  34% { transform: translate(-.8px, -.8px) rotate(-.25deg); }
  62% { transform: translate(.6px, -.4px) rotate(.18deg); }
}

@keyframes boya-body-proud {
  0%, 100% { transform: translate(0, 0) scale(1); }
  24% { transform: translate(0, 2px) scale(1.018, .98); }
  48%, 72% { transform: translate(0, -5px) scale(.994, 1.018); }
}

@keyframes boya-listening {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  42% { transform: translate(-50%, calc(-50% - 4px)) rotate(calc(var(--boya-look-x) * .32deg)) scale(1.006); }
  72% { transform: translate(-50%, calc(-50% - 1px)) rotate(calc(var(--boya-look-x) * .18deg)) scale(1.002); }
}

@keyframes boya-body-idle-rich {
  0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
  24% { transform: translate(1px, -2px) rotate(.7deg) scale(1.008, .996); }
  52% { transform: translate(-1.2px, 1.2px) rotate(-.55deg) scale(1.004, .998); }
  78% { transform: translate(.8px, -1px) rotate(.35deg) scale(1.006, .997); }
}

@keyframes boya-left-arm-idle-rich {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  20% { transform: rotate(1deg) translate(-.2px, .4px); }
  46% { transform: rotate(-.8deg) translate(.2px, -.5px); }
  70% { transform: rotate(1.2deg) translate(-.3px, -.3px); }
  86% { transform: rotate(.5deg) translate(-.1px, .2px); }
}

@keyframes boya-right-arm-idle-rich {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  22% { transform: rotate(-1deg) translate(.2px, .4px); }
  48% { transform: rotate(.8deg) translate(-.2px, -.5px); }
  72% { transform: rotate(-1.2deg) translate(.3px, -.3px); }
  88% { transform: rotate(-.5deg) translate(.1px, .2px); }
}

@keyframes boya-left-leg-idle-rich {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  28% { transform: rotate(-2.4deg) translate(-1.8px, 2.6px); }
  56% { transform: rotate(1.6deg) translate(1.2px, .8px); }
  78% { transform: rotate(-1deg) translate(-.8px, 1.5px); }
}

@keyframes boya-right-leg-idle-rich {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  30% { transform: rotate(2.4deg) translate(1.8px, 2.6px); }
  58% { transform: rotate(-1.6deg) translate(-1.2px, .8px); }
  80% { transform: rotate(1deg) translate(.8px, 1.5px); }
}

@keyframes boya-ear-idle {
  0%, 70%, 100% {
    translate: 0 0;
    rotate: 0deg;
  }
  75% {
    translate: 0 -1.4px;
    rotate: -1.4deg;
  }
  80% {
    translate: 0 .5px;
    rotate: .9deg;
  }
  86% {
    translate: 0 -.8px;
    rotate: -.7deg;
  }
}

@keyframes boya-ear-curious {
  0%, 100% {
    translate: 0 0;
    rotate: 0deg;
  }
  32% {
    translate: 0 -1.8px;
    rotate: -1.8deg;
  }
  62% {
    translate: 0 .6px;
    rotate: 1.1deg;
  }
}

@keyframes boya-curious-hand {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  32% { transform: rotate(-3.5deg) translate(.8px, -1.4px); }
  58% { transform: rotate(-1.8deg) translate(.4px, -.7px); }
  78% { transform: rotate(-4deg) translate(1px, -1.2px); }
}

@keyframes boya-drag {
  0%, 100% { transform: translate(calc(-50% - 2px), -50%) rotate(-1.2deg) scale(1.01); }
  50% { transform: translate(calc(-50% + 2px), calc(-50% - 1px)) rotate(1.2deg) scale(1.015); }
}

@keyframes boya-body-drag {
  0%, 100% { transform: translate(-.8px, .5px) rotate(-.35deg); }
  50% { transform: translate(.8px, -.4px) rotate(.35deg); }
}

@keyframes boya-drag-left-arm {
  0%, 100% { transform: rotate(1.2deg) translate(-.3px, -.3px); }
  50% { transform: rotate(2deg) translate(-.6px, -.9px); }
}

@keyframes boya-drag-right-arm {
  0%, 100% { transform: rotate(-1.2deg) translate(.3px, -.3px); }
  50% { transform: rotate(-2deg) translate(.6px, -.9px); }
}

@keyframes boya-left-leg-drag {
  0%, 100% { transform: rotate(-2.8deg) translate(-1.8px, 2.4px); }
  50% { transform: rotate(2.8deg) translate(1.8px, .8px); }
}

@keyframes boya-right-leg-drag {
  0%, 100% { transform: rotate(2.8deg) translate(1.8px, 2.4px); }
  50% { transform: rotate(-2.8deg) translate(-1.8px, .8px); }
}

@keyframes boya-thinking {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
  32% { transform: translate(-50%, calc(-50% - 3px)) rotate(-.35deg); }
  58% { transform: translate(-50%, calc(-50% - 1px)) rotate(.28deg); }
  78% { transform: translate(-50%, calc(-50% - 4px)) rotate(-.18deg); }
}

@keyframes boya-thinking-hand {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  30% { transform: rotate(-2.2deg) translate(.4px, -1px); }
  58% { transform: rotate(1deg) translate(-.2px, -.4px); }
  78% { transform: rotate(-1.8deg) translate(.3px, -.8px); }
}

@keyframes boya-thinking-left-hand {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  35% { transform: rotate(1.8deg) translate(-.3px, -.8px); }
  62% { transform: rotate(-1deg) translate(.2px, -.4px); }
}

@keyframes boya-guide-hand {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  30% { transform: rotate(-2.8deg) translate(.5px, -1px); }
  54% { transform: rotate(-1.4deg) translate(.3px, -.5px); }
  78% { transform: rotate(-2.4deg) translate(.5px, -.8px); }
}

@keyframes boya-listening-left-hand {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  42% { transform: rotate(1.8deg) translate(-.3px, -.7px); }
}

@keyframes boya-proud-arms {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  34%, 72% { transform: rotate(var(--boya-proud-arm-rotate, -3deg)) translate(0, -1px); }
}

@keyframes boya-pose-guide-hand {
  0%, 100% {
    opacity: .92;
    transform: translate(0, 0) rotate(0deg);
  }
  36% {
    opacity: 1;
    transform: translate(.5px, -1px) rotate(-.9deg);
  }
  68% {
    opacity: .96;
    transform: translate(.2px, -.4px) rotate(.4deg);
  }
}

@keyframes boya-pose-wave-a {
  0%, 12%, 34%, 58%, 82%, 100% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg);
  }
  22%, 46%, 70% {
    opacity: 0;
    transform: translate(.5px, -1px) rotate(-.6deg);
  }
}

@keyframes boya-pose-wave-b {
  0%, 12%, 34%, 58%, 82%, 100% {
    opacity: 0;
    transform: translate(0, 0) rotate(0deg);
  }
  22%, 46%, 70% {
    opacity: 1;
    transform: translate(.7px, -1.2px) rotate(-.8deg);
  }
}

@keyframes boya-pose-jump-lift {
  0%, 100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  18%, 74% {
    opacity: 1;
    transform: translate(0, -.8px) scale(1);
  }
  42% {
    opacity: 1;
    transform: translate(0, -1.8px) scale(1);
  }
}

@keyframes boya-pose-proud-lift {
  0%, 100% {
    opacity: 0;
    transform: translate(0, 0) scale(1);
  }
  24%, 76% {
    opacity: 1;
    transform: translate(0, -1.2px) scale(1);
  }
  48% {
    opacity: 1;
    transform: translate(0, -2px) scale(1);
  }
}

@keyframes boya-pose-stretch-lift {
  0%, 100% {
    opacity: 0;
    transform: translate(0, 0) scale(1);
  }
  18% {
    opacity: .86;
    transform: translate(0, -.6px) scale(1);
  }
  38%, 68% {
    opacity: 1;
    transform: translate(0, -1.8px) scale(1);
  }
  84% {
    opacity: .78;
    transform: translate(0, -.6px) scale(1);
  }
}

@keyframes boya-thinking-mark {
  0%, 100% { filter: saturate(1); opacity: .96; }
  45% { filter: saturate(1.2) brightness(1.06); opacity: 1; }
}

@keyframes boya-sleep {
  0%, 100% { transform: translate(-50%, calc(-50% + 3px)) rotate(0deg); }
  50% { transform: translate(-50%, calc(-50% + 8px)) rotate(-.5deg); }
}

@keyframes boya-body-sleepy {
  0%, 100% { transform: translate(0, 1px) rotate(0deg) scale(1.004, .996); }
  50% { transform: translate(0, 3px) rotate(-.16deg) scale(1.01, .99); }
}

@keyframes boya-sleepy-arms {
  0%, 100% { transform: rotate(1.5deg) translate(0, 1px); }
  50% { transform: rotate(4deg) translate(0, 3px); }
}

@keyframes boya-sleepy-eye {
  0%, 100% {
    transform:
      rotate(0deg)
      translate(0, 0)
      scaleY(.34);
    opacity: .78;
  }
  50% {
    transform:
      rotate(0deg)
      translate(0, .2px)
      scaleY(.18);
    opacity: .68;
  }
}

@keyframes boya-peek {
  0%, 100% { transform: translate(-50%, calc(-50% + 7px)) rotate(0deg) scale(.992); }
  38% { transform: translate(-50%, calc(-50% - 2px)) rotate(-.28deg) scale(1.004); }
  58% { transform: translate(-50%, calc(-50% - 1px)) rotate(.18deg) scale(1.002); }
}

@keyframes boya-peek-hand {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  38% { transform: rotate(-2.4deg) translate(.4px, -.8px); }
  58% { transform: rotate(-1.2deg) translate(.2px, -.4px); }
}

@keyframes boya-arm-tickle {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  20% { transform: rotate(1.8deg) translate(.3px, -.7px); }
  40% { transform: rotate(-1.8deg) translate(-.3px, -.7px); }
  60% { transform: rotate(2deg) translate(.3px, -.7px); }
  80% { transform: rotate(-1deg) translate(-.2px, -.4px); }
}

@keyframes boya-left-leg-tap {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  34% { transform: rotate(-3deg) translate(-2px, 2.5px); }
  58% { transform: rotate(1.8deg) translate(1px, .6px); }
}

@keyframes boya-right-leg-ready {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  45% { transform: rotate(3deg) translate(2px, 2.5px); }
}

@keyframes boya-left-leg-proud {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  40%, 70% { transform: rotate(-3deg) translate(-1.5px, -1.8px); }
}

@keyframes boya-right-leg-proud {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  40%, 70% { transform: rotate(3deg) translate(1.5px, -1.8px); }
}

@keyframes boya-stretch-body {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  14% { transform: translate(-50%, calc(-50% + 3px)) scale(1.018, .982); }
  42% { transform: translate(-50%, calc(-50% - 9px)) rotate(-.35deg) scale(.992, 1.026); }
  64% { transform: translate(-50%, calc(-50% - 7px)) rotate(.22deg) scale(.998, 1.018); }
  82% { transform: translate(-50%, calc(-50% + 1px)) scale(1.012, .988); }
}

@keyframes boya-body-stretch {
  0%, 100% { transform: translate(0, 0) scale(1); }
  16% { transform: translate(0, 2px) scale(1.018, .982); }
  44%, 66% { transform: translate(0, -4px) scale(.988, 1.026); }
  84% { transform: translate(0, 1px) scale(1.01, .99); }
}

@keyframes boya-left-arm-stretch {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  16% { transform: rotate(1deg) translate(-.2px, .3px); }
  38%, 66% { transform: rotate(3deg) translate(-.5px, -1.2px); }
  82% { transform: rotate(1.4deg) translate(-.2px, -.3px); }
}

@keyframes boya-right-arm-stretch {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  16% { transform: rotate(-1deg) translate(.2px, .3px); }
  38%, 66% { transform: rotate(-3deg) translate(.5px, -1.2px); }
  82% { transform: rotate(-1.4deg) translate(.2px, -.3px); }
}

@keyframes boya-left-leg-stretch {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  18% { transform: rotate(-1.5deg) translate(-.8px, 2.4px); }
  44%, 64% { transform: rotate(-3.6deg) translate(-2.4px, -1.2px); }
  84% { transform: rotate(-1.8deg) translate(-1px, .8px); }
}

@keyframes boya-right-leg-stretch {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  18% { transform: rotate(1.5deg) translate(.8px, 2.4px); }
  44%, 64% { transform: rotate(3.6deg) translate(2.4px, -1.2px); }
  84% { transform: rotate(1.8deg) translate(1px, .8px); }
}

@keyframes boya-ear-stretch {
  0%, 100% { translate: 0 0; rotate: 0deg; }
  32%, 64% { translate: 0 -2.2px; rotate: -2deg; }
  78% { translate: 0 .4px; rotate: .9deg; }
}

@keyframes boya-jump-arms {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  40% { transform: rotate(var(--boya-jump-arm-rotate, -4deg)) translate(0, -1.5px); }
  72% { transform: rotate(var(--boya-jump-arm-rotate-small, -2deg)) translate(0, -.7px); }
}

@keyframes boya-left-leg-jump {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  42% { transform: rotate(-2.6deg) translate(-1.2px, -1.8px); }
  72% { transform: rotate(-1deg) translate(-.4px, -.4px); }
}

@keyframes boya-right-leg-jump {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  42% { transform: rotate(2.6deg) translate(1.2px, -1.8px); }
  72% { transform: rotate(1deg) translate(.4px, -.4px); }
}

@keyframes boya-tickle-body {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  16% { transform: translate(calc(-50% - 2px), calc(-50% - 4px)) rotate(-2.1deg) scale(1.008); }
  32% { transform: translate(calc(-50% + 2px), calc(-50% - 2px)) rotate(1.9deg) scale(1.004); }
  48% { transform: translate(calc(-50% - 2px), calc(-50% - 4px)) rotate(-1.7deg) scale(1.008); }
  64% { transform: translate(calc(-50% + 2px), calc(-50% - 2px)) rotate(1.5deg) scale(1.004); }
  82% { transform: translate(-50%, calc(-50% - 2px)) rotate(-.7deg) scale(1.002); }
}

@keyframes boya-right-hand-hello {
  0%, 100% { transform: rotate(0deg) translate(0, 0); }
  14% { transform: rotate(-2deg) translate(.4px, -.5px); }
  26% { transform: rotate(-5deg) translate(.8px, -1.4px); }
  38% { transform: rotate(-2.4deg) translate(.5px, -.7px); }
  50% { transform: rotate(-5.5deg) translate(.9px, -1.5px); }
  62% { transform: rotate(-2.8deg) translate(.5px, -.8px); }
  74% { transform: rotate(-4.8deg) translate(.8px, -1.3px); }
  88% { transform: rotate(-1.4deg) translate(.3px, -.4px); }
  96% { transform: rotate(.4deg) translate(0, 0); }
}

@keyframes boya-head-nod {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  24% { transform: translate(0, .5px) rotate(.03deg); }
  48% { transform: translate(-.4px, -1px) rotate(-.18deg); }
  74% { transform: translate(0, -.4px) rotate(.08deg); }
}

@keyframes boya-pupil-soft-blink {
  0%, 67.4%, 71.6%, 100% {
    scale: 1 1;
    opacity: 1;
  }
  68.35%, 69.85% {
    scale: 1 .2;
    opacity: 0;
  }
  70.65% {
    scale: 1 .72;
    opacity: .68;
  }
  71.25% {
    scale: 1 1;
    opacity: 1;
  }
}

@keyframes boya-eye-socket-soft-blink {
  0%, 67.4%, 71.6%, 100% {
    scale: 1 1;
    opacity: 1;
  }
  68.15% {
    scale: 1 .54;
    opacity: .42;
  }
  68.35%, 69.85% {
    scale: 1 .12;
    opacity: 0;
  }
  70.65% {
    scale: 1 .72;
    opacity: .72;
  }
}

@keyframes boya-closed-eye-soft-blink {
  0%, 67.7%, 71.25%, 100% {
    opacity: 0;
    translate: 0 0;
    scale: .9 .92;
  }
  68.45%, 69.75% {
    opacity: .92;
    translate: 0 .25px;
    scale: 1 .98;
  }
  70.6% {
    opacity: .28;
    translate: 0 .08px;
    scale: .94 .94;
  }
}

@keyframes boya-sleepy-eye-line {
  0%, 100% {
    opacity: .92;
    translate: 0 0;
    scale: .98 1;
  }
  50% {
    opacity: 1;
    translate: 0 .8px;
    scale: 1.03 1;
  }
}

@keyframes boya-closed-eye-sleepy {
  0%, 100% {
    opacity: .94;
    translate: 0 0;
    scale: .98 1;
  }
  50% {
    opacity: 1;
    translate: 0 .65px;
    scale: 1.03 1;
  }
}

@keyframes boya-css-mouth-talk {
  0%, 100% {
    opacity: .68;
    transform: translate(-50%, -50%) scale(.78, .48);
  }
  42% {
    opacity: .88;
    transform: translate(-50%, -50%) scale(1.04, .78);
  }
  72% {
    opacity: .78;
    transform: translate(-50%, -50%) scale(.9, .58);
  }
}

@keyframes boya-mouth-soft-smile {
  0%, 100% {
    opacity: .88;
    transform: translate(-50%, -50%) scale(1, .92);
  }
  48% {
    opacity: .98;
    transform: translate(-50%, -50%) scale(1.08, 1);
  }
}

@keyframes boya-mouth-laugh-pop {
  0%, 100% {
    opacity: .9;
    scale: 1;
  }
  42% {
    opacity: 1;
    scale: 1.05;
  }
  72% {
    opacity: .96;
    scale: .98;
  }
}

@keyframes boya-mouth-pucker {
  0%, 100% {
    opacity: .78;
    transform: translate(-50%, -50%) scale(.92, .98);
  }
  48% {
    opacity: .9;
    transform: translate(-50%, -50%) scale(1.08, 1.02);
  }
}

@keyframes boya-bubble-float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -4px; }
}

@media (prefers-reduced-motion: reduce) {
  .boya-pet-stage,
  .boya-layer {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
