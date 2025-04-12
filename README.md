# Discord.js Bot Base

A feature-rich Discord bot base with health monitoring, message management, and deployment controls.

Mostly built for personal use, feel free to use in your own stuff. No support will be provided but PRs are welcome if you find bugs or want to add features.

## Features

- **Health Monitoring**: Web interface to check bot status and components
- **Message Management**: Send, edit, delete and restore messages using Discohook
- **Auto Deployment**: Webhook-based deployment system with domain allowlist
- **Redis Integration**: Caching and cooldown management
- **MongoDB Support**: Persistent data storage
- **Docker Support**: Containerized deployment with health checks
- **FFmpeg Integration**: Audio processing capabilities
- **Owner Commands**: Special commands for bot owners
- **Test Server Support**: Dedicated test servers for development

## Dependencies

1. **Node.js**: Version 18 or higher required
2. **Bun**: Used as the package manager ([Install here](https://bun.sh/))
3. **Redis**: For caching and cooldown management
4. **MongoDB**: For persistent data storage
5. **FFmpeg**: For audio processing capabilities

## Quick Start (Docker)

1. Clone the repository:
```bash
git clone https://github.com/your-username/discord-bot-base.git
cd discord-bot-base
```

2. Configure environment:
```bash
copy .env.example .env
```

3. Build and run with Docker:
```bash
docker-compose up -d
```

## Manual Installation

1. Install dependencies:
```bash
bun install
```

2. Configure environment variables in `.env`:

```env
# Required Bot Configuration
BOT_TOKEN=your_discord_bot_token
OWNER_IDS=comma,separated,user,ids
TEST_SERVERS=comma,separated,server,ids
PREFIX=!

# Database Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=your_database_name
REDIS_URL=redis://localhost:6379

# Health Monitoring
HEALTH_PORT=3000
HEALTH_CHECK_INTERVAL=30000

# Bot Customization
WAITING_EMOJI=⏳
DEBUG_LOG=false
DEFAULT_TIMEZONE=Europe/London

# Optional Features
STAFF_ROLE=optional_staff_role_id
OPENAI_API_KEY=optional_openai_api_key

# Deployment Configuration
ALLOWED_DEPLOY_DOMAINS=github.com,gitlab.com
ZIPLINE_BASEURL=https://your.zipline.instance # zipline.diced.sh
ZIPLINE_TOKEN=your_zipline_token
```

3. Start the bot:
```bash
# Development mode with hot reload
bun run dev

# Production mode
bun start
```

## Docker Configuration

The bot includes full Docker support with:
- Multi-stage builds for optimal image size
- Health checks for container orchestration
- FFmpeg and Node.js pre-installed
- Volume support for persistent data

### Docker Compose Example:
```yaml
version: '3.8'
services:
  bot:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - .env:/app/.env
    depends_on:
      - redis
      - mongo

  redis:
    image: redis:alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  mongo:
    image: mongo:latest
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db

volumes:
  redis_data:
  mongo_data:
```

## Development Scripts

- `bun run dev` - Start with hot reload for development
- `bun start` - Start in production mode
- `bun run test-build` - Test TypeScript compilation

## Health Monitoring

The bot includes a built-in health monitoring system:

- `GET /health` - JSON status endpoint for monitoring
- `GET /` - Interactive dashboard for bot management
- `GET /deploy` - Webhook endpoint for automated deployments

Health checks monitor:
- Discord connection status
- Database connectivity
- Redis availability
- Command loading status

## Message Management

Comprehensive message management via slash commands:

- `/message send` - Send messages with Discohook data
- `/message edit` - Edit existing bot messages
- `/message delete` - Delete bot messages
- `/message restore` - Convert messages to Discohook format

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.