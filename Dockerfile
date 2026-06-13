FROM node:24-alpine
WORKDIR /app

# Install runtime dependencies only (express + liquidjs).
# TypeScript is a dev-only dependency: Node 24 strips types at runtime,
# so the .ts sources run directly with no build step or tsc in the image.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY template.liquid ./

EXPOSE 8080
CMD ["node", "src/index.ts"]
