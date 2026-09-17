FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "node src/db-migrate.js && (node src/db-seed.js || true) && node src/server.js"]
