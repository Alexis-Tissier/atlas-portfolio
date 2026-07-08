import {
  accounts,
  allocationTargets,
  positions,
  securities,
} from "../mocks/mockPortfolio";
import type {
  AccountSummary,
  AllocationRow,
  Position,
  PositionRow,
  PortfolioSummary,
} from "../types/portfolio";

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 4,
});

export function formatEuro(value: number) {
  return euroFormatter.format(value).replace(/\u00a0/g, " ");
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")} %`;
}

export function getCashTotal() {
  return accounts
    .filter((account) => account.includeInNetWorth)
    .reduce((sum, account) => sum + account.cashBalance, 0);
}

export function getPositionValue(position: Position) {
  return position.quantity * position.currentPrice;
}

export function getPositionCost(position: Position) {
  return position.quantity * position.averagePrice;
}

export function getPositionsTotal() {
  return positions.reduce((sum, position) => sum + getPositionValue(position), 0);
}

export function getPortfolioTotal() {
  return getCashTotal() + getPositionsTotal();
}

export function getPortfolioSummary(): PortfolioSummary {
  return {
    total: getPortfolioTotal(),
    performanceAmount: 7842.31,
    performancePercent: 19.81,
    startDate: "12 janv. 2024",
  };
}

export function getPositionRows(): PositionRow[] {
  const total = getPortfolioTotal();

  return positions.map((position) => {
    const security = securities.find((item) => item.id === position.securityId);
    const account = accounts.find((item) => item.id === position.accountId);

    if (!security || !account) {
      throw new Error(`Position mal configurée : ${position.id}`);
    }

    const value = getPositionValue(position);
    const cost = getPositionCost(position);
    const performance = ((value - cost) / cost) * 100;
    const weight = (value / total) * 100;

    return {
      asset: security.name,
      category: security.assetClass,
      account: account.name,
      quantity: numberFormatter.format(position.quantity),
      value: formatEuro(value),
      weight: `${weight.toFixed(1).replace(".", ",")} %`,
      performance: formatPercent(performance),
      rawValue: value,
      rawWeight: weight,
    };
  });
}

export function getAllocationRows(): AllocationRow[] {
  const total = getPortfolioTotal();
  const totals = new Map<string, number>();

  totals.set("Cash", getCashTotal());

  for (const position of positions) {
    const security = securities.find((item) => item.id === position.securityId);

    if (!security) {
      continue;
    }

    const current = totals.get(security.assetClass) ?? 0;
    totals.set(security.assetClass, current + getPositionValue(position));
  }

  return allocationTargets.map((target) => {
    const value = totals.get(target.bucket) ?? 0;
    const actualPercent = total > 0 ? (value / total) * 100 : 0;

    return {
      bucket: target.bucket,
      targetPercent: target.targetPercent,
      value,
      actualPercent,
      differencePercent: actualPercent - target.targetPercent,
    };
  });
}

export function getAccountSummaries(): AccountSummary[] {
  const total = getPortfolioTotal();

  return accounts.map((account) => {
    const positionsValue = positions
      .filter((position) => position.accountId === account.id)
      .reduce((sum, position) => sum + getPositionValue(position), 0);

    const totalValue = account.cashBalance + positionsValue;

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      cashBalance: account.cashBalance,
      positionsValue,
      totalValue,
      weight: total > 0 ? (totalValue / total) * 100 : 0,
    };
  });
}
