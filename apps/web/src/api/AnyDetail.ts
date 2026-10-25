import type { Book, MediaDetail, Movie, Season, Series, Videogame } from '@metrack/domain';

/** The detail of any entity, before narrowing by collection. */
export type AnyDetail = MediaDetail<Movie | Series | Season | Videogame | Book>;
