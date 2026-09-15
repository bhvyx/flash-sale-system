const productRepository = require("../../../src/repositories/productRepository");
const pool = require("../../../src/db");

describe("productRepository", () => {
  test("creates a product with the correct initial stock", async () => {
    const product = await productRepository.createProduct(
      "Test Product",
      999.99,
      50,
    );

    expect(product).toEqual(
      expect.objectContaining({
        name: "Test Product",
        price: "999.99",
        total_stock: 50,
        available_stock: 50,
      }),
    );
  });

  test("retrieves products", async () => {
    const products = await productRepository.getAllProducts();

    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toEqual(
      expect.objectContaining({
        name: "Test Product",
      }),
    );
  });

  test("retrieves a product by id", async () => {
    const product = await productRepository.createProduct(
      "Lookup Product",
      499.99,
      20,
    );

    const result = await productRepository.getProductById(product.id);

    expect(result).toEqual(
      expect.objectContaining({
        id: product.id,
        name: "Lookup Product",
        price: "499.99",
        total_stock: 20,
        available_stock: 20,
      }),
    );
  });

  afterAll(async () => {
    await pool.end();
  });
});
