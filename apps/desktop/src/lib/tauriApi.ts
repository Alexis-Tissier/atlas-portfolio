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

export type NewCashTransaction = {
  transaction_type: "deposit" | "withdrawal" | "transfer";
  date: string;
  from_account_id?: string | null;
  to_account_id?: string | null;
  amount: number;
  note?: string | null;
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

export async function createCashTransaction(input: NewCashTransaction) {
  return invoke<string>("create_cash_transaction", { input });
}
