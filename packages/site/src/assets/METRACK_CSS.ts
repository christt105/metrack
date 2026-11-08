/** The stylesheet metrack adds after the vendored theme CSS; every fix to the public pages lives here. */
export const METRACK_CSS = String.raw`html.dark {
  background-color: #131418;
}

html.light {
  background-color: #fff;
}

html,
body {
  overflow-x: clip;
}

body {
  min-height: 100vh;
  min-height: 100dvh;
}
`;
