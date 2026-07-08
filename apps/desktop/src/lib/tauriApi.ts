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
};

export type DbTransaction = {
  id: string;
  date: string;
  transaction_type: string;
  account_name: string | null;
  from_account_name: string | null;
  to_account_name: string | null;
  security_name: string | null;
  amount: number;
  quantity: number | null;
  price: number | null;
  fees: number;
  note: string | null;
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

export type NewOnlineSecurity = {
  symbol: string;
  name: string;
  asset_class: string;
  currency: string;
  region?: string | null;
};

export type NewCashTransaction = {
  transaction_type: "deposit" | "withdrawal" | "transfer";
  date: string;
  from_account_id?: string | null;
  to_account_id?: string | null;
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

export async function createSecurityFromOnlineResult(input: NewOnlineSecurity) {
  return invoke<DbSecurity>("create_security_from_online_result", { input });
}
