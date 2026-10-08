import { ProductFormPage } from "@/features/products/components/product-form-page";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductFormPage mode="edit" productId={id} />;
}
