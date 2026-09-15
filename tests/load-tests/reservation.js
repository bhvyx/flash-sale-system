import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const successfulReservations = new Counter("successful_reservations");
const stockRejections = new Counter("stock_rejections");
const lockRejections = new Counter("lock_rejections");
const unexpectedErrors = new Counter("unexpected_errors");

export const options = {
  scenarios: {
    reservations: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
};

const BASE_URL = "http://host.docker.internal:5000";

export default function () {
  const response = http.post(
    `${BASE_URL}/api/reservations`,
    JSON.stringify({
      productId: __ENV.PRODUCT_ID,
      quantity: 1,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${__ENV.TOKEN}`,
      },
    },
  );

  if (response.status === 201) {
    successfulReservations.add(1);
  } else if (response.status === 400) {
    stockRejections.add(1);
  } else if (response.status === 503) {
    lockRejections.add(1);
  } else {
    unexpectedErrors.add(1);
  }

  check(response, {
    "valid reservation response": (response) =>
      response.status === 201 ||
      response.status === 400 ||
      response.status === 503,
  });
}
