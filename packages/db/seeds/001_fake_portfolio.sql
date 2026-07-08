-- Atlas Portfolio
-- Fake seed data for public development only.
-- Do not replace this file with real portfolio data.

PRAGMA foreign_keys = ON;

DELETE FROM recommendations;
DELETE FROM alerts;
DELETE FROM portfolio_snapshots;
DELETE FROM strategy_steps;
DELETE FROM sector_targets;
DELETE FROM allocation_targets;
DELETE FROM prices;
DELETE FROM transactions;
DELETE FROM positions;
DELETE FROM securities;
DELETE FROM accounts;

INSERT INTO accounts (id, name, type, currency, cash_balance, include_in_net_worth) VALUES
  ('compte-courant', 'Compte courant', 'current_account', 'EUR', 1534.50, 1),
  ('pea', 'PEA', 'pea', 'EUR', 3500.00, 1),
  ('cto', 'CTO', 'cto', 'EUR', 4500.00, 1),
  ('livret-a', 'Livret A', 'livret_a', 'EUR', 6900.00, 1),
  ('crypto-wallet', 'Compte crypto', 'crypto_wallet', 'EUR', 0.00, 1);

INSERT INTO securities (id, name, ticker, isin, asset_class, sector, country, currency) VALUES
  ('cw8', 'Amundi MSCI World ETF (CW8)', 'CW8.PA', 'LU1681043599', 'ETF', 'ETF Monde', 'Monde', 'EUR'),
  ('pea-europe', 'Lyxor PEA MSCI Europe (PEA)', 'PCEU.PA', NULL, 'ETF', 'ETF Europe', 'Europe', 'EUR'),
  ('lvmh', 'LVMH', 'MC.PA', 'FR0000121014', 'Actions', 'Luxe', 'France', 'EUR'),
  ('asml', 'ASML Holding', 'ASML.AS', NULL, 'Actions', 'Technologie', 'Pays-Bas', 'EUR'),
  ('btc', 'Bitcoin (BTC)', 'BTC-EUR', NULL, 'Crypto', 'Crypto', 'Crypto', 'EUR');

INSERT INTO positions (id, account_id, security_id, quantity, average_price, current_price) VALUES
  ('pos-cw8', 'pea', 'cw8', 15.2, 575.30, 680.22),
  ('pos-europe', 'pea', 'pea-europe', 98, 57.92, 39.35),
  ('pos-lvmh', 'pea', 'lvmh', 12, 391.51, 488.85),
  ('pos-asml', 'cto', 'asml', 8, 502.51, 1511.40),
  ('pos-btc', 'crypto-wallet', 'btc', 0.08508, 39160.00, 54400.10);

INSERT INTO transactions (id, date, type, from_account_id, to_account_id, account_id, security_id, quantity, price, fees, amount, note) VALUES
  ('tx-001', '2024-01-12', 'deposit', NULL, 'compte-courant', NULL, NULL, NULL, NULL, 0, 12000.00, 'Apport initial fictif'),
  ('tx-002', '2024-01-15', 'transfer', 'compte-courant', 'pea', NULL, NULL, NULL, NULL, 0, 5000.00, 'Transfert compte courant vers PEA'),
  ('tx-003', '2024-01-16', 'buy', NULL, NULL, 'pea', 'cw8', 60, 57.53, 2.00, 3453.80, NULL),
  ('tx-004', '2024-02-10', 'transfer', 'compte-courant', 'livret-a', NULL, NULL, NULL, NULL, 0, 2000.00, 'Mise de sécurité Livret A'),
  ('tx-005', '2024-04-03', 'buy', NULL, NULL, 'pea', 'lvmh', 4, 391.51, 2.00, 1568.04, NULL),
  ('tx-006', '2024-05-20', 'dividend', NULL, NULL, 'pea', 'lvmh', NULL, NULL, 0, 68.40, 'Dividende fictif'),
  ('tx-007', '2024-07-05', 'buy', NULL, NULL, 'crypto-wallet', 'btc', 0.1, 11958.80, 1.50, 1197.38, NULL);

INSERT INTO prices (security_id, date, close_price, currency, source) VALUES
  ('cw8', '2024-12-31', 680.22, 'EUR', 'manual'),
  ('pea-europe', '2024-12-31', 39.35, 'EUR', 'manual'),
  ('lvmh', '2024-12-31', 488.85, 'EUR', 'manual'),
  ('asml', '2024-12-31', 1511.40, 'EUR', 'manual'),
  ('btc', '2024-12-31', 54400.10, 'EUR', 'manual');

INSERT INTO allocation_targets (bucket, target_percent, min_percent, max_percent) VALUES
  ('ETF', 40, 35, 45),
  ('Actions', 45, 35, 50),
  ('Crypto', 10, 5, 12),
  ('Cash', 5, 5, 15);

INSERT INTO sector_targets (sector, target_percent) VALUES
  ('Luxe', 10),
  ('Technologie', 10),
  ('Santé', 8),
  ('Industrie', 7),
  ('Consommation', 5),
  ('Énergie', 3),
  ('Finance', 2);

INSERT INTO strategy_steps (threshold, title, description, rules_json) VALUES
  (1000, 'Base minimale', 'Éviter la dispersion et expliquer chaque écart.', NULL),
  (2000, 'Base simple', 'Limiter le nombre de lignes.', NULL),
  (3000, 'Première structure', 'Observer ETF, actions et cash.', NULL),
  (4000, 'Structure lisible', 'Vérifier la concentration par ligne.', NULL),
  (5000, 'Construction', 'Construire un socle diversifié.', NULL),
  (10000, 'Accélération', 'Rééquilibrer par apports.', NULL),
  (25000, 'Pilotage régulier', 'Suivre secteurs et performance.', NULL),
  (50000, 'Diversification avancée', 'Rendre les objectifs sectoriels plus précis.', NULL),
  (75000, 'Stabilisation', 'Limiter les grosses concentrations.', NULL),
  (100000, 'Optimisation', 'Stabilité, fiscalité, liquidité et diversification globale.', NULL);

INSERT INTO portfolio_snapshots (date, total_value, invested_capital, performance_amount, performance_percent) VALUES
  ('2024-01-12', 12000.00, 12000.00, 0.00, 0.00),
  ('2024-03-01', 18420.00, 17000.00, 1420.00, 8.35),
  ('2024-06-01', 28350.00, 24000.00, 4350.00, 18.13),
  ('2024-09-01', 38220.00, 32000.00, 6220.00, 19.44),
  ('2024-12-31', 47382.56, 39540.25, 7842.31, 19.81);

INSERT INTO alerts (date, type, severity, message, status) VALUES
  ('2024-12-31', 'sector_concentration', 'danger', 'Concentration actions US élevée (38 % du total). Envisagez plus de diversification géographique.', 'open'),
  ('2024-12-31', 'crypto_allocation', 'warning', 'Exposition crypto au-dessus de votre fourchette cible (10 %). Rééquilibrage conseillé.', 'open'),
  ('2024-12-31', 'cash_level', 'info', 'Liquidités faibles (5 %). Gardez une marge de sécurité pour les opportunités et imprévus.', 'open');

INSERT INTO recommendations (date, contribution_amount, suggestion_json) VALUES
  (
    '2024-12-31',
    1000,
    '{"allocation":[{"label":"ETF monde","value":400},{"label":"Actions qualité","value":350},{"label":"Crypto (BTC/ETH)","value":150},{"label":"Cash (fonds €)","value":100}]}'
  );
