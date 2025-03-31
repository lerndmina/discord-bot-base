import { CommandKit } from "commandkit";
import { Client } from "discord.js";
import mongoose from "mongoose";
import http from "http";
import { redisClient } from "./Bot";
import log from "./utils/log";

export default async function healthCheck(data: { client: Client<true>; handler: CommandKit }) {
  try {
    const { client, handler } = data;
    // Create a simple HTTP server
    const server = http.createServer((req, res) => {
      // Check component health
      const components = {
        discord: testDiscordConnection(client),
        database: testDatabaseConnection(),
        redis: testRedisConnection(),
        commands: {
          status: handler.commands.length > 0 ? "healthy" : "unhealthy",
          loaded: handler.commands.length,
        },
      };

      // Determine overall health
      const isHealthy = Object.values(components).every(
        (component) => component.status === "healthy"
      );

      const health = {
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        components,
      };

      // Set headers
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Send response with appropriate status code (200 if healthy, 503 if not)
      res.writeHead(isHealthy ? 200 : 503);
      res.end(JSON.stringify(health, null, 2));
    });

    // Start server on port 3000 or from environment variable
    const PORT = process.env.HEALTH_PORT || 3000;
    server.listen(PORT, () => {
      log.info(`Health check server running on port ${PORT}`);
    });

    return true;
  } catch (error) {
    log.error("Health check setup failed:", error);
    return false;
  }
}

/**
 * Test the Discord client connection
 */
function testDiscordConnection(client: Client<true>) {
  const isConnected = client.ws.status === 0;
  return {
    status: isConnected ? "healthy" : "unhealthy",
    details: isConnected ? `Connected (${client.ws.ping}ms)` : "Disconnected",
    ping: client.ws.ping,
  };
}

/**
 * Test the MongoDB connection
 */
function testDatabaseConnection() {
  const readyState = mongoose.connection.readyState;
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
    99: "uninitialized",
  };

  return {
    status: readyState === 1 ? "healthy" : "unhealthy",
    details: stateMap[readyState] || "unknown",
  };
}

/**
 * Test the Redis connection
 */
function testRedisConnection() {
  try {
    const isReady = redisClient.isReady;
    return {
      status: isReady ? "healthy" : "unhealthy",
      details: isReady ? "Connected" : "Disconnected",
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      details: `Error: ${error.message || error}`,
    };
  }
}
