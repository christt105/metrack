import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ImageStore } from '../src/images/ImageStore.js';
import type { CommandOptions, CommandRunner } from '../src/publish/CommandRunner.js';
import { FilePublishState } from '../src/publish/FilePublishState.js';
import { PublishPipeline } from '../src/publish/PublishPipeline.js';
import type { Publisher } from '../src/publish/Publisher.js';
import {
  BookRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  VideogameRepository,
} from '../src/storage/repositories/index.js';
import { openTestDatabase } from './support/openTestDatabase.js';

const dirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-publish-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

class RecordingRunner implements CommandRunner {
  readonly calls: { command: string; args: string[]; cwd?: string; hadContent: boolean }[] = [];
  failWith: Error | null = null;

  async run(command: string, args: string[], options: CommandOptions = {}): Promise<void> {
    if (this.failWith) throw this.failWith;
    const hadContent = existsSync(join(options.cwd ?? '', 'content/movies/Alpha/index.md'));
    this.calls.push({ command, args, cwd: options.cwd, hadContent });
    const out = args[args.indexOf('--destination') + 1]!;
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'index.html'), 'built');
  }
}

class FakePublisher implements Publisher {
  readonly published: string[] = [];
  failWith: Error | null = null;

  async publish(siteDir: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.published.push(readFileSync(join(siteDir, 'index.html'), 'utf8'));
  }
}

function setup() {
  const db = openTestDatabase();
  const root = tempDir();
  const template = join(root, 'template');
  mkdirSync(template);
  writeFileSync(join(template, 'hugo.toml'), 'title = "x"');
  const movies = new MovieRepository(db);
  const sources = {
    movies,
    series: new SeriesRepository(db),
    seasons: new SeasonRepository(db),
    videogames: new VideogameRepository(db),
    books: new BookRepository(db),
    images: new ImageStore(db, join(root, 'images')),
  };
  const runner = new RecordingRunner();
  const publisher = new FakePublisher();
  const state = new FilePublishState(join(root, 'state.json'));
  const pipeline = new PublishPipeline(
    sources,
    { siteTemplateDir: template, workDir: join(root, 'work'), hugoBinary: 'hugo' },
    runner,
    publisher,
    state,
  );
  const addMovie = (title: string) =>
    movies.create({
      tmdbId: null,
      jellyfinId: null,
      title,
      originalTitle: null,
      releaseDate: null,
      overview: null,
      genres: [],
      cast: [],
      director: null,
      note: null,
      cover: null,
      banner: null,
      slug: title,
      tags: [],
      status: 'planned',
      startedAt: null,
      finishedAt: null,
      rating: null,
      review: null,
      rewatches: [],
    });
  return { pipeline, runner, publisher, state, addMovie, template };
}

describe('PublishPipeline', () => {
  it('builds the template plus exported content and publishes the result', async () => {
    const { pipeline, runner, publisher, addMovie, template } = setup();
    addMovie('Alpha');
    expect(await pipeline.run()).toBe('published');
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]).toMatchObject({ command: 'hugo', hadContent: true });
    expect(publisher.published).toEqual(['built']);
    expect(existsSync(join(template, 'content'))).toBe(false);
  });

  it('does not build or publish when nothing changed since the last publish', async () => {
    const { pipeline, runner, publisher, addMovie } = setup();
    addMovie('Alpha');
    await pipeline.run();
    expect(await pipeline.run()).toBe('unchanged');
    expect(runner.calls).toHaveLength(1);
    expect(publisher.published).toHaveLength(1);
    addMovie('Beta');
    expect(await pipeline.run()).toBe('published');
    expect(publisher.published).toHaveLength(2);
  });

  it('does not record a failed publish, so the next attempt tries again', async () => {
    const { pipeline, publisher, addMovie } = setup();
    addMovie('Alpha');
    publisher.failWith = new Error('upload refused');
    await expect(pipeline.run()).rejects.toThrow('upload refused');
    publisher.failWith = null;
    expect(await pipeline.run()).toBe('published');
  });

  it('fails when the site build fails', async () => {
    const { pipeline, runner, publisher, addMovie } = setup();
    addMovie('Alpha');
    runner.failWith = new Error('hugo exploded');
    await expect(pipeline.run()).rejects.toThrow('hugo exploded');
    expect(publisher.published).toEqual([]);
  });
});
