FROM oven/bun:latest

# Install FFmpeg
RUN apt-get update && \
  apt-get install -y ffmpeg

# Set the working directory
WORKDIR /app

# Copy the package.json and bun.lockb files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the application files
COPY . .

# Set the command to start the app
CMD [ "bun", "run", "start" ]