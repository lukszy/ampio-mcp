FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY *.ts *.json ./
COPY ./src/ ./src/

RUN bun run build

EXPOSE 3000

# Mandatory: run with `docker run --env-file .env` — the server refuses to start without AMPIO_* vars
CMD ["bun", "dist/index.js"]
