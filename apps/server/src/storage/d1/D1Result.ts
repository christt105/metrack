import type { Row } from '../mapping/Row.js';
import type { D1Meta } from './D1Meta.js';

export interface D1Result {
  results: Row[];
  meta: D1Meta;
}
