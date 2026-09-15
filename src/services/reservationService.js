const reservationRepository = require("../repositories/reservationRepository");
const { acquireLockWithRetry, releaseLock } = require("../redis/lock");

async function createReservation(userId, productId, quantity) {
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

async function getReservationById(id, userId) {
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

async function cancelReservation(id, userId) {
  return await reservationRepository.cancelReservation(id, userId);
}

module.exports = {
  createReservation,
  getReservationById,
  getUserReservations,
  expireReservation,
  cancelReservation,
};
