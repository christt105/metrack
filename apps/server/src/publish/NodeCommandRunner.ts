import { spawn } from 'node:child_process';
import type { CommandOptions, CommandRunner } from './CommandRunner.js';

const TAIL_BYTES = 2000;

export class NodeCommandRunner implements CommandRunner {
  run(command: string, args: string[], options: CommandOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: { ...parentEnv(options.inheritEnv), ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      const collect = (chunk: Buffer): void => {
        output = (output + chunk.toString()).slice(-TAIL_BYTES);
      };
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);
      child.on('error', (error) =>
        reject(new Error(`${command} could not start: ${error.message}`)),
      );
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}: ${output.trim()}`));
      });
    });
  }
}

function parentEnv(names: readonly string[] | undefined): NodeJS.ProcessEnv {
  if (names === undefined) return process.env;
  const exact = new Set(names.filter((name) => !name.endsWith('*')));
  const prefixes = names.filter((name) => name.endsWith('*')).map((name) => name.slice(0, -1));
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) =>
        value !== undefined &&
        (exact.has(name) || prefixes.some((prefix) => name.startsWith(prefix))),
    ),
  );
}
