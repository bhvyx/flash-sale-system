const reservationRepository = require("../repositories/reservationRepository");
const { acquireLockWithRetry, releaseLock } = require("../redis/lock");
const AppError = require("../utils/AppError");

async function createReservation(userId, productId, quantity) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const lock = await acquireLockWithRetry(
    `inventory:product:${productId}`,
    10000,
    5000,
    50,
  );

  if (!lock) {
    throw new AppError("Inventory is busy, please retry", 503);
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
    throw new AppError("Reservation not found", 404);
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
