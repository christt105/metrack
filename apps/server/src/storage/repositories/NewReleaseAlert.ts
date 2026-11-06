import type { AlertKey } from '@metrack/domain';

export type NewReleaseAlert = AlertKey & { title: string; message: string; sentAt: string };
