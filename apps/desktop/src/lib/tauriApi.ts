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

export async function getAccounts() {
  return invoke<DbAccount[]>("get_accounts");
}

export async function getPortfolioOverview() {
  return invoke<PortfolioOverviewRow[]>("get_portfolio_overview");
}
