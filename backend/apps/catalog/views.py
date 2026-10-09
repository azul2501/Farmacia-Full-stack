import csv
import io
import unicodedata
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import ALL_COMPANY_ROLES, INVENTORY_ROLES
from apps.audit.services import record_audit
from apps.catalog.models import (
    ActiveIngredient,
    Category,
    Customer,
    Laboratory,
    Product,
    ProductBarcode,
    ProductVariant,
    ProductWarehouseLocation,
    Supplier,
    TherapeuticAction,
)
from apps.catalog.serializers import (
    ActiveIngredientSerializer,
    CategorySerializer,
    CustomerSerializer,
    LaboratorySerializer,
    ProductBarcodeSerializer,
    ProductSerializer,
    ProductVariantSerializer,
    ProductWarehouseLocationSerializer,
    SupplierSerializer,
    TherapeuticActionSerializer,
)
from apps.core.permissions import (
    CompanyScopedViewSetMixin,
    HasCompanyAccess,
    HasCompanyRole,
    ensure_resource_access,
)
from apps.core.role_policies import INVENTORY_CRUD, SALES_CRUD

PRODUCT_IMPORT_HEADERS = [
    "CODIGO_BARRAS",
    "NOMBRE_COMERCIAL",
    "CATEGORIA",
    "LABORATORIO",
    "UNIDAD_BASE",
    "PRESENTACION_PRINCIPAL",
    "SE_COMPRA_POR",
    "CONTENIDO_POR_EMPAQUE",
    "COSTO_COMPRA_EMPAQUE",
    "VENDER_UNIDAD",
    "PRECIO_UNIDAD",
    "VENDER_BLISTER",
    "UNIDADES_POR_BLISTER",
    "PRECIO_BLISTER",
    "VENDER_CAJA",
    "PRECIO_CAJA",
    "PRINCIPIO_ACTIVO",
    "ACCION_TERAPEUTICA",
    "PROVEEDOR_HABITUAL",
    "REGISTRO_SANITARIO",
    "CODIGO_DIGEMID",
    "MANEJA_LOTES",
    "CONTROLA_VENCIMIENTO",
    "VENTA_CON_RECETA",
    "MEDICAMENTO_CONTROLADO",
    "VIGILANCIA_SANITARIA",
    "ACUMULA_PUNTOS",
    "INFORMACION_ADICIONAL",
]

STOCK_IMPORT_HEADERS = [
    "CODIGO_BARRAS",
    "ALMACEN",
    "LOTE",
    "VENCIMIENTO",
    "CANTIDAD",
    "COSTO_REAL",
]


def truthy(value):
    return str(value or "").strip().lower() in {"1", "si", "sí", "s", "true", "x", "yes"}


def decimal_text(value, *, required=False, min_value=None):
    raw = str(value or "").strip().replace(",", ".")
    if not raw:
        if required:
            raise ValueError("Es obligatorio.")
        return ""
    try:
        parsed = Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError("Debe ser un número válido.") from exc
    if min_value is not None and parsed < Decimal(str(min_value)):
        raise ValueError(f"Debe ser mayor o igual a {min_value}.")
    return str(parsed)


def plain_text(value):
    """Texto sin tildes ni mayusculas para comparar nombres escritos a mano en Excel."""
    normalized = unicodedata.normalize("NFD", str(value or "").strip().lower())
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def import_decimal(value):
    raw = str(value or "").strip().replace(",", ".")
    try:
        return Decimal(raw) if raw else None
    except InvalidOperation:
        return None


def parse_import_date(value):
    value = (value or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def csv_response(filename, rows):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("\ufeff")
    writer = csv.writer(response)
    writer.writerows(rows)
    return response


def read_csv_upload(uploaded_file):
    try:
        text = uploaded_file.read().decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError({"file": "El archivo debe estar guardado como CSV UTF-8 compatible con Excel."}) from exc
    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;") if sample.strip() else csv.excel
    except csv.Error:
        dialect = csv.excel
    return list(csv.DictReader(io.StringIO(text), dialect=dialect))


class DeactivateInsteadOfDeleteMixin:
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        record_audit(
            company=request.company,
            actor=request.user,
            action=f"{instance._meta.label_lower}.deactivated",
            resource=instance,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CatalogViewSet(DeactivateInsteadOfDeleteMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = INVENTORY_CRUD
    ordering_fields = ["name", "created_at"]
    filterset_fields = ["is_active"]


class CategoryViewSet(CatalogViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    search_fields = ["name"]


class LaboratoryViewSet(CatalogViewSet):
    queryset = Laboratory.objects.all()
    serializer_class = LaboratorySerializer
    search_fields = ["name"]


class ActiveIngredientViewSet(CatalogViewSet):
    queryset = ActiveIngredient.objects.all()
    serializer_class = ActiveIngredientSerializer
    search_fields = ["name"]


class TherapeuticActionViewSet(CatalogViewSet):
    queryset = TherapeuticAction.objects.all()
    serializer_class = TherapeuticActionSerializer
    search_fields = ["name"]


class SupplierViewSet(DeactivateInsteadOfDeleteMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = INVENTORY_CRUD
    search_fields = ["document_number", "legal_name", "trade_name"]
    ordering_fields = ["legal_name", "created_at"]
    filterset_fields = ["is_active", "document_type"]


class CustomerViewSet(DeactivateInsteadOfDeleteMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = SALES_CRUD
    search_fields = ["document_number", "full_name", "phone"]
    ordering_fields = ["full_name", "created_at"]
    filterset_fields = ["is_active", "document_type"]


class ProductViewSet(DeactivateInsteadOfDeleteMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Product.objects.select_related(
        "category", "laboratory", "active_ingredient", "therapeutic_action"
    ).prefetch_related("variants__barcodes")
    serializer_class = ProductSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {
        **INVENTORY_CRUD,
        "by_barcode": ALL_COMPANY_ROLES,
        "template": ALL_COMPANY_ROLES,
        "stock_template": ALL_COMPANY_ROLES,
        "export": ALL_COMPANY_ROLES,
        "import_preview": INVENTORY_ROLES,
        "import_commit": INVENTORY_ROLES,
        "stock_import": INVENTORY_ROLES,
    }
    search_fields = [
        "internal_code",
        "commercial_name",
        "active_ingredient__name",
        "therapeutic_action__name",
        "variants__sku",
        "variants__barcodes__code",
    ]
    ordering_fields = ["commercial_name", "internal_code", "created_at"]
    filterset_fields = [
        "is_active",
        "product_type",
        "category",
        "laboratory",
        "active_ingredient",
        "therapeutic_action",
    ]

    def _resolve_named(self, model, name, errors, field_label, *, required=False):
        value = str(name or "").strip()
        if not value:
            if required:
                errors.append(f"{field_label} es obligatorio.")
            return None
        instance = model.objects.filter(company=self.request.company, name__iexact=value, is_active=True).first()
        if instance is None:
            errors.append(f"{field_label} '{value}' no existe o esta inactivo.")
            return None
        return str(instance.id)

    def _resolve_supplier(self, name, errors):
        value = str(name or "").strip()
        if not value:
            return None
        supplier = (
            Supplier.objects.filter(company=self.request.company, is_active=True)
            .filter(legal_name__iexact=value)
            .first()
            or Supplier.objects.filter(company=self.request.company, is_active=True)
            .filter(trade_name__iexact=value)
            .first()
        )
        if supplier is None:
            errors.append(f"Proveedor habitual '{value}' no existe o esta inactivo.")
            return None
        return str(supplier.id)

    def _row_payload(self, row):
        normalized = {key.strip().upper(): value for key, value in row.items() if key}
        errors = []
        barcode = str(normalized.get("CODIGO_BARRAS", "") or "").strip()
        commercial_name = str(normalized.get("NOMBRE_COMERCIAL", "") or "").strip()
        if not commercial_name:
            errors.append("NOMBRE_COMERCIAL es obligatorio.")

        category = self._resolve_named(Category, normalized.get("CATEGORIA"), errors, "CATEGORIA", required=True)
        laboratory = self._resolve_named(Laboratory, normalized.get("LABORATORIO"), errors, "LABORATORIO")
        active_ingredient = self._resolve_named(
            ActiveIngredient, normalized.get("PRINCIPIO_ACTIVO"), errors, "PRINCIPIO_ACTIVO"
        )
        therapeutic_action = self._resolve_named(
            TherapeuticAction, normalized.get("ACCION_TERAPEUTICA"), errors, "ACCION_TERAPEUTICA"
        )
        usual_supplier = self._resolve_supplier(normalized.get("PROVEEDOR_HABITUAL"), errors)

        if barcode and ProductBarcode.objects.filter(company=self.request.company, code=barcode).exists():
            errors.append(f"El código de barras {barcode} ya existe.")

        unit = str(normalized.get("UNIDAD_BASE", "") or "").strip() or "UNIDAD"
        presentation = str(normalized.get("PRESENTACION_PRINCIPAL", "") or "").strip() or unit
        try:
            purchase_factor = decimal_text(normalized.get("CONTENIDO_POR_EMPAQUE"), required=True, min_value="0.0001")
        except ValueError as exc:
            purchase_factor = "0"
            errors.append(f"CONTENIDO_POR_EMPAQUE: {exc}")
        try:
            purchase_pack_price = decimal_text(normalized.get("COSTO_COMPRA_EMPAQUE"), required=True, min_value="0")
        except ValueError as exc:
            purchase_pack_price = "0"
            errors.append(f"COSTO_COMPRA_EMPAQUE: {exc}")

        sale_variants = []
        if truthy(normalized.get("VENDER_UNIDAD")) or str(normalized.get("PRECIO_UNIDAD", "")).strip():
            try:
                price = decimal_text(normalized.get("PRECIO_UNIDAD"), required=True, min_value="0.01")
                sale_variants.append(
                    {
                        "sale_unit": "UNIDAD",
                        "presentation": "Unidad",
                        "contains_units": "1",
                        "base_sale_price": price,
                    }
                )
            except ValueError as exc:
                errors.append(f"PRECIO_UNIDAD: {exc}")
        if truthy(normalized.get("VENDER_BLISTER")) or str(normalized.get("PRECIO_BLISTER", "")).strip():
            try:
                blister_units = decimal_text(normalized.get("UNIDADES_POR_BLISTER"), required=True, min_value="0.0001")
                price = decimal_text(normalized.get("PRECIO_BLISTER"), required=True, min_value="0.01")
                sale_variants.append(
                    {
                        "sale_unit": "BLISTER",
                        "presentation": f"Blister x {blister_units}",
                        "contains_units": blister_units,
                        "base_sale_price": price,
                    }
                )
            except ValueError as exc:
                errors.append(f"BLISTER: {exc}")
        if truthy(normalized.get("VENDER_CAJA")) or str(normalized.get("PRECIO_CAJA", "")).strip():
            try:
                price = decimal_text(normalized.get("PRECIO_CAJA"), required=True, min_value="0.01")
                sale_variants.append(
                    {
                        "sale_unit": "CAJA",
                        "presentation": f"Caja x {purchase_factor}",
                        "contains_units": purchase_factor,
                        "base_sale_price": price,
                    }
                )
            except ValueError as exc:
                errors.append(f"PRECIO_CAJA: {exc}")
        if not sale_variants:
            errors.append("Activa al menos una forma de venta con precio.")

        requires_expiry = truthy(normalized.get("CONTROLA_VENCIMIENTO"))
        requires_lot = truthy(normalized.get("MANEJA_LOTES")) or requires_expiry
        first_sale = (
            sale_variants[0]
            if sale_variants
            else {
                "sale_unit": "UNIDAD",
                "contains_units": "1",
                "base_sale_price": "0.01",
            }
        )
        payload = {
            "commercial_name": commercial_name,
            "category": category,
            "laboratory": laboratory,
            "active_ingredient": active_ingredient,
            "therapeutic_action": therapeutic_action,
            "usual_supplier": usual_supplier,
            "sanitary_registration": str(normalized.get("REGISTRO_SANITARIO", "") or "").strip(),
            "digemid_code": str(normalized.get("CODIGO_DIGEMID", "") or "").strip(),
            "tax_affectation": "TAXED",
            "product_type": "MEDICINE",
            "requires_lot": requires_lot,
            "requires_expiry": requires_expiry,
            "requires_prescription": truthy(normalized.get("VENTA_CON_RECETA")),
            "is_controlled": truthy(normalized.get("MEDICAMENTO_CONTROLADO")),
            "health_surveillance": truthy(normalized.get("VIGILANCIA_SANITARIA")),
            "earns_points": truthy(normalized.get("ACUMULA_PUNTOS")),
            "additional_info": str(normalized.get("INFORMACION_ADICIONAL", "") or "").strip(),
            "is_active": True,
            "initial_variant": {
                "presentation": presentation,
                "unit_of_measure": unit,
                "sale_unit": first_sale["sale_unit"],
                "conversion_factor": first_sale["contains_units"],
                "allows_fractioning": any(item["sale_unit"] != "CAJA" for item in sale_variants),
                "minimum_stock": "0",
                "purchase_pack_price": purchase_pack_price,
                "purchase_factor": purchase_factor,
                "sale_factor": first_sale["contains_units"],
                "base_sale_price": first_sale["base_sale_price"],
                "currency": "PEN",
                "barcode": barcode,
            },
            "sale_variants": sale_variants,
        }
        return payload, errors

    @action(detail=False, methods=["get"], url_path="by-barcode")
    def by_barcode(self, request):
        code = request.query_params.get("code", "").strip()
        if not code:
            raise ValidationError({"code": "El código de barras es obligatorio."})
        barcode = (
            ProductBarcode.objects.select_related("variant__product")
            .filter(company=request.company, code=code, variant__product__is_active=True)
            .first()
        )
        if barcode is None:
            raise NotFound("No existe un producto activo con ese código de barras.")
        serializer = self.get_serializer(barcode.variant.product)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="template")
    def template(self, request):
        sample = [
            "7750000000012",
            "Paracetamol 500 mg",
            "Medicamentos",
            "Laboratorio Demo",
            "tabletas",
            "",
            "Caja",
            "100",
            "100.00",
            "SI",
            "1.50",
            "SI",
            "10",
            "14.00",
            "SI",
            "135.00",
            "Paracetamol",
            "Analgesico",
            "Proveedor Demo",
            "",
            "",
            "SI",
            "SI",
            "NO",
            "NO",
            "NO",
            "SI",
            "",
        ]
        return csv_response("plantilla-productos.csv", [PRODUCT_IMPORT_HEADERS, sample])

    @action(detail=False, methods=["get"], url_path="stock-template")
    def stock_template(self, request):
        sample = ["7750000000012", "Almacén Central", "LOT-001", "2027-12-31", "100", "1.0000"]
        return csv_response("plantilla-lotes-stock-inicial.csv", [STOCK_IMPORT_HEADERS, sample])

    @action(
        detail=False,
        methods=["post"],
        url_path="stock-import",
        parser_classes=[MultiPartParser, FormParser],
    )
    def stock_import(self, request):
        """Carga stock inicial por lote desde CSV. Sin `commit=true` solo valida y devuelve la vista previa."""
        from apps.inventory.models import Lot, MovementType
        from apps.inventory.services import InventoryService, MovementCommand
        from apps.tenancy.models import Warehouse

        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            raise ValidationError({"file": "Selecciona el archivo CSV de stock inicial."})
        if not uploaded_file.name.lower().endswith(".csv"):
            raise ValidationError({"file": "La carga de stock acepta CSV guardado desde Excel."})
        commit = str(request.data.get("commit", "")).lower() in {"1", "true", "si"}
        today = timezone.localdate()
        warehouses = list(Warehouse.objects.filter(company=request.company, is_active=True).select_related("branch"))
        rows = []
        for index, raw in enumerate(read_csv_upload(uploaded_file), start=2):
            row = {str(key or "").strip().upper(): str(value or "").strip() for key, value in raw.items()}
            errors = []
            barcode = (
                ProductBarcode.objects.select_related("variant__product")
                .filter(company=request.company, code=row.get("CODIGO_BARRAS", ""), variant__is_active=True)
                .first()
            )
            variant = barcode.variant if barcode else None
            if variant is None:
                errors.append("Código de barras no registrado en productos activos.")
            warehouse_name = row.get("ALMACEN", "")
            warehouse = next(
                (w for w in warehouses if plain_text(warehouse_name) in {plain_text(w.name), plain_text(w.code)}),
                None,
            )
            if warehouse is None:
                errors.append(f"Almacen '{warehouse_name}' no existe.")
            else:
                try:
                    ensure_resource_access(user=request.user, company=request.company, resource=warehouse)
                except PermissionDenied:
                    errors.append(f"No tienes acceso al almacén '{warehouse.name}'.")
            quantity = import_decimal(row.get("CANTIDAD"))
            if quantity is None or quantity <= 0:
                errors.append("CANTIDAD debe ser un número mayor a 0.")
            unit_cost = import_decimal(row.get("COSTO_REAL"))
            if row.get("COSTO_REAL") and (unit_cost is None or unit_cost < 0):
                errors.append("COSTO_REAL debe ser un número mayor o igual a 0.")
            batch_number = row.get("LOTE", "").upper()
            expiry = parse_import_date(row.get("VENCIMIENTO", ""))
            if row.get("VENCIMIENTO") and expiry is None:
                errors.append("VENCIMIENTO debe tener formato AAAA-MM-DD o DD/MM/AAAA.")
            if variant is not None:
                product = variant.product
                if product.requires_lot and not batch_number:
                    errors.append("El producto maneja lotes: LOTE es obligatorio.")
                if product.requires_expiry and expiry is None and not row.get("VENCIMIENTO"):
                    errors.append("El producto controla vencimiento: VENCIMIENTO es obligatorio.")
            if expiry is not None and expiry < today:
                errors.append("El lote ya esta vencido; no se carga como stock disponible.")
            rows.append(
                {
                    "row": index,
                    "product": f"{variant.product.commercial_name} {variant.presentation}" if variant else "",
                    "warehouse": warehouse.name if warehouse else warehouse_name,
                    "lot": batch_number,
                    "expiry_date": expiry.isoformat() if expiry else None,
                    "quantity": str(quantity) if quantity is not None else "",
                    "valid": not errors,
                    "errors": errors,
                    "_data": (variant, warehouse, batch_number, expiry, quantity, unit_cost),
                }
            )
        error_count = sum(1 for row in rows if not row["valid"])
        imported = 0
        if commit:
            if not rows:
                raise ValidationError({"file": "El archivo no tiene filas."})
            if error_count:
                raise ValidationError({"file": "Corrige las filas con error antes de importar."})
            batch_id = uuid.uuid4()
            with transaction.atomic():
                for row in rows:
                    variant, warehouse, batch_number, expiry, quantity, unit_cost = row["_data"]
                    lot = None
                    if batch_number or expiry:
                        lot, _ = Lot.objects.get_or_create(
                            company=request.company,
                            variant=variant,
                            batch_number=batch_number or "SIN-LOTE",
                            expiry_date=expiry,
                        )
                    InventoryService.apply_movement(
                        MovementCommand(
                            company=request.company,
                            warehouse=warehouse,
                            variant=variant,
                            lot=lot,
                            movement_type=MovementType.ADJUSTMENT_IN,
                            quantity=quantity,
                            reference_type="inventory.initial_stock",
                            reference_id=batch_id,
                            performed_by=request.user,
                            unit_cost=unit_cost,
                            reason="Stock inicial (importación CSV)",
                        )
                    )
                    imported += 1
                record_audit(
                    company=request.company,
                    actor=request.user,
                    action="inventory.initial_stock_imported",
                    resource=request.company,
                    payload={"rows": imported, "file": uploaded_file.name},
                )
        for row in rows:
            row.pop("_data")
        return Response(
            {
                "rows": rows,
                "valid_count": len(rows) - error_count,
                "error_count": error_count,
                "imported": imported,
            },
            status=status.HTTP_201_CREATED if commit else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        rows = [PRODUCT_IMPORT_HEADERS]
        for product in self.get_queryset().prefetch_related("variants__barcodes").order_by("commercial_name"):
            variants = {variant.sale_unit.upper(): variant for variant in product.variants.all()}
            primary_barcode = ""
            for variant in product.variants.all():
                barcode = variant.barcodes.filter(is_primary=True).first()
                if barcode:
                    primary_barcode = barcode.code
                    break
            unit = variants.get("UNIDAD")
            blister = variants.get("BLISTER")
            box = variants.get("CAJA")
            main_variant = unit or blister or box or product.variants.first()
            rows.append(
                [
                    primary_barcode,
                    product.commercial_name,
                    product.category.name if product.category_id else "",
                    product.laboratory.name if product.laboratory_id else "",
                    main_variant.unit_of_measure if main_variant else "UNIDAD",
                    main_variant.presentation if main_variant else "",
                    "Caja",
                    str(main_variant.purchase_factor) if main_variant else "",
                    str(main_variant.purchase_pack_price) if main_variant else "",
                    "SI" if unit and unit.is_active else "NO",
                    str(unit.base_sale_price) if unit else "",
                    "SI" if blister and blister.is_active else "NO",
                    str(blister.sale_factor) if blister else "",
                    str(blister.base_sale_price) if blister else "",
                    "SI" if box and box.is_active else "NO",
                    str(box.base_sale_price) if box else "",
                    product.active_ingredient.name if product.active_ingredient_id else "",
                    product.therapeutic_action.name if product.therapeutic_action_id else "",
                    str(product.usual_supplier) if product.usual_supplier_id else "",
                    product.sanitary_registration,
                    product.digemid_code,
                    "SI" if product.requires_lot else "NO",
                    "SI" if product.requires_expiry else "NO",
                    "SI" if product.requires_prescription else "NO",
                    "SI" if product.is_controlled else "NO",
                    "SI" if product.health_surveillance else "NO",
                    "SI" if product.earns_points else "NO",
                    product.additional_info,
                ]
            )
        return csv_response("productos.csv", rows)

    @action(
        detail=False,
        methods=["post"],
        url_path="import-preview",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_preview(self, request):
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            raise ValidationError({"file": "Selecciona un archivo CSV compatible con Excel."})
        if not uploaded_file.name.lower().endswith(".csv"):
            raise ValidationError({"file": "Por ahora la importación acepta CSV guardado desde Excel."})
        rows = []
        for index, row in enumerate(read_csv_upload(uploaded_file), start=2):
            payload, errors = self._row_payload(row)
            serializer = self.get_serializer(data=payload)
            if not serializer.is_valid():
                errors.extend([f"{field}: {value}" for field, value in serializer.errors.items()])
            rows.append(
                {
                    "row": index,
                    "name": payload.get("commercial_name"),
                    "barcode": payload.get("initial_variant", {}).get("barcode", ""),
                    "valid": not errors,
                    "errors": errors,
                    "payload": payload if not errors else None,
                }
            )
        return Response(
            {
                "rows": rows,
                "valid_count": sum(1 for row in rows if row["valid"]),
                "error_count": sum(1 for row in rows if not row["valid"]),
            }
        )

    @action(detail=False, methods=["post"], url_path="import-commit")
    def import_commit(self, request):
        rows = request.data.get("rows", [])
        if not isinstance(rows, list) or not rows:
            raise ValidationError({"rows": "No hay filas válidas para importar."})
        created = []
        for payload in rows:
            serializer = self.get_serializer(data=payload)
            serializer.is_valid(raise_exception=True)
            product = serializer.save(company=request.company)
            created.append({"id": str(product.id), "commercial_name": product.commercial_name})
        return Response({"created": created}, status=status.HTTP_201_CREATED)


class ProductVariantViewSet(DeactivateInsteadOfDeleteMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = ProductVariant.objects.select_related("product").prefetch_related("barcodes", "warehouse_locations")
    serializer_class = ProductVariantSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = INVENTORY_CRUD
    search_fields = ["sku", "presentation", "product__commercial_name", "barcodes__code"]
    ordering_fields = ["sku", "product__commercial_name", "base_sale_price"]
    filterset_fields = ["product", "is_active"]

    @action(detail=False, methods=["get"], url_path="by-barcode")
    def by_barcode(self, request):
        code = request.query_params.get("code", "").strip()
        if not code:
            raise ValidationError({"code": "El código de barras es obligatorio."})
        variant = (
            self.get_queryset().filter(barcodes__code=code, is_active=True, product__is_active=True).distinct().first()
        )
        if variant is None:
            raise NotFound("No existe un producto activo con ese código de barras.")
        return Response(self.get_serializer(variant).data)


class ProductBarcodeViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = ProductBarcode.objects.select_related("variant__product")
    serializer_class = ProductBarcodeSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = INVENTORY_CRUD
    search_fields = ["code", "variant__sku", "variant__product__commercial_name"]
    filterset_fields = ["variant", "is_primary"]


class ProductWarehouseLocationViewSet(
    DeactivateInsteadOfDeleteMixin,
    CompanyScopedViewSetMixin,
    viewsets.ModelViewSet,
):
    queryset = ProductWarehouseLocation.objects.select_related("warehouse__branch", "variant__product")
    serializer_class = ProductWarehouseLocationSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = INVENTORY_CRUD
    search_fields = ["code", "description", "aisle", "shelf", "level", "variant__product__commercial_name"]
    ordering_fields = ["code", "warehouse__name", "created_at"]
    filterset_fields = ["warehouse", "variant", "is_active"]
