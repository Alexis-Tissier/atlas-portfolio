-- Atlas Portfolio
-- Migration 001 - initial SQLite schema
-- Public-safe: schema only, no personal data.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('current_account', 'pea', 'cto', 'livret_a', 'crypto_wallet')
  ),
  currency TEXT NOT NULL DEFAULT 'EUR',
  cash_balance REAL NOT NULL DEFAULT 0,
  include_in_net_worth INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS securities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  isin TEXT,
  asset_class TEXT NOT NULL CHECK (
    asset_class IN ('ETF', 'Actions', 'Crypto', 'Cash')
  ),
  sector TEXT,
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  average_price REAL NOT NULL DEFAULT 0,
  current_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('deposit', 'withdrawal', 'transfer', 'buy', 'sell', 'dividend', 'fee', 'opening_position', 'opening_cash')
  ),
  from_account_id TEXT,
  to_account_id TEXT,
  account_id TEXT,
  security_id TEXT,
  quantity REAL,
  price REAL,
  fees REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  security_id TEXT NOT NULL,
  date TEXT NOT NULL,
  close_price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (security_id, date, source),
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS allocation_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket TEXT NOT NULL CHECK (
    bucket IN ('ETF', 'Actions', 'Crypto', 'Cash')
  ),
  target_percent REAL NOT NULL,
  min_percent REAL,
  max_percent REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sector_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sector TEXT NOT NULL,
  target_percent REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS strategy_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threshold REAL NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rules_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  total_value REAL NOT NULL,
  invested_capital REAL,
  performance_amount REAL,
  performance_percent REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'danger')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'resolved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  contribution_amount REAL,
  suggestion_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS price_update_status (
  security_id TEXT PRIMARY KEY,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider TEXT NOT NULL DEFAULT '',
  used_symbol TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  old_price REAL NOT NULL DEFAULT 0,
  new_price REAL,
  message TEXT,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_positions_account ON positions(account_id);
CREATE INDEX IF NOT EXISTS idx_positions_security ON positions(security_id);
CREATE INDEX IF NOT EXISTS idx_prices_security_date ON prices(security_id, date);
