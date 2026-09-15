const paymentRepository = require("../../../src/repositories/paymentRepository");
const orderRepository = require("../../../src/repositories/orderRepository");
const reservationRepository = require("../../../src/repositories/reservationRepository");
const productRepository = require("../../../src/repositories/productRepository");
const userRepository = require("../../../src/repositories/userRepository");
const pool = require("../../../src/db");

async function createPaymentFixture() {
  const user = await userRepository.createUser(
    `payment-${Date.now()}-${Math.random()}@example.com`,
    "hashed-password",
  );

  const product = await productRepository.createProduct(
    "Payment Test Product",
    500,
    10,
  );

  const reservation = await reservationRepository.createReservationTransaction(
    user.id,
    product.id,
    2,
    new Date(Date.now() + 10 * 60 * 1000),
  );

  const order = await orderRepository.createOrderTransaction(
    reservation.id,
    user.id,
  );

  return {
    user,
    product,
    reservation,
    order,
  };
}

describe("paymentRepository", () => {
  test("processes a successful payment and confirms the order", async () => {
    const { user, product, reservation, order } = await createPaymentFixture();

    const payment = await paymentRepository.processPayment(
      order.id,
      "SUCCESS",
      `success-${Date.now()}`,
      user.id,
    );

    expect(payment).toEqual(
      expect.objectContaining({
        order_id: order.id,
        amount: "1000.00",
        status: "SUCCESS",
      }),
    );

    const updatedOrder = await orderRepository.getOrderById(order.id, user.id);

    const updatedReservation = await reservationRepository.getReservationById(
      reservation.id,
      user.id,
    );

    const updatedProduct = await productRepository.getProductById(product.id);

    expect(updatedOrder.status).toBe("CONFIRMED");
    expect(updatedReservation.status).toBe("PURCHASED");
    expect(updatedProduct.total_stock).toBe(8);
    expect(updatedProduct.available_stock).toBe(8);
  });

  test("records a failed payment without consuming inventory", async () => {
    const { user, product, reservation, order } = await createPaymentFixture();

    const payment = await paymentRepository.processPayment(
      order.id,
      "FAILED",
      `failed-${Date.now()}`,
      user.id,
    );

    expect(payment).toEqual(
      expect.objectContaining({
        order_id: order.id,
        status: "FAILED",
      }),
    );

    const updatedOrder = await orderRepository.getOrderById(order.id, user.id);

    const updatedReservation = await reservationRepository.getReservationById(
      reservation.id,
      user.id,
    );

    const updatedProduct = await productRepository.getProductById(product.id);

    expect(updatedOrder.status).toBe("PENDING");
    expect(updatedReservation.status).toBe("ACTIVE");
    expect(updatedProduct.total_stock).toBe(10);
    expect(updatedProduct.available_stock).toBe(8);
  });

  test("does not process the same idempotency key twice", async () => {
    const { user, product, reservation, order } = await createPaymentFixture();

    const idempotencyKey = `duplicate-${Date.now()}`;

    const firstPayment = await paymentRepository.processPayment(
      order.id,
      "SUCCESS",
      idempotencyKey,
      user.id,
    );

    const secondPayment = await paymentRepository.processPayment(
      order.id,
      "SUCCESS",
      idempotencyKey,
      user.id,
    );

    expect(secondPayment.id).toBe(firstPayment.id);

    const updatedProduct = await productRepository.getProductById(product.id);

    expect(updatedProduct.total_stock).toBe(8);
    expect(updatedProduct.available_stock).toBe(8);
  });

  test("rejects reuse of an idempotency key for another order", async () => {
    const firstFixture = await createPaymentFixture();
    const secondFixture = await createPaymentFixture();

    const idempotencyKey = `conflict-${Date.now()}`;

    await paymentRepository.processPayment(
      firstFixture.order.id,
      "SUCCESS",
      idempotencyKey,
      firstFixture.user.id,
    );

    await expect(
      paymentRepository.processPayment(
        secondFixture.order.id,
        "SUCCESS",
        idempotencyKey,
        secondFixture.user.id,
      ),
    ).rejects.toThrow("Idempotency key already used for another order");
  });

  test("does not allow payment for another user's order", async () => {
    const fixture = await createPaymentFixture();

    const anotherUser = await userRepository.createUser(
      `payment-other-${Date.now()}-${Math.random()}@example.com`,
      "hashed-password",
    );

    await expect(
      paymentRepository.processPayment(
        fixture.order.id,
        "SUCCESS",
        `ownership-${Date.now()}`,
        anotherUser.id,
      ),
    ).rejects.toThrow("Order not found");

    const product = await productRepository.getProductById(fixture.product.id);

    expect(product.total_stock).toBe(10);
    expect(product.available_stock).toBe(8);
  });

  afterAll(async () => {
    await pool.end();
  });
});
