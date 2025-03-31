import { CommandKit } from "commandkit";
import { Client } from "discord.js";
import mongoose from "mongoose";
import http from "http";
import { redisClient } from "./Bot";
import log from "./utils/log";
import FetchEnvs, { DEFAULT_OPTIONAL_STRING } from "./utils/FetchEnvs";

const env = FetchEnvs();

// Simple HTML tag function that just returns the string (for syntax highlighting only)
function html(strings: TemplateStringsArray, ...values: any[]): string {
  let result = "";
  strings.forEach((str, i) => {
    result += str;
    if (i < values.length) {
      result += values[i];
    }
  });
  return result;
}

export default async function healthCheck(data: { client: Client<true>; handler: CommandKit }) {
  try {
    const { client, handler } = data;
    // Create an HTTP server
    const server = http.createServer(async (req, res) => {
      // Get health status data
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

      // Handle different routes
      if (req.url === "/health") {
        // JSON endpoint for Docker health checks
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.writeHead(isHealthy ? 200 : 503);
        res.end(JSON.stringify(health, null, 2));
      } else {
        // HTML page with redeploy button
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(isHealthy ? 200 : 503);

        const statusColor = isHealthy ? "green" : "red";
        const statusText = isHealthy ? "Healthy" : "Unhealthy";

        // Create component status HTML
        const componentRows = Object.entries(components)
          .map(([name, component]: [string, any]) => {
            const color = component.status === "healthy" ? "green" : "red";
            let details = component.details || "";

            // For commands, show number loaded
            if (name === "commands") {
              details = `${component.loaded} commands loaded`;
            }

            // Use a CSS circle instead of Unicode character
            return `
            <tr>
              <td>${name.charAt(0).toUpperCase() + name.slice(1)}</td>
              <td>
                <div
                  style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; margin-right: 5px;"
                ></div>
                ${component.status.toUpperCase()}
              </td>
              <td>${details}</td>
            </tr>
          `;
          })
          .join("");

        // Prepare JavaScript for the redeployment function
        const hasRedeployUrl = env.REDEPLOY_URL !== DEFAULT_OPTIONAL_STRING;
        const redeployUrl = env.REDEPLOY_URL || "#";
        const scriptContent = `
          function redeployBot() {
            if (confirm("Are you sure you want to redeploy the bot?")) {
              ${!hasRedeployUrl ? 'return alert("Redeploy URL not set up");' : ""}
              fetch("${redeployUrl}")
                .then((response) => {
                  if (response.ok) {
                    alert("Redeployment initiated successfully!");
                  } else {
                    alert("Failed to initiate redeployment.");
                  }
                })
                .catch((error) => {
                  console.error("Error:", error);
                  alert("An error occurred during redeployment.");
                });
            }
          }
        `;

        // HTML template with redeploy button
        const htmlTemplate = html`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Bot Health Status</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background-color: #f5f5f5;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background-color: white;
                  border-radius: 5px;
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                  padding: 20px;
                }
                h1 {
                  color: #333;
                }
                .status {
                  display: inline-block;
                  padding: 8px 16px;
                  border-radius: 20px;
                  color: white;
                  font-weight: bold;
                  background-color: ${statusColor};
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 20px 0;
                }
                th,
                td {
                  padding: 12px;
                  text-align: left;
                  border-bottom: 1px solid #ddd;
                }
                th {
                  background-color: #f2f2f2;
                }
                .redeploy-btn {
                  background-color: #4caf50;
                  color: white;
                  padding: 10px 20px;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 16px;
                }
                .redeploy-btn:hover {
                  background-color: #45a049;
                }
                .timestamp {
                  color: #777;
                  font-size: 14px;
                  margin-top: 20px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Bot Health Status: <span class="status">${statusText}</span></h1>

                <h2>Component Status</h2>
                <table>
                  <tr>
                    <th>Component</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                  ${componentRows}
                </table>

                <button onclick="redeployBot()" class="redeploy-btn">Redeploy Bot</button>
                <p class="timestamp">Last updated: ${new Date().toLocaleString()}</p>
              </div>

              <script>
                ${scriptContent};
              </script>
            </body>
          </html>
        `;

        // Send the HTML response directly
        res.end(htmlTemplate);
      }
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
