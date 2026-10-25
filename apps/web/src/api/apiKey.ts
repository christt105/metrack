import type { InjectionKey } from 'vue';
import type { ApiClient } from './ApiClient';

export const apiKey: InjectionKey<ApiClient> = Symbol('api');
