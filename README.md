# Discord.js Bot Base

A feature-rich Discord bot base with health monitoring, message management, and deployment controls.

## Features

- **Health Monitoring**: Web interface to check bot status and components
- **Message Management**: Send, edit, delete and restore messages using Discohook
- **Auto Deployment**: Webhook-based deployment system with domain allowlist
- **Redis Integration**: Caching and cooldown management
- **MongoDB Support**: Persistent data storage
- **Owner Commands**: Special commands for bot owners
- **Test Server Support**: Dedicated test servers for development

## Dependencies

This bot requires several key dependencies:

1. **Node.js**: Version 16 or higher required
2. **Bun**: Used as the package manager ([Install here](https://bun.sh/))
3. **Redis**: For caching and cooldown management ([Install Redis](https://redis.io/download))
4. **MongoDB**: For persistent data storage ([Install MongoDB](https://www.mongodb.com/try/download/community))

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/discord-bot-base.git
```

2. Install dependencies:
```bash
bun install
```

3. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:

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

# Bot Customization
WAITING_EMOJI=⏳
DEBUG_LOG=false
DEFAULT_TIMEZONE=Europe/London

# Optional Features
STAFF_ROLE=optional_staff_role_id
OPENAI_API_KEY=optional_openai_api_key

# Deployment Configuration
ALLOWED_DEPLOY_DOMAINS=github.com,gitlab.com
ZIPLINE_BASEURL=https://your.zipline.instance
ZIPLINE_TOKEN=your_zipline_token
```

5. Start the bot:
```bash
bun start
```

## Health Monitoring

The bot includes a built-in health monitoring system accessible via HTTP:

- **Health Check**: `GET /health` - Returns JSON status of all components
- **Web Interface**: `GET /` - Interactive dashboard for bot status and deployment
- **Deploy Endpoint**: `GET /deploy` - Trigger bot redeployment (domain-restricted)

The health server runs on port 3000 by default, configurable via `HEALTH_PORT` environment variable.

## Message Management

The bot includes comprehensive message management commands:

- `/message send` - Send messages using Discohook data
- `/message edit` - Edit existing bot messages
- `/message delete` - Delete bot messages
- `/message restore` - Restore messages to Discohook format

## Docker Support

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "start"]
```

Build and run:
```bash
docker build -t discord-bot .
docker run -d --name bot --env-file .env discord-bot
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.