FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Chromium renders job pages whose posting is loaded by scripts (#64). It never connects out itself: every
# request goes through the backend's public-address check (src/copilot/link-render.ts).
RUN apk add --no-cache chromium
ENV JD_LINK_BROWSER_PATH=/usr/bin/chromium-browser
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3005
CMD ["./docker-entrypoint.sh"]
