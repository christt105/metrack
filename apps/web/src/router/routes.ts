import type { RouteRecordRaw } from 'vue-router';
import HelpView from '../views/HelpView.vue';
import InviteView from '../views/InviteView.vue';
import LoginView from '../views/LoginView.vue';
import MediaDetailView from '../views/MediaDetailView.vue';
import MediaEditView from '../views/MediaEditView.vue';
import MediaListView from '../views/MediaListView.vue';
import NewMediaView from '../views/NewMediaView.vue';
import SearchView from '../views/SearchView.vue';
import SettingsView from '../views/SettingsView.vue';
import WelcomeView from '../views/WelcomeView.vue';
import WatchlistView from '../views/WatchlistView.vue';
import SteamImportView from '../views/SteamImportView.vue';
import UnlinkedView from '../views/UnlinkedView.vue';
import './routeMeta';

export const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  {
    path: '/invite/:code',
    name: 'invite',
    component: InviteView,
    meta: { public: true },
    props: true,
  },
  { path: '/welcome', name: 'welcome', component: WelcomeView },
  { path: '/', name: 'library', component: MediaListView },
  { path: '/search', name: 'search', component: SearchView },
  { path: '/watchlist', name: 'watchlist', component: WatchlistView },
  { path: '/unlinked', name: 'unlinked', component: UnlinkedView },
  { path: '/steam', name: 'steam', component: SteamImportView },
  { path: '/settings', name: 'settings', component: SettingsView },
  { path: '/help', name: 'help', component: HelpView },
  { path: '/new/:collection(games|books)', name: 'new', component: NewMediaView, props: true },
  {
    path: '/:collection(movies|series|seasons|games|books)/:id(\\d+)',
    name: 'detail',
    component: MediaDetailView,
    props: (route) => ({ collection: route.params.collection, id: Number(route.params.id) }),
  },
  {
    path: '/:collection(movies|series|seasons|games|books)/:id(\\d+)/edit',
    name: 'edit',
    component: MediaEditView,
    meta: { focused: true },
    props: (route) => ({ collection: route.params.collection, id: Number(route.params.id) }),
  },
  { path: '/:rest(.*)*', redirect: '/' },
];
