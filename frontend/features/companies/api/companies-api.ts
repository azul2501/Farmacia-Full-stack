import type { Pharmacy } from "@/types/domain";

export async function getCompaniesFromApi(): Promise<Pharmacy[]> {
  throw new Error("El repositorio API de empresas se habilitara en la fase Django REST Framework.");
}
