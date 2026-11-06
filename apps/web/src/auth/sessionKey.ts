import type { InjectionKey } from 'vue';
import type { Session } from './Session';

export const sessionKey: InjectionKey<Session> = Symbol('session');
