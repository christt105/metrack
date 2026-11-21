<script setup lang="ts">
import { computed, ref } from 'vue';
import { canonicalPlatform, KNOWN_PLATFORMS, normalizePlatforms } from '@metrack/domain';
import { loadCustomPlatforms, rememberCustomPlatform } from '../logic/customPlatforms';
import { parseList } from '../logic/formDraft';
import { useMessages } from '../composables/useMessages';

defineProps<{ id: string }>();
const model = defineModel<string>({ required: true });
const messages = useMessages();

const own = ref('');
const remembered = ref(loadCustomPlatforms());
const selected = computed(() => normalizePlatforms(parseList(model.value)));
const options = computed(() => {
  const known: string[] = [...KNOWN_PLATFORMS];
  const extra = [...remembered.value, ...selected.value].map(canonicalPlatform);
  return [...new Set([...known, ...extra])];
});

function toggle(name: string, on: boolean): void {
  const next = on ? [...selected.value, name] : selected.value.filter((p) => p !== name);
  model.value = normalizePlatforms(next).join(', ');
}

function addOwn(): void {
  const name = canonicalPlatform(own.value);
  if (name === '') return;
  own.value = '';
  if (!(KNOWN_PLATFORMS as readonly string[]).includes(name)) {
    rememberCustomPlatform(name);
    remembered.value = loadCustomPlatforms();
  }
  toggle(name, true);
}
</script>

<template>
  <div :id="id" class="platforms" role="group" :aria-label="messages.hero.platforms">
    <label v-for="name in options" :key="name" class="option">
      <input
        type="checkbox"
        :checked="selected.includes(name)"
        @change="toggle(name, ($event.target as HTMLInputElement).checked)"
      />
      {{ name }}
    </label>
    <span class="own">
      <input
        v-model="own"
        type="text"
        autocomplete="off"
        :placeholder="messages.edit.ownPlatform"
        :aria-label="messages.edit.ownPlatform"
        @keydown.enter.prevent="addOwn"
      />
      <button type="button" :disabled="own.trim() === ''" @click="addOwn">
        {{ messages.edit.addPlatform }}
      </button>
    </span>
  </div>
</template>

<style scoped>
.platforms {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2) var(--s-3);
}

.option {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
}

.own {
  display: inline-flex;
  gap: var(--s-2);
}
</style>
