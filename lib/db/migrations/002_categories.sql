ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'phones';
-- ponytail: products.specs stays NOT NULL and a product without a spec sheet stores the JSON text 'null'
-- (avoids rebuilding products, which variants reference). SQL must test `specs = 'null'`, not `IS NULL`;
-- rebuild the table with a nullable column if specs ever get queried in SQL.

CREATE TABLE variants_new (
  sku TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  storage INTEGER CHECK (storage > 0),
  price_override INTEGER CHECK (price_override >= 0),
  stock_qty INTEGER NOT NULL CHECK (stock_qty >= 0), -- the oversell guard: a reservation below 0 aborts the order
  images TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
INSERT INTO variants_new (sku, product_id, color_name, color_hex, storage, price_override, stock_qty, images, position)
  SELECT sku, product_id, color_name, color_hex, storage, price_override, stock_qty, images, position FROM variants;
DROP TABLE variants;
ALTER TABLE variants_new RENAME TO variants;
CREATE INDEX variants_product ON variants(product_id, position);
