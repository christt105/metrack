/** The policy with `'nonce-<nonce>'` added to its `script-src` directive. */
export function withScriptNonce(policy: string, nonce: string): string {
  return policy
    .split('; ')
    .map((directive) =>
      directive.startsWith('script-src ') ? `${directive} 'nonce-${nonce}'` : directive,
    )
    .join('; ');
}
