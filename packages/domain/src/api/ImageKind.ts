export const IMAGE_KINDS = ['cover', 'banner'] as const;

export type ImageKind = (typeof IMAGE_KINDS)[number];
