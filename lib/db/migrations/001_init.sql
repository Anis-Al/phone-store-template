-- JSON columns hold text; money is whole DZD; timestamps are ISO-8601 strings.
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tagline TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'used')),
  specs TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  base_price INTEGER NOT NULL CHECK (base_price >= 0),
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE variants (
  sku TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  storage INTEGER NOT NULL,
  price_override INTEGER CHECK (price_override >= 0),
  stock_qty INTEGER NOT NULL CHECK (stock_qty >= 0), -- the oversell guard: a reservation below 0 aborts the order
  images TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX variants_product ON variants(product_id, position);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  seq INTEGER UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'confirmed', 'ready', 'done', 'cancelled')),
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('delivery', 'pickup')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cod', 'instore')),
  customer TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX orders_status ON orders(status, created_at);
CREATE INDEX orders_created ON orders(created_at);

CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id),
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price INTEGER NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (order_id, sku)
);

CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('order', 'cancel', 'manual', 'import', 'edit')),
  note TEXT,
  order_id TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX stock_movements_sku ON stock_movements(sku, created_at);
CREATE INDEX stock_movements_order ON stock_movements(order_id);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  disabled_at TEXT
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  diff TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_entity ON audit(entity, entity_id, created_at);
