export type Product = {
  id: number;
  descripcion: string;
  nlaboratorio: string;
  factor: number;
  rsanitario: string;
  pcompra: number;
  stock: number;
  mstock: number;
  pventa: number;
  tipo: "B" | "S";
  lote: boolean;
  estado: boolean;
};
