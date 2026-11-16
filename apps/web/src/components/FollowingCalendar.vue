<script setup lang="ts">
import { computed, ref } from 'vue';
import { sizedImageUrl } from '@metrack/domain';
import { messages } from '../i18n/messages';
import { addMonths } from '../logic/following/dates';
import type { FollowingEvent } from '../logic/following/FollowingEvent';
import { monthGrid } from '../logic/following/monthGrid';
import AppIcon from './AppIcon.vue';
import FollowingEventRow from './FollowingEventRow.vue';

const props = defineProps<{ events: FollowingEvent[]; today: string }>();

const month = ref(props.today.slice(0, 7));
const selected = ref(props.today);
const weeks = computed(() => monthGrid(month.value));
const byDate = computed(() => {
  const map = new Map<string, FollowingEvent[]>();
  for (const event of props.events) map.set(event.date, [...(map.get(event.date) ?? []), event]);
  return map;
});
const selectedEvents = computed(() => byDate.value.get(selected.value) ?? []);

function move(months: number): void {
  month.value = addMonths(month.value, months);
  const first = props.events.find((event) => event.date.startsWith(month.value));
  selected.value = first?.date ?? `${month.value}-01`;
}

function backToToday(): void {
  month.value = props.today.slice(0, 7);
  selected.value = props.today;
}

function coverOf(event: FollowingEvent): string | null {
  return event.entry.cover ? sizedImageUrl(event.entry.cover, 'thumb') : null;
}

function dayLabel(date: string): string {
  const count = byDate.value.get(date)?.length ?? 0;
  const titles = (byDate.value.get(date) ?? []).map((event) => event.entry.title).join(', ');
  return count ? `${messages.watchlist.day(date)}: ${titles}` : messages.watchlist.day(date);
}
</script>

<template>
  <div class="calendar">
    <div class="bar">
      <h2 class="title">{{ messages.watchlist.month(month) }}</h2>
      <div class="nav">
        <button type="button" class="small" @click="backToToday">
          {{ messages.watchlist.thisMonth }}
        </button>
        <button
          type="button"
          class="icon"
          :aria-label="messages.watchlist.previousMonth"
          @click="move(-1)"
        >
          <AppIcon name="back" :size="20" />
        </button>
        <button
          type="button"
          class="icon"
          :aria-label="messages.watchlist.nextMonth"
          @click="move(1)"
        >
          <AppIcon name="chevron" :size="20" />
        </button>
      </div>
    </div>
    <div class="grid" role="grid" :aria-label="messages.watchlist.month(month)">
      <div class="head" role="row">
        <span v-for="name in messages.watchlist.weekdays" :key="name" role="columnheader">{{
          name
        }}</span>
      </div>
      <div v-for="week in weeks" :key="week[0]?.date" class="week" role="row">
        <button
          v-for="day in week"
          :key="day.date"
          type="button"
          role="gridcell"
          class="day"
          :class="{
            out: !day.inMonth,
            today: day.date === today,
            busy: byDate.has(day.date),
          }"
          :aria-pressed="day.date === selected"
          :aria-label="dayLabel(day.date)"
          @click="selected = day.date"
        >
          <span class="num">{{ day.day }}</span>
          <span v-if="byDate.has(day.date)" class="posters" aria-hidden="true">
            <span
              v-for="event in (byDate.get(day.date) ?? []).slice(0, 2)"
              :key="event.key"
              class="poster"
            >
              <img v-if="coverOf(event)" :src="coverOf(event) as string" alt="" loading="lazy" />
            </span>
            <span v-if="(byDate.get(day.date)?.length ?? 0) > 2" class="more">{{
              messages.watchlist.more((byDate.get(day.date)?.length ?? 0) - 2)
            }}</span>
          </span>
        </button>
      </div>
    </div>
    <section class="selected" aria-live="polite">
      <h3>{{ messages.watchlist.day(selected) }}</h3>
      <p v-if="selectedEvents.length === 0" class="muted">
        {{ messages.watchlist.nothingThatDay }}
      </p>
      <div class="list">
        <FollowingEventRow
          v-for="event in selectedEvents"
          :key="event.key"
          :event="event"
          :today="today"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}

.title {
  margin: 0;
  font-size: 24px;
}

.nav {
  display: flex;
  gap: var(--s-2);
}

.icon {
  width: 44px;
  padding: 0;
}

.grid {
  overflow: hidden;
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
}

.head,
.week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.head span {
  padding: var(--s-2);
  border-bottom: 1px solid var(--outline);
  color: var(--muted);
  font-size: var(--t-label);
  font-weight: 500;
  text-align: center;
}

.week + .week .day {
  border-top: 1px solid var(--outline);
}

.day {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 6px;
  min-height: 116px;
  padding: var(--s-2);
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: left;
}

.day + .day {
  border-left: 1px solid var(--outline);
}

.day:hover:not(:disabled) {
  background: var(--surface-low);
  transform: none;
}

.day[aria-pressed='true'] {
  background: var(--surface-low);
  box-shadow: inset 0 0 0 2px var(--primary);
}

.out .num {
  color: var(--muted);
  opacity: 0.6;
}

.num {
  display: inline-grid;
  place-items: center;
  align-self: flex-start;
  min-width: 28px;
  height: 28px;
  border-radius: 999px;
  font-size: var(--t-small);
  font-weight: 500;
}

.today .num {
  background: var(--primary);
  color: var(--on-primary);
}

.posters {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

.poster {
  width: 40px;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 6px;
  background: var(--surface-highest);
}

.poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.more {
  color: var(--muted);
  font-size: var(--t-label);
  font-weight: 500;
}

.selected {
  margin-top: var(--s-5);
}

.selected h3 {
  margin-bottom: var(--s-3);
}

.list {
  display: grid;
  gap: var(--s-3);
}

@media (max-width: 759px) {
  .day {
    align-items: center;
    min-height: 56px;
    padding: 6px 2px;
    gap: 4px;
  }

  .num {
    align-self: center;
  }

  .poster {
    display: none;
  }

  .busy .posters::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--primary);
  }

  .more {
    display: none;
  }

  .head span {
    padding: var(--s-2) 0;
  }
}
</style>
