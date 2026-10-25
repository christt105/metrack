<script setup lang="ts">
import ErrorNotice from '../components/ErrorNotice.vue';
import WatchlistRow from '../components/WatchlistRow.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { messages } from '../i18n/messages';

const api = useApi();
const followed = useLoader(() => api.listWatchlist());
const alerts = useLoader(() => api.listAlerts());

const sentAt = (iso: string): string => iso.slice(0, 16).replace('T', ' ');
</script>

<template>
  <section>
    <h1>{{ messages.watchlist.title }}</h1>

    <h2>{{ messages.watchlist.followedTitle }}</h2>
    <ErrorNotice :error="followed.error.value" />
    <p v-if="followed.loading.value && !followed.data.value" class="muted">
      {{ messages.common.loading }}
    </p>
    <p v-else-if="followed.data.value && followed.data.value.length === 0" class="muted">
      {{ messages.watchlist.followedEmpty }}
    </p>
    <ul class="followed">
      <WatchlistRow
        v-for="entry in followed.data.value ?? []"
        :key="`${entry.type}-${entry.id}`"
        :entry="entry"
        @unfollowed="followed.reload"
      />
    </ul>

    <h2>{{ messages.watchlist.alertsTitle }}</h2>
    <ErrorNotice :error="alerts.error.value" />
    <p v-if="alerts.data.value && alerts.data.value.length === 0" class="muted">
      {{ messages.watchlist.alertsEmpty }}
    </p>
    <ul class="alerts">
      <li v-for="alert in alerts.data.value ?? []" :key="alert.id">
        <strong>{{ alert.title }}</strong>
        <span>{{ messages.watchlist.kinds[alert.kind] }}</span>
        <span class="muted">{{ sentAt(alert.sentAt) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
ul {
  margin: 0 0 24px;
  padding: 0;
  list-style: none;
}

.alerts li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--outline);
}
</style>
