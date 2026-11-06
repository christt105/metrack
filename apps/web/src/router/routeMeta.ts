import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Opens without a session. */
    public?: boolean;
  }
}
