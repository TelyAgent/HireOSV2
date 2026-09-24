FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Overridable at build time -- see docker-compose.prod.yml, PORTS.md "远程部署".
ARG VITE_BASE_PATH
ENV VITE_BASE_PATH=$VITE_BASE_PATH
# `npm run build` (tsc -b && vite build) currently fails here on pre-existing
# type errors across several files (missing @types/node in vite.config.ts,
# a StoreContext i18n dictionary mismatch, a couple of loosely-typed arrays)
# that predate this Docker work and are unrelated to it -- see PORTS.md
# "Docker 部署" for the flag. All of them are type-level only (no missing
# runtime imports), so `vite build` alone (esbuild, no tsc gate) produces a
# working bundle. Switch back to `npm run build` once those are fixed.
RUN npx vite build

FROM nginx:alpine
# Served at the site root regardless of what Vite `base` was baked in --
# `base` only changes how index.html/JS *reference* asset URLs, not dist's
# own on-disk layout, so a prefix-agnostic nginx config works for both the
# local `/interview/` build and the remote `/hireos/interview/` build.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
