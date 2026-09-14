const { randomUUID } = require("crypto");
const redisClient = require("./client");

async function acquireLock(key, ttl = 10000) {
  const token = randomUUID();

  const result = await redisClient.set(key, token, {
    NX: true,
    PX: ttl,
  });

  if (result !== "OK") {
    return null;
  }

  return {
    key,
    token,
  };
}

async function acquireLockWithRetry(
  key,
  ttl = 10000,
  maxWait = 5000,
  initialDelay = 50,
) {
  const startTime = Date.now();
  let delay = initialDelay;

  while (Date.now() - startTime < maxWait) {
    const lock = await acquireLock(key, ttl);

    if (lock) {
      return lock;
    }

    const jitter = Math.floor(Math.random() * 50);
    const waitTime = Math.min(
      delay + jitter,
      maxWait - (Date.now() - startTime),
    );

    if (waitTime <= 0) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    delay = Math.min(delay * 2, 500);
  }

  return null;
}

async function releaseLock(lock) {
  await redisClient.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
    {
      keys: [lock.key],
      arguments: [lock.token],
    },
  );
}

module.exports = {
  acquireLock,
  acquireLockWithRetry,
  releaseLock,
};
