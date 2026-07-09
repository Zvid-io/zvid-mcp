# mcp/Dockerfile — hosted Zvid MCP server, Streamable HTTP transport (mcp.zvid.io)
# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

EXPOSE 8080
USER node

# Auth is per-request (Authorization: Bearer zvid_...); ZVID_API_KEY is only a
# single-tenant fallback and must NOT be set on the public hosted deployment.
CMD ["node", "dist/http.js"]
