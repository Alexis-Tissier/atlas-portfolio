import type {
  Account,
  AllocationTarget,
  AttentionPoint,
  Position,
  SectorTarget,
  Security,
  StrategyStep,
  Transaction,
} from "../types/portfolio";

export const accounts: Account[] = [
  {
    id: "compte-courant",
    name: "Compte courant",
    type: "current_account",
    currency: "EUR",
    cashBalance: 1534.5,
    includeInNetWorth: true,
  },
  {
    id: "pea",
    name: "PEA",
    type: "pea",
    currency: "EUR",
    cashBalance: 3500,
    includeInNetWorth: true,
  },
  {
    id: "cto",
    name: "CTO",
    type: "cto",
    currency: "EUR",
    cashBalance: 4500,
    includeInNetWorth: true,
  },
  {
    id: "livret-a",
    name: "Livret A",
    type: "livret_a",
    currency: "EUR",
    cashBalance: 6900,
    includeInNetWorth: true,
  },
  {
    id: "crypto-wallet",
    name: "Compte crypto",
    type: "crypto_wallet",
    currency: "EUR",
    cashBalance: 0,
    includeInNetWorth: true,
  },
];

export const securities: Security[] = [
  {
    id: "cw8",
    name: "Amundi MSCI World ETF (CW8)",
    ticker: "CW8.PA",
    isin: "LU1681043599",
    assetClass: "ETF",
    sector: "ETF Monde",
  },
  {
    id: "pea-europe",
    name: "Lyxor PEA MSCI Europe (PEA)",
    ticker: "PCEU.PA",
    assetClass: "ETF",
    sector: "ETF Europe",
  },
  {
    id: "lvmh",
    name: "LVMH",
    ticker: "MC.PA",
    isin: "FR0000121014",
    assetClass: "Actions",
    sector: "Luxe",
  },
  {
    id: "asml",
    name: "ASML Holding",
    ticker: "ASML.AS",
    assetClass: "Actions",
    sector: "Technologie",
  },
  {
    id: "btc",
    name: "Bitcoin (BTC)",
    ticker: "BTC-EUR",
    assetClass: "Crypto",
    sector: "Crypto",
  },
];

export const positions: Position[] = [
  {
    id: "pos-cw8",
    accountId: "pea",
    securityId: "cw8",
    quantity: 152,
    averagePrice: 57.53,
    currentPrice: 64.6871710526,
  },
  {
    id: "pos-europe",
    accountId: "pea",
    securityId: "pea-europe",
    quantity: 98,
    averagePrice: 57.92,
    currentPrice: 62.6765306122,
  },
  {
    id: "pos-lvmh",
    accountId: "pea",
    securityId: "lvmh",
    quantity: 12,
    averagePrice: 391.51,
    currentPrice: 452.7,
  },
  {
    id: "pos-asml",
    accountId: "cto",
    securityId: "asml",
    quantity: 8,
    averagePrice: 502.51,
    currentPrice: 614.1,
  },
  {
    id: "pos-btc",
    accountId: "crypto-wallet",
    securityId: "btc",
    quantity: 0.2789,
    averagePrice: 11958.8,
    currentPrice: 16594.8368591,
  },
];

export const transactions: Transaction[] = [
  {
    id: "tx-001",
    date: "2024-01-12",
    type: "deposit",
    toAccountId: "compte-courant",
    amount: 12000,
    note: "Apport initial fictif",
  },
  {
    id: "tx-002",
    date: "2024-01-15",
    type: "transfer",
    fromAccountId: "compte-courant",
    toAccountId: "pea",
    amount: 5000,
    note: "Transfert compte courant vers PEA",
  },
  {
    id: "tx-003",
    date: "2024-01-16",
    type: "buy",
    accountId: "pea",
    securityId: "cw8",
    quantity: 60,
    price: 57.53,
    fees: 2,
    amount: 3453.8,
  },
  {
    id: "tx-004",
    date: "2024-02-10",
    type: "transfer",
    fromAccountId: "compte-courant",
    toAccountId: "livret-a",
    amount: 2000,
    note: "Mise de sécurité Livret A",
  },
  {
    id: "tx-005",
    date: "2024-04-03",
    type: "buy",
    accountId: "pea",
    securityId: "lvmh",
    quantity: 4,
    price: 391.51,
    fees: 2,
    amount: 1568.04,
  },
  {
    id: "tx-006",
    date: "2024-05-20",
    type: "dividend",
    accountId: "pea",
    securityId: "lvmh",
    amount: 68.4,
    note: "Dividende fictif",
  },
  {
    id: "tx-007",
    date: "2024-07-05",
    type: "buy",
    accountId: "crypto-wallet",
    securityId: "btc",
    quantity: 0.1,
    price: 11958.8,
    fees: 1.5,
    amount: 1197.38,
  },
];

export const allocationTargets: AllocationTarget[] = [
  { bucket: "ETF", targetPercent: 40 },
  { bucket: "Actions", targetPercent: 45 },
  { bucket: "Crypto", targetPercent: 10 },
  { bucket: "Cash", targetPercent: 5 },
];

export const sectorTargets: SectorTarget[] = [
  { sector: "Luxe", targetPercent: 10 },
  { sector: "Technologie", targetPercent: 10 },
  { sector: "Santé", targetPercent: 8 },
  { sector: "Industrie", targetPercent: 7 },
  { sector: "Consommation", targetPercent: 5 },
  { sector: "Énergie", targetPercent: 3 },
  { sector: "Finance", targetPercent: 2 },
];

export const strategySteps: StrategyStep[] = [
  { threshold: 1000, title: "Base minimale", description: "Éviter la dispersion et expliquer chaque écart." },
  { threshold: 2000, title: "Base simple", description: "Limiter le nombre de lignes." },
  { threshold: 3000, title: "Première structure", description: "Observer ETF, actions et cash." },
  { threshold: 4000, title: "Structure lisible", description: "Vérifier la concentration par ligne." },
  { threshold: 5000, title: "Construction", description: "Construire un socle diversifié." },
  { threshold: 10000, title: "Accélération", description: "Rééquilibrer par apports." },
  { threshold: 25000, title: "Pilotage régulier", description: "Suivre secteurs et performance." },
  { threshold: 50000, title: "Diversification avancée", description: "Rendre les objectifs sectoriels plus précis." },
  { threshold: 75000, title: "Stabilisation", description: "Limiter les grosses concentrations." },
  { threshold: 100000, title: "Optimisation", description: "Stabilité, fiscalité, liquidité et diversification globale." },
];

export const attentionPoints: AttentionPoint[] = [
  {
    kind: "red",
    text: "Concentration actions US élevée (38 % du total). Envisagez plus de diversification géographique.",
  },
  {
    kind: "yellow",
    text: "Exposition crypto au-dessus de votre fourchette cible (10 %). Rééquilibrage conseillé.",
  },
  {
    kind: "blue",
    text: "Liquidités faibles (5 %). Gardez une marge de sécurité pour les opportunités et imprévus.",
  },
];

export const monthlyContribution = {
  amount: 1000,
  nextDate: "15 juin 2024",
  allocation: [
    { label: "ETF monde", value: 400, color: "#7ca7f7" },
    { label: "Actions qualité", value: 350, color: "#9bd29c" },
    { label: "Crypto (BTC/ETH)", value: 150, color: "#b79bf2" },
    { label: "Cash (fonds €)", value: 100, color: "#f4d47c" },
  ],
};
