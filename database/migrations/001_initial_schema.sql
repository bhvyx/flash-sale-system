CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =========================
-- USERS
-- =========================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================
-- PRODUCTS
-- =========================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    total_stock INTEGER NOT NULL CHECK (total_stock >= 0),
    available_stock INTEGER NOT NULL CHECK (
        available_stock >= 0
        AND available_stock <= total_stock
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================
-- RESERVATION STATUS
-- =========================

CREATE TYPE reservation_status AS ENUM (
    'ACTIVE',
    'PURCHASED',
    'EXPIRED',
    'CANCELLED'
);


-- =========================
-- RESERVATIONS
-- =========================

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    product_id UUID NOT NULL
        REFERENCES products(id),

    quantity INTEGER NOT NULL CHECK (quantity > 0),

    status reservation_status NOT NULL DEFAULT 'ACTIVE',

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================
-- ORDERS
-- =========================

CREATE TYPE order_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED'
);


CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    reservation_id UUID NOT NULL UNIQUE
        REFERENCES reservations(id),

    product_id UUID NOT NULL
        REFERENCES products(id),

    quantity INTEGER NOT NULL CHECK (quantity > 0),

    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),

    status order_status NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================
-- INDEXES
-- =========================

CREATE INDEX idx_reservations_user_id
    ON reservations(user_id);

CREATE INDEX idx_reservations_product_id
    ON reservations(product_id);

CREATE INDEX idx_reservations_expires_at
    ON reservations(expires_at);

CREATE INDEX idx_reservations_status
    ON reservations(status);

CREATE INDEX idx_orders_user_id
    ON orders(user_id);

CREATE INDEX idx_orders_product_id
    ON orders(product_id);