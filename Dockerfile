FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/ ./
COPY frontend/ /app/frontend/

EXPOSE 5000
USER node

CMD ["node", "docker-start.js"]
