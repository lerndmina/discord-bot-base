import { CommandKit } from "commandkit";
import { Client } from "discord.js";
import mongoose from "mongoose";
import http from "http";
import { redisClient } from "./Bot";
import log from "./utils/log";
import FetchEnvs from "./utils/FetchEnvs";

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

        const statusColor = isHealthy ? "#4caf50" : "#f44336"; // Green or red
        const statusText = isHealthy ? "Healthy" : "Unhealthy";

        // Create component status HTML
        const componentRows = Object.entries(components)
          .map(([name, component]: [string, any]) => {
            const color = component.status === "healthy" ? "#4caf50" : "#f44336"; // Green or red
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

        // JavaScript for handling redeploy URL and redeploy function
        const scriptContent = html` <script>
          // Load redeploy URL from localStorage if available
          let redeployUrl = localStorage.getItem("redeployUrl") || "";
          let redeploying = false;

          // Function to update and save the redeploy URL
          function updateRedeployUrl() {
            const input = document.getElementById("redeployUrlInput");
            redeployUrl = input.value.trim();

            if (redeployUrl) {
              localStorage.setItem("redeployUrl", redeployUrl);
              showStatus("success", "URL saved!");
            } else {
              showStatus("error", "Please enter a valid URL");
            }
          }

          // Function to show status messages
          function showStatus(type, message) {
            const statusEl = document.getElementById("redeployStatus");
            statusEl.textContent = message;
            statusEl.className =
              type === "success"
                ? "status-success"
                : type === "error"
                ? "status-error"
                : "status-info";

            setTimeout(() => {
              statusEl.textContent = "";
              statusEl.className = "";
            }, 3000);
          }

          // Set the input value when page loads
          window.onload = function () {
            document.getElementById("redeployUrlInput").value = redeployUrl;
          };

          // Function to update the redeploy button state
          function updateRedeployButton(isRedeploying) {
            const button = document.getElementById("redeployButton");
            redeploying = isRedeploying;

            if (isRedeploying) {
              button.disabled = true;
              button.innerHTML = '<div class="spinner"></div> Redeploying...';
            } else {
              button.disabled = false;
              button.textContent = "Redeploy Bot";
            }
          }

          // Function to redeploy the bot
          function redeployBot() {
            if (redeploying) return;

            if (!redeployUrl) {
              showStatus("error", "Please set a redeploy URL first");
              return;
            }

            if (confirm("Are you sure you want to redeploy the bot?")) {
              updateRedeployButton(true);
              showStatus("info", "Deployment request sent...");

              // Send the fetch request but don't wait for a response
              fetch(redeployUrl, {
                method: "GET",
                mode: "no-cors", // This allows requests without expecting responses
                cache: "no-cache",
              }).catch((e) => console.error("Error sending request:", e));

              // Show success message after a short delay
              setTimeout(() => {
                showStatus("success", "Request sent! Deployment should be happening now.");
                updateRedeployButton(false);
              }, 1500);
            }
          }
        </script>`;

        // HTML template with redeploy button - dark mode
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
                  background-color: #121212;
                  color: #e0e0e0;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background-color: #1e1e1e;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                  padding: 20px;
                }
                h1,
                h2 {
                  color: #e0e0e0;
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
                  border-bottom: 1px solid #333;
                }
                th {
                  background-color: #2a2a2a;
                  color: #e0e0e0;
                }
                .input-group {
                  margin: 20px 0;
                  display: flex;
                  flex-wrap: wrap;
                  gap: 10px;
                  align-items: center;
                }
                input[type="text"] {
                  flex: 1;
                  padding: 10px;
                  border: 1px solid #444;
                  border-radius: 4px;
                  background-color: #333;
                  color: #e0e0e0;
                  font-size: 14px;
                  min-width: 200px;
                }
                .btn {
                  background-color: #2979ff;
                  color: white;
                  padding: 10px 20px;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 16px;
                  transition: all 0.2s;
                }
                .btn:hover:not(:disabled) {
                  background-color: #1565c0;
                }
                .btn:disabled {
                  background-color: #555;
                  cursor: not-allowed;
                  opacity: 0.7;
                }
                .btn-green {
                  background-color: #4caf50;
                }
                .btn-green:hover:not(:disabled) {
                  background-color: #388e3c;
                }
                .timestamp {
                  color: #999;
                  font-size: 14px;
                  margin-top: 20px;
                }
                .status-success {
                  color: #4caf50;
                  margin-left: 10px;
                  font-size: 14px;
                }
                .status-error {
                  color: #f44336;
                  margin-left: 10px;
                  font-size: 14px;
                }
                .status-info {
                  color: #2196f3;
                  margin-left: 10px;
                  font-size: 14px;
                }
                /* Make links visible in dark mode */
                a {
                  color: #64b5f6;
                  text-decoration: none;
                }
                a:hover {
                  text-decoration: underline;
                }
                .section {
                  margin: 30px 0;
                  padding: 20px;
                  background-color: #242424;
                  border-radius: 6px;
                }
                /* Spinner for loading state */
                .spinner {
                  display: inline-block;
                  width: 12px;
                  height: 12px;
                  border: 2px solid rgba(255, 255, 255, 0.3);
                  border-radius: 50%;
                  border-top-color: white;
                  animation: spin 1s linear infinite;
                  margin-right: 8px;
                }
                @keyframes spin {
                  to {
                    transform: rotate(360deg);
                  }
                }
                .info-text {
                  color: #999;
                  font-size: 14px;
                  margin-top: 8px;
                  font-style: italic;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Bot Health Status: <span class="status">${statusText}</span></h1>

                <div class="section">
                  <h2>Component Status</h2>
                  <table>
                    <tr>
                      <th>Component</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                    ${componentRows}
                  </table>
                </div>

                <div class="section">
                  <h2>Redeploy Bot</h2>
                  <div class="input-group">
                    <input type="text" id="redeployUrlInput" placeholder="Enter redeploy URL" />
                    <button onclick="updateRedeployUrl()" class="btn">Save URL</button>
                    <span id="redeployStatus"></span>
                  </div>
                  <p class="info-text">
                    The URL should point to your deployment webhook (e.g., GitHub Actions/GitLab CI
                    trigger URL)
                  </p>
                  <button id="redeployButton" onclick="redeployBot()" class="btn btn-green">
                    Redeploy Bot
                  </button>
                </div>

                <p class="timestamp">Last updated: ${new Date().toLocaleString()}</p>
              </div>

              ${scriptContent};
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
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
    99: "Uninitialized",
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
