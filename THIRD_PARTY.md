# Third-party notices

The public pages (`packages/site`) reuse the compiled stylesheet, scripts, font and default images of the author's Hugo theme, [hugo-mediatracker-theme](https://github.com/christt105/hugo-mediatracker-theme) (MIT, Copyright (c) 2026 christt105), which is built on [hugo-blog-awesome](https://github.com/hugo-sid/hugo-blog-awesome) (MIT, Copyright (c) the hugo-blog-awesome authors).

The files under `packages/site/src/assets` that come from them are `THEME_CSS`, `CODE_HIGHLIGHT_CSS`, `THEME_JS`, `MAIN_JS`, `FILTER_JS`, `YEAR_NAV_JS`, `STATS_JS`, `COLLAGE_JS`, `COLLAGE_CSS` and the Roboto font in `ROBOTO_WOFF2` (Roboto is licensed under the Apache License 2.0).

The MIT license text of both projects:

```
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Vendored browser assets

The public pages serve two more third-party files themselves, so no request leaves for a CDN:

- [Font Awesome Free](https://fontawesome.com) 6.4.0 (`FONT_AWESOME_CSS`, `FONT_AWESOME_SOLID_WOFF2`, `FONT_AWESOME_BRANDS_WOFF2` under `packages/site/src/assets`, only the solid and brands styles the pages use): icons CC BY 4.0, fonts SIL OFL 1.1, code MIT. Copyright 2023 Fonticons, Inc. The license is at https://fontawesome.com/license/free.
- [html2canvas-pro](https://github.com/yorickshan/html2canvas-pro) 1.6.2 (`HTML2CANVAS_PRO_JS`): MIT, Copyright (c) 2024-present yorickshan and html2canvas-pro contributors.
