import { FormEvent, useEffect, useState } from "react";
import "./App.css";
import { attentionPoints, monthlyContribution } from "./mocks/mockPortfolio";
import { formatEuro, getAllocationRows, getPositionRows, getPortfolioSummary } from "./core/portfolioCalculations";
import {
  createCashTransaction,
  getDashboardData,
  getTransactions,
  type DashboardData,
  type DbTransaction,
  type NewCashTransaction,
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

function App() {
  const [currentPage, setCurrentPage] = useState("Portefeuille");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

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
  }

  useEffect(() => {
    refreshData();
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
            <strong>{dashboardData ? "SQLite connecté" : "Données locales"}</strong>
            <p>{dashboardData ? "Base locale active" : "Mode fallback mock"}</p>
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

        {currentPage === "Transactions" ? (
          <TransactionsPage
            accounts={accounts}
            onTransactionCreated={refreshData}
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
  positionRows,
  summary,
}: {
  accounts: DashboardData["accounts"];
  allocationRows: { bucket: string; targetPercent: number; actualPercent?: number; differencePercent?: number; value?: number }[];
  databaseError: string | null;
  dashboardData: DashboardData | null;
  positionRows: { asset: string; category: string; account: string; quantity: string; value: string; weight: string; performance: string }[];
  summary: { total: number; performance_amount: number; performance_percent: number; start_date: string };
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

            <button className="select-button">Depuis le début⌄</button>
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

            <div className="chart-area">
              <div className="y-axis">
                <span>60 k €</span>
                <span>45 k €</span>
                <span>30 k €</span>
                <span>15 k €</span>
                <span>0 €</span>
              </div>

              <svg viewBox="0 0 780 230" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#7da7f5" stopOpacity="0.26" />
                    <stop offset="100%" stopColor="#7da7f5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 185 L50 170 L100 160 L150 142 L200 126 L250 116 L300 105 L350 91 L400 98 L450 82 L500 72 L550 61 L600 68 L650 47 L700 40 L740 31 L780 18 L780 230 L0 230 Z" fill="url(#fill)" />
                <path d="M0 185 L50 170 L100 160 L150 142 L200 126 L250 116 L300 105 L350 91 L400 98 L450 82 L500 72 L550 61 L600 68 L650 47 L700 40 L740 31 L780 18" fill="none" stroke="#6f9df0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div className="months">
                <span>Janv. 2024</span>
                <span>Mars 2024</span>
                <span>Mai 2024</span>
                <span>Juil. 2024</span>
                <span>Sept. 2024</span>
                <span>Nov. 2024</span>
                <span>Aujourd’hui</span>
              </div>
            </div>
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
              <h2>Base SQLite locale</h2>
              <span className={dashboardData ? "status-pill connected" : "status-pill warning"}>
                {dashboardData ? "Connectée" : "Fallback"}
              </span>
            </div>

            {databaseError ? <p className="error-text">{databaseError}</p> : null}

            <div className="accounts-list">
              {accounts.map((account) => (
                <div className="account-line" key={account.id}>
                  <div>
                    <strong>{account.name}</strong>
                    <span>{account.account_type}</span>
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

function TransactionsPage({
  accounts,
  onTransactionCreated,
  transactions,
  transactionsError,
}: {
  accounts: DashboardData["accounts"];
  onTransactionCreated: () => Promise<void>;
  transactions: DbTransaction[];
  transactionsError: string | null;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const totalDeposits = transactions
    .filter((transaction) => transaction.transaction_type === "deposit")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalWithdrawals = transactions
    .filter((transaction) => transaction.transaction_type === "withdrawal")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalTransfers = transactions
    .filter((transaction) => transaction.transaction_type === "transfer")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <section className="page">
      <div className="title-block page-title-row">
        <div>
          <h1>Transactions</h1>
          <p>Suivi des achats, ventes, dépôts, retraits, dividendes, frais et transferts.</p>
        </div>

        <button className="primary-action" onClick={() => setIsFormOpen((value) => !value)}>
          {isFormOpen ? "Fermer" : "+ Ajouter une transaction"}
        </button>
      </div>

      {isFormOpen ? (
        <CashTransactionForm
          accounts={accounts}
          onCancel={() => setIsFormOpen(false)}
          onCreated={async () => {
            await onTransactionCreated();
            setIsFormOpen(false);
          }}
        />
      ) : null}

      <div className="transaction-summary-grid">
        <MetricCard label="Transactions" value={String(transactions.length)} note="lues depuis SQLite" />
        <MetricCard label="Dépôts" value={formatEuro(totalDeposits)} note="apports entrants" />
        <MetricCard label="Retraits" value={formatEuro(totalWithdrawals)} note="sorties de cash" />
        <MetricCard label="Transferts" value={formatEuro(totalTransfers)} note="entre comptes" />
      </div>

      <article className="card transactions-card">
        <div className="transactions-header">
          <div>
            <h2>Journal des transactions</h2>
            <p>Lecture directe de la table SQLite <code>transactions</code>.</p>
          </div>
          <span className="status-pill connected">SQLite</span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function CashTransactionForm({
  accounts,
  onCancel,
  onCreated,
}: {
  accounts: DashboardData["accounts"];
  onCancel: () => void;
  onCreated: () => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstAccountId = accounts[0]?.id ?? "";
  const secondAccountId = accounts[1]?.id ?? firstAccountId;

  const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal" | "transfer">("deposit");
  const [date, setDate] = useState(today);
  const [fromAccountId, setFromAccountId] = useState(firstAccountId);
  const [toAccountId, setToAccountId] = useState(secondAccountId);
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!fromAccountId && firstAccountId) {
      setFromAccountId(firstAccountId);
    }

    if (!toAccountId && secondAccountId) {
      setToAccountId(secondAccountId);
    }
  }, [firstAccountId, fromAccountId, secondAccountId, toAccountId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(",", "."));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError("Le montant doit être un nombre supérieur à 0.");
      return;
    }

    if (transactionType === "deposit" && !toAccountId) {
      setFormError("Choisis un compte de destination.");
      return;
    }

    if (transactionType === "withdrawal" && !fromAccountId) {
      setFormError("Choisis un compte source.");
      return;
    }

    if (transactionType === "transfer" && (!fromAccountId || !toAccountId)) {
      setFormError("Choisis un compte source et un compte de destination.");
      return;
    }

    if (transactionType === "transfer" && fromAccountId === toAccountId) {
      setFormError("Le compte source et le compte de destination doivent être différents.");
      return;
    }

    const payload: NewCashTransaction = {
      transaction_type: transactionType,
      date,
      amount: parsedAmount,
      note: note.trim() ? note.trim() : null,
      from_account_id: transactionType === "deposit" ? null : fromAccountId,
      to_account_id: transactionType === "withdrawal" ? null : toAccountId,
    };

    setIsSubmitting(true);
    setFormError(null);

    try {
      await createCashTransaction(payload);
      await onCreated();
      setAmount("100");
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
          <h2>Ajouter une transaction cash</h2>
          <p>Première version : dépôt, retrait et transfert. Les achats/ventes viendront après.</p>
        </div>
        <span className="status-pill connected">Écriture SQLite</span>
      </div>

      <form className="transaction-form" onSubmit={handleSubmit}>
        <label>
          Type
          <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as "deposit" | "withdrawal" | "transfer")}>
            <option value="deposit">Dépôt</option>
            <option value="withdrawal">Retrait</option>
            <option value="transfer">Transfert</option>
          </select>
        </label>

        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

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

        <label className="form-note-field">
          Note
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex : virement mensuel vers PEA" />
        </label>

        {formError ? <p className="form-error">{formError}</p> : null}

        <div className="form-actions">
          <button className="secondary-action" type="button" onClick={onCancel}>Annuler</button>
          <button className="primary-action" type="submit" disabled={isSubmitting || accounts.length === 0}>
            {isSubmitting ? "Ajout..." : "Ajouter"}
          </button>
        </div>
      </form>
    </article>
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

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")} %`;
}

function formatUnsignedPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")} %`;
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
