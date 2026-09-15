const express = require("express");
const reservationController = require("../controllers/reservationController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", reservationController.createReservation);
router.get("/user/:userId", reservationController.getUserReservations);
router.get("/:id", reservationController.getReservationById);
router.post("/:id/expire", reservationController.expireReservation);

module.exports = router;
