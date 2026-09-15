const reservationService = require("../services/reservationService");

async function createReservation(req, res, next) {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    const reservation = await reservationService.createReservation(
      userId,
      productId,
      quantity,
    );

    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
}

async function getReservationById(req, res, next) {
  try {
    const reservation = await reservationService.getReservationById(
      req.params.id,
      req.user.id,
    );

    res.status(200).json(reservation);
  } catch (error) {
    next(error);
  }
}

async function getUserReservations(req, res, next) {
  try {
    const reservations = await reservationService.getUserReservations(
      req.user.id,
    );

    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
}

async function expireReservation(req, res, next) {
  try {
    const reservation = await reservationService.expireReservation(
      req.params.id,
    );

    res.status(200).json(reservation);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createReservation,
  getReservationById,
  getUserReservations,
  expireReservation,
};
