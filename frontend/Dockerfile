# 浏览器直接访问后端，NEXT_PUBLIC_API_URL 在构建时注入
ARG NEXT_PUBLIC_API_URL=http://localhost:8010

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
ARG NEXT_PUBLIC_API_URL
WORKDIR /app
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行阶段：只保留 standalone 产物（含按需追踪的最小 node_modules）
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8009 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8009

CMD ["node", "server.js"]
