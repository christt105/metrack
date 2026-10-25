import { onMounted, ref } from 'vue';
import type { Ref } from 'vue';

export interface Loader<T> {
  data: Ref<T | null>;
  error: Ref<unknown>;
  loading: Ref<boolean>;
  reload: () => Promise<void>;
}

/** Runs `load` on mount and on demand, keeping the latest result, error and loading flag. Stale answers are dropped. */
export function useLoader<T>(load: () => Promise<T>): Loader<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<unknown>(null);
  const loading = ref(false);
  let ticket = 0;

  async function reload(): Promise<void> {
    const mine = ++ticket;
    loading.value = true;
    try {
      const result = await load();
      if (mine !== ticket) return;
      data.value = result;
      error.value = null;
    } catch (cause) {
      if (mine !== ticket) return;
      error.value = cause;
    } finally {
      if (mine === ticket) loading.value = false;
    }
  }

  onMounted(reload);
  return { data, error, loading, reload };
}
