const NodeEnvironment = require("jest-environment-node").TestEnvironment;
const { startContainers, stopContainers } = require("./setup");

class TestEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();

    const { databaseUrl, redisUrl } = await startContainers();

    this.global.process.env.DATABASE_URL = databaseUrl;
    this.global.process.env.REDIS_URL = redisUrl;
    this.global.process.env.JWT_SECRET = "test-secret";
  }

  async teardown() {
    await stopContainers();
    await super.teardown();
  }
}

module.exports = TestEnvironment;
