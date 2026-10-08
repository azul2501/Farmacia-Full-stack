import Decimal from "decimal.js";

export type PriceMetrics = {
  unitCost: Decimal | null;
  unitGain: Decimal | null;
  marginOnCost: Decimal | null;
};

function decimal(value: string) {
  try {
    return new Decimal(value || "0");
  } catch {
    return new Decimal(0);
  }
}

export function calculatePriceMetrics(packPrice: string, purchaseFactor: string, salePrice: string): PriceMetrics {
  const factor = decimal(purchaseFactor);
  if (factor.lte(0)) return { unitCost: null, unitGain: null, marginOnCost: null };
  const unitCost = decimal(packPrice).div(factor);
  const unitGain = decimal(salePrice).minus(unitCost);
  const marginOnCost = unitCost.gt(0) ? unitGain.div(unitCost).mul(100) : null;
  return { unitCost, unitGain, marginOnCost };
}
