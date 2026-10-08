import { getProductsFromApi } from "@/features/products/api/products-api";
import { productFixtures } from "@/features/products/mocks/product-fixtures";
import type { Product } from "@/features/products/types/product";
import { runtimeConfig } from "@/features/shared/config/runtime";

export async function getProducts(search = ""): Promise<Product[]> {
  if (runtimeConfig.dataSource === "api") return getProductsFromApi(search);

  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  return productFixtures
    .filter((product) => product.descripcion.toLocaleLowerCase("es").includes(normalizedSearch))
    .map((product) => ({ ...product }));
}
