/** A response body is bigger than the limit the caller accepts. */
export class ResponseTooLargeError extends Error {
  constructor(
    url: string,
    readonly limit: number,
  ) {
    super(`The response from ${url} is over ${limit} bytes`);
    this.name = 'ResponseTooLargeError';
  }
}
