/** Another user already has the handle. */
export class HandleTakenError extends Error {
  constructor(readonly handle: string) {
    super(`The handle ${handle} is taken`);
    this.name = 'HandleTakenError';
  }
}
