-- Delivery zones, verified against the official Swiss Post directory (AMTOVZ).
-- Handwritten corrections on her price sheet override the printed values.
-- Brugg Stadt minimum: CHF 50 (confirmed by owner).
-- 'Obersiggenthal CHF 15' on the sheet is NOT seeded. Obersiggenthal is a
-- Gemeinde, not an Ortschaft - it has no postcode of its own. Its three
-- villages keep the sheet's own prices: Nussbaumen 12, Rieden 14, Kirchdorf 14.

INSERT INTO delivery_zone (name_de, method, fee_gross, min_order_gross, free_over_gross, sort_order) VALUES
  ('Neuenhof', 'own_van', 8.00, 40.00, 120.00, 1),
  ('Stadt Baden', 'own_van', 10.00, 40.00, 120.00, 2),
  ('Ennetbaden', 'own_van', 10.00, 40.00, 120.00, 3),
  ('Killwangen', 'own_van', 10.00, 40.00, 120.00, 4),
  ('Wettingen', 'own_van', 10.00, 40.00, 120.00, 5),
  ('Rütihof', 'own_van', 10.00, 40.00, 120.00, 6),
  ('Dättwil', 'own_van', 12.00, 40.00, 120.00, 7),
  ('Fislisbach', 'own_van', 12.00, 40.00, 120.00, 8),
  ('Nussbaumen', 'own_van', 12.00, 40.00, 120.00, 9),
  ('Spreitenbach', 'own_van', 12.00, 40.00, 120.00, 10),
  ('Birmenstorf', 'own_van', 14.00, 40.00, 120.00, 11),
  ('Kirchdorf', 'own_van', 14.00, 40.00, 120.00, 12),
  ('Rieden bei Nussbaumen', 'own_van', 14.00, 40.00, 120.00, 13),
  ('Würenlos', 'own_van', 14.00, 40.00, 120.00, 14),
  ('Ehrendingen', 'own_van', 15.00, 40.00, 120.00, 15),
  ('Freienwil', 'own_van', 15.00, 40.00, 120.00, 16),
  ('Niederrohrdorf', 'own_van', 15.00, 40.00, 120.00, 17),
  ('Oberrohrdorf', 'own_van', 15.00, 40.00, 120.00, 18),
  ('Turgi', 'own_van', 15.00, 40.00, 120.00, 19),
  ('Mellingen', 'own_van', 16.00, 40.00, 120.00, 20),
  ('Bellikon', 'own_van', 18.00, 40.00, 120.00, 21),
  ('Remetschwil', 'own_van', 18.00, 40.00, 120.00, 22),
  ('Untersiggenthal', 'own_van', 18.00, 50.00, 120.00, 23),
  ('Brugg Stadt', 'own_van', 20.00, 50.00, 120.00, 24),
  ('Endingen', 'own_van', 20.00, 40.00, 120.00, 25),
  ('Lengnau', 'own_van', 20.00, 40.00, 120.00, 26),
  ('Otelfingen', 'own_van', 20.00, 40.00, 120.00, 27);

INSERT INTO delivery_zone_plz (plz, ortschaft, zone_id) VALUES
  ('5432', 'Neuenhof', (SELECT id FROM delivery_zone WHERE name_de = 'Neuenhof')),
  ('5400', 'Baden', (SELECT id FROM delivery_zone WHERE name_de = 'Stadt Baden')),
  ('5408', 'Ennetbaden', (SELECT id FROM delivery_zone WHERE name_de = 'Ennetbaden')),
  ('8956', 'Killwangen', (SELECT id FROM delivery_zone WHERE name_de = 'Killwangen')),
  ('5430', 'Wettingen', (SELECT id FROM delivery_zone WHERE name_de = 'Wettingen')),
  ('5406', 'Rütihof', (SELECT id FROM delivery_zone WHERE name_de = 'Rütihof')),
  ('5405', 'Dättwil AG', (SELECT id FROM delivery_zone WHERE name_de = 'Dättwil')),
  ('5442', 'Fislisbach', (SELECT id FROM delivery_zone WHERE name_de = 'Fislisbach')),
  ('5415', 'Nussbaumen AG', (SELECT id FROM delivery_zone WHERE name_de = 'Nussbaumen')),
  ('8957', 'Spreitenbach', (SELECT id FROM delivery_zone WHERE name_de = 'Spreitenbach')),
  ('5413', 'Birmenstorf AG', (SELECT id FROM delivery_zone WHERE name_de = 'Birmenstorf')),
  ('5416', 'Kirchdorf AG', (SELECT id FROM delivery_zone WHERE name_de = 'Kirchdorf')),
  ('5415', 'Rieden AG', (SELECT id FROM delivery_zone WHERE name_de = 'Rieden bei Nussbaumen')),
  ('5436', 'Würenlos', (SELECT id FROM delivery_zone WHERE name_de = 'Würenlos')),
  ('5420', 'Ehrendingen', (SELECT id FROM delivery_zone WHERE name_de = 'Ehrendingen')),
  ('5423', 'Freienwil', (SELECT id FROM delivery_zone WHERE name_de = 'Freienwil')),
  ('5443', 'Niederrohrdorf', (SELECT id FROM delivery_zone WHERE name_de = 'Niederrohrdorf')),
  ('5452', 'Oberrohrdorf', (SELECT id FROM delivery_zone WHERE name_de = 'Oberrohrdorf')),
  ('5300', 'Turgi', (SELECT id FROM delivery_zone WHERE name_de = 'Turgi')),
  ('5507', 'Mellingen', (SELECT id FROM delivery_zone WHERE name_de = 'Mellingen')),
  ('5454', 'Bellikon', (SELECT id FROM delivery_zone WHERE name_de = 'Bellikon')),
  ('5453', 'Remetschwil', (SELECT id FROM delivery_zone WHERE name_de = 'Remetschwil')),
  ('5417', 'Untersiggenthal', (SELECT id FROM delivery_zone WHERE name_de = 'Untersiggenthal')),
  ('5200', 'Brugg AG', (SELECT id FROM delivery_zone WHERE name_de = 'Brugg Stadt')),
  ('5304', 'Endingen', (SELECT id FROM delivery_zone WHERE name_de = 'Endingen')),
  ('5426', 'Lengnau AG', (SELECT id FROM delivery_zone WHERE name_de = 'Lengnau')),
  ('8112', 'Otelfingen', (SELECT id FROM delivery_zone WHERE name_de = 'Otelfingen'));
