FROM node:20-alpine AS base
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/

# Install all dependencies
RUN npm ci --workspace=shared --workspace=server

# Copy source
COPY shared/ shared/
COPY server/ server/

# Build shared first, then server
RUN npm run build --workspace=shared
RUN npm run build --workspace=server

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/shared/package.json shared/
COPY --from=base /app/server/package.json server/
RUN npm ci --workspace=shared --workspace=server --omit=dev

COPY --from=base /app/shared/dist shared/dist
COPY --from=base /app/server/dist server/dist

EXPOSE 3000
CMD ["node", "server/dist/app.js"]
