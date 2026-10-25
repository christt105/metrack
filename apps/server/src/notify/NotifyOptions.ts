/** Presentation hints for a notification. Everything is optional. */
export interface NotifyOptions {
  priority?: 'low' | 'default' | 'high';
  /** ntfy tag names, rendered as emoji or labels. */
  tags?: string[];
  /** Public URL of an image shown with the notification. */
  imageUrl?: string;
}
