<script setup lang="ts">
import { computed, ref } from 'vue';
import { sizedImageUrl } from '@metrack/domain';
import ErrorNotice from '../components/ErrorNotice.vue';
import FollowingCalendar from '../components/FollowingCalendar.vue';
import FollowingEventRow from '../components/FollowingEventRow.vue';
import WatchlistRow from '../components/WatchlistRow.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { messages } from '../i18n/messages';
import { buildAgenda, RECENT_DAYS } from '../logic/following/buildAgenda';
import { daysBetween, localDate } from '../logic/following/dates';
import { followingEvents } from '../logic/following/followingEvents';

type View = 'upcoming' | 'calendar' | 'all';

const api = useApi();
const followed = useLoader(() => api.listWatchlist());
const alerts = useLoader(() => api.listAlerts());
const view = ref<View>('upcoming');
const views: View[] = ['upcoming', 'calendar', 'all'];
const today = localDate(new Date());

const events = computed(() => followingEvents(followed.data.value ?? []));
const agenda = computed(() => buildAgenda(events.value, today));
const waiting = computed(() => {
  const dated = new Set(
    events.value
      .filter((event) => daysBetween(today, event.date) >= -RECENT_DAYS)
      .map((event) => event.key),
  );
  return (followed.data.value ?? []).filter((entry) => !dated.has(`${entry.type}-${entry.id}`));
});

function groupTitle(kind: string, month: string | null): string {
  return month ? messages.watchlist.month(month) : (messages.watchlist.groups[kind] ?? kind);
}

const sentAt = (iso: string): string => iso.slice(0, 16).replace('T', ' ');
</script>

<template>
  <section>
    <header class="head">
      <h1>{{ messages.watchlist.title }}</h1>
      <div class="views" role="group" :aria-label="messages.watchlist.viewsLabel">
        <button
          v-for="option in views"
          :key="option"
          type="button"
          class="chip"
          :aria-pressed="view === option"
          @click="view = option"
        >
          {{ messages.watchlist.views[option] }}
        </button>
      </div>
    </header>

    <ErrorNotice :error="followed.error.value" />
    <p v-if="followed.loading.value && !followed.data.value" class="muted">
      {{ messages.common.loading }}
    </p>
    <p v-else-if="followed.data.value && followed.data.value.length === 0" class="muted">
      {{ messages.watchlist.followedEmpty }}
    </p>

    <template v-else-if="followed.data.value">
      <div v-if="view === 'upcoming'" class="agenda">
        <p v-if="agenda.length === 0" class="muted">{{ messages.watchlist.upcomingEmpty }}</p>
        <section
          v-for="group in agenda"
          :key="`${group.kind}-${group.month}`"
          class="group"
          :aria-label="groupTitle(group.kind, group.month)"
        >
          <h2>{{ groupTitle(group.kind, group.month) }}</h2>
          <div class="list">
            <FollowingEventRow
              v-for="event in group.events"
              :key="event.key"
              :event="event"
              :today="today"
            />
          </div>
        </section>
        <section v-if="waiting.length" class="group">
          <h2>{{ messages.watchlist.waitingTitle }}</h2>
          <p class="muted note">{{ messages.watchlist.dataNote }}</p>
          <ul class="waiting">
            <li v-for="entry in waiting" :key="`${entry.type}-${entry.id}`">
              <RouterLink :to="`/${entry.type === 'movie' ? 'movies' : 'series'}/${entry.id}`">
                <span class="mini">
                  <img
                    v-if="entry.cover"
                    :src="sizedImageUrl(entry.cover, 'thumb')"
                    alt=""
                    width="342"
                    height="513"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span class="mini-title">{{ entry.title }}</span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <FollowingCalendar v-else-if="view === 'calendar'" :events="events" :today="today" />

      <ul v-else class="followed">
        <WatchlistRow
          v-for="entry in followed.data.value"
          :key="`${entry.type}-${entry.id}`"
          :entry="entry"
          @unfollowed="followed.reload"
        />
      </ul>
    </template>

    <section class="alerts-section" aria-labelledby="alerts-title">
      <h2 id="alerts-title">{{ messages.watchlist.alertsTitle }}</h2>
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
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  margin-bottom: var(--s-6);
}

.head h1 {
  margin: 0;
}

.views {
  display: flex;
  gap: var(--s-2);
}

.chip {
  cursor: pointer;
}

.agenda {
  display: grid;
  gap: var(--s-6);
}

.group h2 {
  margin-bottom: var(--s-3);
}

.note {
  margin: -6px 0 var(--s-3);
  font-size: var(--t-small);
}

.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
  gap: var(--s-3);
}

.waiting {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--s-4) var(--s-3);
}

.waiting a {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--on-surface);
}

.waiting a:hover {
  text-decoration: none;
}

.mini {
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border: 1px solid var(--outline);
  border-radius: var(--r-sm);
  background: var(--surface-low);
  transition: border-color 120ms var(--ease);
}

.mini img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.waiting a:hover .mini {
  border-color: var(--outline-strong);
}

.mini-title {
  display: -webkit-box;
  overflow: hidden;
  font-size: var(--t-label);
  line-height: 1.3;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.followed {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--s-3);
}

.alerts-section {
  margin-top: var(--s-7);
}

.alerts li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--outline);
}

@media (max-width: 599px) {
  .waiting {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .followed {
    grid-template-columns: 1fr;
  }

  .views {
    width: 100%;
  }

  .views .chip {
    flex: 1;
    justify-content: center;
  }
}
</style>
