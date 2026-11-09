/** An object read from R2. */
export interface R2Body {
  arrayBuffer(): Promise<ArrayBuffer>;
}
