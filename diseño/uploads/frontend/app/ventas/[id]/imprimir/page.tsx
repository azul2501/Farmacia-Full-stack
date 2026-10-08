import { SalePrintPage } from "@/features/sales/components/sale-print-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalePrintPage saleId={id} />;
}
