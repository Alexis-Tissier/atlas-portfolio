import { type ChangeEvent, useMemo, useState } from "react";
import type { PositionPageRow } from "./lib/tauriApi";
import "./SectorAllocationCard.css";

const sectorOverrideStorageKey = "allocation.sectorOverrides.v1";

const sectors = [
  "Luxe",
  "Industrie",
  "Aéronautique & défense",
  "Santé",
  "Technologie",
  "Finance",
  "Énergie",
  "Automobile",
  "Consommation",
  "Télécommunications & médias",
  "Services aux collectivités",
  "Immobilier",
  "Matériaux",
  "Diversifié",
  "Obligations",
  "Crypto",
  "Liquidités",
  "Autre",
] as const;

type SectorName = (typeof sectors)[number];
type SectorOverrides = Record<string, SectorName>;

type GroupedSecurity = {
  securityId: string;
  name: string;
  ticker: string;
  assetClass: string;
  value: number;
  accountNames: string[];
};

type SectorDistributionRow = {
  sector: SectorName;
  value: number;
  percent: number;
  color: string;
  holdings: GroupedSecurity[];
};

const sectorColors: Record<SectorName, string> = {
  Luxe: "#b79068",
  Industrie: "#7ca7f7",
  "Aéronautique & défense": "#6e8dbf",
  Santé: "#82bf9b",
  Technologie: "#9a8ce0",
  Finance: "#6cb7b0",
  Énergie: "#e0a668",
  Automobile: "#9aa6b2",
  Consommation: "#d58fa0",
  "Télécommunications & médias": "#809ec8",
  "Services aux collectivités": "#79b4c5",
  Immobilier: "#c38f83",
  Matériaux: "#c4a56a",
  Diversifié: "#8fb79d",
  Obligations: "#d2a16b",
  Crypto: "#aa91e8",
  Liquidités: "#e8c968",
  Autre: "#aab2bd",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function inferSector(position: Pick<PositionPageRow, "asset_class" | "security_name" | "ticker">): SectorName {
  const assetClass = normalizeText(position.asset_class);
  const ticker = position.ticker.toUpperCase().trim();
  const tickerRoot = ticker.split(/[.:-]/)[0];
  const text = normalizeText(`${position.security_name} ${position.ticker}`);

  if (assetClass.includes("crypto")) return "Crypto";
  if (assetClass.includes("cash") || assetClass.includes("monetaire")) return "Liquidités";
  if (assetClass.includes("obligation")) return "Obligations";
  if (assetClass.includes("immobilier")) return "Immobilier";
  if (assetClass.includes("matiere")) return "Matériaux";

  const tickerIn = (...values: string[]) => values.includes(tickerRoot);

  if (
    tickerIn("MC", "RMS", "KER", "CDI", "CFR", "MONC", "PRDSY", "BRBY")
    || matchesAny(text, [
      "lvmh", "hermes", "kering", "christian dior", "richemont", "moncler",
      "prada", "burberry", "brunello cucinelli", "ferragamo", "luxury",
    ])
  ) return "Luxe";

  if (
    tickerIn("AIR", "SAF", "HO", "AM", "LDO", "RHM", "BA", "RR")
    || matchesAny(text, [
      "airbus", "safran", "thales", "dassault aviation", "leonardo", "rheinmetall",
      "bae systems", "rolls royce", "aeronaut", "aerospace", "defence", "defense",
    ])
  ) return "Aéronautique & défense";

  if (
    tickerIn("SU", "LR", "SGO", "DG", "EN", "ALO", "SIEMENS", "ABB", "CAT")
    || matchesAny(text, [
      "schneider", "legrand", "saint gobain", "vinci", "bouygues", "alstom",
      "siemens", "abb ", "caterpillar", "industrial", "industrie", "automation",
    ])
  ) return "Industrie";

  if (
    tickerIn("SAN", "EL", "ERF", "DIM", "BIO", "NVO", "PFE", "MRK", "JNJ", "AZN")
    || matchesAny(text, [
      "sanofi", "essilor", "eurofins", "sartorius", "biomerieux", "novo nordisk",
      "pfizer", "merck", "johnson", "astrazeneca", "health", "sante", "pharma",
      "medical", "biotech",
    ])
  ) return "Santé";

  if (
    tickerIn("CAP", "DSY", "STMPA", "ASML", "SAP", "MSFT", "AAPL", "NVDA", "GOOGL", "AMD")
    || matchesAny(text, [
      "capgemini", "dassault systemes", "stmicro", "asml", "sap ", "microsoft",
      "apple", "nvidia", "alphabet", "google", "semiconductor", "software",
      "technolog", "informatique", "cyber",
    ])
  ) return "Technologie";

  if (
    tickerIn("BNP", "ACA", "GLE", "CS", "AMUN", "V", "MA", "BLK", "ALV")
    || matchesAny(text, [
      "bnp", "credit agricole", "societe generale", "axa", "amundi", "allianz",
      "blackrock", "visa", "mastercard", "bank", "banque", "assurance", "finance",
    ])
  ) return "Finance";

  if (
    tickerIn("TTE", "SHEL", "BP", "XOM", "CVX", "ENI", "EQNR")
    || matchesAny(text, [
      "totalenergies", "shell", "exxon", "chevron", "equinor", "petrol", "oil",
      "gas", "energie", "energy",
    ])
  ) return "Énergie";

  if (
    tickerIn("RNO", "STLAP", "VOW", "MBG", "BMW", "TSLA", "ML", "RACE")
    || matchesAny(text, [
      "renault", "stellantis", "volkswagen", "mercedes", "bmw", "tesla", "michelin",
      "ferrari", "automobile", "automotive", "auto ",
    ])
  ) return "Automobile";

  if (
    tickerIn("OR", "ADS", "NKE", "BN", "RI", "CA", "UL", "NESN", "MDLZ", "KO", "PEP")
    || matchesAny(text, [
      "l'oreal", "loreal", "adidas", "nike", "danone", "pernod", "carrefour",
      "unilever", "nestle", "mondelez", "coca cola", "pepsico", "consumer",
      "consommation", "retail", "aliment",
    ])
  ) return "Consommation";

  if (
    tickerIn("ORA", "PUB", "VIV", "NFLX", "META", "TMUS", "VZ")
    || matchesAny(text, [
      "orange", "publicis", "vivendi", "netflix", "meta platforms", "telecom",
      "media", "communication",
    ])
  ) return "Télécommunications & médias";

  if (
    tickerIn("ENGI", "VIE", "IBE", "EDP", "NG", "RWE")
    || matchesAny(text, [
      "engie", "veolia", "iberdrola", "electricite", "utilities", "utility",
      "eau ", "water", "reseau electrique",
    ])
  ) return "Services aux collectivités";

  if (
    tickerIn("URW", "ICAD", "GFC", "VNA", "SPG", "O")
    || matchesAny(text, [
      "unibail", "icade", "vonovia", "realty income", "simon property", "reit",
      "immobilier", "real estate",
    ])
  ) return "Immobilier";

  if (
    tickerIn("AI", "MT", "AKE", "BAS", "RIO", "BHP", "GLEN")
    || matchesAny(text, [
      "air liquide", "arcelormittal", "arkema", "basf", "rio tinto", "bhp",
      "glencore", "chimie", "chemical", "acier", "steel", "mining", "materiau",
    ])
  ) return "Matériaux";

  if (assetClass.includes("etf") || assetClass.includes("fonds")) {
    return "Diversifié";
  }

  return "Autre";
}

function readSectorOverrides(): SectorOverrides {
  try {
    const rawValue = window.localStorage.getItem(sectorOverrideStorageKey);
    if (!rawValue) return {};

    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsedValue).filter(
        (entry): entry is [string, SectorName] =>
          typeof entry[1] === "string" && sectors.includes(entry[1] as SectorName),
      ),
    );
  } catch {
    return {};
  }
}

function groupPositions(positions: PositionPageRow[]) {
  const grouped = new Map<string, GroupedSecurity>();

  positions.forEach((position) => {
    if (!Number.isFinite(position.value) || position.value <= 0) return;

    const current = grouped.get(position.security_id);
    if (current) {
      current.value += position.value;
      if (!current.accountNames.includes(position.account_name)) {
        current.accountNames.push(position.account_name);
      }
      return;
    }

    grouped.set(position.security_id, {
      securityId: position.security_id,
      name: position.security_name,
      ticker: position.ticker,
      assetClass: position.asset_class,
      value: position.value,
      accountNames: [position.account_name],
    });
  });

  return [...grouped.values()].sort((left, right) => right.value - left.value);
}

function sectorForSecurity(security: GroupedSecurity, overrides: SectorOverrides) {
  return overrides[security.securityId] ?? inferSector({
    asset_class: security.assetClass,
    security_name: security.name,
    ticker: security.ticker,
  });
}

function buildSectorRows(securities: GroupedSecurity[], overrides: SectorOverrides) {
  const totalValue = securities.reduce((sum, security) => sum + security.value, 0);
  const grouped = new Map<SectorName, GroupedSecurity[]>();

  securities.forEach((security) => {
    const sector = sectorForSecurity(security, overrides);
    const holdings = grouped.get(sector) ?? [];
    holdings.push(security);
    grouped.set(sector, holdings);
  });

  return [...grouped.entries()]
    .map<SectorDistributionRow>(([sector, holdings]) => {
      const value = holdings.reduce((sum, holding) => sum + holding.value, 0);
      return {
        sector,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
        color: sectorColors[sector],
        holdings: [...holdings].sort((left, right) => right.value - left.value),
      };
    })
    .sort((left, right) => right.value - left.value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

function displayEuro(value: number, isPrivacyMode: boolean) {
  if (isPrivacyMode) return "••••••";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SectorAllocationCard({
  isPrivacyMode,
  positions,
}: {
  isPrivacyMode: boolean;
  positions: PositionPageRow[];
}) {
  const [overrides, setOverrides] = useState<SectorOverrides>(() => readSectorOverrides());
  const groupedSecurities = useMemo(() => groupPositions(positions), [positions]);
  const sectorRows = useMemo(
    () => buildSectorRows(groupedSecurities, overrides),
    [groupedSecurities, overrides],
  );
  const totalInvestedValue = groupedSecurities.reduce((sum, security) => sum + security.value, 0);
  const mainSector = sectorRows[0] ?? null;
  const overrideCount = Object.keys(overrides).filter((securityId) =>
    groupedSecurities.some((security) => security.securityId === securityId),
  ).length;

  function updateSectorOverride(securityId: string, sector: SectorName | "automatic") {
    setOverrides((current) => {
      const next = { ...current };

      if (sector === "automatic") {
        delete next[securityId];
      } else {
        next[securityId] = sector;
      }

      window.localStorage.setItem(sectorOverrideStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <article className="card allocation-wide-card sector-allocation-card">
      <div className="sector-allocation-heading">
        <div>
          <h2>Répartition par secteur</h2>
          <p className="muted">
            Classement de la poche investie. Les ETF généralistes restent dans « Diversifié ».
          </p>
        </div>

        <div className="sector-allocation-summary">
          <span>Secteur principal</span>
          <strong>{mainSector?.sector ?? "—"}</strong>
          <small>{mainSector ? formatPercent(mainSector.percent) : "Aucune position"}</small>
        </div>
      </div>

      {groupedSecurities.length === 0 ? (
        <div className="sector-allocation-empty">Aucune position à classer dans ce périmètre.</div>
      ) : (
        <>
          <div className="sector-ranking-list">
            {sectorRows.map((row, index) => (
              <div className="sector-ranking-row" key={row.sector}>
                <span className="sector-ranking-index">{index + 1}</span>

                <div className="sector-ranking-label">
                  <div>
                    <span className="sector-ranking-dot" style={{ background: row.color }} />
                    <strong>{row.sector}</strong>
                  </div>
                  <small>
                    {row.holdings.slice(0, 3).map((holding) => holding.name).join(" · ")}
                    {row.holdings.length > 3 ? ` · +${row.holdings.length - 3}` : ""}
                  </small>
                </div>

                <div className="sector-ranking-bar" aria-hidden="true">
                  <span style={{ background: row.color, width: `${Math.max(row.percent, 1)}%` }} />
                </div>

                <strong className="sector-ranking-percent">{formatPercent(row.percent)}</strong>
                <span className="sector-ranking-value">{displayEuro(row.value, isPrivacyMode)}</span>
              </div>
            ))}
          </div>

          <div className="sector-allocation-footer">
            <span>{sectorRows.length} secteur{sectorRows.length > 1 ? "s" : ""}</span>
            <span>{groupedSecurities.length} ligne{groupedSecurities.length > 1 ? "s" : ""}</span>
            <span>{displayEuro(totalInvestedValue, isPrivacyMode)} investi</span>
          </div>

          <details className="sector-classification-details">
            <summary>Vérifier ou corriger le classement des lignes</summary>
            <p>
              Atlas propose automatiquement un secteur à partir du nom, du ticker et de la classe d’actifs.
              Les corrections sont conservées localement sur cet ordinateur.
              {overrideCount > 0 ? ` ${overrideCount} correction${overrideCount > 1 ? "s" : ""} active${overrideCount > 1 ? "s" : ""}.` : ""}
            </p>

            <div className="sector-classification-table">
              {groupedSecurities.map((security) => {
                const inferredSector = inferSector({
                  asset_class: security.assetClass,
                  security_name: security.name,
                  ticker: security.ticker,
                });
                const selectedSector = overrides[security.securityId] ?? "automatic";

                return (
                  <div className="sector-classification-row" key={security.securityId}>
                    <div>
                      <strong>{security.name}</strong>
                      <span>
                        {security.ticker} · {security.assetClass} · {security.accountNames.join(", ")}
                      </span>
                    </div>

                    <select
                      aria-label={`Secteur de ${security.name}`}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                        updateSectorOverride(
                          security.securityId,
                          event.target.value as SectorName | "automatic",
                        )
                      }
                      value={selectedSector}
                    >
                      <option value="automatic">Automatique · {inferredSector}</option>
                      {sectors.map((sector) => (
                        <option key={sector} value={sector}>{sector}</option>
                      ))}
                    </select>

                    <span>{displayEuro(security.value, isPrivacyMode)}</span>
                  </div>
                );
              })}
            </div>
          </details>
        </>
      )}
    </article>
  );
}
