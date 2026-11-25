# Stable 1.14.7 source plus the explicit capture, branding and localization overlay.
# Frozen dependencies are installed without hooks; checks/builds have no network.
FROM ghcr.io/keptinventory/kept:1.14.7@sha256:e346925dc007d16e2eaab91a20e1c5313734957acb54eeec456d40d5cf813ab3 AS tools
USER root
ENV CI=true HOME=/tmp PNPM_HOME=/tmp/pnpm
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml pnpm-11.23.0.tgz ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/docs/package.json apps/docs/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/mcp/package.json packages/mcp/package.json
RUN mkdir /tmp/package-manager && tar -xzf pnpm-11.23.0.tgz -C /tmp/package-manager
RUN --mount=type=cache,id=tingfinder-pnpm,target=/tmp/pnpm/store node /tmp/package-manager/package/bin/pnpm.cjs install --frozen-lockfile --ignore-scripts --filter @kept/web... --filter @kept/server... --filter kept
COPY . .
RUN --network=none node /tmp/package-manager/package/bin/pnpm.cjs --filter @kept/shared build && node /tmp/package-manager/package/bin/pnpm.cjs --filter @kept/mcp build

FROM tools AS checked
# Reuse the exact pinned native library already installed in the base runtime.
RUN --network=none cp -a /app/node_modules/.pnpm/@img+sharp-libvips-linux-x64@1.3.4/. /src/node_modules/.pnpm/@img+sharp-libvips-linux-x64@1.3.4/
ENV KEPT_DATABASE_URL=postgres://test:test@127.0.0.1/test KEPT_AUTH_DATABASE_URL=postgres://test:test@127.0.0.1/test KEPT_SYSTEM_DATABASE_URL=postgres://test:test@127.0.0.1/test KEPT_PUBLIC_URL=http://kept.test

RUN --network=none NODE_ENV=test node /tmp/package-manager/package/bin/pnpm.cjs --dir apps/web exec vitest run src/components/capture/capture-screen.test.tsx src/components/capture/required-details.test.tsx src/components/capture/enqueue.test.ts src/offline/dexie-store.test.ts src/lib/prefs.test.ts src/i18n/start-locale.test.ts src/i18n/fallback-locale.test.ts
RUN --network=none node /tmp/package-manager/package/bin/pnpm.cjs --dir apps/web exec tsc --noEmit && node /tmp/package-manager/package/bin/pnpm.cjs --dir apps/server exec tsc -p tsconfig.build.json
RUN --network=none node /tmp/package-manager/package/bin/pnpm.cjs exec vitest run --config deploy/localization.vitest.ts
RUN --network=none node scripts/check-i18n.mjs
RUN --network=none KEPT_VERSION=1.14.7 node /tmp/package-manager/package/bin/pnpm.cjs --filter @kept/web build
# Public assets can originate in a private editor umask; the runtime is non-root.
RUN --network=none chmod -R a+rX /src/apps/web/dist /src/apps/server/src/reports/template

FROM ghcr.io/keptinventory/kept:1.14.7@sha256:e346925dc007d16e2eaab91a20e1c5313734957acb54eeec456d40d5cf813ab3
ARG REVISION
ENV KEPT_SOURCE_URL=https://github.com/Lauge1949/kept/tree/${REVISION}
LABEL org.opencontainers.image.source="https://github.com/Lauge1949/kept" org.opencontainers.image.revision="${REVISION}" org.opencontainers.image.title="Tingfinder"
# Merge compiled stable modules into the existing runtime, retaining its report assets and dependencies.
COPY --from=checked /src/packages/shared/dist /app/packages/shared/dist
COPY --from=checked /src/packages/mcp/dist /app/packages/mcp/dist
COPY --from=checked /src/apps/server/dist /app/apps/server/dist
COPY --from=checked /src/apps/web/dist /app/apps/web/dist
COPY --from=checked /src/apps/server/src/reports/template/ /app/apps/server/dist/reports/template/
