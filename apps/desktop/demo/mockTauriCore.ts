type InvokeArgs = Record<string, any> | undefined;

const round2 = (value: number) => Math.round(value * 100) / 100;

const accounts = [
  { id: "account-current", name: "Compte courant", account_type: "current_account", currency: "EUR", cash_balance: 1534.5, positions_value: 0, total_value: 1534.5, include_in_net_worth: true },
  { id: "account-livret", name: "Livret A", account_type: "livret_a", currency: "EUR", cash_balance: 6976.19, positions_value: 0, total_value: 6976.19, include_in_net_worth: true },
  { id: "account-pea", name: "PEA", account_type: "pea", currency: "EUR", cash_balance: 3812.48, positions_value: 20015.15, total_value: 23827.63, include_in_net_worth: true },
  { id: "account-cto", name: "CTO", account_type: "cto", currency: "EUR", cash_balance: 4500, positions_value: 11659.2, total_value: 16159.2, include_in_net_worth: true },
  { id: "account-pee", name: "PEE", account_type: "pee", currency: "EUR", cash_balance: 10050, positions_value: 50, total_value: 10100, include_in_net_worth: true },
  { id: "account-crypto", name: "Compte crypto", account_type: "crypto_wallet", currency: "EUR", cash_balance: 0, positions_value: 4711.1, total_value: 4711.1, include_in_net_worth: true },
].map((account) => ({ ...account, weight: 0 }));

const securities = [
  { id: "security-asml", name: "ASML Holding", ticker: "ASML.AS", isin: "NL0010273215", asset_class: "Actions", currency: "EUR", current_price: 1457.4 },
  { id: "security-cw8", name: "Amundi MSCI World ETF (CW8)", ticker: "CW8.PA", isin: "LU1681043599", asset_class: "ETF", currency: "EUR", current_price: 680.98 },
  { id: "security-lvmh", name: "LVMH", ticker: "MC.PA", isin: "FR0000121014", asset_class: "Actions", currency: "EUR", current_price: 476.85 },
  { id: "security-btc", name: "Bitcoin (BTC)", ticker: "BTC-EUR", isin: null, asset_class: "Crypto", currency: "EUR", current_price: 55372.55 },
  { id: "security-pceu", name: "Lyxor PEA MSCI Europe (PEA)", ticker: "PCEU.PA", isin: "FR0011869353", asset_class: "ETF", currency: "EUR", current_price: 40.225 },
  { id: "security-fund", name: "Fonds PEE Test", ticker: "FRTESTFUND01", isin: null, asset_class: "Fonds", currency: "EUR", current_price: 10 },
];

const positions = [
  { position_id: "position-asml", account_id: "account-cto", security_id: "security-asml", account_name: "CTO", security_name: "ASML Holding", ticker: "ASML.AS", asset_class: "Actions", quantity: 8, average_price: 502.485, current_price: 1457.4, value: 11659.2, cost: 4019.88, performance_amount: 7639.32, performance_percent: 190.04, price_warning: null, price_source: "yahoo", price_date: "2026-07-31", last_price_symbol: "ASML.AS", price_error: null },
  { position_id: "position-cw8", account_id: "account-pea", security_id: "security-cw8", account_name: "PEA", security_name: "Amundi MSCI World ETF (CW8)", ticker: "CW8.PA", asset_class: "ETF", quantity: 15.2, average_price: 575.3, current_price: 680.98, value: 10350.9, cost: 8744.56, performance_amount: 1606.34, performance_percent: 18.37, price_warning: null, price_source: "yahoo", price_date: "2026-07-31", last_price_symbol: "CW8.PA", price_error: null },
  { position_id: "position-lvmh", account_id: "account-pea", security_id: "security-lvmh", account_name: "PEA", security_name: "LVMH", ticker: "MC.PA", asset_class: "Actions", quantity: 12, average_price: 391.51, current_price: 476.85, value: 5722.2, cost: 4698.12, performance_amount: 1024.08, performance_percent: 21.8, price_warning: null, price_source: "yahoo", price_date: "2026-07-31", last_price_symbol: "MC.PA", price_error: null },
  { position_id: "position-btc", account_id: "account-crypto", security_id: "security-btc", account_name: "Compte crypto", security_name: "Bitcoin (BTC)", ticker: "BTC-EUR", asset_class: "Crypto", quantity: 0.08507, average_price: 39160, current_price: 55372.55, value: 4711.1, cost: 3331.74, performance_amount: 1379.36, performance_percent: 41.4, price_warning: null, price_source: "yahoo", price_date: "2026-07-31", last_price_symbol: "BTC-EUR", price_error: null },
  { position_id: "position-pceu", account_id: "account-pea", security_id: "security-pceu", account_name: "PEA", security_name: "Lyxor PEA MSCI Europe (PEA)", ticker: "PCEU.PA", asset_class: "ETF", quantity: 98, average_price: 57.92, current_price: 40.225, value: 3942.05, cost: 5676.16, performance_amount: -1734.11, performance_percent: -30.55, price_warning: null, price_source: "yahoo", price_date: "2026-07-31", last_price_symbol: "PCEU.PA", price_error: null },
  { position_id: "position-fund", account_id: "account-pee", security_id: "security-fund", account_name: "PEE", security_name: "Fonds PEE Test", ticker: "FRTESTFUND01", asset_class: "Fonds", quantity: 5, average_price: 10, current_price: 10, value: 50, cost: 50, performance_amount: 0, performance_percent: 0, price_warning: "Cours manuel à vérifier", price_source: "manual", price_date: null, last_price_symbol: "FRTESTFUND01", price_error: null },
];

const snapshots = [
  ["2024-01-12", 20100], ["2024-02-01", 21480], ["2024-03-01", 24550], ["2024-04-01", 26790],
  ["2024-05-01", 29650], ["2024-06-01", 32140], ["2024-07-01", 30920], ["2024-08-01", 34480],
  ["2024-09-01", 37120], ["2024-10-01", 39850], ["2024-11-01", 38760], ["2024-12-01", 42840],
  ["2025-01-01", 45220], ["2025-02-01", 43890], ["2025-03-01", 47260], ["2025-04-01", 48930],
  ["2025-05-01", 47820], ["2025-06-01", 51640], ["2025-07-01", 54120], ["2025-08-01", 52880],
  ["2025-09-01", 55740], ["2025-10-01", 57980], ["2025-11-01", 56820], ["2025-12-01", 59460],
  ["2026-01-01", 58220], ["2026-02-01", 60780], ["2026-03-01", 59650], ["2026-04-01", 62110],
  ["2026-05-01", 61480], ["2026-06-01", 62890], ["2026-07-31", 63308.62],
].map(([date, total], index) => ({
  date,
  total_value: total,
  invested_capital: 19606.53 + Math.min(index, 12) * 350,
  performance_amount: total - (19606.53 + Math.min(index, 12) * 350),
  performance_percent: ((total / Math.max(19606.53 + Math.min(index, 12) * 350, 1)) - 1) * 100,
}));

const transactions = [
  { id: "tx-open-current", date: "2024-01-12", transaction_type: "opening_cash", account_id: "account-current", from_account_id: null, to_account_id: null, security_id: null, account_name: "Compte courant", from_account_name: null, to_account_name: null, security_name: null, security_ticker: null, amount: 1534.5, quantity: null, price: null, fees: 0, note: "Solde d’ouverture fictif" },
  { id: "tx-open-livret", date: "2024-01-12", transaction_type: "opening_cash", account_id: "account-livret", from_account_id: null, to_account_id: null, security_id: null, account_name: "Livret A", from_account_name: null, to_account_name: null, security_name: null, security_ticker: null, amount: 6976.19, quantity: null, price: null, fees: 0, note: "Solde d’ouverture fictif" },
  { id: "tx-open-pea-cash", date: "2024-01-12", transaction_type: "opening_cash", account_id: "account-pea", from_account_id: null, to_account_id: null, security_id: null, account_name: "PEA", from_account_name: null, to_account_name: null, security_name: null, security_ticker: null, amount: 3812.48, quantity: null, price: null, fees: 0, note: "Cash d’ouverture fictif" },
  { id: "tx-open-cto-cash", date: "2024-01-12", transaction_type: "opening_cash", account_id: "account-cto", from_account_id: null, to_account_id: null, security_id: null, account_name: "CTO", from_account_name: null, to_account_name: null, security_name: null, security_ticker: null, amount: 4500, quantity: null, price: null, fees: 0, note: "Cash d’ouverture fictif" },
  { id: "tx-open-pee-cash", date: "2024-01-12", transaction_type: "opening_cash", account_id: "account-pee", from_account_id: null, to_account_id: null, security_id: null, account_name: "PEE", from_account_name: null, to_account_name: null, security_name: null, security_ticker: null, amount: 10050, quantity: null, price: null, fees: 0, note: "Cash d’ouverture fictif" },
  ...positions.map((position, index) => ({
    id: `tx-open-position-${index}`,
    date: "2024-01-12",
    transaction_type: "opening_position",
    account_id: position.account_id,
    from_account_id: null,
    to_account_id: null,
    security_id: position.security_id,
    account_name: position.account_name,
    from_account_name: null,
    to_account_name: null,
    security_name: position.security_name,
    security_ticker: position.ticker,
    amount: position.cost,
    quantity: position.quantity,
    price: position.average_price,
    fees: 0,
    note: "Position d’ouverture fictive",
  })),
  { id: "tx-dividend-lvmh", date: "2025-04-24", transaction_type: "dividend", account_id: "account-pea", from_account_id: null, to_account_id: "account-pea", security_id: "security-lvmh", account_name: "PEA", from_account_name: null, to_account_name: "PEA", security_name: "LVMH", security_ticker: "MC.PA", amount: 82.94, quantity: null, price: null, fees: 0, note: "Dividende fictif" },
  { id: "tx-fee", date: "2025-05-02", transaction_type: "fee", account_id: "account-pea", from_account_id: "account-pea", to_account_id: null, security_id: null, account_name: "PEA", from_account_name: "PEA", to_account_name: null, security_name: null, security_ticker: null, amount: 4.07, quantity: null, price: null, fees: 0, note: "Frais fictifs" },
];

function allocationRows(filteredPositions = positions, filteredAccounts = accounts) {
  const total = filteredAccounts.reduce((sum, account) => sum + account.total_value, 0);
  const values = new Map<string, number>();
  for (const position of filteredPositions) values.set(position.asset_class, (values.get(position.asset_class) ?? 0) + position.value);
  values.set("Cash", filteredAccounts.reduce((sum, account) => sum + account.cash_balance, 0));
  const targets: Record<string, number> = { ETF: 40, Actions: 45, Crypto: 10, Cash: 5, Fonds: 0 };
  return ["ETF", "Actions", "Crypto", "Cash", "Fonds"].map((bucket) => {
    const value = values.get(bucket) ?? 0;
    const actual = total > 0 ? value / total * 100 : 0;
    const target = targets[bucket] ?? 0;
    return { bucket, target_percent: target, value, actual_percent: actual, difference_percent: actual - target };
  });
}

function dashboardFor(accountIds?: string[]) {
  const selectedAccounts = accountIds?.length ? accounts.filter((account) => accountIds.includes(account.id)) : accounts;
  const selectedIds = new Set(selectedAccounts.map((account) => account.id));
  const selectedPositions = positions.filter((position) => selectedIds.has(position.account_id));
  const total = selectedAccounts.reduce((sum, account) => sum + account.total_value, 0);
  const selectedCost = selectedPositions.reduce((sum, position) => sum + position.cost, 0) + selectedAccounts.reduce((sum, account) => sum + account.cash_balance, 0);
  const dashboardAccounts = selectedAccounts.map((account) => ({ ...account, weight: total > 0 ? account.total_value / total * 100 : 0 }));
  return {
    summary: accountIds?.length ? {
      total,
      performance_amount: total - selectedCost,
      performance_percent: selectedCost > 0 ? (total - selectedCost) / selectedCost * 100 : 0,
      start_date: "2024-01-12",
    } : {
      total: 63308.62,
      performance_amount: 43702.08,
      performance_percent: 222.9,
      start_date: "2024-01-12",
    },
    positions: selectedPositions.map((position) => ({
      asset: position.security_name,
      category: position.asset_class,
      account: position.account_name,
      quantity: position.quantity,
      value: position.value,
      weight: total > 0 ? position.value / total * 100 : 0,
      performance_percent: position.performance_percent,
    })),
    allocation: allocationRows(selectedPositions, selectedAccounts),
    accounts: dashboardAccounts,
    snapshots: snapshots.map((snapshot) => ({ ...snapshot, total_value: accountIds?.length ? snapshot.total_value * (total / 63308.62) : snapshot.total_value })),
  };
}

function marketHistory(symbol: string, period: string) {
  const base = symbol.toUpperCase().includes("BTC") ? 47000 : symbol.toUpperCase().includes("MC") ? 430 : 180;
  const count = period === "1M" ? 24 : period === "6M" ? 36 : period === "1A" ? 52 : 72;
  const now = Math.floor(Date.now() / 1000);
  const points = Array.from({ length: count }, (_, index) => {
    const trend = base * (0.86 + index / count * 0.18);
    const wave = Math.sin(index * 0.72) * base * 0.025 + Math.sin(index * 0.19) * base * 0.016;
    return { timestamp: now - (count - index) * 86400 * 5, close: round2(trend + wave) };
  });
  return { symbol, currency: "EUR", source: "demo", used_symbol: symbol, current_price: points.at(-1)?.close ?? base, points };
}

export async function invoke<T>(command: string, args?: InvokeArgs): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, command.startsWith("get_") ? 35 : 80));

  switch (command) {
    case "get_accounts":
      return accounts.map(({ positions_value, total_value, weight, ...account }) => account) as T;
    case "get_portfolio_overview":
      return accounts.map((account) => ({ source: "account", label: account.name, value: account.total_value })) as T;
    case "get_dashboard_data":
      return dashboardFor() as T;
    case "get_scoped_dashboard_data":
      return dashboardFor(args?.accountIds ?? args?.account_ids ?? []) as T;
    case "get_transactions":
      return transactions as T;
    case "get_securities":
      return securities as T;
    case "get_positions_page":
      return positions as T;
    case "search_online_assets": {
      const query = String(args?.query ?? "").toUpperCase();
      const results = [
        { symbol: "AI.PA", name: "Air Liquide", asset_class: "Actions", region: "France", currency: "EUR", source: "demo", match_score: 1 },
        { symbol: "MC.PA", name: "LVMH", asset_class: "Actions", region: "France", currency: "EUR", source: "demo", match_score: .96 },
        { symbol: "CW8.PA", name: "Amundi MSCI World ETF", asset_class: "ETF", region: "France", currency: "EUR", source: "demo", match_score: .93 },
        { symbol: "BTC-EUR", name: "Bitcoin EUR", asset_class: "Crypto", region: "Monde", currency: "EUR", source: "demo", match_score: .9 },
      ];
      return results.filter((item) => !query || item.symbol.includes(query) || item.name.toUpperCase().includes(query)) as T;
    }
    case "lookup_online_asset_history":
      return marketHistory(String(args?.symbol ?? "AI.PA"), String(args?.period ?? "6M")) as T;
    case "lookup_online_asset_quote": {
      const history = marketHistory(String(args?.symbol ?? "AI.PA"), "1M");
      return { symbol: history.symbol, price: history.current_price, source: "demo", used_symbol: history.symbol } as T;
    }
    case "update_open_position_prices":
      return { updated_at: new Date().toISOString(), updated_count: positions.length - 1, skipped_count: 1, error_count: 0, updated: [], errors: [] } as T;
    case "create_opening_position_adjustments":
    case "create_opening_cash_adjustments":
      return 0 as T;
    case "create_cash_transaction":
    case "create_trade_transaction":
    case "update_transaction":
    case "delete_transaction":
      return "demo-operation" as T;
    case "import_transactions_batch":
      return { imported_count: Array.isArray(args?.inputs) ? args.inputs.length : 0, backup_path: "Mode démo : aucune base modifiée" } as T;
    case "create_account":
    case "update_account":
      return { id: "account-demo", name: args?.input?.name ?? "Compte démo", account_type: args?.input?.account_type ?? "other", currency: "EUR", cash_balance: 0, include_in_net_worth: true } as T;
    case "create_security":
    case "create_security_from_online_result":
      return { id: "security-demo", name: args?.input?.name ?? "Actif démo", ticker: args?.input?.ticker ?? args?.input?.symbol ?? "DEMO", isin: null, asset_class: args?.input?.asset_class ?? "Actions", currency: "EUR", current_price: args?.input?.current_price ?? 100 } as T;
    default:
      console.info(`[Atlas web demo] commande simulée : ${command}`, args ?? {});
      if (command.startsWith("get_") || command.startsWith("list_")) return [] as T;
      return null as T;
  }
}
