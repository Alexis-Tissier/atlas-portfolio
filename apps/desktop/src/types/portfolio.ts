export type Currency = "EUR";

export type AccountType =
  | "current_account"
  | "pea"
  | "cto"
  | "livret_a"
  | "crypto_wallet";

export type AssetClass = "ETF" | "Actions" | "Crypto" | "Cash";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "buy"
  | "sell"
  | "dividend"
  | "fee";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  cashBalance: number;
  includeInNetWorth: boolean;
};

export type Security = {
  id: string;
  name: string;
  ticker: string;
  isin?: string;
  assetClass: AssetClass;
  sector?: string;
};

export type Position = {
  id: string;
  accountId: string;
  securityId: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
};

export type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
  fromAccountId?: string;
  toAccountId?: string;
  accountId?: string;
  securityId?: string;
  quantity?: number;
  price?: number;
  fees?: number;
  amount: number;
  note?: string;
};

export type AllocationTarget = {
  bucket: AssetClass;
  targetPercent: number;
};

export type SectorTarget = {
  sector: string;
  targetPercent: number;
};

export type StrategyStep = {
  threshold: number;
  title: string;
  description: string;
};

export type PositionRow = {
  asset: string;
  category: AssetClass;
  account: string;
  quantity: string;
  value: string;
  weight: string;
  performance: string;
  rawValue: number;
  rawWeight: number;
};

export type AllocationRow = {
  bucket: AssetClass;
  targetPercent: number;
  value: number;
  actualPercent: number;
  differencePercent: number;
};

export type AccountSummary = {
  id: string;
  name: string;
  type: AccountType;
  cashBalance: number;
  positionsValue: number;
  totalValue: number;
  weight: number;
};

export type PortfolioSummary = {
  total: number;
  performanceAmount: number;
  performancePercent: number;
  startDate: string;
};

export type AttentionPoint = {
  kind: "red" | "yellow" | "blue";
  text: string;
};
