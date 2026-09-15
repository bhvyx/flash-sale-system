# Flash Sale System

A backend service for high-contention flash sales, built to guarantee that limited inventory is **never oversold** under concurrent load even when hundreds of requests target the same product in the same second.

Verified under load: **1,001 reservation requests against 50 units of stock produced exactly 50 reservations, 0 oversells and 0 unhandled errors.**

**Stack:** Node.js · Express 5 · PostgreSQL 17 · Redis 7 · Docker · Jest + Testcontainers · k6

---

## The problem

A flash sale is a worst-case concurrency scenario: a large number of users compete for a small, fixed pool of stock at a known moment in time. A naive implementation does this:

```js
const product = await getProduct(id); // reads available_stock = 1
if (product.available_stock >= quantity) {
  // two requests both pass this check
  await decrementStock(id, quantity); // both decrement → stock goes negative
}
```

Between the read and the write, another request can read the same stock value. Both pass the check, both decrement and the store has sold inventory it does not have. This is a classic read-modify-write race and under flash-sale traffic it is not an edge case, it is the default outcome.

This service solves that with two coordinated layers, plus a reservation model that separates _holding_ stock from _paying_ for it.

---

## Architecture

```
                            ┌──────────────┐
                            │    Client    │
                            └──────┬───────┘
                                   │ HTTP + JWT
                                   ▼
        ┌──────────────────────────────────────────────────────┐
        │                  Express Application                  │
        │                                                       │
        │   Routes ──► authMiddleware ──► validate(zod) ──►     │
        │                                      Controllers      │
        │                                          │            │
        │                                          ▼            │
        │                                      Services         │◄── errorMiddleware
        │                                          │            │    (AppError → status)
        │                                          ▼            │
        │                                    Repositories        │
        └───────────────┬──────────────────────────┬────────────┘
                        │                          │
            Lock acquire/release              SQL + transactions
                        │                          │
                        ▼                          ▼
               ┌─────────────────┐       ┌────────────────────┐
               │      Redis      │       │    PostgreSQL      │
               │                 │       │                    │
               │ SET NX PX +     │       │ SELECT ... FOR     │
               │ Lua CAS release │       │ UPDATE (row locks) │
               │                 │       │ ACID transactions  │
               │ Admission       │       │ Source of truth    │
               │ control         │       │ for correctness    │
               └─────────────────┘       └────────────────────┘

                        ┌──────────────────────────┐
                        │   Expiration Worker      │
                        │   (5s interval)          │
                        │   ACTIVE + past expiry   │
                        │   → EXPIRED, restore     │
                        │     available_stock      │
                        └──────────────────────────┘
```

### Purchase lifecycle

```
  POST /api/reservations          POST /api/orders           POST /api/payments
          │                              │                           │
          ▼                              ▼                           ▼
  ┌───────────────┐            ┌─────────────────┐        ┌────────────────────┐
  │  RESERVATION  │            │      ORDER      │        │      PAYMENT       │
  │    ACTIVE     │───────────►│     PENDING     │───────►│      SUCCESS       │
  │               │            │                 │        │                    │
  │ available_    │            │ amount locked   │        │ total_stock  -= qty│
  │ stock -= qty  │            │ from product    │        │ reservation →      │
  │ expires in    │            │ price           │        │   PURCHASED        │
  │ 10 min        │            │                 │        │ order → CONFIRMED  │
  └───────┬───────┘            └─────────────────┘        └────────────────────┘
          │
          │ 10 min elapsed, or user cancels
          ▼
  ┌───────────────────────────┐
  │  EXPIRED  /  CANCELLED    │
  │  available_stock += qty   │
  └───────────────────────────┘
```

Stock is tracked with **two counters**, which is what makes the intermediate "held but not yet paid for" state safe:

| Counter           | Decremented at      | Meaning                              |
| ----------------- | ------------------- | ------------------------------------ |
| `available_stock` | Reservation created | What a new buyer may still claim     |
| `total_stock`     | Payment confirmed   | What physically remains in inventory |

A reservation reduces `available_stock` immediately, so no one else can claim the same unit. `total_stock` only drops once money is confirmed. If a reservation expires or is cancelled, `available_stock` is restored and `total_stock` was never touched. The schema enforces `available_stock <= total_stock` as a `CHECK` constraint, so this invariant cannot be violated even by a bug in application code.

---

## How overselling is prevented

### Layer 1 — PostgreSQL row locks (correctness)

The actual guarantee lives in the database. Every reservation runs inside a transaction that locks the product row before reading stock:

```sql
BEGIN;

SELECT * FROM products
WHERE id = $1
FOR UPDATE;              -- concurrent transactions block here

-- check stock, then decrement, then insert reservation

COMMIT;
```

`FOR UPDATE` makes concurrent transactions for the same product serialize at the database. The second request physically cannot read stock until the first commits or rolls back, which closes the read-modify-write window entirely. **This holds regardless of how many application instances are running**, because the lock lives in Postgres rather than in process memory.

### Layer 2 — Redis distributed lock (admission control)

Postgres alone is sufficient for correctness. Redis is layered in front for a different reason: **protecting the connection pool.**

Without it, every concurrent request for a hot product opens a transaction and blocks on the row lock _while holding a connection from the `pg` pool_. Under a flash-sale spike, the pool fills with connections that are idle-but-blocked, and unrelated requests, even for entirely different products, start timing out waiting for a free connection.

The Redis lock caps how many requests reach Postgres at once per product:

```js
const lock = await acquireLockWithRetry(
  `inventory:product:${productId}`,
  10000,
  5000,
  50,
);
if (!lock) throw new AppError("Inventory is busy, please retry", 503);
```

Implementation details that matter:

- **`SET NX PX`** — atomic acquire with a TTL, so a crashed process cannot hold the lock forever.
- **UUID token + Lua compare-and-delete on release** — a process whose lock already expired cannot delete a lock now held by someone else:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end
  ```
- **Exponential backoff with jitter** (50ms → 500ms cap, ±50ms jitter) — prevents a thundering herd of retry attempts synchronizing.
- **Bounded wait (5s)** — requests fail fast with `503` rather than hanging indefinitely, giving callers clean backpressure instead of a stalled connection.

**Design trade-off, stated honestly:** Redis is an availability dependency here, not a correctness one. If Redis is unreachable, reservations currently fail closed even though Postgres alone could still serve them safely. Failing _open_ — skipping the lock and relying on `FOR UPDATE` — would trade throughput for availability. That fallback is listed under [Known limitations](#known-limitations).

### Double-charge prevention

Payments are protected on two independent levels:

1. **Idempotency key** (`Idempotency-Key` header, `UNIQUE` column). A retry with the same key returns the original payment record without re-processing. A key reused against a _different_ order is rejected with `409`.
2. **Row-locked order status gate.** The order row is fetched `FOR UPDATE` and rejected unless `status = 'PENDING'`. Once the first payment commits, the order is `CONFIRMED`, so any subsequent attempt — even with a fresh idempotency key, even arriving concurrently — is rejected before it can touch stock.

Level 2 is what makes the guarantee complete: level 1 handles well-behaved retries, level 2 handles client bugs and races.

---

## Load test results

Run with [k6](https://k6.io) against a live server: constant arrival rate, 100 req/s for 10s, up to 200 VUs, targeting a single product seeded with **50 units**.

```bash
docker run --rm -i \
  -e PRODUCT_ID=<product-uuid> \
  -e TOKEN=<jwt> \
  -v "$PWD/tests/load-tests:/scripts" \
  grafana/k6 run /scripts/reservation.js
```

### Results

| Metric                          | Value                           |
| ------------------------------- | ------------------------------- |
| Total requests                  | 1,001                           |
| **Successful reservations**     | **50** (exactly matching stock) |
| Stock rejections (`400`)        | 942                             |
| Lock-timeout rejections (`503`) | 9                               |
| Unexpected errors (`5xx`)       | **0**                           |
| Checks passed                   | **100.00%** (1,001 / 1,001)     |
| Throughput                      | ~90 req/s sustained             |

### Correctness verification

Independently confirmed against the database rather than trusting application responses:

```sql
SELECT COUNT(*) AS reservations, COALESCE(SUM(quantity), 0) AS total_reserved
FROM reservations
WHERE product_id = '...' AND status = 'ACTIVE';

 reservations | total_reserved
--------------+----------------
           50 |             50
```

**50 units of stock, 50 reservations, 1,001 competing requests, zero oversells.**

### Latency

| Percentile | Successful responses | All responses |
| ---------- | -------------------- | ------------- |
| median     | 10.2ms               | 7.7ms         |
| p90        | 129ms                | 864ms         |
| p95        | 215ms                | 1.95s         |
| max        | 460ms                | 5.01s         |

The overall tail is wider than the successful-response tail because requests that queue on the Redis lock before ultimately timing out are included. **This is the intended behaviour, not a regression:** at 100 req/s against 50 units, the overwhelming majority of requests _cannot_ succeed, and the system is designed to serialize access to the contended row rather than respond quickly at the cost of correctness. Every one of those slow requests still returned a well-formed `400` or `503` — none returned `5xx`, and none overslept the 5s bound.

---

## Testing

```bash
npm test
```

Integration tests run against **real PostgreSQL and Redis instances** spun up per-run via [Testcontainers](https://testcontainers.com) — no mocked database layer. `tests/testEnvironment.js` starts `postgres:17` and `redis:7` containers, executes every migration in `database/migrations/` against the fresh database, injects the connection URLs into `process.env`, and tears the containers down afterward.

This matters for this project specifically: `FOR UPDATE` semantics, transaction isolation, and `CHECK` constraint enforcement cannot be verified against a mock. The tests exercise the same locking behaviour the production code depends on.

Coverage includes:

- **Repository layer** (`tests/integration/repositories/`) — transaction logic tested directly, without the HTTP layer.
- **API layer** (`tests/integration/`) — full request lifecycle via Supertest: auth enforcement, Zod validation rejection, stock decrement and restoration verified by reading actual post-operation stock values, cross-user isolation (user B receives `404` for user A's reservation) and payment idempotency.

---

## API

All endpoints except registration, login, and product reads require `Authorization: Bearer <jwt>`.

| Method | Endpoint                         | Auth      | Description                                         |
| ------ | -------------------------------- | --------- | --------------------------------------------------- |
| `POST` | `/api/auth/register`             | —         | Create account (bcrypt, cost 12)                    |
| `POST` | `/api/auth/login`                | —         | Returns JWT                                         |
| `GET`  | `/api/products`                  | —         | List products                                       |
| `GET`  | `/api/products/:id`              | —         | Product detail                                      |
| `POST` | `/api/products`                  | **Admin** | Create product                                      |
| `POST` | `/api/reservations`              | User      | Hold stock for 10 minutes                           |
| `GET`  | `/api/reservations/:id`          | User      | Own reservation only                                |
| `GET`  | `/api/reservations/user/:userId` | User      | Own reservations only                               |
| `POST` | `/api/reservations/:id/cancel`   | User      | Release hold, restore stock                         |
| `POST` | `/api/orders`                    | User      | Convert reservation → pending order                 |
| `GET`  | `/api/orders/:id`                | User      | Own order only                                      |
| `GET`  | `/api/orders/user/:userId`       | User      | Own orders only                                     |
| `POST` | `/api/payments`                  | User      | Confirm payment (requires `Idempotency-Key` header) |
| `GET`  | `/health`                        | —         | Liveness probe                                      |

Authorization is enforced at the **repository** layer via `AND user_id = $2` in the query itself, not by a check in the controller — so an ownership bug cannot be introduced by forgetting a guard clause upstream.

### Example flow

```bash
# 1. Reserve
curl -X POST localhost:5000/api/reservations \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":"<uuid>","quantity":1}'

# 2. Create order
curl -X POST localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reservationId":"<uuid>"}'

# 3. Pay
curl -X POST localhost:5000/api/payments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"orderId":"<uuid>","outcome":"SUCCESS"}'
```

---

## Project structure

```
src/
├── routes/          URL → handler mapping only
├── middleware/      auth (JWT), admin, zod validation, centralized errors
├── controllers/     HTTP in / HTTP out — no business logic
├── services/        business rules, lock acquisition, orchestration
├── repositories/    all SQL; owns transaction boundaries
├── validation/      zod schemas per domain
├── redis/           client + distributed lock primitives
├── db/              pg connection pool
└── utils/           AppError (message + statusCode)

database/migrations/ ordered .sql, applied in filename order
tests/
├── integration/     API + repository tests (Testcontainers)
└── load-tests/      k6 scripts
```

Layering is strict: repositories are the only files that import `pg`, which is what allows transaction and locking logic to be tested directly without booting Express. Errors thrown as `AppError(message, statusCode)` are mapped to responses by a single `errorMiddleware`, so controllers contain no status-code logic.

---

## Running locally

**Prerequisites:** Node.js 18+, Docker.

```bash
# 1. Start dependencies
docker compose up -d

# 2. Configure
cp .env.example .env
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/flashsale
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=<any-secret>
# PORT=5000

# 3. Install
npm install

# 4. Apply migrations (in filename order)
for f in database/migrations/*.sql; do
  docker exec -i flash-sale-postgres psql -U postgres -d flashsale < "$f"
done

# 5. Run
npm run dev
```

To create an admin user for product seeding, register normally and then:

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'you@example.com';
```

---

## Known limitations

Deliberate scope boundaries, and the gaps I would close next:

- **Payment gateway is simulated.** The `outcome` field is supplied by the client rather than by a real provider. The idempotency, state-machine, and transaction logic around it is real; the provider integration is not.
- **No Redis fallback.** If Redis is unreachable, reservations fail closed. Failing open (skipping admission control, relying on `FOR UPDATE`) would preserve correctness while trading throughput for availability.
- **No rate limiting or per-user purchase cap.** Nothing currently prevents a single user or script from claiming the entire stock pool. For a real flash sale this is essential, and it is the highest-priority next addition.
- **Expiration worker runs in-process on `setInterval`.** With multiple app instances, every instance runs the sweep. Row locks prevent corruption, but the work is duplicated — `FOR UPDATE SKIP LOCKED` or a dedicated job queue is the correct fix.
- **A few secondary error paths still throw bare `Error`**, surfacing as `500` instead of `409`. The protection is correct; the status code is not.
- **No pagination** on list endpoints and no structured logging (`console.error` only).
