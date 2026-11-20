import { ApiRequestError } from '../api/ApiRequestError';
import type { Messages } from '../i18n/messages/Messages';

/** A sentence for people describing why a call failed. */
export function errorMessage(error: unknown, messages: Messages): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'network_error') return messages.errors.network;
    if (error.code === 'provider_not_configured') return messages.errors.providerNotConfigured;
    if (error.code === 'no_metadata_source') return messages.errors.noMetadataSource;
    if (error.status === 404) return messages.errors.notFound;
    return error.message;
  }
  return error instanceof Error ? error.message : messages.errors.generic;
}
