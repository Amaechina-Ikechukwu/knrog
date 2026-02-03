FROM oven/bun:1.1.5
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

# Install serve globally
RUN bun install -g serve

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]