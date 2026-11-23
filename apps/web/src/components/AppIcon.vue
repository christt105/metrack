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
    <template v-else-if="name === 'next'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m10 8.5 5 3.5-5 3.5z" />
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
    <template v-else-if="name === 'crown'">
      <path d="M4 18.5h16M4.5 17 3.5 8l4.8 4L12 5.5l3.7 6.5 4.8-4-1 9z" />
    </template>
    <template v-else-if="name === 'heart'">
      <path
        d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"
      />
    </template>
    <template v-else-if="name === 'thumbsUp'">
      <path
        d="M8 10.5V19H4.5v-8.5zM8 10.5l3.2-6.2c1.6 0 2.4 1.2 2 2.7L12.6 9.5h5.3a1.9 1.9 0 0 1 1.9 2.3l-1.2 5.6a2.4 2.4 0 0 1-2.3 1.6H8"
      />
    </template>
    <template v-else-if="name === 'thumbsDown'">
      <path
        d="M8 13.5V5H4.5v8.5zM8 13.5l3.2 6.2c1.6 0 2.4-1.2 2-2.7l-.6-2.5h5.3a1.9 1.9 0 0 0 1.9-2.3l-1.2-5.6A2.4 2.4 0 0 0 16.3 4.5H8"
      />
    </template>
    <template v-else-if="name === 'smile'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14c.9 1.4 2.1 2.1 3.5 2.1s2.6-.7 3.5-2.1M9 9.5h.01M15 9.5h.01" />
    </template>
    <template v-else-if="name === 'dizzy'">
      <circle cx="12" cy="12" r="8.5" />
      <path
        d="m7.8 8.3 2.4 2.4m0-2.4-2.4 2.4M13.8 8.3l2.4 2.4m0-2.4-2.4 2.4M9 16c1-1.1 2-1.1 3 0s2 1.1 3 0"
      />
    </template>
    <template v-else-if="name === 'skull'">
      <path
        d="M12 3.8a7.5 7.5 0 0 0-7.5 7.5c0 2.4 1.1 4 2.9 5v3.4h9.2v-3.4c1.8-1 2.9-2.6 2.9-5A7.5 7.5 0 0 0 12 3.8z"
      />
      <path d="M9.2 11.5h.01M14.8 11.5h.01M10.5 19.7v-2.3M13.5 19.7v-2.3" />
    </template>
    <template v-else-if="name === 'trophy'">
      <path
        d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3 3 0 0 0 8 10.5M16 6h3.5v1.5a3 3 0 0 1-3.5 3M12 13v4M8.5 20h7M10 17h4"
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
    <template v-else-if="name === 'skipForward'">
      <path d="M5 6.5v11l7-5.5zM12.5 6.5v11l7-5.5z" />
    </template>
    <template v-else-if="name === 'more'">
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'filler'">
      <circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3" />
    </template>
    <template v-else-if="name === 'mixedFiller'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'externalLink'">
      <path
        d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 14v3.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2H10"
      />
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
