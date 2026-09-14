require("dotenv").config();

const app = require("./app");
const pool = require("./db");
const redisClient = require("./redis/client");
const { startExpirationWorker } = require("./services/expirationService");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected");

    await redisClient.connect();
    console.log("Redis connected");

    startExpirationWorker();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
