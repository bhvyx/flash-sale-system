const reservationRepository = require("../repositories/reservationRepository");
const { acquireLockWithRetry, releaseLock } = require("../redis/lock");

async function createReservation(userId, productId, quantity) {
  if (!userId || !productId || quantity === undefined) {
    throw new Error("Missing required fields");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const lock = await acquireLockWithRetry(
    `inventory:product:${productId}`,
    10000,
    5000,
    50,
  );

  if (!lock) {
    throw new Error("Inventory is busy, please retry");
  }

  try {
    return await reservationRepository.createReservationTransaction(
      userId,
      productId,
      quantity,
      expiresAt,
    );
  } finally {
    await releaseLock(lock);
  }
}

async function getReservationById(id) {
  const reservation = await reservationRepository.getReservationById(
    id,
    userId,
  );

  if (!reservation) {
    throw new Error("Reservation not found");
  }

  return reservation;
}

async function getUserReservations(userId) {
  return await reservationRepository.getUserReservations(userId);
}

async function expireReservation(id) {
  return await reservationRepository.expireReservation(id);
}

module.exports = {
  createReservation,
  getReservationById,
  getUserReservations,
  expireReservation,
};
