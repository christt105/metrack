/** The cloud answered a connector request with an error status. */
export class CloudError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}
