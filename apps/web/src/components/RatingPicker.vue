<script setup lang="ts">
import { RATING_LEVELS } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import { ratingDisplay } from '../logic/ratingDisplay';
import AppIcon from './AppIcon.vue';

const messages = useMessages();
defineProps<{ id?: string }>();
const model = defineModel<number | null>({ required: true });

function choose(rating: number | null): void {
  model.value = rating;
}
</script>

<template>
  <div :id="id" class="picker" role="radiogroup" :aria-label="messages.ratingPicker.legend">
    <button
      v-for="level in RATING_LEVELS"
      :key="level.rating"
      type="button"
      role="radio"
      class="option"
      :class="{ selected: model === level.rating }"
      :style="{ '--accent': level.color }"
      :aria-checked="model === level.rating"
      :data-rating="level.rating"
      @click="choose(level.rating)"
    >
      <AppIcon :name="level.icon" :size="20" />
      <span>{{ ratingDisplay(level.rating, messages).label }}</span>
    </button>
    <button
      type="button"
      role="radio"
      class="option none"
      :class="{ selected: model === null }"
      :aria-checked="model === null"
      data-rating="none"
      @click="choose(null)"
    >
      {{ messages.ratingPicker.none }}
    </button>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}

.option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 6px 12px;
  border: 1px solid var(--outline);
  border-radius: 999px;
  background: transparent;
  color: var(--on-surface);
}

.option .icon {
  color: var(--accent);
}

.option.selected {
  border-color: var(--accent, var(--primary));
  background: color-mix(in srgb, var(--accent, var(--primary)) 18%, transparent);
}
</style>
