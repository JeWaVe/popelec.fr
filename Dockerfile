## Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

## Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy values so Payload config compiles without a live database
ENV PAYLOAD_SECRET=build-secret-placeholder
ENV DATABASE_URI=postgres://placeholder:placeholder@localhost:5432/placeholder
RUN npm run build

## Stage 3: Migrate — source + Payload CLI for running migrations
FROM node:22-alpine AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npx", "payload", "migrate"]

## Stage 4: Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN mkdir -p media && chown nextjs:nodejs media
VOLUME /app/media

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
