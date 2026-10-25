import type { RouteRecordRaw } from 'vue-router';
import MediaDetailView from '../views/MediaDetailView.vue';
import MediaListView from '../views/MediaListView.vue';
import NewMediaView from '../views/NewMediaView.vue';
import SearchView from '../views/SearchView.vue';
import SettingsView from '../views/SettingsView.vue';
import UnlinkedView from '../views/UnlinkedView.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'library', component: MediaListView },
  { path: '/search', name: 'search', component: SearchView },
  { path: '/unlinked', name: 'unlinked', component: UnlinkedView },
  { path: '/settings', name: 'settings', component: SettingsView },
  { path: '/new/:collection(games|books)', name: 'new', component: NewMediaView, props: true },
  {
    path: '/:collection(movies|series|seasons|games|books)/:id(\\d+)',
    name: 'detail',
    component: MediaDetailView,
    props: (route) => ({ collection: route.params.collection, id: Number(route.params.id) }),
  },
  { path: '/:rest(.*)*', redirect: '/' },
];
