# Build the static export (next.config.ts → output: "export" → out/), then
# serve it with Caddy. The final image has no Node and no node_modules.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/out /srv
EXPOSE 8080
