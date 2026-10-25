/** Where a cover or banner value of a note points. */
export type ImageSource = { kind: 'local'; path: string } | { kind: 'remote'; url: string };
