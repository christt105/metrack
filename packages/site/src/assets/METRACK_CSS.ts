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

.footer_credits {
  display: block;
  font-size: 12px;
  color: #767f87;
  padding: 0.3rem 0.95rem;
}

.footer_credits img {
  vertical-align: middle;
  margin-right: 0.4rem;
}
.badge-trophy {
  position: absolute;
  top: 30px;
  left: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 0 8px 8px 0;
  background: #f2c230;
  color: #3a2a00;
  font-size: 1rem;
  line-height: 1;
  pointer-events: none;
}

.status-badge.all-achievements {
  background: #f2c230;
  color: #3a2a00;
}
`;
