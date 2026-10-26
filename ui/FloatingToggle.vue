<template>
  <div :style="rootStyle" @pointerdown.prevent="onPointerDown" @contextmenu.prevent="openMenu" :title="tipText">
    <span :style="dotStyle">{{ state === 'disguised' ? '●' : '○' }}</span>
    <div v-if="menuOpen" :style="menuStyle">
      <div :style="menuItemStyle" @click.stop="onMenuEdit">编辑伪装</div>
      <div :style="menuItemStyle" @click.stop="onMenuResetPos">按钮归位</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SiteProfile } from '@/core/types';

const props = defineProps<{ state: SiteProfile['switchState']; position: { x: number; y: number } | null }>();
const emit = defineEmits<{
  toggle: [];
  moved: [pos: { x: number; y: number }];
  edit: [];
  resetPos: [];
}>();

const menuOpen = ref(false);
const dragPos = ref<{ x: number; y: number } | null>(null);

const pos = computed(() => dragPos.value ?? props.position);

const rootStyle = computed(() => {
  const p = pos.value;
  return {
    position: 'fixed' as const,
    left: p ? `${p.x}px` : 'auto',
    top: p ? `${p.y}px` : 'auto',
    right: p ? 'auto' : '16px',
    bottom: p ? 'auto' : '16px',
    zIndex: 2147483646,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '999px',
    background: 'rgba(90,90,90,0.55)',
    color: '#e8e8e8',
    fontSize: '12px',
    lineHeight: 1,
    cursor: 'pointer',
    userSelect: 'none' as const,
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
    fontFamily: 'system-ui, sans-serif',
  };
});

const dotStyle = {
  fontSize: '11px',
  opacity: 0.95,
};

const menuStyle = {
  position: 'absolute' as const,
  top: '120%',
  left: 0,
  background: 'rgba(50,50,50,0.96)',
  borderRadius: '8px',
  padding: '4px',
  minWidth: '96px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
};

const menuItemStyle = {
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  fontSize: '12px',
  color: '#eee',
};

const tipText = computed(() =>
  props.state === 'disguised' ? 'PageMask：清爽中，点击还原' : 'PageMask：点击开启清爽模式',
);

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  menuOpen.value = false;
  const root = e.currentTarget as HTMLElement;
  const startX = e.clientX;
  const startY = e.clientY;
  const rect = root.getBoundingClientRect();
  const originLeft = rect.left;
  const originTop = rect.top;
  let moved = false;

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true;
    dragPos.value = {
      x: Math.min(Math.max(0, originLeft + dx), window.innerWidth - 40),
      y: Math.min(Math.max(0, originTop + dy), window.innerHeight - 28),
    };
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (moved && dragPos.value) {
      emit('moved', dragPos.value);
    } else {
      emit('toggle');
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function openMenu() {
  menuOpen.value = !menuOpen.value;
}

function onMenuEdit() {
  menuOpen.value = false;
  emit('edit');
}

function onMenuResetPos() {
  menuOpen.value = false;
  dragPos.value = null;
  emit('resetPos');
}
</script>
