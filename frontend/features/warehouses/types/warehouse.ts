export type Warehouse = {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  code: string;
  status: "active" | "inactive";
};
