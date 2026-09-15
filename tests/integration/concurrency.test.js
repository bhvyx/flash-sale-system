const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const userRepository = require("../../src/repositories/userRepository");
const productRepository = require("../../src/repositories/productRepository");
const reservationRepository = require("../../src/repositories/reservationRepository");
const pool = require("../../src/db");
const redisClient = require("../../src/redis/client");

describe("reservation concurrency", () => {
  let user;
  let token;
  let product;

  beforeAll(async () => {
    await redisClient.connect();

    user = await userRepository.createUser(
      `concurrency-${Date.now()}@example.com`,
      "hashed-password",
    );

    product = await productRepository.createProduct(
      "Concurrency Product",
      100,
      10,
    );

    token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: false },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  test("does not oversell inventory under concurrent reservations", async () => {
    const requests = Array.from({ length: 50 }, () =>
      request(app)
        .post("/api/reservations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          productId: product.id,
          quantity: 1,
        }),
    );

    const responses = await Promise.all(requests);

    const successfulReservations = responses.filter(
      (response) => response.status === 201,
    );

    const failedReservations = responses.filter(
      (response) => response.status !== 201,
    );

    const updatedProduct = await productRepository.getProductById(product.id);

    const reservations = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM reservations
             WHERE product_id = $1
             AND status = 'ACTIVE'`,
      [product.id],
    );

    const totalReserved = Number(reservations.rows[0].total);

    expect(successfulReservations.length).toBe(10);
    expect(failedReservations.length).toBe(40);
    expect(totalReserved).toBe(10);
    expect(updatedProduct.available_stock).toBe(0);
    expect(totalReserved).toBeLessThanOrEqual(product.total_stock);
  });

  afterAll(async () => {
    await redisClient.quit();
    await pool.end();
  });
});
