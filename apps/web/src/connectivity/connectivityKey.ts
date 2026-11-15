import type { InjectionKey } from 'vue';
import type { Connectivity } from './Connectivity';

export const connectivityKey: InjectionKey<Connectivity> = Symbol('connectivity');
