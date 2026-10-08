export type NamedOption = { id: string; name: string; is_active: boolean };

export type SupplierOption = {
  id: string;
  document_type: string;
  document_number: string;
  legal_name: string;
  trade_name: string;
  is_active: boolean;
};

export type Barcode = { id: string; code: string; is_primary: boolean };

export type ProductVariant = {
  id: string;
  sku: string;
  presentation: string;
  unit_of_measure: string;
  sale_unit: string;
  conversion_factor: string;
  allows_fractioning: boolean;
  minimum_stock: string;
  purchase_pack_price: string;
  purchase_factor: string;
  unit_purchase_cost: string;
  sale_factor: string;
  base_sale_price: string;
  currency: string;
  unit_gain: string;
  margin_on_cost: string | null;
  is_active: boolean;
  barcodes: Barcode[];
};

export type Product = {
  id: string;
  internal_code: string;
  commercial_name: string;
  category: string;
  category_name: string;
  laboratory: string | null;
  laboratory_name: string | null;
  active_ingredient: string | null;
  active_ingredient_name: string | null;
  therapeutic_action: string | null;
  therapeutic_action_name: string | null;
  usual_supplier: string | null;
  usual_supplier_name: string | null;
  sanitary_registration: string;
  digemid_code: string;
  tax_affectation: string;
  product_type: string;
  requires_lot: boolean;
  requires_expiry: boolean;
  is_controlled: boolean;
  requires_prescription: boolean;
  health_surveillance: boolean;
  earns_points: boolean;
  additional_info: string;
  is_active: boolean;
  variants: ProductVariant[];
};

export type ProductLocation = {
  id: string;
  variant: string;
  warehouse: string;
  code: string;
  description: string;
  aisle: string;
  shelf: string;
  level: string;
};

export type ImportPreviewRow = {
  row: number;
  name: string;
  barcode: string;
  valid: boolean;
  errors: string[];
  payload: Record<string, unknown> | null;
};

export type ImportPreviewResponse = {
  rows: ImportPreviewRow[];
  valid_count: number;
  error_count: number;
};
