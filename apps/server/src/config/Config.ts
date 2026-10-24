export interface Config {
  port: number;
  host: string;
  dataDir: string;
  webDir: string;
  appVersion: string;
  tmdbApiKey: string | undefined;
  tmdbLanguage: string;
  steamGridDbToken: string | undefined;
}
