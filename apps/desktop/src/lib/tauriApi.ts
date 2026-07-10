import { invoke } from "@tauri-apps/api/core";

export type DbAccount = {
  id: string;
  name: string;
  account_type: string;
  cash_balance: number;
  include_in_net_worth: boolean;
};

export type PortfolioOverviewRow = {
  source: string;
  label: string;
  value: number;
};

export type DashboardSummary = {
  total: number;
  performance_amount: number;
  performance_percent: number;
  start_date: string;
};

export type DashboardPosition = {
  asset: string;
  category: string;
  account: string;
  quantity: number;
  value: number;
  weight: number;
  performance_percent: number;
};

export type DashboardAllocation = {
  bucket: string;
  target_percent: number;
  value: number;
  actual_percent: number;
  difference_percent: number;
};

export type DashboardSnapshot = {
  date: string;
  total_value: number;
  invested_capital: number | null;
  performance_amount: number | null;
  performance_percent: number | null;
};

export type DashboardAccount = {
  id: string;
  name: string;
  account_type: string;
  cash_balance: number;
  positions_value: number;
  total_value: number;
  weight: number;
};

export type DashboardData = {
  summary: DashboardSummary;
  positions: DashboardPosition[];
  allocation: DashboardAllocation[];
  accounts: DashboardAccount[];
  snapshots: DashboardSnapshot[];
};

export type DbTransaction = {
  id: string;
  date: string;
  transaction_type: string;
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  security_id: string | null;
  account_name: string | null;
  from_account_name: string | null;
  to_account_name: string | null;
  security_name: string | null;
  security_ticker: string | null;
  amount: number;
  quantity: number | null;
  price: number | null;
  fees: number;
  note: string | null;
};

export type UpdateTransactionInput = {
  id: string;
  transaction_type: "deposit" | "withdrawal" | "transfer" | "buy" | "sell" | "dividend" | "fee";
  date: string;
  account_id?: string | null;
  from_account_id?: string | null;
  to_account_id?: string | null;
  security_id?: string | null;
  amount?: number | null;
  quantity?: number | null;
  price?: number | null;
  fees?: number;
  note?: string | null;
};

export type DbSecurity = {
  id: string;
  name: string;
  ticker: string;
  asset_class: string;
  current_price: number;
};

export type OnlineAssetSearchResult = {
  symbol: string;
  name: string;
  asset_class: string;
  region: string;
  currency: string;
  source: string;
  match_score: number;
};

export type OnlineAssetHistoryPoint = {
  timestamp: number;
  close: number;
};

export type OnlineAssetHistory = {
  symbol: string;
  currency: string;
  source: string;
  used_symbol: string;
  current_price: number;
  points: OnlineAssetHistoryPoint[];
};

export type OnlineAssetQuote = {
  symbol: string;
  price: number;
  source: string;
  used_symbol: string;
};

export type NewOnlineSecurity = {
  symbol: string;
  name: string;
  asset_class: string;
  currency: string;
  region?: string | null;
};


export type PriceUpdateLine = {
  security_id: string;
  name: string;
  ticker: string;
  old_price: number;
  new_price: number;
  source: string;
  used_symbol: string;
};

export type PriceUpdateError = {
  security_id: string;
  name: string;
  ticker: string;
  used_symbol: string;
  message: string;
};

export type PriceUpdateSummary = {
  updated_at: string;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  updated: PriceUpdateLine[];
  errors: PriceUpdateError[];
};

export type PositionPageRow = {
  position_id: string;
  account_id: string;
  security_id: string;
  account_name: string;
  security_name: string;
  ticker: string;
  asset_class: string;
  quantity: number;
  average_price: number;
  current_price: number;
  value: number;
  cost: number;
  performance_amount: number;
  performance_percent: number;
  price_warning: string | null;
  price_source: string | null;
  price_date: string | null;
};

export type NewCashTransaction = {
  transaction_type: "deposit" | "withdrawal" | "transfer" | "dividend" | "fee";
  date: string;
  from_account_id?: string | null;
  to_account_id?: string | null;
  security_id?: string | null;
  amount: number;
  note?: string | null;
};

export type NewTradeTransaction = {
  transaction_type: "buy" | "sell";
  date: string;
  account_id: string;
  security_id: string;
  quantity: number;
  price: number;
  fees: number;
  note?: string | null;
};

export type NewSecurityInput = {
  name: string;
  ticker: string;
  asset_class: "ETF" | "Actions" | "Crypto" | "Cash";
  currency: string;
  current_price: number;
};

export async function getAccounts() {
  return invoke<DbAccount[]>("get_accounts");
}

export async function getPortfolioOverview() {
  return invoke<PortfolioOverviewRow[]>("get_portfolio_overview");
}

export async function getDashboardData() {
  return invoke<DashboardData>("get_dashboard_data");
}

export async function getTransactions() {
  return invoke<DbTransaction[]>("get_transactions");
}

export async function getSecurities() {
  return invoke<DbSecurity[]>("get_securities");
}

export async function getPositionsPage() {
  return invoke<PositionPageRow[]>("get_positions_page");
}

export async function createCashTransaction(input: NewCashTransaction) {
  return invoke<string>("create_cash_transaction", { input });
}

export async function createTradeTransaction(input: NewTradeTransaction) {
  return invoke<string>("create_trade_transaction", { input });
}

export async function createSecurity(input: NewSecurityInput) {
  return invoke<DbSecurity>("create_security", { input });
}

export async function searchOnlineAssets(query: string) {
  return invoke<OnlineAssetSearchResult[]>("search_online_assets", { query });
}

export async function lookupOnlineAssetHistory(symbol: string, period: string) {
  return invoke<OnlineAssetHistory>("lookup_online_asset_history", { symbol, period });
}

export async function lookupOnlineAssetQuote(symbol: string) {
  return invoke<OnlineAssetQuote>("lookup_online_asset_quote", { symbol });
}

export async function createSecurityFromOnlineResult(input: NewOnlineSecurity) {
  return invoke<DbSecurity>("create_security_from_online_result", { input });
}


export async function updateOpenPositionPrices() {
  return invoke<PriceUpdateSummary>("update_open_position_prices");
}


export async function updateTransaction(input: UpdateTransactionInput) {
  return invoke<string>("update_transaction", { input });
}

export async function deleteTransaction(transactionId: string) {
  return invoke<string>("delete_transaction", { transactionId });
}


export async function createOpeningPositionAdjustments() {
  return invoke<number>("create_opening_position_adjustments");
}

export async function createOpeningCashAdjustments() {
  return invoke<number>("create_opening_cash_adjustments");
}
