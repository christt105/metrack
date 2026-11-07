<script setup lang="ts">
import type { UserSettings } from '@metrack/domain';
import { messages } from '../i18n/messages';

defineProps<{ settings: UserSettings }>();

const keys = Object.keys(messages.settings.settingLabels) as (keyof UserSettings)[];
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
