import { FormEvent, useEffect, useState } from "react";
import "./App.css";
import { attentionPoints, monthlyContribution } from "./mocks/mockPortfolio";
import { formatEuro, getAllocationRows, getPositionRows, getPortfolioSummary } from "./core/portfolioCalculations";
import {
  createCashTransaction,
  createSecurityFromOnlineResult,
  createTradeTransaction,
  createOpeningPositionAdjustments,
  createOpeningCashAdjustments,
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
  "Prévisionnel",
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

type DistributionRow = {
  label: string;
  value: number;
  percent: number;
  color: string;
  targetPercent?: number;
  differencePercent?: number;
  detail?: string;
};

type AccountClassDistribution = {
  accountName: string;
  totalValue: number;
  rows: DistributionRow[];
};

type ForecastPoint = {
  year: number;
  value: number;
  contributions: number;
  performance: number;
};

type ForecastProjection = {
  finalValue: number;
  totalContributions: number;
  totalPerformance: number;
  points: ForecastPoint[];
};


type RecommendationAction = {
  assetClass: string;
  amount: number;
  percent: number;
  title: string;
  instrumentHint: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

type RecommendationAvoidance = {
  label: string;
  reason: string;
  severity: "warning" | "info";
};

type RecommendationPlan = {
  actions: RecommendationAction[];
  avoidances: RecommendationAvoidance[];
  mainMessage: string;
  targetGapMessage: string;
  concentrationMessage: string;
};

type GoalMilestone = {
  amount: number;
  title: string;
  subtitle: string;
  description: string;
  rules: string[];
};

const goalMilestones: GoalMilestone[] = [
  {
    amount: 1_000,
    title: "Base minimale",
    subtitle: "Démarrage propre",
    description: "Éviter la dispersion et construire une première structure lisible.",
    rules: ["Limiter le nombre de lignes.", "Prioriser la régularité des apports.", "Éviter les positions trop petites."],
  },
  {
    amount: 5_000,
    title: "Construction",
    subtitle: "Socle patrimonial",
    description: "Construire un portefeuille simple, diversifié et facile à suivre.",
    rules: ["Renforcer les ETF ou les lignes centrales.", "Garder une poche de cash claire.", "Éviter les achats impulsifs."],
  },
  {
    amount: 10_000,
    title: "Accélération",
    subtitle: "Allocation cible",
    description: "Commencer à piloter l'écart entre l'allocation réelle et l'allocation idéale.",
    rules: ["Rééquilibrer surtout par les nouveaux apports.", "Surveiller les grosses lignes.", "Clarifier le rôle de chaque actif."],
  },
  {
    amount: 25_000,
    title: "Pilotage régulier",
    subtitle: "Suivi structuré",
    description: "Suivre les performances, la concentration et les écarts d'allocation.",
    rules: ["Analyser la performance hors apports.", "Limiter la concentration par ligne.", "Contrôler les classes d'actifs chaque mois."],
  },
  {
    amount: 50_000,
    title: "Diversification avancée",
    subtitle: "Robustesse",
    description: "Diversifier plus finement les zones, secteurs et enveloppes.",
    rules: ["Éviter une dépendance excessive à un secteur.", "Comparer PEA, CTO, cash et crypto.", "Préparer une stratégie long terme plus robuste."],
  },
  {
    amount: 75_000,
    title: "Stabilisation",
    subtitle: "Maîtrise du risque",
    description: "Réduire les angles morts et rendre la stratégie plus défensive si nécessaire.",
    rules: ["Surveiller la volatilité globale.", "Renforcer la liquidité disponible.", "Formaliser des règles de vente ou d'arbitrage."],
  },
  {
    amount: 100_000,
    title: "Optimisation",
    subtitle: "Patrimoine confirmé",
    description: "Optimiser fiscalité, liquidité, diversification et lisibilité globale.",
    rules: ["Penser fiscalité et enveloppes.", "Évaluer l'immobilier ou d'autres poches.", "Conserver une stratégie simple malgré la taille du portefeuille."],
  },
];


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

        {currentPage === "Répartition" ? (
          <AllocationPage
            accounts={accounts}
            allocationRows={allocationRows}
            isPrivacyMode={isPrivacyMode}
            positions={positionsPageRows}
            summary={summary}
          />
        ) : currentPage === "Objectifs" ? (
          <GoalsPage
            isPrivacyMode={isPrivacyMode}
            summary={summary}
          />
        ) : currentPage === "Performance" ? (
          <PerformancePage
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
        ) : currentPage === "Prévisionnel" ? (
          <ForecastPage
            isPrivacyMode={isPrivacyMode}
            summary={summary}
          />
        ) : currentPage === "Recommandations" ? (
          <RecommendationsPage
            accounts={accounts}
            allocationRows={allocationRows}
            isPrivacyMode={isPrivacyMode}
            positions={positionsPageRows}
            summary={summary}
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




function GoalsPage({
  isPrivacyMode,
  summary,
}: {
  isPrivacyMode: boolean;
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
}) {
  const totalValue = Math.max(summary.total, 0);
  const reachedMilestones = goalMilestones.filter((milestone) => totalValue >= milestone.amount);
  const currentMilestone = reachedMilestones[reachedMilestones.length - 1] ?? null;
  const nextMilestone = goalMilestones.find((milestone) => totalValue < milestone.amount) ?? null;
  const displayedMilestone = currentMilestone ?? nextMilestone ?? goalMilestones[0];
  const baselineAmount = currentMilestone?.amount ?? 0;
  const targetAmount = nextMilestone?.amount ?? Math.max(totalValue, 1);
  const progressPercent = nextMilestone
    ? Math.min(Math.max(((totalValue - baselineAmount) / Math.max(targetAmount - baselineAmount, 1)) * 100, 0), 100)
    : 100;
  const remainingAmount = nextMilestone ? Math.max(nextMilestone.amount - totalValue, 0) : 0;

  return (
    <section className="page">
      <div className="title-block">
        <h1>Objectifs</h1>
        <p>Suivi des paliers patrimoniaux, du prochain cap à atteindre et des règles associées.</p>
      </div>

      <div className="transaction-summary-grid goals-summary-grid">
        <MetricCard label="Patrimoine actuel" value={displayEuro(totalValue, isPrivacyMode)} note="base de suivi" />
        <MetricCard label="Palier actuel" value={currentMilestone?.title ?? "Préparation"} note={currentMilestone ? displayEuro(currentMilestone.amount, isPrivacyMode) : "premier palier à atteindre"} />
        <MetricCard label="Prochain palier" value={nextMilestone ? displayEuro(nextMilestone.amount, isPrivacyMode) : "Tous atteints"} note={nextMilestone?.title ?? "objectif haut validé"} />
        <MetricCard label="Reste à atteindre" value={nextMilestone ? displayEuro(remainingAmount, isPrivacyMode) : "—"} note={formatUnsignedPercent(progressPercent)} />
      </div>

      <div className="goals-layout">
        <article className="card goals-progress-card">
          <div className="card-header">
            <h2>Progression vers le prochain palier</h2>
            <span className="status-pill connected">{formatUnsignedPercent(progressPercent)}</span>
          </div>

          <div className="goal-progress-main">
            <div>
              <strong>{nextMilestone ? nextMilestone.title : "Objectif haut atteint"}</strong>
              <p>{nextMilestone ? nextMilestone.description : "Tous les paliers définis sont atteints."}</p>
            </div>
            <span>{nextMilestone ? displayEuro(remainingAmount, isPrivacyMode) : "—"}</span>
          </div>

          <div className="goal-progress-track">
            <span style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="goal-progress-footer">
            <span>{displayEuro(baselineAmount, isPrivacyMode)}</span>
            <span>{nextMilestone ? displayEuro(nextMilestone.amount, isPrivacyMode) : displayEuro(totalValue, isPrivacyMode)}</span>
          </div>
        </article>

        <article className="card goals-guidance-card">
          <h2>Règle du moment</h2>
          <p className="muted">{displayedMilestone.subtitle}</p>
          <h3>{displayedMilestone.title}</h3>
          <p>{displayedMilestone.description}</p>

          <ul className="goal-rule-list">
            {displayedMilestone.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="card goals-milestones-card">
          <h2>Parcours patrimonial</h2>
          <p className="muted">Chaque palier donne une logique de pilotage différente.</p>

          <div className="goal-milestone-list">
            {goalMilestones.map((milestone) => {
              const isDone = totalValue >= milestone.amount;
              const isActive = nextMilestone?.amount === milestone.amount;
              const statusClass = isDone ? "done" : isActive ? "active" : "locked";
              const statusLabel = isDone ? "Atteint" : isActive ? "En cours" : "À venir";

              return (
                <div className={`goal-milestone-row ${statusClass}`} key={milestone.amount}>
                  <div className="goal-milestone-marker">
                    <span>{isDone ? "✓" : isActive ? "→" : "○"}</span>
                  </div>

                  <div>
                    <strong>{milestone.title}</strong>
                    <p>{milestone.description}</p>
                  </div>

                  <div className="goal-milestone-meta">
                    <strong>{displayEuro(milestone.amount, isPrivacyMode)}</strong>
                    <span>{statusLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}




function ForecastPage({
  isPrivacyMode,
  summary,
}: {
  isPrivacyMode: boolean;
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
}) {
  const [monthlyInput, setMonthlyInput] = useState(String(monthlyContribution.amount));
  const [yearsInput, setYearsInput] = useState("10");
  const [annualReturnInput, setAnnualReturnInput] = useState("6");
  const [annualIncreaseInput, setAnnualIncreaseInput] = useState("0");

  const initialValue = Math.max(summary.total, 0);
  const monthlyAmount = Math.max(parseDecimal(monthlyInput) || 0, 0);
  const years = Math.min(Math.max(Math.round(parseDecimal(yearsInput) || 10), 1), 40);
  const annualReturnPercent = Math.min(Math.max(parseDecimal(annualReturnInput) || 0, -20), 30);
  const annualIncreasePercent = Math.min(Math.max(parseDecimal(annualIncreaseInput) || 0, 0), 20);

  const projection = buildForecastProjection(
    initialValue,
    monthlyAmount,
    years,
    annualReturnPercent,
    annualIncreasePercent,
  );

  const scenarios = [
    {
      label: "Prudent",
      returnPercent: 3,
      projection: buildForecastProjection(initialValue, monthlyAmount, years, 3, annualIncreasePercent),
    },
    {
      label: "Central",
      returnPercent: 6,
      projection: buildForecastProjection(initialValue, monthlyAmount, years, 6, annualIncreasePercent),
    },
    {
      label: "Dynamique",
      returnPercent: 8,
      projection: buildForecastProjection(initialValue, monthlyAmount, years, 8, annualIncreasePercent),
    },
  ];

  return (
    <section className="page">
      <div className="title-block">
        <h1>Prévisionnel</h1>
        <p>Simulation du patrimoine futur avec apports mensuels, rendement annuel estimé et intérêts composés.</p>
      </div>

      <div className="forecast-layout">
        <article className="card forecast-settings-card">
          <h2>Hypothèses</h2>
          <p className="muted">Modifiez les paramètres pour voir l’effet des apports et du rendement dans le temps.</p>

          <div className="forecast-input-grid">
            <label>
              Patrimoine de départ
              <input disabled value={displayEuro(initialValue, isPrivacyMode)} />
            </label>

            <label>
              Apport mensuel
              <input
                inputMode="decimal"
                onChange={(event) => setMonthlyInput(event.target.value)}
                value={monthlyInput}
              />
            </label>

            <label>
              Durée en années
              <input
                inputMode="numeric"
                onChange={(event) => setYearsInput(event.target.value)}
                value={yearsInput}
              />
            </label>

            <label>
              Rendement annuel estimé
              <input
                inputMode="decimal"
                onChange={(event) => setAnnualReturnInput(event.target.value)}
                value={annualReturnInput}
              />
            </label>

            <label>
              Hausse annuelle des apports
              <input
                inputMode="decimal"
                onChange={(event) => setAnnualIncreaseInput(event.target.value)}
                value={annualIncreaseInput}
              />
            </label>
          </div>

          <p className="forecast-note">
            Hypothèse simplifiée : les apports sont ajoutés chaque mois, le rendement est composé mensuellement.
            Ce n’est pas une garantie, seulement une simulation.
          </p>
        </article>

        <article className="card forecast-result-card">
          <div className="card-header">
            <h2>Résultat estimé</h2>
            <span className="status-pill connected">{years} ans</span>
          </div>

          <div className="forecast-main-result">
            <p>Patrimoine estimé</p>
            <strong>{displayEuro(projection.finalValue, isPrivacyMode)}</strong>
          </div>

          <div className="forecast-result-grid">
            <div>
              <span>Capital versé</span>
              <strong>{displayEuro(projection.totalContributions, isPrivacyMode)}</strong>
            </div>

            <div>
              <span>Intérêts / performance</span>
              <strong>{displayEuro(projection.totalPerformance, isPrivacyMode)}</strong>
            </div>

            <div>
              <span>Multiplicateur</span>
              <strong>{projection.totalContributions > 0 ? `${(projection.finalValue / projection.totalContributions).toFixed(2).replace(".", ",")}×` : "—"}</strong>
            </div>
          </div>
        </article>

        <article className="card forecast-chart-card">
          <div className="card-header">
            <h2>Projection dans le temps</h2>
            <span className="status-pill connected">{formatSignedPercent(annualReturnPercent)} / an</span>
          </div>

          <ForecastChart projection={projection} isPrivacyMode={isPrivacyMode} />
        </article>

        <article className="card forecast-scenarios-card">
          <h2>Scénarios rapides</h2>
          <p className="muted">Comparaison à apports identiques, selon plusieurs rendements annuels.</p>

          <div className="forecast-scenario-list">
            {scenarios.map((scenario) => (
              <div className="forecast-scenario" key={scenario.label}>
                <div>
                  <strong>{scenario.label}</strong>
                  <span>{formatUnsignedPercent(scenario.returnPercent)} / an</span>
                </div>

                <p>{displayEuro(scenario.projection.finalValue, isPrivacyMode)}</p>
                <small>{displayEuro(scenario.projection.totalPerformance, isPrivacyMode)} d’intérêts/performance</small>
              </div>
            ))}
          </div>
        </article>

        <article className="card forecast-table-card">
          <h2>Détail par année</h2>

          <table className="forecast-table">
            <thead>
              <tr>
                <th>Année</th>
                <th>Capital versé</th>
                <th>Intérêts / performance</th>
                <th>Patrimoine estimé</th>
              </tr>
            </thead>

            <tbody>
              {projection.points.filter((point) => point.year > 0).map((point) => (
                <tr key={point.year}>
                  <td>Année {point.year}</td>
                  <td>{displayEuro(point.contributions, isPrivacyMode)}</td>
                  <td>{displayEuro(point.performance, isPrivacyMode)}</td>
                  <td className="amount-cell">{displayEuro(point.value, isPrivacyMode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </section>
  );
}

function buildForecastProjection(
  initialValue: number,
  monthlyContributionAmount: number,
  years: number,
  annualReturnPercent: number,
  annualContributionIncreasePercent: number,
): ForecastProjection {
  const points: ForecastPoint[] = [];
  const totalMonths = years * 12;
  const monthlyReturn = Math.pow(1 + annualReturnPercent / 100, 1 / 12) - 1;
  const annualContributionIncrease = 1 + annualContributionIncreasePercent / 100;

  let value = initialValue;
  let totalContributions = initialValue;
  let currentMonthlyContribution = monthlyContributionAmount;

  points.push({
    year: 0,
    value,
    contributions: totalContributions,
    performance: 0,
  });

  for (let month = 1; month <= totalMonths; month += 1) {
    value *= 1 + monthlyReturn;
    value += currentMonthlyContribution;
    totalContributions += currentMonthlyContribution;

    if (month % 12 === 0) {
      const performance = value - totalContributions;

      points.push({
        year: month / 12,
        value,
        contributions: totalContributions,
        performance,
      });

      currentMonthlyContribution *= annualContributionIncrease;
    }
  }

  const finalValue = points[points.length - 1]?.value ?? initialValue;
  const finalContributions = points[points.length - 1]?.contributions ?? initialValue;

  return {
    finalValue,
    totalContributions: finalContributions,
    totalPerformance: finalValue - finalContributions,
    points,
  };
}

function ForecastChart({
  isPrivacyMode,
  projection,
}: {
  isPrivacyMode: boolean;
  projection: ForecastProjection;
}) {
  const data = projection.points;
  const chartWidth = 780;
  const chartHeight = 250;
  const topPadding = 18;
  const bottomPadding = 30;
  const values = data.flatMap((point) => [point.value, point.contributions]);
  const maxValue = Math.max(...values, 1);
  const minValue = 0;
  const range = Math.max(maxValue - minValue, 1);

  function pointToCoordinates(value: number, index: number) {
    const x = data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth;
    const y = topPadding + ((maxValue - value) / range) * (chartHeight - topPadding - bottomPadding);

    return { x, y };
  }

  function buildPath(selector: (point: ForecastPoint) => number) {
    return data
      .map((point, index) => {
        const coordinates = pointToCoordinates(selector(point), index);
        return `${index === 0 ? "M" : "L"}${coordinates.x.toFixed(2)} ${coordinates.y.toFixed(2)}`;
      })
      .join(" ");
  }

  const valuePath = buildPath((point) => point.value);
  const contributionPath = buildPath((point) => point.contributions);
  const yLabels = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];

  return (
    <div className="forecast-chart">
      <div className="y-axis">
        {yLabels.map((value) => (
          <span key={value}>{displayCompactEuro(value, isPrivacyMode)}</span>
        ))}
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-label="Projection du patrimoine">
        <path d={contributionPath} className="forecast-chart-contribution-line" />
        <path d={valuePath} className="forecast-chart-value-line" />
      </svg>

      <div className="forecast-chart-footer">
        {data.map((point) => (
          <span key={point.year}>{point.year === 0 ? "Départ" : `A${point.year}`}</span>
        ))}
      </div>

      <div className="forecast-legend">
        <span><i className="forecast-dot value" /> Patrimoine estimé</span>
        <span><i className="forecast-dot contribution" /> Capital versé</span>
      </div>
    </div>
  );
}



function RecommendationsPage({
  accounts,
  allocationRows,
  isPrivacyMode,
  positions,
  summary,
}: {
  accounts: DashboardData["accounts"];
  allocationRows: AllocationDisplayRow[];
  isPrivacyMode: boolean;
  positions: PositionPageRow[];
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
}) {
  const [contributionInput, setContributionInput] = useState(String(monthlyContribution.amount));
  const contributionAmount = Math.max(parseDecimal(contributionInput) || 0, 0);
  const plan = buildRecommendationPlan(allocationRows, positions, accounts, summary.total, contributionAmount);
  const topAction = plan.actions[0] ?? null;
  const totalRecommended = plan.actions.reduce((sum, action) => sum + action.amount, 0);

  return (
    <section className="page">
      <div className="title-block page-title-row">
        <div>
          <h1>Recommandations</h1>
          <p>Plan d’action concret basé sur les écarts d’allocation, la concentration et le prochain apport.</p>
        </div>

        <label className="recommendation-input">
          Prochain apport
          <input
            inputMode="decimal"
            onChange={(event) => setContributionInput(event.target.value)}
            value={contributionInput}
          />
        </label>
      </div>

      <div className="transaction-summary-grid recommendations-summary-grid">
        <MetricCard label="À investir" value={displayEuro(contributionAmount, isPrivacyMode)} note="montant simulé" />
        <MetricCard label="Priorité" value={topAction?.assetClass ?? "—"} note={topAction?.title ?? "aucune action"} />
        <MetricCard label="Montant conseillé" value={displayEuro(totalRecommended, isPrivacyMode)} note="selon écarts cible" />
        <MetricCard label="À éviter" value={String(plan.avoidances.length)} note="renforcements déconseillés" />
      </div>

      <div className="recommendations-layout">
        <article className="card recommendation-main-card">
          <div className="card-header">
            <h2>Plan d’action du mois</h2>
            <span className="status-pill connected">Rééquilibrage</span>
          </div>

          <p className="recommendation-main-message">{plan.mainMessage}</p>

          <div className="recommendation-action-list">
            {plan.actions.length > 0 ? (
              plan.actions.map((action, index) => (
                <div className={`recommendation-action ${action.priority}`} key={`${action.assetClass}-${index}`}>
                  <div className="recommendation-action-rank">{index + 1}</div>

                  <div>
                    <div className="recommendation-action-title">
                      <strong>{action.title}</strong>
                      <span>{action.assetClass}</span>
                    </div>
                    <p>{action.instrumentHint}</p>
                    <small>{action.reason}</small>
                  </div>

                  <div className="recommendation-action-amount">
                    <strong>{displayEuro(action.amount, isPrivacyMode)}</strong>
                    <span>{formatUnsignedPercent(action.percent)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">Aucune action d’achat proposée avec ce montant.</p>
            )}
          </div>
        </article>

        <article className="card recommendation-diagnostic-card">
          <h2>Diagnostic</h2>

          <div className="recommendation-diagnostic-list">
            <div>
              <strong>Écart cible</strong>
              <p>{plan.targetGapMessage}</p>
            </div>

            <div>
              <strong>Concentration</strong>
              <p>{plan.concentrationMessage}</p>
            </div>

            <div>
              <strong>Principe</strong>
              <p>Les recommandations privilégient les nouveaux apports. L’objectif est de corriger sans vendre dans l’urgence.</p>
            </div>
          </div>
        </article>

        <article className="card recommendation-avoid-card">
          <h2>À ne pas renforcer maintenant</h2>
          <p className="muted">Ces lignes ou poches sont déjà trop lourdes ou moins prioritaires.</p>

          <div className="recommendation-avoid-list">
            {plan.avoidances.length > 0 ? (
              plan.avoidances.map((item) => (
                <div className={`recommendation-avoid ${item.severity}`} key={item.label}>
                  <strong>{item.label}</strong>
                  <p>{item.reason}</p>
                </div>
              ))
            ) : (
              <p className="muted">Aucune interdiction forte détectée. Le portefeuille semble proche de sa cible.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function buildRecommendationPlan(
  allocationRows: AllocationDisplayRow[],
  positions: PositionPageRow[],
  accounts: DashboardData["accounts"],
  totalValue: number,
  contributionAmount: number,
): RecommendationPlan {
  const normalizedRows = allocationRows.map((row) => ({
    bucket: row.bucket,
    targetPercent: row.targetPercent,
    actualPercent: row.actualPercent ?? 0,
    differencePercent: row.differencePercent ?? 0,
    value: row.value ?? 0,
  }));

  const underweighted = normalizedRows
    .map((row) => ({
      ...row,
      missingPercent: row.targetPercent - row.actualPercent,
    }))
    .filter((row) => row.missingPercent > 0.5)
    .sort((left, right) => right.missingPercent - left.missingPercent);

  const overweighted = normalizedRows
    .filter((row) => row.actualPercent - row.targetPercent > 1.5)
    .sort((left, right) => (right.actualPercent - right.targetPercent) - (left.actualPercent - left.targetPercent));

  const totalMissing = underweighted.reduce((sum, row) => sum + row.missingPercent, 0);
  const hasPea = accounts.some((account) => account.account_type === "pea");
  const actions = contributionAmount > 0 && totalMissing > 0
    ? underweighted
        .map((row, index) => {
          const rawAmount = contributionAmount * (row.missingPercent / totalMissing);
          const amount = Math.round(rawAmount / 10) * 10;

          return {
            assetClass: row.bucket,
            amount,
            percent: contributionAmount > 0 ? (amount / contributionAmount) * 100 : 0,
            title: titleForRecommendation(row.bucket),
            instrumentHint: instrumentHintForRecommendation(row.bucket, hasPea),
            reason: `${row.bucket} est sous la cible de ${formatUnsignedPercent(row.missingPercent)} : actuel ${formatUnsignedPercent(row.actualPercent)}, cible ${formatUnsignedPercent(row.targetPercent)}.`,
            priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
          } satisfies RecommendationAction;
        })
        .filter((action) => action.amount > 0)
    : [];

  const avoidances: RecommendationAvoidance[] = [];

  for (const row of overweighted) {
    avoidances.push({
      label: `Poche ${row.bucket}`,
      reason: `${row.bucket} est déjà au-dessus de la cible : actuel ${formatUnsignedPercent(row.actualPercent)}, cible ${formatUnsignedPercent(row.targetPercent)}. Priorité aux autres poches.`,
      severity: "warning",
    });
  }

  const concentratedPositions = [...positions]
    .map((position) => ({
      ...position,
      weight: totalValue > 0 ? (position.value / totalValue) * 100 : 0,
    }))
    .filter((position) => position.weight >= 12)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 4);

  for (const position of concentratedPositions) {
    avoidances.push({
      label: position.security_name,
      reason: `Cette ligne pèse ${formatUnsignedPercent(position.weight)} du portefeuille. Évite de la renforcer tant qu’elle reste aussi dominante.`,
      severity: "warning",
    });
  }

  if (actions.some((action) => action.assetClass === "ETF")) {
    avoidances.push({
      label: "Actions individuelles non prioritaires",
      reason: "Les ETF sont sous la cible : les nouveaux apports doivent d’abord améliorer la diversification globale.",
      severity: "info",
    });
  }

  const mainMessage = actions.length > 0
    ? `Avec ${formatEuro(contributionAmount)}, la priorité est de corriger les poches sous-pondérées plutôt que de renforcer les lignes déjà visibles.`
    : "Le portefeuille est proche de son allocation cible ou le montant d’apport est nul. Aucun achat prioritaire n’est proposé.";

  const targetGapMessage = underweighted.length > 0
    ? `Poche la plus en retard : ${underweighted[0].bucket}, avec ${formatUnsignedPercent(underweighted[0].missingPercent)} sous la cible.`
    : "Aucune poche n’est fortement sous-pondérée par rapport à la cible.";

  const concentrationMessage = concentratedPositions.length > 0
    ? `Ligne la plus concentrée : ${concentratedPositions[0].security_name}, à ${formatUnsignedPercent(concentratedPositions[0].weight)} du portefeuille.`
    : "Aucune ligne ne dépasse le seuil de concentration de 12 %.";

  return {
    actions,
    avoidances,
    mainMessage,
    targetGapMessage,
    concentrationMessage,
  };
}

function titleForRecommendation(assetClass: string) {
  const titles: Record<string, string> = {
    ETF: "Acheter en priorité",
    Actions: "Renforcer sélectivement",
    Crypto: "Renforcer prudemment",
    Cash: "Garder en liquidité",
  };

  return titles[assetClass] ?? "Renforcer";
}

function instrumentHintForRecommendation(assetClass: string, hasPea: boolean) {
  const peaText = hasPea ? " via le PEA" : "";

  const hints: Record<string, string> = {
    ETF: `ETF Monde ou ETF S&P 500${peaText}. L’objectif est d’augmenter la diversification internationale.`,
    Actions: "Actions de qualité, mais seulement hors lignes déjà trop lourdes. Évite de renforcer une concentration existante.",
    Crypto: "BTC / ETH uniquement si la poche crypto reste sous la cible et si tu acceptes la volatilité.",
    Cash: "Cash disponible, Livret A ou poche de sécurité. À privilégier si la liquidité est trop basse.",
  };

  return hints[assetClass] ?? "Renforcement selon la poche sous-pondérée.";
}


function AllocationPage({
  accounts,
  allocationRows,
  isPrivacyMode,
  positions,
  summary,
}: {
  accounts: DashboardData["accounts"];
  allocationRows: AllocationDisplayRow[];
  isPrivacyMode: boolean;
  positions: PositionPageRow[];
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
}) {
  const totalValue = Math.max(summary.total, 0);
  const normalizedClassRows = allocationRows.map((row) => ({
    label: row.bucket,
    value: row.value ?? 0,
    percent: row.actualPercent ?? 0,
    targetPercent: row.targetPercent,
    differencePercent: row.differencePercent ?? 0,
    color: colorForBucket(row.bucket),
  }));

  const accountRows = buildAccountDistributionRows(accounts, totalValue);
  const accountClassRows = buildAccountClassDistribution(accounts, positions);
  const positionRows = buildPositionDistributionRows(positions, totalValue);
  const classDonut = buildDistributionDonut(normalizedClassRows);
  const accountDonut = buildDistributionDonut(accountRows);
  const largestClass = [...normalizedClassRows].sort((left, right) => right.value - left.value)[0];
  const largestAccount = [...accountRows].sort((left, right) => right.value - left.value)[0];
  const cashRow = normalizedClassRows.find((row) => row.label === "Cash");

  return (
    <section className="page">
      <div className="title-block">
        <h1>Répartition</h1>
        <p>Analyse de la composition du portefeuille par classe d’actifs, compte, enveloppe et ligne.</p>
      </div>

      <div className="transaction-summary-grid allocation-summary-grid">
        <MetricCard label="Patrimoine total" value={displayEuro(totalValue, isPrivacyMode)} note="base de calcul" />
        <MetricCard label="Classe principale" value={largestClass ? formatUnsignedPercent(largestClass.percent) : "—"} note={largestClass?.label ?? "aucune"} />
        <MetricCard label="Compte principal" value={largestAccount ? formatUnsignedPercent(largestAccount.percent) : "—"} note={largestAccount?.label ?? "aucun"} />
        <MetricCard label="Cash" value={cashRow ? formatUnsignedPercent(cashRow.percent) : "—"} note={displayEuro(cashRow?.value ?? 0, isPrivacyMode)} />
      </div>

      <div className="allocation-dashboard-grid">
        <article className="card allocation-analysis-card">
          <h2>Répartition par classe</h2>
          <p className="muted">Poids réel des grandes poches du portefeuille.</p>

          <div className="allocation-analysis-row">
            <div className="allocation-large-donut" style={{ background: classDonut }} />

            <div className="allocation-detail-list">
              <div className="distribution-line distribution-line-header">
                <span />
                <strong>Classe</strong>
                <p>Actuel</p>
                <em>Idéal</em>
              </div>

              {normalizedClassRows.map((row) => (
                <DistributionLine
                  key={row.label}
                  isPrivacyMode={isPrivacyMode}
                  row={row}
                  showTarget
                />
              ))}
            </div>
          </div>
        </article>

        <article className="card allocation-analysis-card">
          <h2>Répartition par compte</h2>
          <p className="muted">Poids de chaque compte ou enveloppe.</p>

          <div className="allocation-analysis-row">
            <div className="allocation-large-donut" style={{ background: accountDonut }} />

            <div className="allocation-detail-list">
              {accountRows.map((row) => (
                <DistributionLine
                  key={row.label}
                  isPrivacyMode={isPrivacyMode}
                  row={row}
                />
              ))}
            </div>
          </div>
        </article>

        <article className="card allocation-wide-card">
          <h2>Classes par compte</h2>
          <p className="muted">Lecture par enveloppe : PEA, CTO, Livret A, compte crypto, compte courant.</p>

          <div className="account-class-list">
            {accountClassRows.map((account) => (
              <div className="account-class-row" key={account.accountName}>
                <div className="account-class-label">
                  <strong>{account.accountName}</strong>
                  <span>{displayEuro(account.totalValue, isPrivacyMode)}</span>
                </div>

                <div className="stacked-bar">
                  {account.rows.map((row) => (
                    <span
                      key={row.label}
                      style={{
                        width: `${Math.max(row.percent, 0.5)}%`,
                        background: row.color,
                      }}
                      title={`${row.label} · ${formatUnsignedPercent(row.percent)}`}
                    />
                  ))}
                </div>

                <div className="account-class-breakdown">
                  {account.rows.map((row) => (
                    <small key={row.label}>
                      {row.label} · {formatUnsignedPercent(row.percent)}
                    </small>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card allocation-wide-card">
          <h2>Actions / ETF / Crypto / Cash par compte</h2>
          <p className="muted">Vue détaillée pour comprendre où sont logées les classes d’actifs.</p>

          <table className="allocation-table">
            <thead>
              <tr>
                <th>Compte</th>
                <th>ETF</th>
                <th>Actions</th>
                <th>Crypto</th>
                <th>Cash</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {accountClassRows.map((account) => {
                const byLabel = new Map(account.rows.map((row) => [row.label, row]));

                return (
                  <tr key={account.accountName}>
                    <td>{account.accountName}</td>
                    <td>{displayEuro(byLabel.get("ETF")?.value ?? 0, isPrivacyMode)}</td>
                    <td>{displayEuro(byLabel.get("Actions")?.value ?? 0, isPrivacyMode)}</td>
                    <td>{displayEuro(byLabel.get("Crypto")?.value ?? 0, isPrivacyMode)}</td>
                    <td>{displayEuro(byLabel.get("Cash")?.value ?? 0, isPrivacyMode)}</td>
                    <td className="amount-cell">{displayEuro(account.totalValue, isPrivacyMode)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>

        <article className="card allocation-wide-card">
          <h2>Poids par ligne</h2>
          <p className="muted">Les plus grosses positions expliquent la concentration réelle du portefeuille.</p>

          <div className="position-weight-list">
            {positionRows.map((row) => (
              <div className="position-weight-row" key={row.label}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{row.detail}</span>
                </div>

                <div className="target-bar">
                  <span style={{ width: `${Math.min(Math.max(row.percent, 0), 100)}%` }} />
                </div>

                <p>{formatUnsignedPercent(row.percent)}</p>
                <small>{displayEuro(row.value, isPrivacyMode)}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function DistributionLine({
  isPrivacyMode,
  row,
  showTarget = false,
}: {
  isPrivacyMode: boolean;
  row: DistributionRow;
  showTarget?: boolean;
}) {
  return (
    <div className="distribution-line">
      <span style={{ background: row.color }} />

      <div>
        <strong>{row.label}</strong>
        <small>{displayEuro(row.value, isPrivacyMode)}</small>
      </div>

      <p>{formatUnsignedPercent(row.percent)}</p>

      {showTarget ? (
        <em className="distribution-target">
          {formatUnsignedPercent(row.targetPercent ?? 0)}
        </em>
      ) : null}
    </div>
  );
}


function PerformancePage({
  isPrivacyMode,
  positions,
  snapshots,
  summary,
  transactions,
}: {
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

  const visibleTransactions = transactions.filter(
    (transaction) => !["opening_position", "opening_cash"].includes(transaction.transaction_type)
  );
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
  const [openingCashAdjustmentMessage, setOpeningCashAdjustmentMessage] = useState<string | null>(null);
  const [isCreatingOpeningAdjustments, setIsCreatingOpeningAdjustments] = useState(false);
  const [isCreatingOpeningCashAdjustments, setIsCreatingOpeningCashAdjustments] = useState(false);
  const auditItems = buildPortfolioAuditItems(accounts, positions, transactions, isPrivacyMode);
  const warningCount = auditItems.filter((item) => item.status === "warning").length;
  const positionWarningCount = auditItems.filter((item) => item.kind === "position" && item.status === "warning").length;
  const cashWarningCount = auditItems.filter((item) => item.kind === "cash" && item.status === "warning").length;
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

  async function handleCreateOpeningCashAdjustments() {
    setIsCreatingOpeningCashAdjustments(true);
    setOpeningCashAdjustmentMessage(null);

    try {
      const createdCount = await createOpeningCashAdjustments();
      await onRefresh();
      setOpeningCashAdjustmentMessage(
        createdCount > 0
          ? `${createdCount} ajustement(s) de cash d’ouverture créé(s).`
          : "Aucun ajustement cash nécessaire."
      );
    } catch (error) {
      setOpeningCashAdjustmentMessage(String(error));
    } finally {
      setIsCreatingOpeningCashAdjustments(false);
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
        <MetricCard label="Cash vérifié" value={String(cashFlowCount)} note="comptes analysés" />
        <MetricCard label="Alertes" value={String(warningCount)} note={warningCount === 0 ? "aucun écart bloquant" : "écarts à vérifier"} />
      </div>

      <article className="card audit-card">
        <div className="audit-header">
          <div>
            <h2>Diagnostic de cohérence</h2>
            <p>
              Cette page ne modifie pas la base. Elle recalcule les positions et le cash depuis le journal
              pour repérer les écarts avec l’état actuel du portefeuille.
            </p>
          </div>

          <div className="audit-header-actions">
            {positionWarningCount > 0 ? (
              <button
                className="secondary-action"
                disabled={isCreatingOpeningAdjustments}
                onClick={handleCreateOpeningAdjustments}
                type="button"
              >
                {isCreatingOpeningAdjustments ? "Création..." : "Créer les ajustements d’ouverture"}
              </button>
            ) : (
              <span className="status-pill connected">Positions cohérentes</span>
            )}

            {cashWarningCount > 0 ? (
              <button
                className="secondary-action"
                disabled={isCreatingOpeningCashAdjustments}
                onClick={handleCreateOpeningCashAdjustments}
                type="button"
              >
                {isCreatingOpeningCashAdjustments ? "Création..." : "Créer les ajustements cash"}
              </button>
            ) : null}

            <span className={warningCount === 0 ? "status-pill connected" : "status-pill warning"}>
              {warningCount === 0 ? "Cohérent" : `${warningCount} alerte(s)`}
            </span>
          </div>
        </div>

        {openingAdjustmentMessage ? <p className="form-success">{openingAdjustmentMessage}</p> : null}
        {openingCashAdjustmentMessage ? <p className="form-success">{openingCashAdjustmentMessage}</p> : null}

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

    if (transaction.transaction_type === "opening_cash") {
      if (!transaction.account_name) {
        warnings.push({
          kind: "warning",
          label: transaction.id,
          journalValue: "—",
          currentValue: "—",
          difference: "—",
          status: "warning",
          message: "Ajustement cash incomplet : compte manquant.",
        });
        continue;
      }

      addCash(transaction.account_name, amount);
      continue;
    }

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
    const reconstructedCash = cashFlows.get(account.name) ?? 0;
    const currentCash = account.cash_balance;
    const difference = reconstructedCash - currentCash;
    const isOk = Math.abs(difference) <= 0.01;

    if (Math.abs(reconstructedCash) <= 0.000001 && Math.abs(currentCash) <= 0.000001) {
      continue;
    }

    items.push({
      kind: "cash",
      label: `Cash · ${account.name}`,
      journalValue: displayEuro(reconstructedCash, isPrivacyMode),
      currentValue: displayEuro(currentCash, isPrivacyMode),
      difference: displayEuro(difference, isPrivacyMode),
      status: isOk ? "ok" : "warning",
      message: isOk
        ? "Cash cohérent entre le journal de transactions et le solde actuel du compte."
        : "Écart entre le cash reconstruit depuis le journal et le solde actuel. Il faudra ajouter un cash d’ouverture ou compléter les transactions historiques.",
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



function percentOfTotal(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function colorForDistributionIndex(index: number) {
  const colors = ["#7da7f5", "#8bcf91", "#b997f5", "#f5cf73", "#f2a0a0", "#9fd8cb", "#c7b8a0"];
  return colors[index % colors.length];
}

function buildDistributionDonut(rows: DistributionRow[]) {
  const visibleRows = rows.filter((row) => row.value > 0);

  if (visibleRows.length === 0) {
    return "#eef0f2";
  }

  let cursor = 0;
  const segments = visibleRows.map((row) => {
    const start = cursor;
    const end = cursor + row.percent;
    cursor = end;

    return `${row.color} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function buildAccountDistributionRows(accounts: DashboardData["accounts"], totalValue: number): DistributionRow[] {
  return accounts
    .map((account, index) => ({
      label: account.name,
      value: account.total_value,
      percent: percentOfTotal(account.total_value, totalValue),
      color: colorForDistributionIndex(index),
      detail: labelForAccountType(account.account_type),
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
}

function buildAccountClassDistribution(
  accounts: DashboardData["accounts"],
  positions: PositionPageRow[],
): AccountClassDistribution[] {
  return accounts
    .map((account) => {
      const accountPositions = positions.filter((position) => position.account_name === account.name);
      const values = new Map<string, number>();

      for (const position of accountPositions) {
        values.set(position.asset_class, (values.get(position.asset_class) ?? 0) + position.value);
      }

      const investedValue = accountPositions.reduce((sum, position) => sum + position.value, 0);
      const cashValue = Math.max(account.total_value - investedValue, 0);

      if (cashValue > 0.000001) {
        values.set("Cash", (values.get("Cash") ?? 0) + cashValue);
      }

      const rows = ["ETF", "Actions", "Crypto", "Cash"]
        .map((label) => ({
          label,
          value: values.get(label) ?? 0,
          percent: percentOfTotal(values.get(label) ?? 0, account.total_value),
          color: colorForBucket(label),
        }))
        .filter((row) => row.value > 0.000001);

      return {
        accountName: account.name,
        totalValue: account.total_value,
        rows,
      };
    })
    .filter((account) => account.totalValue > 0)
    .sort((left, right) => right.totalValue - left.totalValue);
}

function buildPositionDistributionRows(positions: PositionPageRow[], totalValue: number): DistributionRow[] {
  return [...positions]
    .sort((left, right) => right.value - left.value)
    .map((position) => ({
      label: position.security_name,
      value: position.value,
      percent: percentOfTotal(position.value, totalValue),
      color: colorForBucket(position.asset_class),
      detail: `${position.asset_class} · ${position.account_name}`,
    }));
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
    opening_cash: "Cash initial",
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
