FROM node:22-slim

# Dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Instalar claude CLI (la imagen node ya tiene usuario 'node' no-root)
ENV NPM_CONFIG_PREFIX=/usr/local
RUN npm install -g @anthropic-ai/claude-code

ENV PATH="/usr/local/bin:/usr/bin:/bin"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY worker.mjs ./
RUN chown -R node:node /app

# Usar el usuario no-root que viene incluido en la imagen node
USER node

CMD ["node", "worker.mjs"]
