# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-bullseye-slim AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/next.config.ts ./next.config.ts
COPY --from=builder /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=builder /usr/src/app/next-env.d.ts ./next-env.d.ts

EXPOSE 3000
CMD ["npm", "run", "start"]
