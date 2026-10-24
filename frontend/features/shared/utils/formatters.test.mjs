import assert from "node:assert/strict";
import test from "node:test";
import { formatQuantity, roundDecimal, toIntegerInput, toMoneyInput } from "./formatters.ts";

test("los precios del backend con 4 decimales se muestran con 2", () => {
  assert.equal(toMoneyInput("0.2000"), "0.20");
  assert.equal(toMoneyInput("12.5"), "12.50");
  assert.equal(toMoneyInput("1.005"), "1.01");
  assert.equal(toMoneyInput(3), "3.00");
  assert.equal(toMoneyInput("0"), "0.00");
});

test("precio vacio queda vacio (o el valor por defecto)", () => {
  assert.equal(toMoneyInput(""), "");
  assert.equal(toMoneyInput(null), "");
  assert.equal(toMoneyInput(undefined, "0.00"), "0.00");
  assert.equal(toMoneyInput("abc"), "");
});

test("factores y cantidades enteras sin decimales", () => {
  assert.equal(toIntegerInput("100.0000"), "100");
  assert.equal(toIntegerInput("1.0000"), "1");
  assert.equal(toIntegerInput("10.000"), "10");
  assert.equal(toIntegerInput(""), "");
  assert.equal(toIntegerInput(null, "1"), "1");
});

test("cantidades del backend se muestran sin ceros de mas", () => {
  assert.equal(formatQuantity(Number("10.000")), "10");
  assert.equal(roundDecimal(0.1 + 0.2), 0.3);
});
