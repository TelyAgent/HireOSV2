FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Overridable at build time -- see docker-compose.yml, PORTS.md "远程部署".
ARG VITE_BASE_PATH
ENV VITE_BASE_PATH=$VITE_BASE_PATH
# `isRealApi()` (src/data/api/shared.ts) only returns true when this is
# exactly "real" -- default (unset) is the mock-data fixture branch, which
# is what local dev's own .env sets explicitly but .dockerignore excludes
# .env from the build context, so every Docker build silently fell back to
# fixture data with no error. Docker builds should always be real-API mode;
# there's no scenario where a containerized build wants fixtures.
ARG VITE_API_MODE=real
ENV VITE_API_MODE=$VITE_API_MODE
RUN npm run build

FROM nginx:alpine
# Served at the site root regardless of what Vite `base` was baked in --
# `base` only changes how index.html/JS *reference* asset URLs, not dist's
# own on-disk layout, so a prefix-agnostic nginx config works for both the
# local `/screening/` build and the remote `/hireos/screening/` build.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
