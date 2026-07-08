import { FormEvent, useEffect, useState } from "react";
import "./App.css";
import { attentionPoints, monthlyContribution } from "./mocks/mockPortfolio";
import { formatEuro, getAllocationRows, getPositionRows, getPortfolioSummary } from "./core/portfolioCalculations";
import {
  createCashTransaction,
  createSecurityFromOnlineResult,
  createTradeTransaction,
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
        value: formatEuro(position.value),
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

        <button className="nav-link">Importer / Exporter</button>
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
            <button>♢</button>
            <div className="avatar">AP</div>
          </div>
        </header>

        {currentPage === "Positions" ? (
          <PositionsPage positions={positionsPageRows} positionsError={positionsError} priceUpdateSummary={priceUpdateSummary} />
        ) : currentPage === "Transactions" ? (
          <TransactionsPage
            accounts={accounts}
            onTransactionCreated={refreshData}
            securities={securities}
            transactions={transactions}
            transactionsError={transactionsError}
          />
        ) : currentPage === "Portefeuille" ? (
          <DashboardPage
            accounts={accounts}
            allocationRows={allocationRows}
            databaseError={databaseError}
            dashboardData={dashboardData}
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
  isUpdatingPrices,
  onPriceRefresh,
  positionRows,
  priceUpdateError,
  priceUpdateSummary,
  summary,
  snapshots,
}: {
  accounts: DashboardData["accounts"];
  allocationRows: { bucket: string; targetPercent: number; actualPercent?: number; differencePercent?: number; value?: number }[];
  databaseError: string | null;
  dashboardData: DashboardData | null;
  isUpdatingPrices: boolean;
  onPriceRefresh: () => void;
  positionRows: { asset: string; category: string; account: string; quantity: string; value: string; weight: string; performance: string }[];
  priceUpdateError: string | null;
  priceUpdateSummary: PriceUpdateSummary | null;
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
  snapshots: DashboardData["snapshots"];
}) {
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
              <p className="big-number">{formatEuro(summary.total)}</p>
              <p className="positive">
                {formatEuro(summary.performance_amount)} ({formatSignedPercent(summary.performance_percent)}) <span>depuis le début</span>
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

            <PortfolioChart snapshots={snapshots} currentTotal={summary.total} />
          </article>

          <article className="card milestones-card">
            <h2>Paliers</h2>
            <p>Votre stratégie évolue avec la taille de votre patrimoine.</p>

            <div className="milestones">
              <Milestone color="green" icon="↗" amount="5 000 €" title="Construction" badge="Épargne régulière" text="Priorité à la constitution d’un socle diversifié et automatisé." />
              <Milestone color="purple" icon="△" amount="10 000 €" title="Accélération" badge="Efficience & qualité" text="Optimisation des poches, qualité des actifs, fiscalité." />
              <Milestone color="gold" icon="◇" amount="100 000 €" title="Rayonnement" badge="Préservation & options" text="Préservation, diversification avancée, immobilier, hedge." />
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
            <h2>Plan d’allocation cible</h2>
            <p>Mix stratégique cible</p>

            <div className="allocation-row">
              <div className="donut" />
              <div className="legend">
                {allocationRows.map((row) => (
                  <Legend
                    key={row.bucket}
                    color={colorForBucket(row.bucket)}
                    label={row.bucket}
                    value={`${row.targetPercent} %`}
                  />
                ))}
              </div>
            </div>

            <p className="small-note">Votre allocation évolue avec le temps et vos apports.</p>
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
                  <p>{formatEuro(account.total_value)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card contribution-card">
            <h2>✧ Prochain apport</h2>
            <p className="contribution-amount">{formatEuro(monthlyContribution.amount)} / mois</p>
            <p className="muted">Prochain virement : {monthlyContribution.nextDate}</p>
            <p className="suggestion-title">Suggestion d’allocation ⓘ</p>
            <p className="muted">Pour rester aligné sur votre cible, privilégiez :</p>

            {monthlyContribution.allocation.map((line) => (
              <Allocation key={line.label} label={line.label} value={formatEuro(line.value)} color={line.color} />
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



function PortfolioChart({
  currentTotal,
  snapshots,
}: {
  currentTotal: number;
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
          <span key={value}>{formatCompactEuro(value)}</span>
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
  positions,
  positionsError,
  priceUpdateSummary,
}: {
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
        <MetricCard label="Valeur positions" value={formatEuro(totalValue)} note="hors cash" />
        <MetricCard label="Prix de revient" value={formatEuro(totalCost)} note="coût estimé" />
        <MetricCard label="Perf. latente" value={formatEuro(totalPerformance)} note={formatSignedPercent(totalCost > 0 ? (totalPerformance / totalCost) * 100 : 0)} />
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
                <td>{formatEuro(position.average_price)}</td>
                <td>{formatEuro(position.current_price)}</td>
                <td>{updatedBySecurityId.get(position.position_id)?.source ?? position.price_source ?? "manual"}</td>
                <td>{position.price_date ?? "—"}</td>
                <td>{updatedBySecurityId.get(position.position_id)?.used_symbol ?? errorBySecurityId.get(position.position_id)?.used_symbol ?? position.ticker}</td>
                <td className="price-error-cell">{errorBySecurityId.get(position.position_id)?.message ?? "—"}</td>
                <td className="amount-cell">{formatEuro(position.value)}</td>
                <td className={position.performance_amount >= 0 ? "positive" : "negative"}>
                  {formatEuro(position.performance_amount)} ({formatSignedPercent(position.performance_percent)})
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
  onTransactionCreated,
  securities,
  transactions,
  transactionsError,
}: {
  accounts: DashboardData["accounts"];
  onTransactionCreated: () => Promise<void>;
  securities: DbSecurity[];
  transactions: DbTransaction[];
  transactionsError: string | null;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null);

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

  const totalDeposits = transactions
    .filter((transaction) => transaction.transaction_type === "deposit")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalWithdrawals = transactions
    .filter((transaction) => transaction.transaction_type === "withdrawal")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalTransfers = transactions
    .filter((transaction) => transaction.transaction_type === "transfer")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalBuys = transactions
    .filter((transaction) => transaction.transaction_type === "buy")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalSells = transactions
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
        <MetricCard label="Transactions" value={String(transactions.length)} note="enregistrées localement" />
        <MetricCard label="Dépôts" value={formatEuro(totalDeposits)} note="apports entrants" />
        <MetricCard label="Retraits" value={formatEuro(totalWithdrawals)} note="sorties enregistrées" />
        <MetricCard label="Achats" value={formatEuro(totalBuys)} note="ordres exécutés" />
        <MetricCard label="Ventes" value={formatEuro(totalSells)} note="cessions" />
        <MetricCard label="Transferts" value={formatEuro(totalTransfers)} note="entre comptes" />
      </div>

      <article className="card transactions-card">
        <div className="transactions-header">
          <div>
            <h2>Journal des transactions</h2>
            <p>Journal local des opérations enregistrées.</p>
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
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{formatDate(transaction.date)}</td>
                <td><span className={`type-pill ${transaction.transaction_type}`}>{labelForTransactionType(transaction.transaction_type)}</span></td>
                <td>{formatTransactionFlow(transaction)}</td>
                <td>{transaction.security_name ?? "—"}</td>
                <td>{transaction.quantity ? formatQuantity(transaction.quantity) : "—"}</td>
                <td>{transaction.price ? formatEuro(transaction.price) : "—"}</td>
                <td>{transaction.fees ? formatEuro(transaction.fees) : "—"}</td>
                <td className="amount-cell">{formatEuro(transaction.amount)}</td>
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
  onCancel,
  onCreated,
  securities,
  transactionToEdit,
}: {
  accounts: DashboardData["accounts"];
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
                <em>{formatEuro(security.current_price)}</em>
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
  title,
  badge,
  text,
}: {
  color: string;
  icon: string;
  amount: string;
  title: string;
  badge: string;
  text: string;
}) {
  return (
    <div className="milestone">
      <div className={`milestone-icon ${color}`}>{icon}</div>
      <strong>{amount}</strong>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className={`badge ${color}`}>{badge}</span>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="legend-line">
      <span style={{ background: color }} />
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Allocation({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="allocation-line">
      <span style={{ background: color }} />
      <p>{label}</p>
      <strong>{value}</strong>
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
