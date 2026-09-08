# Greenlight — Cloud Run image: Next.js app + Remotion renderer (headless Chrome)
FROM node:22-bookworm-slim

# Chrome headless shell dependencies (per Remotion's Docker guide) + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
    libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    fonts-liberation fonts-noto-color-emoji ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next build + Remotion bundle + download Chrome headless shell (into node_modules/.remotion)
RUN npm run build && npm run remotion:bundle && npx remotion browser ensure

ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["npx", "next", "start", "-p", "8080", "-H", "0.0.0.0"]
