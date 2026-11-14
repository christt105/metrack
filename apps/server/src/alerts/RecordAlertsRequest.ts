import type { NewReleaseAlert } from '../storage/repositories/NewReleaseAlert.js';

export interface RecordAlertsRequest {
  alerts: NewReleaseAlert[];
}
