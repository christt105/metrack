import { ref, type Ref } from 'vue';

/** Whether the app can reach the network: the browser's own online state, corrected by the outcome of API calls. */
export class Connectivity {
  readonly offline: Ref<boolean>;

  constructor(target: Pick<Window, 'addEventListener'>, online: boolean) {
    this.offline = ref(!online);
    target.addEventListener('online', () => this.report(true));
    target.addEventListener('offline', () => this.report(false));
  }

  /** Records whether the last network attempt reached the server. */
  report(reachable: boolean): void {
    this.offline.value = !reachable;
  }
}
