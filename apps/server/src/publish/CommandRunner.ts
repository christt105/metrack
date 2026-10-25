export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  /**
   * Names of the parent environment variables the command may see. When set, only these
   * (plus `env`) are passed; otherwise the whole parent environment is inherited.
   */
  inheritEnv?: readonly string[];
}

/** Runs an external program and rejects with its error output when it fails. */
export interface CommandRunner {
  run(command: string, args: string[], options?: CommandOptions): Promise<void>;
}
