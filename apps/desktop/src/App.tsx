import "./App.css";

const positions = [
  ["Amundi MSCI World ETF (CW8)", "ETF", "152,00", "9 832,45 €", "20,8 %", "+12,45 %"],
  ["Lyxor PEA MSCI Europe (PEA)", "ETF", "98,00", "6 142,30 €", "13,0 %", "+8,21 %"],
  ["LVMH", "Actions", "12,00", "5 432,40 €", "11,5 %", "+15,62 %"],
  ["ASML Holding", "Actions", "8,00", "4 912,80 €", "10,4 %", "+22,18 %"],
  ["Bitcoin (BTC)", "Crypto", "0,2789", "4 628,11 €", "9,8 %", "+38,77 %"],
];

const nav = ["Portefeuille", "Aperçu", "Positions", "Transactions", "Répartition", "Performance", "Objectifs", "Recommandations", "Journal"];

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="window-dots"><span className="red" /><span className="yellow" /><span className="green" /></div>
        <div className="small-logo">▣</div>
        <nav className="nav">
          {nav.map((item, index) => <button className={index === 0 ? "nav-link active" : "nav-link"} key={item}><span>{navIcon(item)}</span>{item}</button>)}
        </nav>
        <div className="sidebar-divider" />
        <button className="nav-link"><span>⇩</span>Importer / Exporter</button>
        <button className="nav-link"><span>⚙</span>Paramètres</button>
        <div className="local-data"><span className="green-dot" /><div><strong>Données locales</strong><p>Dernière synchro : aujourd’hui, 09:34</p></div></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-left"><button>‹</button><button>›</button><strong>Atlas Portfolio</strong></div>
          <div className="top-right"><div className="search">⌕ Rechercher...</div><button>☼</button><button>♢</button><div className="avatar">AP</div></div>
        </header>

        <section className="page">
          <div className="title-block"><h1>Patrimoine</h1><p>Vue d’ensemble de votre situation patrimoniale et de vos objectifs.</p></div>
          <div className="dashboard">
            <section className="left-col">
              <article className="card total-card">
                <div><p className="label">Patrimoine total</p><p className="big-number">47 382,56 €</p><p className="positive">+7 842,31 € (+19,81 %) <span>depuis le début</span></p><p className="muted">Depuis le 12 janv. 2024</p></div>
                <button className="select-button">Depuis le début⌄</button>
              </article>

              <article className="card chart-card">
                <div className="card-header"><h2>Évolution du patrimoine <span>ⓘ</span></h2><div className="tabs"><span>1M</span><span>6M</span><span>1A</span><strong>Tous</strong></div></div>
                <div className="chart-area">
                  <div className="y-axis"><span>60 k €</span><span>45 k €</span><span>30 k €</span><span>15 k €</span><span>0 €</span></div>
                  <svg viewBox="0 0 780 230" preserveAspectRatio="none">
                    <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7da7f5" stopOpacity="0.26" /><stop offset="100%" stopColor="#7da7f5" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0 185 L50 170 L100 160 L150 142 L200 126 L250 116 L300 105 L350 91 L400 98 L450 82 L500 72 L550 61 L600 68 L650 47 L700 40 L740 31 L780 18 L780 230 L0 230 Z" fill="url(#fill)" />
                    <path d="M0 185 L50 170 L100 160 L150 142 L200 126 L250 116 L300 105 L350 91 L400 98 L450 82 L500 72 L550 61 L600 68 L650 47 L700 40 L740 31 L780 18" fill="none" stroke="#6f9df0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="months"><span>Janv. 2024</span><span>Mars 2024</span><span>Mai 2024</span><span>Juil. 2024</span><span>Sept. 2024</span><span>Nov. 2024</span><span>Aujourd’hui</span></div>
                </div>
              </article>

              <article className="card milestones-card">
                <h2>Paliers</h2><p>Votre stratégie évolue avec la taille de votre patrimoine.</p>
                <div className="milestones">
                  <Milestone color="green" icon="↗" amount="5 000 €" title="Construction" badge="Épargne régulière" text="Priorité à la constitution d’un socle diversifié et automatisé." />
                  <Milestone color="purple" icon="△" amount="10 000 €" title="Accélération" badge="Efficience & qualité" text="Optimisation des poches, qualité des actifs, fiscalité." />
                  <Milestone color="gold" icon="◇" amount="100 000 €" title="Rayonnement" badge="Préservation & options" text="Préservation, diversification avancée, immobilier, hedge." />
                </div>
              </article>

              <article className="card positions-card">
                <h2>Principales positions</h2>
                <table><thead><tr><th>Actif</th><th>Catégorie</th><th>Quantité</th><th>Valeur</th><th>Poids</th><th>Perf. latente</th></tr></thead><tbody>{positions.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className={index === 5 ? "positive" : ""} key={`${row[0]}-${index}`}>{index === 0 && <span className="asset-dot" />} {cell}</td>)}</tr>)}</tbody></table>
                <div className="table-action"><button>Voir toutes les positions →</button></div>
              </article>
            </section>

            <aside className="right-col">
              <article className="card allocation-card"><h2>Plan d’allocation cible</h2><p>Mix stratégique cible</p><div className="allocation-row"><div className="donut" /><div className="legend"><Legend color="#7ca7f7" label="ETF" value="40 %" /><Legend color="#9bd29c" label="Actions" value="45 %" /><Legend color="#b79bf2" label="Crypto" value="10 %" /><Legend color="#f4d47c" label="Cash" value="5 %" /></div></div><p className="small-note">Votre allocation évolue avec le temps et vos apports.</p></article>
              <article className="card contribution-card"><h2>✧ Prochain apport</h2><p className="contribution-amount">1 000 € / mois</p><p className="muted">Prochain virement : 15 juin 2024</p><p className="suggestion-title">Suggestion d’allocation ⓘ</p><p className="muted">Pour rester aligné sur votre cible, privilégiez :</p><Allocation label="ETF monde" value="+400 €" color="#7ca7f7" /><Allocation label="Actions qualité" value="+350 €" color="#9bd29c" /><Allocation label="Crypto (BTC/ETH)" value="+150 €" color="#b79bf2" /><Allocation label="Cash (fonds €)" value="+100 €" color="#f4d47c" /><button className="manual-button">⚙ Ajuster manuellement</button></article>
              <article className="card attention-card"><h2>♡ Points d’attention</h2><Attention kind="red" text="Concentration actions US élevée (38 % du total). Envisagez plus de diversification géographique." /><Attention kind="yellow" text="Exposition crypto au-dessus de votre fourchette cible (10 %). Rééquilibrage conseillé." /><Attention kind="blue" text="Liquidités faibles (5 %). Gardez une marge de sécurité pour les opportunités et imprévus." /></article>
              <article className="quote-card"><p>La constance bat l’intensité. Restez aligné sur votre plan d’allocation et vos objectifs.</p><span>Atlas Portfolio</span></article>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

function Milestone({ color, icon, amount, title, badge, text }: { color: string; icon: string; amount: string; title: string; badge: string; text: string }) {
  return <div className="milestone"><div className={`milestone-icon ${color}`}>{icon}</div><strong>{amount}</strong><h3>{title}</h3><p>{text}</p><span className={`badge ${color}`}>{badge}</span></div>;
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="legend-line"><span style={{ background: color }} /><p>{label}</p><strong>{value}</strong></div>;
}

function Allocation({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="allocation-line"><span style={{ background: color }} /><p>{label}</p><strong>{value}</strong></div>;
}

function Attention({ kind, text }: { kind: string; text: string }) {
  return <div className="attention-line"><span className={kind}>△</span><p>{text}</p><strong>›</strong></div>;
}

function navIcon(item: string) {
  const icons: Record<string, string> = { Portefeuille: "▣", Aperçu: "◉", Positions: "▥", Transactions: "↔", Répartition: "◔", Performance: "⌁", Objectifs: "◎", Recommandations: "✧", Journal: "▤" };
  return icons[item] ?? "•";
}

export default App;
