<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  WEB_EDITABLE_SETTINGS,
  type User,
  type UserSettings,
  type UserSettingsPatch,
} from '@metrack/domain';
import { ApiRequestError } from '../api/ApiRequestError';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ user: User; settings: UserSettings }>();
const emit = defineEmits<{ saved: [settings: UserSettings] }>();

const api = useApi();
const draft = reactive(
  Object.fromEntries(WEB_EDITABLE_SETTINGS.map((key) => [key, props.settings[key] ?? ''])),
) as Record<keyof UserSettings, string>;
const error = ref<unknown>(null);
const saved = ref(false);
const busy = ref(false);
const problems = computed(() =>
  error.value instanceof ApiRequestError && error.value.code === 'invalid_settings'
    ? (error.value.details as Partial<Record<keyof UserSettings, string>>)
    : {},
);

async function save(): Promise<void> {
  const patch: UserSettingsPatch = {};
  for (const key of WEB_EDITABLE_SETTINGS) {
    if (draft[key].trim() !== (props.settings[key] ?? '')) patch[key] = draft[key];
  }
  busy.value = true;
  error.value = null;
  saved.value = false;
  try {
    const updated = await api.updateUserSettings(props.user.id, patch);
    for (const key of WEB_EDITABLE_SETTINGS) draft[key] = updated[key] ?? '';
    saved.value = true;
    emit('saved', updated);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="user" @submit.prevent="save">
    <h3>{{ user.name }}</h3>
    <label v-for="key in WEB_EDITABLE_SETTINGS" :key="key">
      <span class="muted">{{ messages.settings.settingLabels[key] }}</span>
      <input v-model="draft[key]" type="text" :name="key" :aria-invalid="key in problems" />
      <span v-if="problems[key]" class="problem">{{ problems[key] }}</span>
    </label>
    <p class="muted folder">
      {{ messages.settings.settingLabels.mirrorDir }}:
      {{ settings.mirrorDir ?? messages.settings.notSet }}.
      {{ messages.settings.mirrorDirHint(user.id) }}
    </p>
    <button type="submit" :disabled="busy">{{ messages.settings.save }}</button>
    <p v-if="saved" class="notice success" role="status">
      {{ messages.settings.saved(user.name) }}
    </p>
    <ErrorNotice v-else :error="error" />
  </form>
</template>

<style scoped>
.user {
  display: grid;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid var(--outline);
}

h3 {
  margin: 0;
}

label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

.problem {
  color: var(--danger);
}

.folder {
  margin: 0;
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.user button {
  justify-self: start;
}

@media (min-width: 760px) {
  .user {
    grid-template-columns: repeat(2, 1fr);
  }

  h3,
  .folder,
  .notice {
    grid-column: 1 / -1;
  }
}
</style>
