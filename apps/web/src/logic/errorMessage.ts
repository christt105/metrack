import { ApiRequestError } from '../api/ApiRequestError';
import type { Messages } from '../i18n/messages/Messages';

/** A sentence for people describing why a call failed. */
export function errorMessage(error: unknown, messages: Messages): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'network_error') return messages.errors.network;
    if (error.code === 'provider_not_configured') return messages.errors.providerNotConfigured;
    if (error.code === 'invalid_viewing' || error.code === 'invalid_dates') {
      return messages.errors.viewingInvalid;
    }
    if (error.code === 'future_date') return messages.errors.viewingFuture;
    if (error.code === 'duplicate_viewing') return messages.errors.viewingDuplicate;
    if (error.code === 'pass_not_found') return messages.errors.passNotFound;
    if (error.code === 'restart_same_day') return messages.errors.restartSameDay;
    if (error.code === 'no_metadata_source') return messages.errors.noMetadataSource;
    if (error.status === 404) return messages.errors.notFound;
    return error.message;
  }
  return error instanceof Error ? error.message : messages.errors.generic;
}
