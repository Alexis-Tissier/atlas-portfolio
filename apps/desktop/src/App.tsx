import "./App.css";
import {
  attentionPoints,
  monthlyContribution,
} from "./mocks/mockPortfolio";
import {
  formatEuro,
  getAllocationRows,
  getPositionRows,
  getPortfolioSummary,
} from "./core/portfolioCalculations";

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
  const summary = getPortfolioSummary();
  const positionRows = getPositionRows();
  const allocationRows = getAllocationRows();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav className="nav">
          {nav.map((item, index) => (
            <button className={index === 0 ? "nav-link active" : "nav-link"} key={item}>
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <button className="nav-link">Importer / Exporter</button>
        <button className="nav-link">Paramètres</button>

        <div className="local-data">
          <span className="green-dot" />
          <div>
            <strong>Données locales</strong>
            <p>Dernière synchro : aujourd’hui, 09:34</p>
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
                    {formatEuro(summary.performanceAmount)} (+{summary.performancePercent.toFixed(2).replace(".", ",")} %){" "}
                    <span>depuis le début</span>
                  </p>
                  <p className="muted">Depuis le {summary.startDate}</p>
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
      </main>
    </div>
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

export default App;
