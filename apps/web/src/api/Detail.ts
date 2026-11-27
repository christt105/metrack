import type { Collection, MediaDetail, SeriesDetail } from '@metrack/domain';
import type { EntityOf } from './EntityOf';

export type Detail<C extends Collection> = C extends 'series'
  ? SeriesDetail
  : MediaDetail<EntityOf[C]>;
