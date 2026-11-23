<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue';
import type { RowMenuItem } from '../logic/RowMenuItem';
import AppIcon from './AppIcon.vue';

defineProps<{ label: string; items: RowMenuItem[]; disabled?: boolean }>();
const emit = defineEmits<{ select: [id: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menuId = useId();

function entries(): HTMLButtonElement[] {
  return Array.from(root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
}

function close(restoreFocus: boolean): void {
  open.value = false;
  document.removeEventListener('pointerdown', onOutside, true);
  if (restoreFocus) trigger.value?.focus();
}

function onOutside(event: Event): void {
  if (root.value && !root.value.contains(event.target as Node)) close(false);
}

async function toggle(): Promise<void> {
  if (open.value) {
    close(false);
    return;
  }
  open.value = true;
  document.addEventListener('pointerdown', onOutside, true);
  await nextTick();
  entries()[0]?.focus();
}

function choose(id: string): void {
  close(true);
  emit('select', id);
}

function onKeydown(event: KeyboardEvent): void {
  if (!open.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    close(true);
    return;
  }
  const buttons = entries();
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    buttons[(at + 1) % buttons.length]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    buttons[(at - 1 + buttons.length) % buttons.length]?.focus();
  } else if (event.key === 'Tab') {
    close(false);
  }
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true));
</script>

<template>
  <div ref="root" class="menu" @keydown="onKeydown">
    <button
      ref="trigger"
      type="button"
      class="trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? menuId : undefined"
      :aria-label="label"
      :disabled="disabled"
      @click="toggle"
    >
      <AppIcon name="more" :size="20" />
    </button>
    <ul v-if="open" :id="menuId" class="list" role="menu" :aria-label="label">
      <li v-for="item in items" :key="item.id" role="none">
        <button type="button" role="menuitem" class="item" @click="choose(item.id)">
          {{ item.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.menu {
  position: relative;
}

.trigger {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
}

.trigger[aria-expanded='true'] {
  background: var(--surface-high);
  color: var(--on-surface);
}

.list {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  display: grid;
  min-width: 12rem;
  max-width: calc(100vw - 2 * var(--s-3));
  padding: var(--s-2) 0;
  margin: 0;
  border: 1px solid var(--outline-strong);
  border-radius: var(--r-md);
  background: var(--surface-highest);
  list-style: none;
}

.item {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 0 var(--s-4);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--on-surface);
  text-align: left;
}

.item:hover,
.item:focus-visible {
  background: var(--surface-high);
}
</style>
