# @zoom/rtms ships prebuilt native binaries for glibc/linux-x64 only (no
# linux/arm64, no musl) -- node:24-alpine leaves it unable to find
# build/Release/index.js at all, so this service (uniquely among the 5
# backends) needs a Debian-based image, and the whole compose stack is
# pinned to linux/amd64 in docker-compose.yml. The prebuilt .node binary
# also requires GLIBCXX_3.4.31 (from GCC 13) -- node:24-slim's base Debian 12
# "bookworm" only ships 3.4.30, and bookworm-backports doesn't carry a newer
# libstdc++6 either (verified: still resolves to 12.2.0-14+deb12u1). Debian
# 13 "trixie" ships GCC 14 by default, so use that instead of chasing backports.
FROM node:24-trixie-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
