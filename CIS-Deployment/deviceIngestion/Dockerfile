# Multi-stage: the build stage's npm CLI (and its own bundled deps — tar,
# pacote, sigstore, etc., pinned by whatever `node:20-alpine` shipped) never
# reaches the runtime image. A single-stage `npm install` + `npm start`
# image ships that whole CLI at runtime for no reason — it only needs to
# exist long enough to resolve node_modules. Found via a Trivy image scan
# during a security review (20 HIGH/CRITICAL Node.js findings, all in
# npm's own internals, none in this app's actual dependencies).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
RUN apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json .
COPY src ./src
COPY config ./config
EXPOSE 9050 6661 6662
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9050/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
