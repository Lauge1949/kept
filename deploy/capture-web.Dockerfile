# Context: pinned 1.14.7 source + this fork's capture files, prepared by build-capture-web.sh.
# Reuse the installed runtime, so the server and migrations are unchanged.
FROM ghcr.io/keptinventory/kept:1.14.7@sha256:e346925dc007d16e2eaab91a20e1c5313734957acb54eeec456d40d5cf813ab3 AS tools
USER root
ENV CI=true HOME=/tmp PNPM_HOME=/tmp/pnpm
WORKDIR /src
COPY . .
RUN mkdir /tmp/package-manager && tar -xzf pnpm-11.23.0.tgz -C /tmp/package-manager
RUN node /tmp/package-manager/package/bin/pnpm.cjs install --frozen-lockfile --ignore-scripts --filter @kept/web... --filter kept
RUN --network=none node /tmp/package-manager/package/bin/pnpm.cjs --filter @kept/shared build

FROM tools AS checked
RUN --network=none NODE_ENV=test node /tmp/package-manager/package/bin/pnpm.cjs --dir apps/web exec vitest run src/components/capture/capture-screen.test.tsx src/components/capture/required-details.test.tsx src/components/capture/enqueue.test.ts src/offline/dexie-store.test.ts
RUN --network=none node /tmp/package-manager/package/bin/pnpm.cjs --dir apps/web exec tsc --noEmit
RUN --network=none KEPT_VERSION=1.14.7 node /tmp/package-manager/package/bin/pnpm.cjs --filter @kept/web build

FROM ghcr.io/keptinventory/kept:1.14.7@sha256:e346925dc007d16e2eaab91a20e1c5313734957acb54eeec456d40d5cf813ab3
ARG REVISION
ENV KEPT_SOURCE_URL=https://github.com/Lauge1949/kept/tree/${REVISION}
LABEL org.opencontainers.image.source="https://github.com/Lauge1949/kept" org.opencontainers.image.revision="${REVISION}"
COPY --from=checked /src/apps/web/dist /app/apps/web/dist
