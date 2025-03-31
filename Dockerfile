FROM oven/bun:latest

# Install FFmpeg, Node.js, and wget for health checks
RUN apt-get update && \
  apt-get install -y ffmpeg curl wget && \
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
  apt-get install -y nodejs

# Set the working directory
WORKDIR /app

# Copy the package.json and bun.lock files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the application files
COPY . .

# Expose port for health check
EXPOSE 3000

# Add health check
# Checks every 30s, timeout after 10s, 60s startup grace period, 3 retries before unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set the command to start the app
CMD [ "bun", "run", "start" ]