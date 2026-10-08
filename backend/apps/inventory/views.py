from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import ALL_COMPANY_ROLES, INVENTORY_ROLES
from apps.audit.services import record_audit
from apps.catalog.models import ProductVariant
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole, ensure_resource_access
from apps.core.role_policies import INVENTORY_CRUD
from apps.inventory.models import InventoryMovement, Lot, MovementType, Stock
from apps.inventory.serializers import (
    InventoryAdjustmentSerializer,
    InventoryMovementSerializer,
    LotSerializer,
    StockSerializer,
)
from apps.inventory.services import InventoryService, MovementCommand
from apps.tenancy.models import Warehouse


class LotViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Lot.objects.select_related("variant__product")
    serializer_class = LotSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = INVENTORY_CRUD
    search_fields = ["batch_number", "variant__sku", "variant__product__commercial_name"]
    ordering_fields = ["batch_number", "expiry_date", "created_at"]
    filterset_fields = ["variant", "is_blocked", "expiry_date"]


class StockViewSet(CompanyScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Stock.objects.select_related("warehouse", "variant__product", "lot")
    serializer_class = StockSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {
        "list": ALL_COMPANY_ROLES,
        "retrieve": ALL_COMPANY_ROLES,
        "adjustment": INVENTORY_ROLES,
    }
    search_fields = ["variant__sku", "variant__product__commercial_name", "lot__batch_number"]
    ordering_fields = [
        "quantity",
        "updated_at",
        "variant__product__commercial_name",
        "lot__expiry_date",
    ]
    filterset_fields = {"warehouse": ["exact"], "variant": ["exact", "in"], "lot": ["exact"]}

    @action(detail=False, methods=["post"], url_path="adjustments")
    def adjustment(self, request):
        serializer = InventoryAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        warehouse = get_object_or_404(Warehouse, id=data["warehouse"], company=request.company)
        ensure_resource_access(user=request.user, company=request.company, resource=warehouse)
        variant = get_object_or_404(ProductVariant, id=data["variant"], company=request.company)
        lot = None
        if data.get("lot"):
            lot = get_object_or_404(Lot, id=data["lot"], company=request.company, variant=variant)

        movement = InventoryService.apply_movement(
            MovementCommand(
                company=request.company,
                warehouse=warehouse,
                variant=variant,
                lot=lot,
                movement_type=(
                    MovementType.ADJUSTMENT_IN if data["adjustment_type"] == "IN" else MovementType.ADJUSTMENT_OUT
                ),
                quantity=data["quantity"],
                reference_type="inventory.adjustment",
                reference_id=serializer.context.get("request_id", movement_id()),
                performed_by=request.user,
                reason=f"{data['reason']} - {data.get('observation', '')}".strip(" -"),
            )
        )
        record_audit(
            company=request.company,
            actor=request.user,
            action="inventory.adjusted",
            resource=movement,
            payload={"type": data["adjustment_type"], "quantity": str(data["quantity"])},
        )
        return Response(InventoryMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


def movement_id():
    import uuid

    return uuid.uuid4()


class InventoryMovementViewSet(
    CompanyScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = InventoryMovement.objects.select_related(
        "warehouse", "counterpart_warehouse", "variant__product", "lot", "performed_by"
    )
    serializer_class = InventoryMovementSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"list": INVENTORY_ROLES, "retrieve": INVENTORY_ROLES}
    search_fields = [
        "variant__sku",
        "variant__product__commercial_name",
        "lot__batch_number",
        "document_number",
        "reason",
    ]
    ordering_fields = ["created_at", "quantity", "balance_after"]
    filterset_fields = {
        "warehouse": ["exact"],
        "variant": ["exact"],
        "lot": ["exact"],
        "movement_type": ["exact"],
        "performed_by": ["exact"],
        "created_at": ["date__gte", "date__lte"],
    }
