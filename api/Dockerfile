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
CMD ["node", "server.js"]
