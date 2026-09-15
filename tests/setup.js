const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const { RedisContainer } = require("@testcontainers/redis");

let postgresContainer;
let redisContainer;

async function runMigrations(databaseUrl) {
  const client = new Client({
    connectionString: databaseUrl,
  });

  await client.connect();

  const migrationsDir = path.join(__dirname, "..", "database", "migrations");

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    await client.query(sql);
  }

  await client.end();
}

async function startContainers() {
  postgresContainer = await new PostgreSqlContainer("postgres:17")
    .withDatabase("flashsale_test")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  redisContainer = await new RedisContainer("redis:7").start();

  const databaseUrl = postgresContainer.getConnectionUri();
  const redisUrl = redisContainer.getConnectionUrl();

  await runMigrations(databaseUrl);

  return {
    databaseUrl,
    redisUrl,
  };
}

async function stopContainers() {
  if (redisContainer) {
    await redisContainer.stop();
  }

  if (postgresContainer) {
    await postgresContainer.stop();
  }
}

module.exports = {
  startContainers,
  stopContainers,
};
