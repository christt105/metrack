FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/export/package.json packages/export/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages packages
COPY apps apps
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS tools
ARG HUGO_VERSION=0.152.2
ARG TARGETARCH
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/hugo
RUN arch="${TARGETARCH:-amd64}" \
    && archive="hugo_extended_${HUGO_VERSION}_linux-${arch}.tar.gz" \
    && base="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}" \
    && curl -fsSLO "${base}/${archive}" \
    && curl -fsSL "${base}/hugo_${HUGO_VERSION}_checksums.txt" | grep " ${archive}\$" | sha256sum -c - \
    && tar -xzf "${archive}" hugo \
    && ./hugo version

FROM node:22-slim AS runtime
COPY --from=tools /tmp/hugo/hugo /usr/local/bin/hugo
ARG WRANGLER_VERSION=4.152.0
RUN npm install --global --no-fund --no-audit "wrangler@${WRANGLER_VERSION}" \
    && npm cache clean --force \
    && wrangler --version
ENV NODE_ENV=production \
    PORT=8097 \
    DATA_DIR=/data \
    WEB_DIR=/app/web
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /repo/packages/domain/dist ./packages/domain/dist
COPY --from=build /repo/packages/export/package.json ./packages/export/package.json
COPY --from=build /repo/packages/export/dist ./packages/export/dist
COPY --from=build /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/web/dist ./web
VOLUME /data
EXPOSE 8097
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "apps/server/dist/main.js"]
