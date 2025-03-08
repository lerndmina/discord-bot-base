# A simple bot in Discord.js

## Why?

This bot was created as a personal project with multiple motivations. Primarily, it was an opportunity to learn and explore the capabilities of Discord.js, a powerful library for interacting with Discord's API. It as a practical, hands-on way to delve deeper into the world of Discord bot development and understand the intricacies involved..

Lastly, the bot integrates with OpenAI's Whisper API to provide transcribing of voice messages. This has been a great way to add accessibility to the bot and make it more inclusive for all users.
## Dependencies
This bot relies on two key dependencies: FFmpeg and Redis. 

1. **FFmpeg**: This is a free and open-source software project that produces libraries and programs for handling multimedia data. The bot uses FFmpeg for tasks related to audio and video processing. To install FFmpeg, you can follow the instructions on the [official FFmpeg website](https://ffmpeg.org/download.html). Once installed, you should set the `FFMPEG_PATH` environment variable to the path of your FFmpeg executable.

2. **Redis**: This is an open-source, in-memory data structure store, used as a database, cache, and message broker. The bot uses Redis for tasks related to data storage and retrieval. To install Redis, you can follow the instructions on the [official Redis website](https://redis.io/download). Once installed, you should set the `REDIS_URL` environment variable to the URL of your Redis server.

Please ensure that both FFmpeg and Redis are correctly installed and configured before running the bot. The bot will not function correctly without these dependencies.

## Installation
Clone the repository:
```bash
git clone https://github.com/lerndmina/discord.js-Bot.git
```

Install dependencies:
```bash
yarn install
```

Copy the `.env.example` file to `.env` and fill in the provided variables.
```bash
cp .env.example .env
```

Start the bot
```bash
yarn start
```

## Usage
This code isn't supposed to be used by anyone else, but if you want to, you can. Just make sure to replace the environment variables with your own. I won't be providing any support for this but if you find any bugs, feel free to open an issue.

As some basic documentation, the command handler uses the `commands` folder to find commands. Each command is a separate file, and the file name is the command name. The command handler also uses the `events` folder to find events. Each event is a separate file, and the file name is the event name. This functionality is provided by [Commandkit](https://commandkit.js.org/) so read their documentation for more information.

## Docker
If you're planning to host the bot using Docker, you can take advantage of the Dockerfile provided in the root of the repository. Docker can build images automatically by reading the instructions from a Dockerfile. 

The Dockerfile should contain all the necessary instructions to install the bot's dependencies, including FFmpeg and Redis. This means you won't have to install these dependencies manually.

To build and run the Docker image, you can use the following commands:

```bash
# Build the Docker image
docker build -t your-image-name .

# Run the Docker container
docker run -d --name your-container-name your-image-name
```

Replace `your-image-name` with the name you want to give to your Docker image, and `your-container-name` with the name you want to give to your Docker container.

Please note that you'll still need to provide the environment variables (like `FFMPEG_PATH` and `REDIS_URL`) to your Docker container. You can do this using the `-e` option in the `docker run` command, or by using a `.env` file.

## Contributing
This is a personal project but contributions are welcome. For major changes, please open an issue first to discuss what you would like to change. I may not be the most active person on GitHub but I'll try to respond as soon as possible.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.