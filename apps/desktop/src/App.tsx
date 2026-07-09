import { FormEvent, useEffect, useState } from "react";
import "./App.css";
import { attentionPoints, monthlyContribution } from "./mocks/mockPortfolio";
import { formatEuro, getAllocationRows, getPositionRows, getPortfolioSummary } from "./core/portfolioCalculations";
import {
  createCashTransaction,
  createSecurityFromOnlineResult,
  createTradeTransaction,
  createOpeningPositionAdjustments,
  deleteTransaction,
  getDashboardData,
  getPositionsPage,
  getSecurities,
  getTransactions,
  searchOnlineAssets,
  updateTransaction,
  updateOpenPositionPrices,
  type DashboardData,
  type DbSecurity,
  type DbTransaction,
  type NewCashTransaction,
  type NewTradeTransaction,
  type UpdateTransactionInput,
  type PriceUpdateSummary,
  type PositionPageRow,
  type OnlineAssetSearchResult,
} from "./lib/tauriApi";

const nav = [
  "Portefeuille",
  "Aperçu",
  "Positions",
  "Transactions",
  "Répartition",
  "Performance",
  "Objectifs",
  "Recommandations",
  "Journal",
];

type TransactionFormType = "deposit" | "withdrawal" | "transfer" | "buy" | "sell";
type CashTransactionType = "deposit" | "withdrawal" | "transfer";

type AllocationDisplayRow = {
  bucket: string;
  targetPercent: number;
  actualPercent?: number;
  differencePercent?: number;
  value?: number;
};

type CsvImportCandidate = {
  row: Record<string, string>;
  status: "valid" | "error";
  message: string;
  payload?: NewCashTransaction | NewTradeTransaction;
};

type PortfolioAuditItem = {
  kind: "position" | "cash" | "warning";
  label: string;
  journalValue: string;
  currentValue: string;
  difference: string;
  status: "ok" | "warning" | "info";
  message: string;
};

type RebuiltPosition = {
  accountName: string;
  securityName: string;
  quantity: number;
  cost: number;
};


function App() {
  const [currentPage, setCurrentPage] = useState("Portefeuille");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [securities, setSecurities] = useState<DbSecurity[]>([]);
  const [positionsPageRows, setPositionsPageRows] = useState<PositionPageRow[]>([]);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [priceUpdateSummary, setPriceUpdateSummary] = useState<PriceUpdateSummary | null>(null);
  const [priceUpdateError, setPriceUpdateError] = useState<string | null>(null);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  async function refreshData() {
    try {
      const data = await getDashboardData();
      setDashboardData(data);
      setDatabaseError(null);
    } catch (error) {
      console.error(error);
      setDatabaseError(String(error));
    }

    try {
      const data = await getTransactions();
      setTransactions(data);
      setTransactionsError(null);
    } catch (error) {
      console.error(error);
      setTransactionsError(String(error));
    }

    try {
      const data = await getSecurities();
      setSecurities(data);
    } catch (error) {
      console.error(error);
    }

    try {
      const data = await getPositionsPage();
      setPositionsPageRows(data);
      setPositionsError(null);
    } catch (error) {
      console.error(error);
      setPositionsError(String(error));
    }
  }


  async function refreshOpenPositionPrices(silent = false) {
    setIsUpdatingPrices(true);

    try {
      const summary = await updateOpenPositionPrices();
      setPriceUpdateSummary(summary);
      setPriceUpdateError(null);
      await refreshData();
    } catch (error) {
      if (!silent) {
        console.error(error);
      }
      setPriceUpdateError(String(error));
    } finally {
      setIsUpdatingPrices(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await refreshData();

      if (!cancelled) {
        await refreshOpenPositionPrices(true);
      }
    }

    bootstrap();

    const intervalId = window.setInterval(() => {
      if (!cancelled) {
        refreshOpenPositionPrices(true);
      }
    }, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const mockSummary = getPortfolioSummary();
  const mockPositionRows = getPositionRows();
  const mockAllocationRows = getAllocationRows();

  const summary = dashboardData?.summary ?? {
    total: mockSummary.total,
    performance_amount: mockSummary.performanceAmount,
    performance_percent: mockSummary.performancePercent,
    start_date: mockSummary.startDate,
  };

  const positionRows = dashboardData
    ? dashboardData.positions.map((position) => ({
        asset: position.asset,
        category: position.category,
        account: position.account,
        quantity: formatQuantity(position.quantity),
        value: displayEuro(position.value, isPrivacyMode),
        weight: formatUnsignedPercent(position.weight),
        performance: formatSignedPercent(position.performance_percent),
      }))
    : mockPositionRows;

  const allocationRows = dashboardData
    ? dashboardData.allocation.map((row) => ({
        bucket: row.bucket,
        targetPercent: row.target_percent,
        actualPercent: row.actual_percent,
        differencePercent: row.difference_percent,
        value: row.value,
      }))
    : mockAllocationRows;

  const accounts = dashboardData?.accounts ?? [];
  const chartSnapshots = dashboardData?.snapshots ?? [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav className="nav">
          {nav.map((item) => (
            <button
              className={item === currentPage ? "nav-link active" : "nav-link"}
              key={item}
              onClick={() => setCurrentPage(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <button
          className={currentPage === "Importer / Exporter" ? "nav-link active" : "nav-link"}
          onClick={() => setCurrentPage("Importer / Exporter")}
        >
          Importer / Exporter
        </button>
        <button className="nav-link">Paramètres</button>

        <div className="local-data">
          <span className={dashboardData ? "green-dot" : "warning-dot"} />
          <div>
            <strong>{dashboardData ? "Portefeuille local" : "Portefeuille local"}</strong>
            <p>{dashboardData ? "Données à jour" : "Données de démonstration"}</p>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button>‹</button>
            <button>›</button>
            <strong>Atlas Portfolio</strong>
          </div>

          <div className="top-right">
            <div className="search">⌕ Rechercher...</div>
            <button>☼</button>
            <button
              className={isPrivacyMode ? "privacy-toggle active" : "privacy-toggle"}
              onClick={() => setIsPrivacyMode((value) => !value)}
              title={isPrivacyMode ? "Afficher les montants" : "Masquer les montants"}
              type="button"
            >
              {isPrivacyMode ? "•••" : "♢"}
            </button>
            <div className="avatar">AP</div>
          </div>
        </header>

        {currentPage === "Performance" ? (
          <PerformancePage
            allocationRows={allocationRows}
            isPrivacyMode={isPrivacyMode}
            positions={positionsPageRows}
            snapshots={chartSnapshots}
            summary={summary}
            transactions={transactions}
          />
        ) : currentPage === "Positions" ? (
          <PositionsPage positions={positionsPageRows} positionsError={positionsError} priceUpdateSummary={priceUpdateSummary} isPrivacyMode={isPrivacyMode} />
        ) : currentPage === "Transactions" ? (
          <TransactionsPage
            accounts={accounts}
            isPrivacyMode={isPrivacyMode}
            onTransactionCreated={refreshData}
            securities={securities}
            transactions={transactions}
            transactionsError={transactionsError}
          />
        ) : currentPage === "Journal" ? (
          <PortfolioAuditPage
            accounts={accounts}
            isPrivacyMode={isPrivacyMode}
            onRefresh={refreshData}
            positions={positionsPageRows}
            transactions={transactions}
          />
        ) : currentPage === "Importer / Exporter" ? (
          <ImportExportPage
            accounts={accounts}
            onImported={refreshData}
            positions={positionsPageRows}
            securities={securities}
            transactions={transactions}
          />
        ) : currentPage === "Portefeuille" ? (
          <DashboardPage
            accounts={accounts}
            allocationRows={allocationRows}
            databaseError={databaseError}
            dashboardData={dashboardData}
            isPrivacyMode={isPrivacyMode}
            positionRows={positionRows}
            summary={summary}
            snapshots={chartSnapshots}
            isUpdatingPrices={isUpdatingPrices}
            onPriceRefresh={() => refreshOpenPositionPrices(false)}
            priceUpdateError={priceUpdateError}
            priceUpdateSummary={priceUpdateSummary}
          />
        ) : (
          <PlaceholderPage title={currentPage} />
        )}
      </main>
    </div>
  );
}

function DashboardPage({
  accounts,
  allocationRows,
  databaseError,
  dashboardData,
  isPrivacyMode,
  isUpdatingPrices,
  onPriceRefresh,
  positionRows,
  priceUpdateError,
  priceUpdateSummary,
  summary,
  snapshots,
}: {
  accounts: DashboardData["accounts"];
  allocationRows: AllocationDisplayRow[];
  databaseError: string | null;
  dashboardData: DashboardData | null;
  isPrivacyMode: boolean;
  isUpdatingPrices: boolean;
  onPriceRefresh: () => void;
  positionRows: { asset: string; category: string; account: string; quantity: string; value: string; weight: string; performance: string }[];
  priceUpdateError: string | null;
  priceUpdateSummary: PriceUpdateSummary | null;
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
  snapshots: DashboardData["snapshots"];
}) {
  const actualAllocationRows = allocationRows.map((row) => ({
    ...row,
    actualPercent: row.actualPercent ?? 0,
    value: row.value ?? 0,
  }));

  const allocationDonutBackground = buildAllocationDonut(actualAllocationRows);

  return (
    <section className="page">
      <div className="title-block">
        <h1>Patrimoine</h1>
        <p>Vue d’ensemble de votre situation patrimoniale et de vos objectifs.</p>
      </div>

      <div className="dashboard">
        <section className="left-col">
          <article className="card total-card">
            <div>
              <p className="label">Patrimoine total</p>
              <p className="big-number">{displayEuro(summary.total, isPrivacyMode)}</p>
              <p className="positive">
                {displayEuro(summary.performance_amount, isPrivacyMode)} ({formatSignedPercent(summary.performance_percent)}) <span>depuis le début</span>
              </p>
              <p className="muted">Depuis le {summary.start_date}</p>
            </div>

            <div className="price-refresh-panel">
              <button className="select-button" type="button" onClick={onPriceRefresh} disabled={isUpdatingPrices}>
                {isUpdatingPrices ? "Mise à jour..." : "Mettre à jour les cours"}
              </button>

              {priceUpdateSummary ? (
                <p className="muted price-refresh-note">
                  Dernière mise à jour : {priceUpdateSummary.updated_at} · {priceUpdateSummary.updated_count} mis à jour{priceUpdateSummary.error_count ? ` · ${priceUpdateSummary.error_count} conservé(s)` : ""}
                </p>
              ) : null}

              {priceUpdateError ? (
                <p className="error-text price-refresh-note">Cours conservés : {priceUpdateError}</p>
              ) : null}
            </div>
          </article>

          <article className="card chart-card">
            <div className="card-header">
              <h2>Évolution du patrimoine <span>ⓘ</span></h2>
              <div className="tabs">
                <span>1M</span>
                <span>6M</span>
                <span>1A</span>
                <strong>Tous</strong>
              </div>
            </div>

            <PortfolioChart snapshots={snapshots} currentTotal={summary.total} isPrivacyMode={isPrivacyMode} />
          </article>

          <article className="card milestones-card">
            <h2>Paliers</h2>
            <p>Votre stratégie évolue avec la taille de votre patrimoine.</p>

            <div className="milestones">
              <Milestone color="green" icon="↗" amount="5 000 €" isPrivacyMode={isPrivacyMode} title="Construction" badge="Épargne régulière" text="Priorité à la constitution d’un socle diversifié et automatisé." />
              <Milestone color="purple" icon="△" amount="10 000 €" isPrivacyMode={isPrivacyMode} title="Accélération" badge="Efficience & qualité" text="Optimisation des poches, qualité des actifs, fiscalité." />
              <Milestone color="gold" icon="◇" amount="100 000 €" isPrivacyMode={isPrivacyMode} title="Rayonnement" badge="Préservation & options" text="Préservation, diversification avancée, immobilier, hedge." />
            </div>
          </article>

          <article className="card positions-card">
            <h2>Principales positions</h2>

            <table>
              <thead>
                <tr>
                  <th>Actif</th>
                  <th>Catégorie</th>
                  <th>Compte</th>
                  <th>Quantité</th>
                  <th>Valeur</th>
                  <th>Poids</th>
                  <th>Perf. latente</th>
                </tr>
              </thead>

              <tbody>
                {positionRows.map((position) => (
                  <tr key={position.asset}>
                    <td><span className="asset-dot" /> {position.asset}</td>
                    <td>{position.category}</td>
                    <td>{position.account}</td>
                    <td>{position.quantity}</td>
                    <td>{position.value}</td>
                    <td>{position.weight}</td>
                    <td className="positive">{position.performance}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-action">
              <button>Voir toutes les positions →</button>
            </div>
          </article>
        </section>

        <aside className="right-col">
          <article className="card allocation-card">
            <h2>Répartition actuelle</h2>
            <p>Allocation réelle de votre portefeuille aujourd’hui.</p>

            <div className="allocation-row">
              <div className="donut" style={{ background: allocationDonutBackground }} />
              <div className="legend">
                {actualAllocationRows.map((row) => (
                  <AllocationLegend
                    key={row.bucket}
                    amount={row.value}
                    color={colorForBucket(row.bucket)}
                    isPrivacyMode={isPrivacyMode}
                    label={row.bucket}
                    percent={row.actualPercent}
                  />
                ))}
              </div>
            </div>

            <div className="allocation-target-note">
              <span>Objectif cible</span>
              <strong>ETF 40 % · Actions 45 % · Crypto 10 % · Cash 5 %</strong>
            </div>

          </article>

          <article className="card sqlite-status-card">
            <div className="status-header">
              <h2>Mes portefeuilles</h2>
              <span className={dashboardData ? "status-pill connected" : "status-pill warning"}>
                {dashboardData ? "À jour" : "Démo"}
              </span>
            </div>

            {databaseError ? <p className="error-text">{databaseError}</p> : null}

            <div className="accounts-list">
              {accounts.map((account) => (
                <div className="account-line" key={account.id}>
                  <div>
                    <strong>{account.name}</strong>
                    <span>{labelForAccountType(account.account_type)}</span>
                  </div>
                  <p>{displayEuro(account.total_value, isPrivacyMode)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card contribution-card">
            <h2>✧ Prochain apport</h2>
            <p className="contribution-amount">{displayEuro(monthlyContribution.amount, isPrivacyMode)} / mois</p>
            <p className="muted">Prochain virement : {monthlyContribution.nextDate}</p>
            <p className="suggestion-title">Suggestion d’allocation ⓘ</p>
            <p className="muted">Pour rester aligné sur votre cible, privilégiez :</p>

            {monthlyContribution.allocation.map((line) => (
              <Allocation key={line.label} label={line.label} value={formatEuro(line.value)} color={line.color}
                    isPrivacyMode={isPrivacyMode} />
            ))}

            <button className="manual-button">⚙ Ajuster manuellement</button>
          </article>

          <article className="card attention-card">
            <h2>♡ Points d’attention</h2>

            {attentionPoints.map((point) => (
              <Attention key={point.text} kind={point.kind} text={point.text} />
            ))}
          </article>

          <article className="quote-card">
            <p>La constance bat l’intensité. Restez aligné sur votre plan d’allocation et vos objectifs.</p>
            <span>Atlas Portfolio</span>
          </article>
        </aside>
      </div>
    </section>
  );
}





type PerformanceSeriesPoint = {
  date: string;
  value: number;
};

type PerformanceAnalytics = {
  twrPercent: number;
  twrSeries: PerformanceSeriesPoint[];
  externalFlowSeries: PerformanceSeriesPoint[];
};

function parsePerformanceDate(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function externalCashFlowAmount(transaction: DbTransaction) {
  if (transaction.transaction_type === "deposit") {
    return transaction.amount;
  }

  if (transaction.transaction_type === "withdrawal") {
    return -transaction.amount;
  }

  return 0;
}

function buildPerformanceAnalytics(
  currentTotal: number,
  snapshots: DashboardData["snapshots"],
  transactions: DbTransaction[],
): PerformanceAnalytics {
  const sortedSnapshots = [...snapshots]
    .map((snapshot) => ({
      date: snapshot.date,
      value: snapshot.total_value,
    }))
    .sort((left, right) => parsePerformanceDate(left.date) - parsePerformanceDate(right.date));

  if (sortedSnapshots.length === 0) {
    sortedSnapshots.push({
      date: new Date().toISOString().slice(0, 10),
      value: currentTotal,
    });
  }

  const flowTransactions = transactions
    .map((transaction) => ({
      date: transaction.date,
      value: externalCashFlowAmount(transaction),
    }))
    .filter((flow) => Math.abs(flow.value) > 0.000001)
    .sort((left, right) => parsePerformanceDate(left.date) - parsePerformanceDate(right.date));

  const twrSeries: PerformanceSeriesPoint[] = sortedSnapshots.length
    ? [{ date: sortedSnapshots[0].date, value: 0 }]
    : [];

  let cumulativeReturn = 1;

  for (let index = 1; index < sortedSnapshots.length; index += 1) {
    const previous = sortedSnapshots[index - 1];
    const current = sortedSnapshots[index];

    const previousTimestamp = parsePerformanceDate(previous.date);
    const currentTimestamp = parsePerformanceDate(current.date);

    const externalFlows = flowTransactions
      .filter((flow) => {
        const timestamp = parsePerformanceDate(flow.date);
        return timestamp > previousTimestamp && timestamp <= currentTimestamp;
      })
      .reduce((sum, flow) => sum + flow.value, 0);

    if (previous.value > 0) {
      const periodReturn = (current.value - externalFlows) / previous.value - 1;
      cumulativeReturn *= 1 + periodReturn;
    }

    twrSeries.push({
      date: current.date,
      value: (cumulativeReturn - 1) * 100,
    });
  }

  let cumulativeExternalFlow = 0;
  const externalFlowSeries = flowTransactions.map((flow) => {
    cumulativeExternalFlow += flow.value;

    return {
      date: flow.date,
      value: cumulativeExternalFlow,
    };
  });

  return {
    twrPercent: twrSeries.length ? twrSeries[twrSeries.length - 1].value : 0,
    twrSeries,
    externalFlowSeries,
  };
}

function PerformanceMiniChart({
  data,
  emptyMessage,
  formatter,
}: {
  data: PerformanceSeriesPoint[];
  emptyMessage: string;
  formatter: (value: number) => string;
}) {
  if (data.length < 2) {
    return <p className="muted mini-chart-empty">{emptyMessage}</p>;
  }

  const chartWidth = 420;
  const chartHeight = 160;
  const topPadding = 18;
  const bottomPadding = 24;
  const values = data.map((point) => point.value);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);

  const points = data.map((point, index) => {
    const x = data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth;
    const y = topPadding + ((maxValue - point.value) / range) * (chartHeight - topPadding - bottomPadding);

    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const yLabels = [maxValue, (maxValue + minValue) / 2, minValue];

  return (
    <div className="performance-mini-chart">
      <div className="mini-y-axis">
        {yLabels.map((value) => (
          <span key={value}>{formatter(value)}</span>
        ))}
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <line x1="0" x2={chartWidth} y1={points[0].y} y2={points[0].y} className="mini-chart-baseline" />
        <path d={linePath} className="mini-chart-line" />
      </svg>

      <div className="mini-months">
        <span>{formatChartDate(data[0].date)}</span>
        <span>{formatChartDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}


function PerformancePage({
  allocationRows,
  isPrivacyMode,
  positions,
  snapshots,
  summary,
  transactions,
}: {
  allocationRows: AllocationDisplayRow[];
  isPrivacyMode: boolean;
  positions: PositionPageRow[];
  snapshots: DashboardData["snapshots"];
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
  transactions: DbTransaction[];
}) {
  const positionsValue = positions.reduce((sum, position) => sum + position.value, 0);
  const investedCapital = positions.reduce((sum, position) => sum + position.cost, 0);
  const latentPerformance = positions.reduce((sum, position) => sum + position.performance_amount, 0);
  const latentPerformancePercent = investedCapital > 0 ? (latentPerformance / investedCapital) * 100 : 0;
  const cashValue = Math.max(summary.total - positionsValue, 0);
  const sortedByValue = [...positions].sort((left, right) => right.value - left.value);
  const topPosition = sortedByValue[0] ?? null;
  const topPositionWeight = topPosition && summary.total > 0 ? (topPosition.value / summary.total) * 100 : 0;
  const winners = [...positions].sort((left, right) => right.performance_amount - left.performance_amount).slice(0, 3);
  const losers = [...positions].sort((left, right) => left.performance_amount - right.performance_amount).slice(0, 3);
  const normalizedAllocationRows = allocationRows.map((row) => ({
    ...row,
    actualPercent: row.actualPercent ?? 0,
    differencePercent: row.differencePercent ?? 0,
    value: row.value ?? 0,
  }));

  const performanceAnalytics = buildPerformanceAnalytics(summary.total, snapshots, transactions);

  return (
    <section className="page">
      <div className="title-block">
        <h1>Performance</h1>
        <p>Analyse des résultats, du capital investi, de la plus-value latente et des poids du portefeuille.</p>
      </div>

      <div className="transaction-summary-grid performance-summary-grid">
        <MetricCard label="Capital investi" value={displayEuro(investedCapital, isPrivacyMode)} note="prix de revient positions" />
        <MetricCard label="Valeur positions" value={displayEuro(positionsValue, isPrivacyMode)} note="hors cash" />
        <MetricCard label="Plus-value latente" value={displayEuro(latentPerformance, isPrivacyMode)} note={formatSignedPercent(latentPerformancePercent)} />
        <MetricCard label="TWR estimé" value={formatSignedPercent(performanceAnalytics.twrPercent)} note="hors apports/retraits" />
        <MetricCard label="Cash estimé" value={displayEuro(cashValue, isPrivacyMode)} note="total - positions" />
        <MetricCard label="Concentration max." value={topPosition ? formatUnsignedPercent(topPositionWeight) : "—"} note={topPosition?.security_name ?? "aucune position"} />
      </div>

      <div className="performance-grid">
        <article className="card performance-chart-card">
          <div className="card-header">
            <h2>Patrimoine dans le temps</h2>
            <span className="status-pill connected">Depuis le début</span>
          </div>

          <PortfolioChart snapshots={snapshots} currentTotal={summary.total} isPrivacyMode={isPrivacyMode} />
        </article>

        <article className="card performance-card">
          <h2>Rendement hors apports</h2>
          <p className="muted">TWR estimé à partir des snapshots et des flux externes.</p>

          <PerformanceMiniChart
            data={performanceAnalytics.twrSeries}
            emptyMessage="Pas assez de snapshots pour calculer un TWR."
            formatter={formatSignedPercent}
          />
        </article>

        <article className="card performance-card">
          <h2>Apports nets cumulés</h2>
          <p className="muted">Dépôts moins retraits. Les transferts internes sont ignorés.</p>

          <PerformanceMiniChart
            data={performanceAnalytics.externalFlowSeries}
            emptyMessage="Aucun apport ou retrait détecté."
            formatter={(value) => displayCompactEuro(value, isPrivacyMode)}
          />
        </article>

        <article className="card performance-card">
          <h2>Performance par classe</h2>
          <p className="muted">Comparaison entre la répartition actuelle et l’objectif cible.</p>

          <div className="allocation-performance-list">
            {normalizedAllocationRows.map((row) => (
              <div className="allocation-performance-row" key={row.bucket}>
                <div>
                  <strong>{row.bucket}</strong>
                  <span>{displayEuro(row.value, isPrivacyMode)}</span>
                </div>

                <div className="target-bar">
                  <span style={{ width: `${Math.min(Math.max(row.actualPercent, 0), 100)}%` }} />
                </div>

                <p>{formatUnsignedPercent(row.actualPercent)}</p>
                <small className={row.differencePercent >= 0 ? "positive" : "negative"}>
                  {formatSignedPercent(row.differencePercent)}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className="card performance-card">
          <h2>Top gagnants</h2>

          <div className="ranking-list">
            {winners.map((position) => (
              <div className="ranking-line" key={position.position_id}>
                <div>
                  <strong>{position.security_name}</strong>
                  <span>{position.account_name}</span>
                </div>
                <p className="positive">
                  {displayEuro(position.performance_amount, isPrivacyMode)}
                  <small>{formatSignedPercent(position.performance_percent)}</small>
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="card performance-card">
          <h2>Top perdants</h2>

          <div className="ranking-list">
            {losers.map((position) => (
              <div className="ranking-line" key={position.position_id}>
                <div>
                  <strong>{position.security_name}</strong>
                  <span>{position.account_name}</span>
                </div>
                <p className={position.performance_amount >= 0 ? "positive" : "negative"}>
                  {displayEuro(position.performance_amount, isPrivacyMode)}
                  <small>{formatSignedPercent(position.performance_percent)}</small>
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="card performance-card performance-wide-card">
          <h2>Poids des lignes</h2>
          <p className="muted">Les lignes les plus lourdes doivent rester surveillées pour éviter une concentration invisible.</p>

          <div className="position-weight-list">
            {sortedByValue.map((position) => (
              <div className="position-weight-row" key={position.position_id}>
                <div>
                  <strong>{position.security_name}</strong>
                  <span>{position.asset_class} · {position.account_name}</span>
                </div>

                <div className="target-bar">
                  <span style={{ width: `${Math.min(Math.max(summary.total > 0 ? (position.value / summary.total) * 100 : 0, 0), 100)}%` }} />
                </div>

                <p>{formatUnsignedPercent(summary.total > 0 ? (position.value / summary.total) * 100 : 0)}</p>
                <small>{displayEuro(position.value, isPrivacyMode)}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}


function PortfolioChart({
  currentTotal,
  isPrivacyMode,
  snapshots,
}: {
  currentTotal: number;
  isPrivacyMode: boolean;
  snapshots: DashboardData["snapshots"];
}) {
  const data = (snapshots.length ? snapshots : [{ date: "Aujourd’hui", total_value: currentTotal }]).map((point) => ({
    date: point.date,
    value: point.total_value,
  }));

  const values = data.map((point) => point.value);
  const maxValue = Math.max(...values, currentTotal, 1);
  const minValue = Math.min(...values, 0);
  const chartWidth = 780;
  const chartHeight = 230;
  const topPadding = 18;
  const bottomPadding = 28;
  const usableHeight = chartHeight - topPadding - bottomPadding;
  const range = Math.max(maxValue - minValue, 1);

  const points = data.map((point, index) => {
    const x = data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth;
    const y = topPadding + ((maxValue - point.value) / range) * usableHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L${chartWidth} ${chartHeight} L0 ${chartHeight} Z`;

  const labelIndexes = data
    .map((_, index) => index)
    .filter((index) => {
      if (data.length <= 5) return true;
      return index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0;
    });

  const yLabels = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];

  return (
    <div className="chart-area">
      <div className="y-axis">
        {yLabels.map((value) => (
          <span key={value}>{displayCompactEuro(value, isPrivacyMode)}</span>
        ))}
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-label="Évolution du patrimoine">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7da7f5" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#7da7f5" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#fill)" />
        <path d={linePath} fill="none" stroke="#6f9df0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="months">
        {labelIndexes.map((index) => (
          <span key={`${data[index].date}-${index}`}>{formatChartDate(data[index].date)}</span>
        ))}
      </div>
    </div>
  );
}


function PositionsPage({
  isPrivacyMode,
  positions,
  positionsError,
  priceUpdateSummary,
}: {
  isPrivacyMode: boolean;
  positions: PositionPageRow[];
  positionsError: string | null;
  priceUpdateSummary: PriceUpdateSummary | null;
}) {
  const totalValue = positions.reduce((sum, position) => sum + position.value, 0);
  const totalCost = positions.reduce((sum, position) => sum + position.cost, 0);
  const totalPerformance = totalValue - totalCost;
  const suspiciousPositions = positions.filter((position) => position.price_warning);
  const updatedBySecurityId = new Map((priceUpdateSummary?.updated ?? []).map((line) => [line.security_id, line]));
  const errorBySecurityId = new Map((priceUpdateSummary?.errors ?? []).map((line) => [line.security_id, line]));

  return (
    <section className="page">
      <div className="title-block page-title-row">
        <div>
          <h1>Positions</h1>
          <p>Vue de contrôle des quantités, cours, valeurs et performances par actif.</p>
        </div>
      </div>

      <div className="transaction-summary-grid positions-summary-grid">
        <MetricCard label="Valeur positions" value={displayEuro(totalValue, isPrivacyMode)} note="hors cash" />
        <MetricCard label="Prix de revient" value={displayEuro(totalCost, isPrivacyMode)} note="coût estimé" />
        <MetricCard label="Perf. latente" value={displayEuro(totalPerformance, isPrivacyMode)} note={formatSignedPercent(totalCost > 0 ? (totalPerformance / totalCost) * 100 : 0)} />
        <MetricCard label="À vérifier" value={String(suspiciousPositions.length)} note="cours suspects" />
      </div>

      <article className="card transactions-card positions-table-card">
        <div className="transactions-header">
          <div>
            <h2>Positions ouvertes</h2>
            <p>Cette page sert à repérer immédiatement un cours aberrant après une mise à jour.</p>
          </div>
          <span className="status-pill connected">Positions</span>
        </div>

        {positionsError ? <p className="error-text">{positionsError}</p> : null}

        <table className="transactions-table positions-table">
          <thead>
            <tr>
              <th>Actif</th>
              <th>Ticker</th>
              <th>Compte</th>
              <th>Classe</th>
              <th>Quantité</th>
              <th>PRU</th>
              <th>Cours</th>
              <th>Source</th>
              <th>Date prix</th>
              <th>Symbole testé</th>
              <th>Erreur prix</th>
              <th>Valeur</th>
              <th>Perf.</th>
              <th>Alerte</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.position_id} className={position.price_warning ? "position-row-warning" : undefined}>
                <td>{position.security_name}</td>
                <td>{position.ticker}</td>
                <td>{position.account_name}</td>
                <td>{position.asset_class}</td>
                <td>{formatQuantity(position.quantity)}</td>
                <td>{displayEuro(position.average_price, isPrivacyMode)}</td>
                <td>{displayEuro(position.current_price, isPrivacyMode)}</td>
                <td>{updatedBySecurityId.get(position.position_id)?.source ?? position.price_source ?? "manual"}</td>
                <td>{position.price_date ?? "—"}</td>
                <td>{updatedBySecurityId.get(position.position_id)?.used_symbol ?? errorBySecurityId.get(position.position_id)?.used_symbol ?? position.ticker}</td>
                <td className="price-error-cell">{errorBySecurityId.get(position.position_id)?.message ?? "—"}</td>
                <td className="amount-cell">{displayEuro(position.value, isPrivacyMode)}</td>
                <td className={position.performance_amount >= 0 ? "positive" : "negative"}>
                  {displayEuro(position.performance_amount, isPrivacyMode)} ({formatSignedPercent(position.performance_percent)})
                </td>
                <td>{position.price_warning ? <span className="warning-badge">À vérifier</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function TransactionsPage({
  accounts,
  isPrivacyMode,
  onTransactionCreated,
  securities,
  transactions,
  transactionsError,
}: {
  accounts: DashboardData["accounts"];
  isPrivacyMode: boolean;
  onTransactionCreated: () => Promise<void>;
  securities: DbSecurity[];
  transactions: DbTransaction[];
  transactionsError: string | null;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null);

  const visibleTransactions = transactions.filter((transaction) => transaction.transaction_type !== "opening_position");
  const technicalTransactionCount = transactions.length - visibleTransactions.length;

  async function handleDeleteTransaction(transaction: DbTransaction) {
    const confirmed = window.confirm(`Supprimer la transaction du ${formatDate(transaction.date)} ?`);

    if (!confirmed) {
      return;
    }

    await deleteTransaction(transaction.id);
    await onTransactionCreated();
  }

  function openCreateForm() {
    setEditingTransaction(null);
    setIsFormOpen(true);
  }

  function openEditForm(transaction: DbTransaction) {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  }

  const totalDeposits = visibleTransactions
    .filter((transaction) => transaction.transaction_type === "deposit")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalWithdrawals = visibleTransactions
    .filter((transaction) => transaction.transaction_type === "withdrawal")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalTransfers = visibleTransactions
    .filter((transaction) => transaction.transaction_type === "transfer")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalBuys = visibleTransactions
    .filter((transaction) => transaction.transaction_type === "buy")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalSells = visibleTransactions
    .filter((transaction) => transaction.transaction_type === "sell")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <section className="page">
      <div className="title-block page-title-row">
        <div>
          <h1>Transactions</h1>
          <p>Suivi des achats, ventes, dépôts, retraits, dividendes, frais et transferts.</p>
        </div>

        <button className="primary-action" onClick={() => (isFormOpen ? setIsFormOpen(false) : openCreateForm())}>
          {isFormOpen ? "Fermer" : "+ Ajouter une transaction"}
        </button>
      </div>

      {isFormOpen ? (
        <TransactionForm
          accounts={accounts}
          isPrivacyMode={isPrivacyMode}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingTransaction(null);
          }}
          onCreated={async () => {
            await onTransactionCreated();
            setIsFormOpen(false);
            setEditingTransaction(null);
          }}
          securities={securities}
          transactionToEdit={editingTransaction}
        />
      ) : null}

      <div className="transaction-summary-grid">
        <MetricCard label="Transactions" value={String(visibleTransactions.length)} note="opérations visibles" />
        <MetricCard label="Dépôts" value={displayEuro(totalDeposits, isPrivacyMode)} note="apports entrants" />
        <MetricCard label="Retraits" value={displayEuro(totalWithdrawals, isPrivacyMode)} note="sorties enregistrées" />
        <MetricCard label="Achats" value={displayEuro(totalBuys, isPrivacyMode)} note="ordres exécutés" />
        <MetricCard label="Ventes" value={displayEuro(totalSells, isPrivacyMode)} note="cessions" />
        <MetricCard label="Transferts" value={displayEuro(totalTransfers, isPrivacyMode)} note="entre comptes" />
      </div>

      <article className="card transactions-card">
        <div className="transactions-header">
          <div>
            <h2>Journal des transactions</h2>
            <p>Journal local des opérations enregistrées.</p>
            {technicalTransactionCount > 0 ? (
              <p className="technical-note">
                {technicalTransactionCount} ajustement(s) technique(s) masqué(s) par défaut.
              </p>
            ) : null}
          </div>
          <span className="status-pill connected">Journal</span>
        </div>

        {transactionsError ? <p className="error-text">{transactionsError}</p> : null}

        <table className="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Flux</th>
              <th>Actif</th>
              <th>Quantité</th>
              <th>Prix</th>
              <th>Frais</th>
              <th>Montant</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleTransactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{formatDate(transaction.date)}</td>
                <td><span className={`type-pill ${transaction.transaction_type}`}>{labelForTransactionType(transaction.transaction_type)}</span></td>
                <td>{formatTransactionFlow(transaction)}</td>
                <td>{transaction.security_name ?? "—"}</td>
                <td>{transaction.quantity ? formatQuantity(transaction.quantity) : "—"}</td>
                <td>{transaction.price ? displayEuro(transaction.price, isPrivacyMode) : "—"}</td>
                <td>{transaction.fees ? displayEuro(transaction.fees, isPrivacyMode) : "—"}</td>
                <td className="amount-cell">{displayEuro(transaction.amount, isPrivacyMode)}</td>
                <td>{transaction.note ?? "—"}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => openEditForm(transaction)}>Modifier</button>
                    <button type="button" onClick={() => handleDeleteTransaction(transaction)}>Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function TransactionForm({
  accounts,
  isPrivacyMode,
  onCancel,
  onCreated,
  securities,
  transactionToEdit,
}: {
  accounts: DashboardData["accounts"];
  isPrivacyMode: boolean;
  onCancel: () => void;
  onCreated: () => Promise<void>;
  securities: DbSecurity[];
  transactionToEdit: DbTransaction | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstAccountId = accounts[0]?.id ?? "";
  const secondAccountId = accounts[1]?.id ?? firstAccountId;

  const [availableSecurities, setAvailableSecurities] = useState<DbSecurity[]>(securities);
  const [transactionType, setTransactionType] = useState<TransactionFormType>("deposit");
  const [date, setDate] = useState(today);
  const [fromAccountId, setFromAccountId] = useState(firstAccountId);
  const [toAccountId, setToAccountId] = useState(secondAccountId);
  const [accountId, setAccountId] = useState(secondAccountId);
  const [securityId, setSecurityId] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [onlineAssetResults, setOnlineAssetResults] = useState<OnlineAssetSearchResult[]>([]);
  const [onlineSearchError, setOnlineSearchError] = useState<string | null>(null);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = transactionToEdit !== null;
  const isTrade = transactionType === "buy" || transactionType === "sell";
  const selectedSecurity = availableSecurities.find((security) => security.id === securityId);
  const normalizedAssetSearch = assetQuery.trim().toLowerCase();

  const filteredSecurities = normalizedAssetSearch
    ? availableSecurities
        .filter((security) => (
          security.name.toLowerCase().includes(normalizedAssetSearch) ||
          security.ticker.toLowerCase().includes(normalizedAssetSearch) ||
          security.asset_class.toLowerCase().includes(normalizedAssetSearch)
        ))
        .slice(0, 8)
    : [];

  useEffect(() => {
    setAvailableSecurities(securities);
  }, [securities]);

  useEffect(() => {
    if (!transactionToEdit) {
      return;
    }

    setTransactionType(transactionToEdit.transaction_type as TransactionFormType);
    setDate(transactionToEdit.date);
    setFromAccountId(transactionToEdit.from_account_id ?? firstAccountId);
    setToAccountId(transactionToEdit.to_account_id ?? secondAccountId);
    setAccountId(transactionToEdit.account_id ?? secondAccountId);
    setSecurityId(transactionToEdit.security_id ?? "");
    setAmount(formatInputDecimal(transactionToEdit.amount));
    setQuantity(transactionToEdit.quantity ? formatInputDecimal(transactionToEdit.quantity) : "1");
    setPrice(transactionToEdit.price ? formatInputDecimal(transactionToEdit.price) : "");
    setFees(formatInputDecimal(transactionToEdit.fees ?? 0));
    setNote(transactionToEdit.note ?? "");

    const matchingSecurity = securities.find((security) => security.id === transactionToEdit.security_id);
    setAssetQuery(matchingSecurity ? `${matchingSecurity.name} · ${matchingSecurity.ticker}` : transactionToEdit.security_name ?? "");
    setOnlineAssetResults([]);
    setOnlineSearchError(null);
  }, [firstAccountId, secondAccountId, securities, transactionToEdit]);

  useEffect(() => {
    if (!fromAccountId && firstAccountId) {
      setFromAccountId(firstAccountId);
    }

    if (!toAccountId && secondAccountId) {
      setToAccountId(secondAccountId);
    }

    if (!accountId && secondAccountId) {
      setAccountId(secondAccountId);
    }
  }, [accountId, firstAccountId, fromAccountId, secondAccountId, toAccountId]);

  function selectSecurity(security: DbSecurity) {
    setSecurityId(security.id);
    setAssetQuery(`${security.name} · ${security.ticker}`);
    setOnlineAssetResults([]);
    setOnlineSearchError(null);

    const currentPrice = formatInputDecimal(security.current_price);
    setPrice(currentPrice);
    setQuantity("1");
    setAmount(currentPrice);
  }

  function handleTradeFieldChange(field: "amount" | "quantity" | "price", value: string) {
    const currentAmount = field === "amount" ? value : amount;
    const currentQuantity = field === "quantity" ? value : quantity;
    const currentPrice = field === "price" ? value : price;

    if (field === "amount") {
      setAmount(value);
      const parsedAmount = parseDecimal(value);
      const parsedPrice = parseDecimal(currentPrice);
      const parsedQuantity = parseDecimal(currentQuantity);

      if (isPositiveNumber(parsedAmount) && isPositiveNumber(parsedPrice)) {
        setQuantity(formatInputDecimal(parsedAmount / parsedPrice));
      } else if (isPositiveNumber(parsedAmount) && isPositiveNumber(parsedQuantity)) {
        setPrice(formatInputDecimal(parsedAmount / parsedQuantity));
      }
    }

    if (field === "quantity") {
      setQuantity(value);
      const parsedQuantity = parseDecimal(value);
      const parsedPrice = parseDecimal(currentPrice);
      const parsedAmount = parseDecimal(currentAmount);

      if (isPositiveNumber(parsedQuantity) && isPositiveNumber(parsedPrice)) {
        setAmount(formatInputDecimal(parsedQuantity * parsedPrice));
      } else if (isPositiveNumber(parsedQuantity) && isPositiveNumber(parsedAmount)) {
        setPrice(formatInputDecimal(parsedAmount / parsedQuantity));
      }
    }

    if (field === "price") {
      setPrice(value);
      const parsedPrice = parseDecimal(value);
      const parsedQuantity = parseDecimal(currentQuantity);
      const parsedAmount = parseDecimal(currentAmount);

      if (isPositiveNumber(parsedPrice) && isPositiveNumber(parsedQuantity)) {
        setAmount(formatInputDecimal(parsedPrice * parsedQuantity));
      } else if (isPositiveNumber(parsedPrice) && isPositiveNumber(parsedAmount)) {
        setQuantity(formatInputDecimal(parsedAmount / parsedPrice));
      }
    }
  }

  async function handleSearchOnlineAssets() {
    const query = assetQuery.trim();

    if (query.length < 2) {
      setOnlineSearchError("Tape au moins 2 caractères pour chercher un actif sur Yahoo.");
      return;
    }

    setIsSearchingOnline(true);
    setOnlineSearchError(null);

    try {
      const results = await searchOnlineAssets(query);
      setOnlineAssetResults(results);

      if (results.length === 0) {
        setOnlineSearchError("Aucun résultat trouvé sur Yahoo Finance.");
      }
    } catch (error) {
      setOnlineAssetResults([]);
      setOnlineSearchError(String(error));
    } finally {
      setIsSearchingOnline(false);
    }
  }

  async function handleCreateAssetFromOnlineResult(result: OnlineAssetSearchResult) {
    setIsCreatingAsset(true);
    setOnlineSearchError(null);

    try {
      const created = await createSecurityFromOnlineResult({
        symbol: result.symbol,
        name: result.name,
        asset_class: result.asset_class,
        currency: result.currency || "EUR",
        region: result.region || null,
      });

      setAvailableSecurities((current) => {
        const withoutDuplicate = current.filter((security) => security.id !== created.id);
        return [...withoutDuplicate, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      selectSecurity(created);
    } catch (error) {
      setOnlineSearchError(String(error));
    } finally {
      setIsCreatingAsset(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError(null);

    if (isTrade) {
      const tradeTransactionType = transactionType as "buy" | "sell";
      const parsedAmount = parseDecimal(amount);
      const parsedQuantity = parseDecimal(quantity);
      const parsedPrice = parseDecimal(price);
      const parsedFees = parseDecimal(fees || "0");

      if (!accountId) {
        setFormError("Choisis un compte.");
        return;
      }

      if (!securityId || !selectedSecurity) {
        setFormError("Choisis un actif ou cherche-le en ligne.");
        return;
      }

      let finalQuantity = parsedQuantity;
      let finalPrice = parsedPrice;

      if (!isPositiveNumber(finalQuantity) && isPositiveNumber(parsedAmount) && isPositiveNumber(parsedPrice)) {
        finalQuantity = parsedAmount / parsedPrice;
      }

      if (!isPositiveNumber(finalPrice) && isPositiveNumber(parsedAmount) && isPositiveNumber(parsedQuantity)) {
        finalPrice = parsedAmount / parsedQuantity;
      }

      if (!isPositiveNumber(finalQuantity) || !isPositiveNumber(finalPrice)) {
        setFormError("Renseigne au moins deux valeurs cohérentes entre montant, quantité et cours.");
        return;
      }

      if (!Number.isFinite(parsedFees) || parsedFees < 0) {
        setFormError("Les frais doivent être un nombre positif ou égal à 0.");
        return;
      }

      const payload: NewTradeTransaction = {
        transaction_type: tradeTransactionType,
        date,
        account_id: accountId,
        security_id: securityId,
        quantity: finalQuantity,
        price: finalPrice,
        fees: parsedFees,
        note: note.trim() ? note.trim() : null,
      };

      setIsSubmitting(true);

      try {
        if (isEditing && transactionToEdit) {
          const updatePayload: UpdateTransactionInput = {
            id: transactionToEdit.id,
            transaction_type: tradeTransactionType,
            date,
            account_id: accountId,
            security_id: securityId,
            quantity: finalQuantity,
            price: finalPrice,
            fees: parsedFees,
            note: note.trim() ? note.trim() : null,
          };

          await updateTransaction(updatePayload);
        } else {
          await createTradeTransaction(payload);
        }
        await onCreated();
        setAmount("");
        setQuantity("1");
        setPrice(selectedSecurity ? formatInputDecimal(selectedSecurity.current_price) : "");
        setFees("0");
        setNote("");
      } catch (error) {
        setFormError(String(error));
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    const cashTransactionType = transactionType as CashTransactionType;
    const parsedAmount = parseDecimal(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError("Le montant doit être un nombre supérieur à 0.");
      return;
    }

    if (cashTransactionType === "deposit" && !toAccountId) {
      setFormError("Choisis un compte de destination.");
      return;
    }

    if (cashTransactionType === "withdrawal" && !fromAccountId) {
      setFormError("Choisis un compte source.");
      return;
    }

    if (cashTransactionType === "transfer" && (!fromAccountId || !toAccountId)) {
      setFormError("Choisis un compte source et un compte de destination.");
      return;
    }

    if (cashTransactionType === "transfer" && fromAccountId === toAccountId) {
      setFormError("Le compte source et le compte de destination doivent être différents.");
      return;
    }

    const payload: NewCashTransaction = {
      transaction_type: cashTransactionType,
      date,
      amount: parsedAmount,
      note: note.trim() ? note.trim() : null,
      from_account_id: cashTransactionType === "deposit" ? null : fromAccountId,
      to_account_id: cashTransactionType === "withdrawal" ? null : toAccountId,
    };

    setIsSubmitting(true);

    try {
      if (isEditing && transactionToEdit) {
        const updatePayload: UpdateTransactionInput = {
          id: transactionToEdit.id,
          transaction_type: cashTransactionType,
          date,
          amount: parsedAmount,
          note: note.trim() ? note.trim() : null,
          from_account_id: cashTransactionType === "deposit" ? null : fromAccountId,
          to_account_id: cashTransactionType === "withdrawal" ? null : toAccountId,
        };

        await updateTransaction(updatePayload);
      } else {
        await createCashTransaction(payload);
      }
      await onCreated();
      setAmount("");
      setNote("");
    } catch (error) {
      setFormError(String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="card transaction-form-card">
      <div className="transactions-header">
        <div>
          <h2>{isEditing ? "Modifier la transaction" : "Ajouter une transaction"}</h2>
          <p>Dépôt, retrait, transfert, achat et vente. Pour les achats/ventes, montant, quantité et cours restent modifiables.</p>
        </div>
        <span className="status-pill connected">{isEditing ? "Édition" : "Ajout"}</span>
      </div>

      <form className="transaction-form" onSubmit={handleSubmit}>
        <label>
          Type
          <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as TransactionFormType)}>
            <option value="deposit">Dépôt</option>
            <option value="withdrawal">Retrait</option>
            <option value="transfer">Transfert</option>
            <option value="buy">Achat</option>
            <option value="sell">Vente</option>
          </select>
        </label>

        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        {isTrade ? (
          <>
            <label>
              Compte
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </label>

            <AssetPicker
              assetQuery={assetQuery}
              filteredSecurities={filteredSecurities}
              isPrivacyMode={isPrivacyMode}
              isCreatingAsset={isCreatingAsset}
              isSearchingOnline={isSearchingOnline}
              onAssetQueryChange={(value) => {
                setAssetQuery(value);
                setOnlineSearchError(null);
                setOnlineAssetResults([]);
              }}
              onCreateAssetFromOnlineResult={handleCreateAssetFromOnlineResult}
              onSearchOnlineAssets={handleSearchOnlineAssets}
              onSelectSecurity={selectSecurity}
              onlineAssetResults={onlineAssetResults}
              onlineSearchError={onlineSearchError}
              selectedSecurityId={securityId}
            />

            <label>
              Cours unitaire
              <input inputMode="decimal" value={price} onChange={(event) => handleTradeFieldChange("price", event.target.value)} placeholder="Cours" />
            </label>

            <label>
              Quantité
              <input inputMode="decimal" value={quantity} onChange={(event) => handleTradeFieldChange("quantity", event.target.value)} placeholder="1" />
            </label>

            <label>
              Montant de l’ordre
              <input inputMode="decimal" value={amount} onChange={(event) => handleTradeFieldChange("amount", event.target.value)} placeholder="Montant" />
            </label>

            <label>
              Frais
              <input inputMode="decimal" value={fees} onChange={(event) => setFees(event.target.value)} placeholder="0" />
            </label>
          </>
        ) : (
          <>
            {transactionType !== "deposit" ? (
              <label>
                Compte source
                <select value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {transactionType !== "withdrawal" ? (
              <label>
                Compte destination
                <select value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Montant
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1000" />
            </label>
          </>
        )}

        <label className="form-note-field">
          Note
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex : achat LVMH ou virement mensuel vers PEA" />
        </label>

        {formError ? <p className="form-error">{formError}</p> : null}

        <div className="form-actions">
          <button className="secondary-action" type="button" onClick={onCancel}>Annuler</button>
          <button className="primary-action" type="submit" disabled={isSubmitting || accounts.length === 0 || (isTrade && !securityId)}>
            {isSubmitting ? (isEditing ? "Modification..." : "Ajout...") : isEditing ? "Modifier" : "Ajouter"}
          </button>
        </div>
      </form>
    </article>
  );
}

function AssetPicker({
  assetQuery,
  filteredSecurities,
  isCreatingAsset,
  isPrivacyMode,
  isSearchingOnline,
  onAssetQueryChange,
  onCreateAssetFromOnlineResult,
  onSearchOnlineAssets,
  onSelectSecurity,
  onlineAssetResults,
  onlineSearchError,
  selectedSecurityId,
}: {
  assetQuery: string;
  filteredSecurities: DbSecurity[];
  isCreatingAsset: boolean;
  isPrivacyMode: boolean;
  isSearchingOnline: boolean;
  onAssetQueryChange: (value: string) => void;
  onCreateAssetFromOnlineResult: (result: OnlineAssetSearchResult) => Promise<void>;
  onSearchOnlineAssets: () => Promise<void>;
  onSelectSecurity: (security: DbSecurity) => void;
  onlineAssetResults: OnlineAssetSearchResult[];
  onlineSearchError: string | null;
  selectedSecurityId: string;
}) {
  return (
    <div className="asset-picker-field">
      <label>
        Actif
        <input
          value={assetQuery}
          onChange={(event) => onAssetQueryChange(event.target.value)}
          placeholder="Ex : Air Liquide, LVMH, CW8, Bitcoin..."
        />
      </label>

      <div className="asset-picker-actions">
        <button className="secondary-action" type="button" onClick={onSearchOnlineAssets} disabled={isSearchingOnline || isCreatingAsset}>
          {isSearchingOnline ? "Recherche..." : "Chercher sur Yahoo"}
        </button>
      </div>

      {onlineSearchError ? <p className="form-error">{onlineSearchError}</p> : null}

      {filteredSecurities.length > 0 ? (
        <div className="asset-results-block">
          <p>Actifs déjà connus</p>
          <div className="asset-result-list">
            {filteredSecurities.map((security) => (
              <button
                className={security.id === selectedSecurityId ? "asset-result selected" : "asset-result"}
                key={security.id}
                onClick={() => onSelectSecurity(security)}
                type="button"
              >
                <span>
                  <strong>{security.name}</strong>
                  <small>{security.ticker} · {security.asset_class}</small>
                </span>
                <em>{displayEuro(security.current_price, isPrivacyMode)}</em>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {onlineAssetResults.length > 0 ? (
        <div className="asset-results-block online">
          <p>Résultats en ligne</p>
          <div className="asset-result-list">
            {onlineAssetResults.map((result) => (
              <button
                className="asset-result"
                disabled={isCreatingAsset}
                key={`${result.symbol}-${result.region}`}
                onClick={() => onCreateAssetFromOnlineResult(result)}
                type="button"
              >
                <span>
                  <strong>{result.name}</strong>
                  <small>{result.symbol} · {result.region} · {result.currency} · {result.asset_class}</small>
                </span>
                <em>{Math.round(result.match_score * 100)} %</em>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}



function PortfolioAuditPage({
  accounts,
  isPrivacyMode,
  onRefresh,
  positions,
  transactions,
}: {
  accounts: DashboardData["accounts"];
  isPrivacyMode: boolean;
  onRefresh: () => Promise<void>;
  positions: PositionPageRow[];
  transactions: DbTransaction[];
}) {
  const [openingAdjustmentMessage, setOpeningAdjustmentMessage] = useState<string | null>(null);
  const [isCreatingOpeningAdjustments, setIsCreatingOpeningAdjustments] = useState(false);
  const auditItems = buildPortfolioAuditItems(accounts, positions, transactions, isPrivacyMode);
  const warningCount = auditItems.filter((item) => item.status === "warning").length;
  const okCount = auditItems.filter((item) => item.status === "ok").length;
  const reconstructedPositionCount = auditItems.filter((item) => item.kind === "position").length;
  const cashFlowCount = auditItems.filter((item) => item.kind === "cash").length;

  async function handleCreateOpeningAdjustments() {
    setIsCreatingOpeningAdjustments(true);
    setOpeningAdjustmentMessage(null);

    try {
      const createdCount = await createOpeningPositionAdjustments();
      await onRefresh();
      setOpeningAdjustmentMessage(
        createdCount > 0
          ? `${createdCount} ajustement(s) d’ouverture créé(s).`
          : "Aucun ajustement nécessaire."
      );
    } catch (error) {
      setOpeningAdjustmentMessage(String(error));
    } finally {
      setIsCreatingOpeningAdjustments(false);
    }
  }

  return (
    <section className="page">
      <div className="title-block">
        <h1>Journal</h1>
        <p>Contrôle de cohérence entre vos transactions et l’état actuel du portefeuille.</p>
      </div>

      <div className="audit-summary-grid">
        <MetricCard label="Transactions" value={String(transactions.length)} note="lignes analysées" />
        <MetricCard label="Positions vérifiées" value={String(reconstructedPositionCount)} note="depuis le journal" />
        <MetricCard label="Éléments OK" value={String(okCount)} note="cohérents" />
        <MetricCard label="Flux cash" value={String(cashFlowCount)} note="comptes détectés" />
        <MetricCard label="Alertes" value={String(warningCount)} note={warningCount === 0 ? "aucun écart bloquant" : "écarts à vérifier"} />
      </div>

      <article className="card audit-card">
        <div className="audit-header">
          <div>
            <h2>Diagnostic de cohérence</h2>
            <p>
              Cette page ne modifie pas la base. Elle recalcule uniquement un état théorique depuis le journal
              pour repérer les écarts avant une future reconstruction automatique.
            </p>
          </div>

          <div className="audit-header-actions">
            {warningCount > 0 ? (
              <button
                className="secondary-action"
                disabled={isCreatingOpeningAdjustments}
                onClick={handleCreateOpeningAdjustments}
                type="button"
              >
                {isCreatingOpeningAdjustments ? "Création..." : "Créer les ajustements d’ouverture"}
              </button>
            ) : (
              <span className="status-pill connected">Aucun ajustement nécessaire</span>
            )}

            <span className={warningCount === 0 ? "status-pill connected" : "status-pill warning"}>
              {warningCount === 0 ? "Cohérent" : `${warningCount} alerte(s)`}
            </span>
          </div>
        </div>

        {openingAdjustmentMessage ? <p className="form-success">{openingAdjustmentMessage}</p> : null}

        <table>
          <thead>
            <tr>
              <th>Élément</th>
              <th>Journal</th>
              <th>Actuel</th>
              <th>Écart</th>
              <th>Statut</th>
              <th>Détail</th>
            </tr>
          </thead>

          <tbody>
            {auditItems.map((item, index) => (
              <tr className={item.status === "warning" ? "audit-row-warning" : ""} key={`${item.kind}-${item.label}-${index}`}>
                <td>{item.label}</td>
                <td>{item.journalValue}</td>
                <td>{item.currentValue}</td>
                <td>{item.difference}</td>
                <td>
                  <span className={`audit-status ${item.status}`}>
                    {item.status === "ok" ? "OK" : item.status === "warning" ? "À vérifier" : "Info"}
                  </span>
                </td>
                <td>{item.message}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {auditItems.length === 0 ? (
          <p className="muted">Aucune transaction exploitable pour le moment.</p>
        ) : null}

        <div className="audit-explanation">
          <strong>Lecture rapide</strong>
          <p>
            Si une position est indiquée “absente du journal”, cela veut dire qu’elle existe dans la table Positions,
            mais que les transactions actuelles ne suffisent pas à la reconstruire. C’est normal avec les données fictives
            du début du projet. Quand le journal sera complet, ces écarts devront disparaître.
          </p>
        </div>
      </article>
    </section>
  );
}



function positionAuditKey(accountName: string | null | undefined, securityName: string | null | undefined) {
  return `${accountName ?? "Compte inconnu"}|||${securityName ?? "Actif inconnu"}`;
}

function splitPositionAuditKey(key: string) {
  const [accountName, securityName] = key.split("|||");

  return {
    accountName: accountName || "Compte inconnu",
    securityName: securityName || "Actif inconnu",
  };
}

function formatAuditQuantity(value: number) {
  return formatQuantity(Number(value.toFixed(8)));
}

function buildPortfolioAuditItems(
  accounts: DashboardData["accounts"],
  positions: PositionPageRow[],
  transactions: DbTransaction[],
  isPrivacyMode: boolean,
): PortfolioAuditItem[] {
  const items: PortfolioAuditItem[] = [];
  const rebuiltPositions = new Map<string, RebuiltPosition>();
  const cashFlows = new Map<string, number>();
  const warnings: PortfolioAuditItem[] = [];

  function addCash(accountName: string | null | undefined, amount: number) {
    const name = accountName ?? "Compte inconnu";
    cashFlows.set(name, (cashFlows.get(name) ?? 0) + amount);
  }

  function addPosition(
    accountName: string | null | undefined,
    securityName: string | null | undefined,
    quantityDelta: number,
    costDelta: number,
  ) {
    const key = positionAuditKey(accountName, securityName);
    const current = rebuiltPositions.get(key) ?? {
      accountName: accountName ?? "Compte inconnu",
      securityName: securityName ?? "Actif inconnu",
      quantity: 0,
      cost: 0,
    };

    current.quantity += quantityDelta;
    current.cost += costDelta;
    rebuiltPositions.set(key, current);

  }

  for (const transaction of transactions) {
    const amount = transaction.amount ?? 0;
    const quantity = transaction.quantity ?? 0;
    const price = transaction.price ?? 0;
    const fees = transaction.fees ?? 0;

    if (transaction.transaction_type === "opening_position") {
      if (!transaction.account_name || !transaction.security_name || quantity === 0) {
        warnings.push({
          kind: "warning",
          label: transaction.security_name ?? transaction.id,
          journalValue: "—",
          currentValue: "—",
          difference: "—",
          status: "warning",
          message: "Ajustement d’ouverture incomplet : compte, actif ou quantité manquant.",
        });
        continue;
      }

      addPosition(transaction.account_name, transaction.security_name, quantity, quantity * price);
      continue;
    }

    if (transaction.transaction_type === "deposit") {
      addCash(transaction.to_account_name, amount);
      continue;
    }

    if (transaction.transaction_type === "withdrawal") {
      addCash(transaction.from_account_name, -amount);
      continue;
    }

    if (transaction.transaction_type === "transfer") {
      addCash(transaction.from_account_name, -amount);
      addCash(transaction.to_account_name, amount);
      continue;
    }

    if (transaction.transaction_type === "buy") {
      if (!transaction.account_name || !transaction.security_name || quantity <= 0 || price <= 0) {
        warnings.push({
          kind: "warning",
          label: transaction.security_name ?? transaction.id,
          journalValue: "—",
          currentValue: "—",
          difference: "—",
          status: "warning",
          message: "Achat incomplet : compte, actif, quantité ou prix manquant.",
        });
        continue;
      }

      const totalCost = quantity * price + fees;
      addCash(transaction.account_name, -totalCost);
      addPosition(transaction.account_name, transaction.security_name, quantity, totalCost);
      continue;
    }

    if (transaction.transaction_type === "sell") {
      if (!transaction.account_name || !transaction.security_name || quantity <= 0 || price <= 0) {
        warnings.push({
          kind: "warning",
          label: transaction.security_name ?? transaction.id,
          journalValue: "—",
          currentValue: "—",
          difference: "—",
          status: "warning",
          message: "Vente incomplète : compte, actif, quantité ou prix manquant.",
        });
        continue;
      }

      const cashReceived = quantity * price - fees;
      addCash(transaction.account_name, cashReceived);
      addPosition(transaction.account_name, transaction.security_name, -quantity, 0);
    }
  }

  const currentPositions = new Map<string, PositionPageRow>();

  for (const position of positions) {
    currentPositions.set(positionAuditKey(position.account_name, position.security_name), position);
  }

  const allPositionKeys = new Set([...rebuiltPositions.keys(), ...currentPositions.keys()]);

  for (const key of allPositionKeys) {
    const rebuilt = rebuiltPositions.get(key);
    const current = currentPositions.get(key);
    const labels = splitPositionAuditKey(key);
    const rebuiltQuantity = rebuilt?.quantity ?? 0;
    const currentQuantity = current?.quantity ?? 0;
    const difference = rebuiltQuantity - currentQuantity;
    const isOk = Math.abs(difference) <= 0.000001;

    if (isOk && Math.abs(rebuiltQuantity) <= 0.000001 && !current) {
      continue;
    }

    items.push({
      kind: "position",
      label: `${labels.securityName} · ${labels.accountName}`,
      journalValue: rebuilt ? formatAuditQuantity(rebuiltQuantity) : "0",
      currentValue: current ? formatAuditQuantity(currentQuantity) : "0",
      difference: formatAuditQuantity(difference),
      status: isOk ? "ok" : "warning",
      message: isOk
        ? "Quantité cohérente entre le journal et les positions."
        : rebuiltQuantity < -0.000001
          ? "Le journal reconstruit une quantité négative finale : vente ou ajustement à vérifier."
          : rebuilt
            ? "Écart entre la quantité recalculée depuis le journal et la position affichée."
            : "Position actuelle absente du journal de transactions.",
    });
  }

  for (const account of accounts) {
    const flow = cashFlows.get(account.name) ?? 0;

    if (Math.abs(flow) <= 0.000001) {
      continue;
    }

    items.push({
      kind: "cash",
      label: `Flux cash · ${account.name}`,
      journalValue: displayEuro(flow, isPrivacyMode),
      currentValue: "—",
      difference: "—",
      status: "info",
      message: "Flux net reconstruit depuis les dépôts, retraits, transferts, achats et ventes. Comparaison au cash réel prévue à l’étape suivante.",
    });
  }

  return [...warnings, ...items].sort((left, right) => {
    const score = { warning: 0, info: 1, ok: 2 };
    return score[left.status] - score[right.status];
  });
}


function ImportExportPage({
  accounts,
  onImported,
  positions,
  securities,
  transactions,
}: {
  accounts: DashboardData["accounts"];
  onImported: () => Promise<void>;
  positions: PositionPageRow[];
  securities: DbSecurity[];
  transactions: DbTransaction[];
}) {
  const [csvText, setCsvText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const missingCsvHeaders = getMissingCsvHeaders(csvText);
  const importCandidates = missingCsvHeaders.length === 0 ? validateCsvTransactions(csvText, accounts, securities) : [];
  const previewRows = importCandidates.slice(0, 8);
  const validRows = importCandidates.filter((row) => row.status === "valid");

  async function handleCsvFile(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();

    setCsvText(content);
    setImportError(null);
    setImportResult(null);
    event.currentTarget.value = "";
  }

  async function importCsvTransactions() {
    if (validRows.length === 0) {
      setImportError("Aucune ligne valide à importer.");
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      for (const candidate of validRows) {
        if (!candidate.payload) {
          continue;
        }

        const payload = candidate.payload;

        if (payload.transaction_type === "buy" || payload.transaction_type === "sell") {
          await createTradeTransaction(payload as NewTradeTransaction);
        } else {
          await createCashTransaction(payload as NewCashTransaction);
        }
      }

      await onImported();
      setImportResult(`${validRows.length} transaction(s) importée(s).`);
    } catch (error) {
      setImportError(String(error));
    } finally {
      setIsImporting(false);
    }
  }

  function exportTransactions() {
    const rows = transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      type: transaction.transaction_type,
      compte: transaction.account_name ?? "",
      compte_source: transaction.from_account_name ?? "",
      compte_destination: transaction.to_account_name ?? "",
      actif: transaction.security_name ?? "",
      montant: transaction.amount,
      quantite: transaction.quantity ?? "",
      prix: transaction.price ?? "",
      frais: transaction.fees,
      note: transaction.note ?? "",
    }));

    downloadCsv("atlas-transactions.csv", rows);
  }

  function exportPositions() {
    const rows = positions.map((position) => ({
      actif: position.security_name,
      ticker: position.ticker,
      compte: position.account_name,
      classe: position.asset_class,
      quantite: position.quantity,
      pru: position.average_price,
      cours: position.current_price,
      source_prix: position.price_source,
      date_prix: position.price_date ?? "",
      valeur: position.value,
      performance: position.performance_amount,
      performance_pourcent: position.performance_percent,
    }));

    downloadCsv("atlas-positions.csv", rows);
  }

  function exportTransactionTemplate() {
    downloadCsv("atlas-modele-transactions.csv", [
      {
        date: "2026-07-08",
        type: "buy",
        compte: "PEA",
        compte_source: "",
        compte_destination: "",
        ticker: "MC.PA",
        actif: "LVMH",
        quantite: "1",
        prix: "488.85",
        frais: "0",
        montant: "",
        note: "Exemple achat",
      },
    ]);
  }

  return (
    <section className="page">
      <div className="title-block">
        <h1>Importer / Exporter</h1>
        <p>Importez ou exportez vos transactions et positions au format CSV.</p>
      </div>

      <div className="import-export-grid">
        <article className="card import-export-card">
          <h2>Exporter</h2>
          <p>Récupérez vos données locales en CSV pour contrôle ou sauvegarde manuelle.</p>

          <div className="import-export-actions">
            <button className="primary-action" type="button" onClick={exportTransactions}>
              Exporter les transactions
            </button>
            <button className="secondary-action" type="button" onClick={exportPositions}>
              Exporter les positions
            </button>
            <button className="secondary-action" type="button" onClick={exportTransactionTemplate}>
              Télécharger un modèle
            </button>
          </div>
        </article>

        <article className="card import-export-card">
          <h2>Importer</h2>
          <p>Collez un CSV, vérifiez les lignes, puis importez uniquement les lignes valides.</p>

          <textarea
            className="csv-preview-input"
            onChange={(event) => {
              setCsvText(event.target.value);
              setImportError(null);
              setImportResult(null);
            }}
            placeholder="date,type,compte,compte_source,compte_destination,ticker,actif,quantite,prix,frais,montant,note"
            value={csvText}
          />

          <div className="csv-file-actions">
            <label className="secondary-action csv-file-button">
              Ouvrir un CSV
              <input accept=".csv,text/csv" onChange={handleCsvFile} type="file" />
            </label>

            <button
              className="secondary-action"
              disabled={!csvText}
              onClick={() => {
                setCsvText("");
                setImportError(null);
                setImportResult(null);
              }}
              type="button"
            >
              Effacer
            </button>
          </div>

          {missingCsvHeaders.length > 0 ? (
            <p className="form-error">
              Colonnes manquantes : {missingCsvHeaders.join(", ")}
            </p>
          ) : null}

          <div className="csv-preview-toolbar">
            <div className="csv-preview-status">
              {importCandidates.length > 0
                ? `${validRows.length}/${importCandidates.length} ligne(s) valide(s)`
                : "Aucune ligne détectée"}
            </div>

            <button
              className="primary-action"
              disabled={isImporting || validRows.length === 0 || missingCsvHeaders.length > 0}
              onClick={importCsvTransactions}
              type="button"
            >
              {isImporting ? "Import..." : "Importer les lignes valides"}
            </button>
          </div>

          {importError ? <p className="form-error">{importError}</p> : null}
          {importResult ? <p className="form-success">{importResult}</p> : null}

          {previewRows.length > 0 ? (
            <div className="csv-preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Statut</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Compte</th>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Ticker</th>
                    <th>Quantité</th>
                    <th>Prix</th>
                    <th>Montant</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((candidate, index) => (
                    <tr key={index}>
                      <td>
                        <span className={candidate.status === "valid" ? "csv-status valid" : "csv-status error"}>
                          {candidate.status === "valid" ? "OK" : "Erreur"}
                        </span>
                      </td>
                      <td>{candidate.row.date || "—"}</td>
                      <td>{candidate.row.type || "—"}</td>
                      <td>{candidate.row.compte || "—"}</td>
                      <td>{candidate.row.compte_source || "—"}</td>
                      <td>{candidate.row.compte_destination || "—"}</td>
                      <td>{candidate.row.ticker || "—"}</td>
                      <td>{candidate.row.quantite || "—"}</td>
                      <td>{candidate.row.prix || "—"}</td>
                      <td>{candidate.row.montant || "—"}</td>
                      <td>{candidate.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}


function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="page">
      <div className="title-block">
        <h1>{title}</h1>
        <p>Cette page sera construite après le dashboard et les transactions.</p>
      </div>

      <article className="card placeholder-card">
        <h2>Page prévue</h2>
        <p>On garde la navigation prête, mais on développe les pages par ordre de priorité.</p>
      </article>
    </section>
  );
}

function MetricCard({ label, note, value }: { label: string; note: string; value: string }) {
  return (
    <article className="card metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function Milestone({
  color,
  icon,
  amount,
  isPrivacyMode,
  title,
  badge,
  text,
}: {
  color: string;
  icon: string;
  amount: string;
  isPrivacyMode: boolean;
  title: string;
  badge: string;
  text: string;
}) {
  return (
    <div className="milestone">
      <div className={`milestone-icon ${color}`}>{icon}</div>
      <strong>{displayText(amount, isPrivacyMode)}</strong>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className={`badge ${color}`}>{badge}</span>
    </div>
  );
}


function AllocationLegend({
  amount,
  color,
  label,
  isPrivacyMode,
  percent,
}: {
  amount: number;
  color: string;
  isPrivacyMode: boolean;
  label: string;
  percent: number;
}) {
  return (
    <div className="allocation-legend-line">
      <span style={{ background: color }} />
      <div>
        <strong>{label}</strong>
        <small>{displayCompactEuro(amount, isPrivacyMode)}</small>
      </div>
      <p>{formatUnsignedPercent(percent)}</p>
    </div>
  );
}


function Allocation({
  color,
  isPrivacyMode,
  label,
  value,
}: {
  color: string;
  isPrivacyMode: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="allocation-line">
      <span style={{ background: color }} />
      <p>{label}</p>
      <strong>{displayText(value, isPrivacyMode)}</strong>
    </div>
  );
}

function Attention({ kind, text }: { kind: string; text: string }) {
  return (
    <div className="attention-line">
      <span className={kind}>△</span>
      <p>{text}</p>
      <strong>›</strong>
    </div>
  );
}



const MASKED_AMOUNT = "••••••";

function displayEuro(value: number, isPrivacyMode: boolean) {
  return isPrivacyMode ? MASKED_AMOUNT : formatEuro(value);
}

function displayCompactEuro(value: number, isPrivacyMode: boolean) {
  return isPrivacyMode ? MASKED_AMOUNT : formatCompactEuro(value);
}

function displayText(value: string, isPrivacyMode: boolean) {
  return isPrivacyMode ? MASKED_AMOUNT : value;
}


function buildAllocationDonut(rows: AllocationDisplayRow[]) {
  let start = 0;
  const segments = rows
    .filter((row) => (row.actualPercent ?? 0) > 0)
    .map((row) => {
      const percent = row.actualPercent ?? 0;
      const end = start + percent * 3.6;
      const segment = `${colorForBucket(row.bucket)} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
      start = end;
      return segment;
    });

  return segments.length > 0 ? `conic-gradient(${segments.join(", ")})` : "#eef0f2";
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}


function normalizeCsvValue(value: string | undefined) {
  return (value ?? "").trim();
}

function parseCsvNumber(value: string | undefined) {
  const normalized = normalizeCsvValue(value).replace(/\s/g, "").replace(",", ".");

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function findAccountIdByCsvName(accounts: DashboardData["accounts"], value: string | undefined) {
  const normalized = normalizeCsvValue(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  return (
    accounts.find((account) => account.id.toLowerCase() === normalized)?.id ??
    accounts.find((account) => account.name.toLowerCase() === normalized)?.id ??
    accounts.find((account) => labelForAccountType(account.account_type).toLowerCase() === normalized)?.id ??
    null
  );
}

function findSecurityIdByCsvValue(securities: DbSecurity[], ticker: string | undefined, name: string | undefined) {
  const normalizedTicker = normalizeCsvValue(ticker).toLowerCase();
  const normalizedName = normalizeCsvValue(name).toLowerCase();

  if (normalizedTicker) {
    const byTicker = securities.find((security) => security.ticker.toLowerCase() === normalizedTicker);

    if (byTicker) {
      return byTicker.id;
    }
  }

  if (normalizedName) {
    const byName = securities.find((security) => security.name.toLowerCase() === normalizedName);

    if (byName) {
      return byName.id;
    }
  }

  return null;
}

function validateCsvTransactions(
  csvText: string,
  accounts: DashboardData["accounts"],
  securities: DbSecurity[],
): CsvImportCandidate[] {
  const rows = parseCsvPreview(csvText);

  return rows.map((row) => {
    const type = normalizeCsvValue(row.type).toLowerCase() as TransactionFormType;
    const date = normalizeCsvValue(row.date);
    const amount = parseCsvNumber(row.montant);
    const quantity = parseCsvNumber(row.quantite);
    const price = parseCsvNumber(row.prix);
    const fees = parseCsvNumber(row.frais) ?? 0;
    const note = normalizeCsvValue(row.note) || null;

    if (!date) {
      return { row, status: "error", message: "Date manquante." };
    }

    if (!["deposit", "withdrawal", "transfer", "buy", "sell"].includes(type)) {
      return { row, status: "error", message: "Type invalide." };
    }

    if (fees < 0) {
      return { row, status: "error", message: "Frais négatifs." };
    }

    if (type === "buy" || type === "sell") {
      const accountId = findAccountIdByCsvName(accounts, row.compte);
      const securityId = findSecurityIdByCsvValue(securities, row.ticker, row.actif);

      if (!accountId) {
        return { row, status: "error", message: "Compte introuvable." };
      }

      if (!securityId) {
        return { row, status: "error", message: "Actif introuvable. Créez-le d’abord via la recherche Yahoo." };
      }

      if (!quantity || quantity <= 0) {
        return { row, status: "error", message: "Quantité invalide." };
      }

      if (!price || price <= 0) {
        return { row, status: "error", message: "Prix invalide." };
      }

      return {
        row,
        status: "valid",
        message: "Prêt à importer.",
        payload: {
          transaction_type: type,
          date,
          account_id: accountId,
          security_id: securityId,
          quantity,
          price,
          fees,
          note,
        },
      };
    }

    if (!amount || amount <= 0) {
      return { row, status: "error", message: "Montant invalide." };
    }

    const fromAccountId = findAccountIdByCsvName(accounts, row.compte_source || row.compte);
    const toAccountId = findAccountIdByCsvName(accounts, row.compte_destination || row.compte);

    if (type === "deposit") {
      if (!toAccountId) {
        return { row, status: "error", message: "Compte destination introuvable." };
      }

      return {
        row,
        status: "valid",
        message: "Prêt à importer.",
        payload: {
          transaction_type: type,
          date,
          from_account_id: null,
          to_account_id: toAccountId,
          amount,
          note,
        },
      };
    }

    if (type === "withdrawal") {
      if (!fromAccountId) {
        return { row, status: "error", message: "Compte source introuvable." };
      }

      return {
        row,
        status: "valid",
        message: "Prêt à importer.",
        payload: {
          transaction_type: type,
          date,
          from_account_id: fromAccountId,
          to_account_id: null,
          amount,
          note,
        },
      };
    }

    if (!fromAccountId || !toAccountId) {
      return { row, status: "error", message: "Compte source ou destination introuvable." };
    }

    if (fromAccountId === toAccountId) {
      return { row, status: "error", message: "Source et destination identiques." };
    }

    return {
      row,
      status: "valid",
      message: "Prêt à importer.",
      payload: {
        transaction_type: type,
        date,
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        note,
      },
    };
  });
}


const REQUIRED_TRANSACTION_CSV_HEADERS = [
  "date",
  "type",
  "compte",
  "compte_source",
  "compte_destination",
  "ticker",
  "actif",
  "quantite",
  "prix",
  "frais",
  "montant",
  "note",
];

function getMissingCsvHeaders(text: string) {
  const firstLine = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim());

  if (!firstLine) {
    return [];
  }

  const delimiter = detectCsvDelimiter(firstLine);
  const headers = splitCsvLine(firstLine, delimiter).map((header) => header.trim().toLowerCase());

  return REQUIRED_TRANSACTION_CSV_HEADERS.filter((header) => !headers.includes(header));
}

function detectCsvDelimiter(line: string) {
  const commaCount = countCsvDelimiter(line, ",");
  const semicolonCount = countCsvDelimiter(line, ";");

  return semicolonCount > commaCount ? ";" : ",";
}

function countCsvDelimiter(line: string, delimiter: "," | ";") {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === delimiter && !inQuotes) {
      count += 1;
    }
  }

  return count;
}

function splitCsvLine(line: string, delimiter: "," | ";") {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

function parseCsvPreview(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);

    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}


function colorForBucket(bucket: string) {
  const colors: Record<string, string> = {
    ETF: "#7ca7f7",
    Actions: "#9bd29c",
    Crypto: "#b79bf2",
    Cash: "#f4d47c",
  };

  return colors[bucket] ?? "#d1d5db";
}

function parseDecimal(value: string) {
  return Number(value.replace(",", "."));
}

function isPositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function formatInputDecimal(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number(value.toFixed(8)).toString();
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")} %`;
}

function formatUnsignedPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")} %`;
}


function labelForAccountType(accountType: string) {
  const labels: Record<string, string> = {
    current_account: "Compte courant",
    pea: "PEA",
    cto: "Compte-titres",
    livret_a: "Livret A",
    crypto_wallet: "Compte crypto",
  };

  return labels[accountType] ?? accountType;
}

function formatCompactEuro(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 1000)} k €`;
  }

  return formatEuro(value);
}

function formatChartDate(value: string) {
  if (value === "Aujourd’hui") return value;

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
}


function formatQuantity(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function labelForTransactionType(type: string) {
  const labels: Record<string, string> = {
    deposit: "Dépôt",
    withdrawal: "Retrait",
    transfer: "Transfert",
    buy: "Achat",
    sell: "Vente",
    opening_position: "Position initiale",
    dividend: "Dividende",
    fee: "Frais",
  };

  return labels[type] ?? type;
}

function formatTransactionFlow(transaction: DbTransaction) {
  if (transaction.transaction_type === "transfer") {
    return `${transaction.from_account_name ?? "—"} → ${transaction.to_account_name ?? "—"}`;
  }

  if (transaction.transaction_type === "deposit") {
    return `→ ${transaction.to_account_name ?? transaction.account_name ?? "—"}`;
  }

  if (transaction.transaction_type === "withdrawal") {
    return `${transaction.from_account_name ?? transaction.account_name ?? "—"} →`;
  }

  return transaction.account_name ?? "—";
}

export default App;
