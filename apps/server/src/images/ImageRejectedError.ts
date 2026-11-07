export type ImageRejection =
  'unsupported_image' | 'url_not_allowed' | 'image_too_large' | 'image_quota_exceeded';

const STATUS: Record<ImageRejection, number> = {
  unsupported_image: 400,
  url_not_allowed: 400,
  image_too_large: 413,
  image_quota_exceeded: 409,
};

/** An image the store refuses to keep: not an image it can read, from an address it may not fetch, too big, or over the user's quota. */
export class ImageRejectedError extends Error {
  readonly status: number;

  constructor(
    readonly code: ImageRejection,
    message: string,
  ) {
    super(message);
    this.name = 'ImageRejectedError';
    this.status = STATUS[code];
  }
}
