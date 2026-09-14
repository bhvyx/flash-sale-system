const axios = require("axios");

const BASE_URL = "http://localhost:5000";

const userId = "4f8fef8e-7ba8-4676-86a0-abe2e8800556";
const productId = "96c3a5ca-13cb-4b76-b4b6-9b9ce249c208";

const TOTAL_REQUESTS = 150;
const QUANTITY_PER_REQUEST = 1;

async function run() {
  const requests = Array.from({ length: TOTAL_REQUESTS }, () =>
    axios.post(`${BASE_URL}/api/reservations`, {
      userId,
      productId,
      quantity: QUANTITY_PER_REQUEST,
    }),
  );

  const results = await Promise.allSettled(requests);

  const successful = results.filter((result) => result.status === "fulfilled");

  const failed = results.filter((result) => result.status === "rejected");

  console.log("Total requests:", TOTAL_REQUESTS);
  console.log("Successful:", successful.length);
  console.log("Failed:", failed.length);

  console.log(
    "Failure reasons:",
    failed.map((result) => result.reason.response?.data?.error),
  );
}

run();
