FROM oven/bun:latest

# Install FFmpeg and Node.js
RUN apt-get update && \
  apt-get install -y ffmpeg curl && \
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

# Set the command to start the app
CMD [ "bun", "run", "start" ]