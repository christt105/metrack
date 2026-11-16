import { inject } from 'vue';
import type { Connectivity } from '../connectivity/Connectivity';
import { connectivityKey } from '../connectivity/connectivityKey';

/** The connectivity state provided by the app root. */
export function useConnectivity(): Connectivity {
  const connectivity = inject(connectivityKey);
  if (!connectivity) throw new Error('Connectivity was not provided');
  return connectivity;
}
