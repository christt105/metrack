/**
 * Body of `PUT /api/{collection}/{id}/images/{kind}`. `url` is a provider candidate's URL; owner and trusted
 * users may also send a URL of any public site or the `/api/images/<hash>` reference of an image they uploaded.
 */
export interface ImageChoice {
  url: string;
}
