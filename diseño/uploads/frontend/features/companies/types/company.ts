export type Company = {
  id: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  status: "active" | "inactive";
};
