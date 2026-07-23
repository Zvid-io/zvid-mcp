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
    PORT=8080 \
    ZVID_MCP_PROFILE=creator \
    ZVID_MCP_MAX_RENDER_CREDITS=100 \
    ZVID_MCP_MAX_BULK_ITEMS=25

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

EXPOSE 8080
USER node

# Auth is per-request. Hosted clients use OAuth bearer tokens; legacy callers
# may send zvid_... API keys. Never set a server-wide ZVID_API_KEY publicly.
CMD ["node", "dist/http.js"]
