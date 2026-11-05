FROM node:22-bookworm-slim
WORKDIR /app
ARG ENABLE_DESKTOP=false
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/nextjs/package.json apps/nextjs/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/db/prisma packages/db/prisma
RUN npm ci --include=dev
COPY packages packages
COPY apps/worker apps/worker
RUN npm run db:generate && npm run check:worker
RUN if [ "$ENABLE_DESKTOP" = "true" ]; then apt-get update && apt-get install -y python3-venv && python3 -m venv /opt/desktop && /opt/desktop/bin/pip install --no-cache-dir -r apps/worker/desktop/requirements.txt && /opt/desktop/bin/playwright install --with-deps chromium ffmpeg && rm -rf /var/lib/apt/lists/*; fi
ENV DESKTOP_PYTHON=/opt/desktop/bin/python
CMD ["npm","run","start:worker"]
