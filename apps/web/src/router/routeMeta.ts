import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Opens without a session. */
    public?: boolean;
    /** Hides the app navigation on small screens so the page takes the whole screen. */
    focused?: boolean;
  }
}
