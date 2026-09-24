FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Overridable at build time -- see docker-compose.prod.yml, PORTS.md "远程部署".
ARG VITE_BASE_PATH
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM nginx:alpine
# Served at the site root regardless of what Vite `base` was baked in --
# `base` only changes how index.html/JS *reference* asset URLs, not dist's
# own on-disk layout, so a prefix-agnostic nginx config works for both the
# local `/jd/` build and the remote `/hireos/jd/` build.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
