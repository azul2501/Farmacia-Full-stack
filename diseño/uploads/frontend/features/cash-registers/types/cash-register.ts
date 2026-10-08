export type CashRegister = {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  status: "open" | "closed" | "closing";
};
