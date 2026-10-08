import { apiRequest } from "@/lib/api";
import type { Product } from "@/features/products/types/product";

type ProductsResponse = {
  data?: Product[];
};

export async function getProductsFromApi(search = ""): Promise<Product[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await apiRequest<ProductsResponse | Product[]>(`/products${query}`);
  return Array.isArray(response) ? response : response.data ?? [];
}
