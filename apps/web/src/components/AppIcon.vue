<script setup lang="ts">
import type { AppIconName } from '../logic/AppIconName';

defineProps<{ name: AppIconName; size?: number }>();
</script>

<template>
  <svg
    class="icon"
    :width="size ?? 22"
    :height="size ?? 22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'library'">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </template>
    <template v-else-if="name === 'add'">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20.5 20.5-4.9-4.9M11 8.5v5M8.5 11h5" />
    </template>
    <template v-else-if="name === 'following'">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </template>
    <template v-else-if="name === 'inbox'">
      <path d="M3.5 13.5 6 5.5h12l2.5 8V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"
      />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <path d="M10 8l-4 4 4 4M6 12h9.5" />
    </template>
    <template v-else-if="name === 'star'">
      <path
        d="m12 3.8 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z"
        fill="currentColor"
        stroke="none"
      />
    </template>
    <template v-else-if="name === 'back'">
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="m9 5.5 6.5 6.5L9 18.5" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </template>
    <template v-else-if="name === 'list'">
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.75" cy="6.5" r="1" fill="currentColor" />
      <circle cx="4.75" cy="12" r="1" fill="currentColor" />
      <circle cx="4.75" cy="17.5" r="1" fill="currentColor" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </template>
    <template v-else-if="name === 'sortDesc'">
      <path d="M7 4.5v15M3.5 16 7 19.5l3.5-3.5M13.5 6.5h7M13.5 12h5M13.5 17.5h3" />
    </template>
    <template v-else-if="name === 'sortAsc'">
      <path d="M7 19.5v-15M3.5 8 7 4.5 10.5 8M13.5 6.5h3M13.5 12h5M13.5 17.5h7" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
  display: block;
}
</style>
