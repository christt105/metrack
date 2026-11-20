<script setup lang="ts">
import type { EditableSetting, UserSettings } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
defineProps<{ settings: UserSettings }>();

const keys = Object.keys(messages.settings.settingLabels) as EditableSetting[];
</script>

<template>
  <dl>
    <template v-for="key in keys" :key="key">
      <dt class="muted">{{ messages.settings.settingLabels[key] }}</dt>
      <dd :class="{ muted: settings[key] === null }">
        {{ settings[key] ?? messages.settings.notSet }}
      </dd>
    </template>
  </dl>
</template>

<style scoped>
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
