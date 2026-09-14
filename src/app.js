const express = require("express");
const productRoutes = require("./routes/productRoutes");
const reservationRoutes = require("./routes/reservationRoutes");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/products", productRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/orders", require("./routes/orderRoutes"));

module.exports = app;
