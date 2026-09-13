const axios = require("axios");

const userId = "4f8fef8e-7ba8-4676-86a0-abe2e8800556";
const productId = "305b9bb3-cc75-40fe-8bb0-e43d2766a3eb";

async function makeReservation() {
  try {
    const response = await axios.post(
      "http://localhost:5000/api/reservations",
      {
        userId,
        productId,
        quantity: 1,
      },
    );

    console.log("SUCCESS:", response.data.id);
  } catch (error) {
    console.log("FAILED:", error.response?.data || error.message);
  }
}

async function run() {
  await Promise.all([makeReservation(), makeReservation()]);
}

run();
