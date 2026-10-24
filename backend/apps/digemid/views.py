from decimal import Decimal

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.accounts.models import ALL_COMPANY_ROLES, INVENTORY_ROLES
from apps.catalog.serializers import ProductSerializer
from apps.core.permissions import HasCompanyAccess, HasCompanyRole
from apps.digemid.models import MasterBarcode, MasterProduct
from apps.digemid.services import (
    BULK_ADD_LIMIT,
    add_master_product_to_company,
    alerts_with_stock_matches,
    base_catalog_queryset,
    bulk_add_master_products,
    company_codes_in_catalog,
    published_alerts,
)

MIN_SEARCH_LENGTH = 3


class MasterProductSerializer(serializers.ModelSerializer):
    in_my_catalog = serializers.SerializerMethodField()

    class Meta:
        model = MasterProduct
        fields = [
            "id",
            "digemid_code",
            "name",
            "concentration",
            "dosage_form",
            "presentation",
            "fractions",
            "sanitary_registration",
            "holder",
            "manufacturer",
            "active_ingredient",
            "status",
            "product_type",
            "suggested_price",
            "source",
            "in_my_catalog",
        ]

    def get_in_my_catalog(self, obj) -> bool:
        return obj.digemid_code in self.context.get("codes_in_catalog", set())


class AddMasterProductSerializer(serializers.Serializer):
    sale_price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    purchase_price = serializers.DecimalField(max_digits=14, decimal_places=4, min_value=0, required=False)
    minimum_stock = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=0, required=False)
    barcode = serializers.CharField(max_length=64, required=False, allow_blank=True)


class BulkAddSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), required=False, max_length=BULK_ADD_LIMIT)
    all_base = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not attrs.get("ids") and not attrs.get("all_base"):
            raise serializers.ValidationError("Marca al menos un producto.")
        return attrs


class BulkAddResultSerializer(serializers.Serializer):
    added = serializers.IntegerField()
    already_in_catalog = serializers.IntegerField()
    without_price = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.DictField())


class MasterProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo maestro de DIGEMID: buscar y agregar productos a la botica sin escribir la ficha."""

    queryset = MasterProduct.objects.all()
    serializer_class = MasterProductSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {
        "list": ALL_COMPANY_ROLES,
        "retrieve": ALL_COMPANY_ROLES,
        "by_barcode": ALL_COMPANY_ROLES,
        "add": INVENTORY_ROLES,
        "bulk_add": INVENTORY_ROLES,
        "base_summary": ALL_COMPANY_ROLES,
    }
    filter_backends = []

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        search = (self.request.query_params.get("search") or "").strip()
        if len(search) < MIN_SEARCH_LENGTH:
            return queryset.none()
        for word in search.split()[:5]:
            queryset = queryset.filter(
                Q(name__icontains=word)
                | Q(concentration__icontains=word)
                | Q(active_ingredient__icontains=word)
                | Q(digemid_code__iexact=word)
                | Q(sanitary_registration__iexact=word)
            )
        return queryset.order_by("name", "concentration", "digemid_code")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["codes_in_catalog"] = getattr(self, "_codes_in_catalog", set())
        return context

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        items = page if page is not None else []
        self._codes_in_catalog = company_codes_in_catalog(
            company=request.company, codes=[item.digemid_code for item in items]
        )
        serializer = self.get_serializer(items, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=["get"], url_path="by-barcode")
    def by_barcode(self, request):
        code = (request.query_params.get("code") or "").strip()
        barcode = MasterBarcode.objects.select_related("master_product").filter(code=code).first() if code else None
        if barcode is None:
            raise NotFound("Ese código de barras todavía no está enlazado al catálogo DIGEMID.")
        master = barcode.master_product
        self._codes_in_catalog = company_codes_in_catalog(company=request.company, codes=[master.digemid_code])
        return Response(self.get_serializer(master).data)

    @extend_schema(request=AddMasterProductSerializer, responses={201: ProductSerializer})
    @action(detail=True, methods=["post"], url_path="add")
    def add(self, request, pk=None):
        master = self.get_object()
        serializer = AddMasterProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        product = add_master_product_to_company(
            master=master,
            request=request,
            sale_price=data["sale_price"],
            purchase_price=data.get("purchase_price"),
            minimum_stock=data.get("minimum_stock"),
            barcode=data.get("barcode", ""),
        )
        return Response(ProductSerializer(product, context={"request": request}).data, status=status.HTTP_201_CREATED)


    @extend_schema(request=BulkAddSerializer, responses={200: BulkAddResultSerializer})
    @action(detail=False, methods=["post"], url_path="bulk-add")
    def bulk_add(self, request):
        """Agrega varios productos (``ids``) o toda la lista base (``all_base``) con su precio sugerido."""
        serializer = BulkAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["all_base"]:
            masters = base_catalog_queryset().order_by("name", "concentration")
        else:
            masters = MasterProduct.objects.filter(id__in=serializer.validated_data["ids"]).order_by("name")
        summary = bulk_add_master_products(masters=masters, request=request)
        return Response(BulkAddResultSerializer(summary).data)

    @action(detail=False, methods=["get"], url_path="base-summary")
    def base_summary(self, request):
        """Cuántos productos de la lista base tiene ya la botica (para el botón "Cargar toda la lista")."""
        codes = list(base_catalog_queryset().values_list("digemid_code", flat=True))
        in_catalog = len(company_codes_in_catalog(company=request.company, codes=codes))
        return Response({"total": len(codes), "in_my_catalog": in_catalog})


class AlertMatchSerializer(serializers.Serializer):
    product = serializers.CharField()
    lot = serializers.CharField()


class DigemidAlertSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    year = serializers.IntegerField()
    number = serializers.IntegerField()
    title = serializers.CharField()
    url = serializers.URLField()
    lot_numbers = serializers.ListField(child=serializers.CharField())
    sanitary_registrations = serializers.ListField(child=serializers.CharField())
    created_at = serializers.DateTimeField()
    in_stock = AlertMatchSerializer(many=True)


class DigemidAlertListView(generics.GenericAPIView):
    """Últimas alertas de DIGEMID; marca las que mencionan un lote que la botica tiene en stock."""

    permission_classes = [HasCompanyAccess, HasCompanyRole]
    serializer_class = DigemidAlertSerializer
    pagination_class = None

    def get(self, request):
        try:
            limit = min(max(int(request.query_params.get("limit", 10)), 1), 50)
        except ValueError as error:
            raise ValidationError({"limit": "Debe ser un número."}) from error
        rows = alerts_with_stock_matches(company=request.company, alerts=published_alerts(limit))
        data = [
            {
                "id": alert.id,
                "year": alert.year,
                "number": alert.number,
                "title": alert.title,
                "url": alert.url,
                "lot_numbers": alert.lot_numbers,
                "sanitary_registrations": alert.sanitary_registrations,
                "created_at": alert.created_at,
                "in_stock": matches,
            }
            for alert, matches in rows
        ]
        return Response(DigemidAlertSerializer(data, many=True).data)
