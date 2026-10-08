import { getCompaniesFromApi } from "@/features/companies/api/companies-api";
import { pharmacyFixtures } from "@/features/companies/mocks/pharmacy-fixtures";
import { runtimeConfig } from "@/features/shared/config/runtime";
import type { Pharmacy } from "@/types/domain";

export async function getCompanies(): Promise<Pharmacy[]> {
  if (runtimeConfig.dataSource === "api") return getCompaniesFromApi();
  return pharmacyFixtures.map((pharmacy) => ({ ...pharmacy }));
}
