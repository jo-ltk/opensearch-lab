# Small single-stage image: install deps, copy source, run.
FROM node:22-alpine

WORKDIR /app

# Copy package.json first so Docker caches the npm install layer:
# source-code changes won't re-download dependencies.
COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000
ENV NODE_ENV=production

# New Relic (steps 3–4): config via env at runtime — never bake NEW_RELIC_LICENSE_KEY into the image.
ENV NEW_RELIC_NO_CONFIG_FILE=false \
    NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true \
    NEW_RELIC_LOG=stdout \
    NEW_RELIC_APPLICATION_LOGGING_ENABLED=true \
    NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED=true \
    NEW_RELIC_APPLICATION_LOGGING_METRICS_ENABLED=true

CMD ["node", "-r", "newrelic", "server.js"]
