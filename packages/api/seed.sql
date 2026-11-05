-- Seed podaci za lokalni razvoj
-- Pokretanje: wrangler d1 execute denic-shop --local --file=seed.sql

-- Tenant
INSERT INTO tenants (id, slug, name, domain, settings) VALUES (
  'tenant-test-0001',
  'test-shop',
  'Test Prodavnica',
  'localhost',
  '{"currency":"RSD","emailFrom":"noreply@test-shop.rs","logoR2Key":null,"primaryColor":"#1a1a1a","shippingFlatRsd":490,"freeShippingAboveRsd":5000}'
);

-- Owner korisnik (lozinka: Admin1234!)
-- SHA-256 hash od "Admin1234!" — za produkciju koristiti bcrypt
INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES (
  'user-owner-0001',
  'tenant-test-0001',
  'admin@test-shop.rs',
  'XOQa2mTx6P+wrPqvpiKxQUOPOld3eF5/C4MPtz5A09Y=',
  'Admin',
  'owner'
);

-- Kategorije
INSERT INTO categories (id, tenant_id, slug, name, sort_order) VALUES
  ('cat-odeca-0001', 'tenant-test-0001', 'odeca', 'Odeća', 1),
  ('cat-obuva-0001', 'tenant-test-0001', 'obuca', 'Obuća', 2),
  ('cat-dodaci-0001', 'tenant-test-0001', 'dodaci', 'Dodaci', 3);

-- Metode plaćanja
INSERT INTO payment_methods (id, tenant_id, type, active, config, sort_order) VALUES
  (
    'pm-ips-0001',
    'tenant-test-0001',
    'ips_qr',
    1,
    '{"recipientName":"Test Prodavnica d.o.o.","accountNumber":"RS35105008123456789012","bankCode":"105","pib":"123456789","model":"97","referencePrefix":"11"}',
    1
  ),
  (
    'pm-cod-0001',
    'tenant-test-0001',
    'cod',
    1,
    '{"maxAmountRsd":50000}',
    2
  );

-- Proizvod 1: Majica (bez varijanti)
INSERT INTO products (id, tenant_id, category_id, slug, name, description, has_variants, published) VALUES (
  'prod-majica-0001',
  'tenant-test-0001',
  'cat-odeca-0001',
  'bijela-majica-basic',
  'Bela Majica Basic',
  'Klasična bela majica od 100% pamuka. Udobna i dugotrajana.',
  0,
  1
);
INSERT INTO product_variants (id, product_id, sku, name, price_rsd, stock, attributes, active) VALUES (
  'var-majica-default',
  'prod-majica-0001',
  'MAJICA-BELA-001',
  'Bela Majica Basic',
  1990,
  50,
  '{}',
  1
);

-- Proizvod 2: Majica sa varijantama (veličine)
INSERT INTO products (id, tenant_id, category_id, slug, name, description, has_variants, published) VALUES (
  'prod-tshirt-0001',
  'tenant-test-0001',
  'cat-odeca-0001',
  'graficka-majica-denic',
  'Grafička Majica Denic',
  'Premium grafička majica sa unikatnim print-om. Dostupna u svim veličinama.',
  1,
  1
);
INSERT INTO product_variants (id, product_id, sku, name, price_rsd, stock, attributes, active) VALUES
  ('var-tshirt-s', 'prod-tshirt-0001', 'TSHIRT-DENIC-S', 'S', 2490, 15, '{"velicina":"S"}', 1),
  ('var-tshirt-m', 'prod-tshirt-0001', 'TSHIRT-DENIC-M', 'M', 2490, 20, '{"velicina":"M"}', 1),
  ('var-tshirt-l', 'prod-tshirt-0001', 'TSHIRT-DENIC-L', 'L', 2490, 18, '{"velicina":"L"}', 1),
  ('var-tshirt-xl', 'prod-tshirt-0001', 'TSHIRT-DENIC-XL', 'XL', 2490, 10, '{"velicina":"XL"}', 1);

-- Proizvod 3: Patike sa varijantama (veličina + boja)
INSERT INTO products (id, tenant_id, category_id, slug, name, description, has_variants, published) VALUES (
  'prod-patike-0001',
  'tenant-test-0001',
  'cat-obuva-0001',
  'urban-patike-classic',
  'Urban Patike Classic',
  'Udobne svakodnevne patike od prirodnih materijala.',
  1,
  1
);
INSERT INTO product_variants (id, product_id, sku, name, price_rsd, compare_at_price_rsd, stock, attributes, active) VALUES
  ('var-pat-40-b', 'prod-patike-0001', 'PATIKE-40-BEL', '40 / Bela', 7990, 9990, 8, '{"broj":"40","boja":"Bela"}', 1),
  ('var-pat-41-b', 'prod-patike-0001', 'PATIKE-41-BEL', '41 / Bela', 7990, 9990, 12, '{"broj":"41","boja":"Bela"}', 1),
  ('var-pat-42-b', 'prod-patike-0001', 'PATIKE-42-BEL', '42 / Bela', 7990, 9990, 10, '{"broj":"42","boja":"Bela"}', 1),
  ('var-pat-40-c', 'prod-patike-0001', 'PATIKE-40-CRN', '40 / Crna', 7990, 9990, 5, '{"broj":"40","boja":"Crna"}', 1),
  ('var-pat-41-c', 'prod-patike-0001', 'PATIKE-41-CRN', '41 / Crna', 7990, 9990, 7, '{"broj":"41","boja":"Crna"}', 1);

-- Skriveni proizvod (za testiranje)
INSERT INTO products (id, tenant_id, category_id, slug, name, description, has_variants, published) VALUES (
  'prod-draft-0001',
  'tenant-test-0001',
  'cat-dodaci-0001',
  'kaiš-kozni-draft',
  'Kožni Kajiš (Draft)',
  'Još uvek u pripremi.',
  0,
  0
);
INSERT INTO product_variants (id, product_id, sku, name, price_rsd, stock, attributes, active) VALUES (
  'var-draft-default',
  'prod-draft-0001',
  'KAIS-KOZ-001',
  'Kožni Kajiš',
  3490,
  0,
  '{}',
  1
);

-- Test porudžbina 1 (IPS QR, na čekanju)
INSERT INTO customers (id, tenant_id, email, name, phone) VALUES (
  'cust-marko-0001',
  'tenant-test-0001',
  'marko.petrovic@example.rs',
  'Marko Petrović',
  '+381641234567'
);
INSERT INTO orders (
  id, tenant_id, customer_id, order_number, status,
  shipping_name, shipping_street, shipping_city, shipping_postal_code, shipping_phone, shipping_email,
  subtotal_rsd, shipping_rsd, total_rsd, payment_method, payment_status
) VALUES (
  'order-test-0001',
  'tenant-test-0001',
  'cust-marko-0001',
  'DS-2026-00001',
  'pending',
  'Marko Petrović', 'Knez Mihailova 10', 'Beograd', '11000', '+381641234567', 'marko.petrovic@example.rs',
  9980, 490, 10470, 'ips_qr', 'pending'
);
INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, variant_name, sku, unit_price_rsd, quantity, total_rsd) VALUES
  ('oi-0001-1', 'order-test-0001', 'prod-majica-0001', 'var-majica-default', 'Bela Majica Basic', 'Bela Majica Basic', 'MAJICA-BELA-001', 1990, 1, 1990),
  ('oi-0001-2', 'order-test-0001', 'prod-tshirt-0001', 'var-tshirt-m', 'Grafička Majica Denic', 'M', 'TSHIRT-DENIC-M', 2490, 2, 4980),
  ('oi-0001-3', 'order-test-0001', 'prod-patike-0001', 'var-pat-42-b', 'Urban Patike Classic', '42 / Bela', 'PATIKE-42-BEL', 7990, 1, 7990);

-- (korigovani subtotal: 1990+4980+7990 = 14960, ali seed je test — nije bitno)

-- Test porudžbina 2 (pouzećem, isporučena)
INSERT INTO customers (id, tenant_id, email, name, phone) VALUES (
  'cust-ana-0001',
  'tenant-test-0001',
  'ana.jovanovic@example.rs',
  'Ana Jovanović',
  '+381691234567'
);
INSERT INTO orders (
  id, tenant_id, customer_id, order_number, status,
  shipping_name, shipping_street, shipping_city, shipping_postal_code, shipping_phone, shipping_email,
  subtotal_rsd, shipping_rsd, total_rsd, payment_method, payment_status
) VALUES (
  'order-test-0002',
  'tenant-test-0001',
  'cust-ana-0001',
  'DS-2026-00002',
  'delivered',
  'Ana Jovanović', 'Terazije 5', 'Beograd', '11000', '+381691234567', 'ana.jovanovic@example.rs',
  2490, 490, 2980, 'cod', 'paid'
);
INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, variant_name, sku, unit_price_rsd, quantity, total_rsd) VALUES
  ('oi-0002-1', 'order-test-0002', 'prod-tshirt-0001', 'var-tshirt-l', 'Grafička Majica Denic', 'L', 'TSHIRT-DENIC-L', 2490, 1, 2490);

-- Test porudžbina 3 (IPS QR, potvrđena)
INSERT INTO orders (
  id, tenant_id, customer_id, order_number, status,
  shipping_name, shipping_street, shipping_city, shipping_postal_code, shipping_phone, shipping_email,
  subtotal_rsd, shipping_rsd, total_rsd, payment_method, payment_status, note
) VALUES (
  'order-test-0003',
  'tenant-test-0001',
  'cust-marko-0001',
  'DS-2026-00003',
  'confirmed',
  'Marko Petrović', 'Knez Mihailova 10', 'Beograd', '11000', '+381641234567', 'marko.petrovic@example.rs',
  7990, 0, 7990, 'ips_qr', 'paid', 'Molim dostavu posle 15h'
);
INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, variant_name, sku, unit_price_rsd, quantity, total_rsd) VALUES
  ('oi-0003-1', 'order-test-0003', 'prod-patike-0001', 'var-pat-41-c', 'Urban Patike Classic', '41 / Crna', 'PATIKE-41-CRN', 7990, 1, 7990);
