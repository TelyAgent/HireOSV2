# Isolated browser for #64: renders untrusted job pages for the JD backend, which connects over Playwright's
# protocol and does every network request itself. This container holds no secrets and sits on an internal
# network without internet access (see docker-compose.yml), so a compromised renderer reaches nothing.
FROM node:24-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npx playwright-core install --with-deps --only-shell chromium \
  && rm -rf /var/lib/apt/lists/* /root/.npm
USER node
EXPOSE 3010
# One browser per connection, at most two at a time; clients may not choose the executable or its flags.
CMD ["npx", "playwright-core", "run-server", "--port", "3010", "--host", "0.0.0.0", "--max-clients", "2"]
