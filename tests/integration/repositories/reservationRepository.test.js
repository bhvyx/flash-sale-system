const reservationRepository = require("../../../src/repositories/reservationRepository");
const productRepository = require("../../../src/repositories/productRepository");
const userRepository = require("../../../src/repositories/userRepository");
const pool = require("../../../src/db");

describe("reservationRepository", () => {
  let userId;
  let productId;

  beforeAll(async () => {
    const user = await userRepository.createUser(
      `reservation-${Date.now()}@example.com`,
      "hashed-password",
    );

    const product = await productRepository.createProduct(
      "Reservation Test Product",
      100,
      10,
    );

    userId = user.id;
    productId = product.id;
  });

  test("creates a reservation and decreases available stock", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const reservation =
      await reservationRepository.createReservationTransaction(
        userId,
        productId,
        3,
        expiresAt,
      );

    expect(reservation).toEqual(
      expect.objectContaining({
        user_id: userId,
        product_id: productId,
        quantity: 3,
        status: "ACTIVE",
      }),
    );

    const product = await productRepository.getProductById(productId);

    expect(product.available_stock).toBe(7);
    expect(product.total_stock).toBe(10);
  });

  test("rejects reservation when stock is insufficient", async () => {
    await expect(
      reservationRepository.createReservationTransaction(
        userId,
        productId,
        8,
        new Date(Date.now() + 10 * 60 * 1000),
      ),
    ).rejects.toThrow("Not enough stock");

    const product = await productRepository.getProductById(productId);

    expect(product.available_stock).toBe(7);
  });

  test("cancelling a reservation returns stock", async () => {
    const reservation =
      await reservationRepository.createReservationTransaction(
        userId,
        productId,
        2,
        new Date(Date.now() + 10 * 60 * 1000),
      );

    let product = await productRepository.getProductById(productId);
    expect(product.available_stock).toBe(5);

    const cancelled = await reservationRepository.cancelReservation(
      reservation.id,
      userId,
    );

    expect(cancelled.status).toBe("CANCELLED");

    product = await productRepository.getProductById(productId);

    expect(product.available_stock).toBe(7);
  });

  test("expiring a reservation returns stock", async () => {
    const reservation =
      await reservationRepository.createReservationTransaction(
        userId,
        productId,
        2,
        new Date(Date.now() + 10 * 60 * 1000),
      );

    let product = await productRepository.getProductById(productId);
    expect(product.available_stock).toBe(5);

    const expired = await reservationRepository.expireReservation(
      reservation.id,
    );

    expect(expired.status).toBe("EXPIRED");

    product = await productRepository.getProductById(productId);

    expect(product.available_stock).toBe(7);
  });

  afterAll(async () => {
    await pool.end();
  });
});
