# Image size ~ 400MB
FROM node:21-alpine3.18 as builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

COPY package*.json *-lock.yaml ./

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
    && apk add --no-cache git \
    && pnpm install \
    && apk del .gyp

# Copiar el resto del código después de instalar dependencias
COPY . .

# Añadir el comando de build (asegúrate que existe en tu package.json)
RUN pnpm run build

FROM node:21-alpine3.18 as deploy

WORKDIR /app

ARG PORT=3001
ENV PORT=$PORT
EXPOSE 3001

# Copiar solo lo necesario desde el builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/*-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN corepack enable && corepack prepare pnpm@latest --activate 
ENV PNPM_HOME=/usr/local/bin

RUN npm cache clean --force \
    && addgroup -g 1001 -S nodejs \
    && adduser -S -u 1001 nodejs \
    && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp

# Especificar el usuario para ejecución
USER nodejs

# Asegurar que el comando apunte al archivo correcto
CMD ["node", "dist/app.js"]