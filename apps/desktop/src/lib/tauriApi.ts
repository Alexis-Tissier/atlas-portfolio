import { invoke } from "@tauri-apps/api/core";

export type DbAccount = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
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
  currency: string;
  cash_balance: number;
  positions_value: number;
  total_value: number;
  weight: number;
  include_in_net_worth: boolean;
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
  isin: string | null;
  asset_class: string;
  currency: string;
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

export type BatchImportResult = {
  imported_count: number;
  backup_path: string;
};

export type NewSecurityInput = {
  name: string;
  ticker: string;
  isin?: string | null;
  asset_class:
    | "ETF"
    | "Actions"
    | "Fonds"
    | "Obligations"
    | "Monétaire"
    | "Immobilier"
    | "Matières premières"
    | "Crypto"
    | "Cash"
    | "Autre";
  currency: string;
  current_price: number;
};

export type NewAccountInput = {
  name: string;
  account_type: "current_account" | "pea" | "pea_pme" | "cto" | "pee" | "per" | "assurance_vie" | "livret_a" | "ldds" | "pel" | "savings_account" | "crypto_wallet" | "other";
  currency: string;
  initial_cash: number;
  opening_date: string;
  include_in_net_worth: boolean;
};

export type UpdateAccountInput = {
  id: string;
  name: string;
  account_type: "current_account" | "pea" | "pea_pme" | "cto" | "pee" | "per" | "assurance_vie" | "livret_a" | "ldds" | "pel" | "savings_account" | "crypto_wallet" | "other";
  currency: string;
  include_in_net_worth: boolean;
};

type ExternalFlow = {
  date: string;
  amount: number;
};

type TwrPoint = {
  date: string;
  totalValue: number;
  investedCapital: number;
  snapshotIndex: number | null;
};

const millisecondsPerDay = 86_400_000;

function performanceTimestamp(value: string) {
  const timestamp = new Date(`${value}T12:00:00Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function accountIsInPerformanceScope(
  accountId: string | null,
  selectedAccountIds: Set<string>,
) {
  return accountId !== null && selectedAccountIds.has(accountId);
}

function externalFlowForTransaction(
  transaction: DbTransaction,
  selectedAccountIds: Set<string>,
): number {
  const amount = Number(transaction.amount);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const accountSelected = accountIsInPerformanceScope(
    transaction.account_id,
    selectedAccountIds,
  );
  const fromSelected = accountIsInPerformanceScope(
    transaction.from_account_id,
    selectedAccountIds,
  );
  const toSelected = accountIsInPerformanceScope(
    transaction.to_account_id,
    selectedAccountIds,
  );

  if (transaction.transaction_type === "opening_cash") {
    return accountSelected || toSelected ? safeAmount : 0;
  }

  if (transaction.transaction_type === "opening_position") {
    if (!accountSelected) return 0;

    const quantity = Number(transaction.quantity ?? 0);
    const price = Number(transaction.price ?? 0);
    const openingCost = quantity * price;

    return Number.isFinite(openingCost) ? openingCost : 0;
  }

  if (transaction.transaction_type === "deposit") {
    const targetSelected =
      toSelected || (transaction.to_account_id === null && accountSelected);
    return targetSelected ? safeAmount : 0;
  }

  if (transaction.transaction_type === "withdrawal") {
    const sourceSelected =
      fromSelected || (transaction.from_account_id === null && accountSelected);
    return sourceSelected ? -safeAmount : 0;
  }

  if (transaction.transaction_type === "transfer") {
    if (fromSelected && !toSelected) return -safeAmount;
    if (!fromSelected && toSelected) return safeAmount;
  }

  return 0;
}

function buildExternalFlows(
  transactions: DbTransaction[],
  selectedAccountIds: Set<string>,
): ExternalFlow[] {
  return transactions
    .map((transaction) => ({
      date: transaction.date,
      amount: externalFlowForTransaction(transaction, selectedAccountIds),
    }))
    .filter(
      (flow) =>
        performanceTimestamp(flow.date) > 0
        && Number.isFinite(flow.amount)
        && Math.abs(flow.amount) > 0.000001,
    )
    .sort(
      (left, right) =>
        performanceTimestamp(left.date) - performanceTimestamp(right.date),
    );
}

function modifiedDietzReturn(
  previous: TwrPoint,
  current: TwrPoint,
  flows: ExternalFlow[],
) {
  const startTimestamp = performanceTimestamp(previous.date);
  const endTimestamp = performanceTimestamp(current.date);
  const durationDays = Math.max(
    (endTimestamp - startTimestamp) / millisecondsPerDay,
    1,
  );

  const intervalFlows = flows.filter((flow) => {
    const timestamp = performanceTimestamp(flow.date);
    return timestamp > startTimestamp && timestamp <= endTimestamp;
  });

  const transactionFlowTotal = intervalFlows.reduce(
    (sum, flow) => sum + flow.amount,
    0,
  );
  const capitalDelta = current.investedCapital - previous.investedCapital;
  const unrecordedFlow = capitalDelta - transactionFlowTotal;
  const allFlows =
    Math.abs(unrecordedFlow) > 0.01
      ? [...intervalFlows, { date: current.date, amount: unrecordedFlow }]
      : intervalFlows;

  const totalFlow = allFlows.reduce((sum, flow) => sum + flow.amount, 0);
  const weightedFlow = allFlows.reduce((sum, flow) => {
    const flowTimestamp = performanceTimestamp(flow.date);
    const remainingDays = Math.max(
      (endTimestamp - flowTimestamp) / millisecondsPerDay,
      0,
    );
    const weight = Math.min(Math.max(remainingDays / durationDays, 0), 1);
    return sum + flow.amount * weight;
  }, 0);

  const denominator = previous.totalValue + weightedFlow;

  if (!Number.isFinite(denominator) || Math.abs(denominator) <= 0.000001) {
    return 0;
  }

  const periodReturn =
    (current.totalValue - previous.totalValue - totalFlow) / denominator;

  return Number.isFinite(periodReturn) && periodReturn > -1
    ? periodReturn
    : 0;
}

function applyTimeWeightedPerformance(
  data: DashboardData,
  transactions: DbTransaction[],
  scopedAccountIds?: string[],
): DashboardData {
  const selectedAccountIds = new Set(
    scopedAccountIds
      ?? data.accounts
        .filter((account) => account.include_in_net_worth)
        .map((account) => account.id),
  );

  if (selectedAccountIds.size === 0) return data;

  const snapshots = data.snapshots.map((snapshot) => ({ ...snapshot }));
  const points = snapshots
    .map<TwrPoint | null>((snapshot, snapshotIndex) => {
      const totalValue = Number(snapshot.total_value);
      const investedCapital = Number(snapshot.invested_capital);

      if (
        performanceTimestamp(snapshot.date) <= 0
        || !Number.isFinite(totalValue)
        || snapshot.invested_capital === null
        || !Number.isFinite(investedCapital)
      ) {
        return null;
      }

      return {
        date: snapshot.date,
        totalValue,
        investedCapital,
        snapshotIndex,
      };
    })
    .filter((point): point is TwrPoint => point !== null)
    .sort(
      (left, right) =>
        performanceTimestamp(left.date) - performanceTimestamp(right.date),
    );

  if (points.length === 0) return data;

  const currentInvestedCapital =
    data.summary.total - data.summary.performance_amount;
  const today = new Date().toISOString().slice(0, 10);
  const lastPoint = points[points.length - 1];

  if (
    Number.isFinite(data.summary.total)
    && Number.isFinite(currentInvestedCapital)
    && (
      performanceTimestamp(today) > performanceTimestamp(lastPoint.date)
      || Math.abs(data.summary.total - lastPoint.totalValue) > 0.005
      || Math.abs(currentInvestedCapital - lastPoint.investedCapital) > 0.005
    )
  ) {
    points.push({
      date: today,
      totalValue: data.summary.total,
      investedCapital: currentInvestedCapital,
      snapshotIndex: null,
    });
  }

  const flows = buildExternalFlows(transactions, selectedAccountIds);
  const firstPoint = points[0];
  const firstStoredPerformanceValue =
    firstPoint.snapshotIndex === null
      ? null
      : snapshots[firstPoint.snapshotIndex].performance_percent;
  const firstStoredPerformance =
    firstStoredPerformanceValue === null
      ? null
      : Number(firstStoredPerformanceValue);
  const startTimestamp = performanceTimestamp(data.summary.start_date);
  const firstTimestamp = performanceTimestamp(firstPoint.date);

  let cumulativeFactor = 1;

  // Si l'historique de snapshots commence après le début réel du portefeuille,
  // on conserve la performance déjà connue au premier snapshot comme base.
  // Les périodes suivantes neutralisent les flux avec Modified Dietz ; lorsque
  // chaque flux externe dispose d'un snapshot, le résultat converge vers le TWR exact.
  if (firstTimestamp > startTimestamp) {
    if (
      firstStoredPerformance !== null
      && Number.isFinite(firstStoredPerformance)
    ) {
      cumulativeFactor = Math.max(1 + firstStoredPerformance / 100, 0.000001);
    } else if (Math.abs(firstPoint.investedCapital) > 0.000001) {
      cumulativeFactor = Math.max(
        firstPoint.totalValue / firstPoint.investedCapital,
        0.000001,
      );
    }
  }

  if (firstPoint.snapshotIndex !== null) {
    snapshots[firstPoint.snapshotIndex].performance_percent =
      (cumulativeFactor - 1) * 100;
  }

  for (let index = 1; index < points.length; index += 1) {
    const periodReturn = modifiedDietzReturn(
      points[index - 1],
      points[index],
      flows,
    );
    cumulativeFactor *= 1 + periodReturn;

    const snapshotIndex = points[index].snapshotIndex;
    if (snapshotIndex !== null) {
      snapshots[snapshotIndex].performance_percent =
        (cumulativeFactor - 1) * 100;
    }
  }

  return {
    ...data,
    summary: {
      ...data.summary,
      performance_percent: (cumulativeFactor - 1) * 100,
    },
    snapshots,
  };
}

export async function getAccounts() {
  return invoke<DbAccount[]>("get_accounts");
}

export async function createAccount(input: NewAccountInput) {
  return invoke<DbAccount>("create_account", { input });
}

export async function updateAccount(input: UpdateAccountInput) {
  return invoke<DbAccount>("update_account", { input });
}

export async function getPortfolioOverview() {
  return invoke<PortfolioOverviewRow[]>("get_portfolio_overview");
}

export async function getDashboardData() {
  const [data, transactions] = await Promise.all([
    invoke<DashboardData>("get_dashboard_data"),
    invoke<DbTransaction[]>("get_transactions"),
  ]);

  return applyTimeWeightedPerformance(data, transactions);
}

export async function getScopedDashboardData(accountIds: string[]) {
  const [data, transactions] = await Promise.all([
    invoke<DashboardData>("get_scoped_dashboard_data", { accountIds }),
    invoke<DbTransaction[]>("get_transactions"),
  ]);

  return applyTimeWeightedPerformance(data, transactions, accountIds);
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

export async function importTransactionsBatch(
  inputs: Array<NewCashTransaction | NewTradeTransaction>,
) {
  return invoke<BatchImportResult>("import_transactions_batch", { inputs });
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
