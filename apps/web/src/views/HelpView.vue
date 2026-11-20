<script setup lang="ts">
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
const settingsHash: Record<string, string> = {
  following: 'connections',
  public: 'profile',
  account: 'profile',
};
</script>

<template>
  <section class="help">
    <h1>{{ messages.help.title }}</h1>
    <p class="muted">{{ messages.help.intro }}</p>
    <div v-for="section in messages.help.sections" :id="section.id" :key="section.id" class="panel">
      <h2>{{ section.title }}</h2>
      <p v-for="step in section.steps" :key="step">{{ step }}</p>
      <p v-if="settingsHash[section.id]">
        <RouterLink
          :to="{ name: 'settings', hash: `#${settingsHash[section.id]}` }"
          :data-test="`help-settings-${section.id}`"
        >
          {{ messages.help.openSettings }}
        </RouterLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
.help {
  max-width: 640px;
}
</style>
