import { ArtworkService } from '../artwork/ArtworkService.js';
import { buildMediaKinds } from '../media/buildMediaKinds.js';
import { MediaCatalog } from '../media/MediaCatalog.js';
import { MediaEditor } from '../media/MediaEditor.js';
import { UnlinkedResolver } from '../titles/UnlinkedResolver.js';
import type { EditServices } from './EditServices.js';
import type { EditServicesDeps } from './EditServicesDeps.js';

export function createEditServices(deps: EditServicesDeps): EditServices {
  const { sources } = deps;
  const kinds = buildMediaKinds(sources);
  const editor = new MediaEditor(kinds, deps.states, deps.images, deps.now);
  return {
    editor,
    catalog: new MediaCatalog(kinds, (seriesId) => sources.seasons.listBySeries(seriesId)),
    artwork: new ArtworkService(editor, sources.series, deps.imageProviders, deps.images),
    titleProviders: deps.titleProviders,
    resolver: new UnlinkedResolver(deps.unlinked, editor, deps.titleProviders, deps.cache),
    series: sources.series,
    overrides: sources.overrides,
    unlinked: deps.unlinked,
  };
}
