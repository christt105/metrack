export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
}

/** Runs an external program and rejects with its error output when it fails. */
export interface CommandRunner {
  run(command: string, args: string[], options?: CommandOptions): Promise<void>;
}
