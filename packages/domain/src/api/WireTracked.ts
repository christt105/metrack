import type { Tracking } from '../Tracking.js';

/** A tracked entity as the connector protocol carries it: `rewatches` stays the plain list of finish dates older connectors read. */
export type WireTracked<T extends Tracking> = Omit<T, 'rewatches'> & { rewatches: string[] };
