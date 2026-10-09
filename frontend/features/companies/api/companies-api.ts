import type { Pharmacy } from "@/types/domain";

export async function getCompaniesFromApi(): Promise<Pharmacy[]> {
  throw new Error("El repositorio API de empresas se habilitará en la fase Django REST Framework.");
}
