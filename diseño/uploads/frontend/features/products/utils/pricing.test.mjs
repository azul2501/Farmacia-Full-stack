import assert from "node:assert/strict";
import test from "node:test";
import { calculatePriceMetrics } from "./pricing.ts";

test("calcula costo, ganancia y margen con precision decimal", () => {
  const result = calculatePriceMetrics("100", "100", "1.50");
  assert.equal(result.unitCost?.toFixed(4), "1.0000");
  assert.equal(result.unitGain?.toFixed(4), "0.5000");
  assert.equal(result.marginOnCost?.toFixed(2), "50.00");
});

test("no calcula metricas con factor cero", () => {
  const result = calculatePriceMetrics("100", "0", "1.50");
  assert.equal(result.unitCost, null);
  assert.equal(result.marginOnCost, null);
});

test("expone margen negativo sin redondeos binarios", () => {
  const result = calculatePriceMetrics("30", "10", "2.50");
  assert.equal(result.unitCost?.toFixed(4), "3.0000");
  assert.equal(result.unitGain?.toFixed(4), "-0.5000");
  assert.equal(result.marginOnCost?.toFixed(2), "-16.67");
});
