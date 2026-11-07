/** The ntfy server every user's alerts go through; each user picks their own topic. */
export interface NtfyServer {
  url: string;
  token?: string;
}
