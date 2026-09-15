const express = require("express");
const reservationController = require("../controllers/reservationController");
const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const {
  createReservationSchema,
} = require("../validation/reservationValidation");

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/",
  validate(createReservationSchema),
  reservationController.createReservation,
);
router.get("/user/:userId", reservationController.getUserReservations);
router.get("/:id", reservationController.getReservationById);
router.post("/:id/expire", reservationController.expireReservation);

module.exports = router;
