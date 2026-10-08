from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import INVENTORY_ROLES
from apps.audit.services import record_audit
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole
from apps.purchases.models import Purchase, PurchaseStatus
from apps.purchases.serializers import PurchaseSerializer, PurchaseSummarySerializer
from apps.purchases.services import PurchaseService


class PurchaseViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related("supplier", "branch", "destination_warehouse").prefetch_related(
        "items__variant__product", "items__lot"
    )
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": INVENTORY_ROLES}
    search_fields = ["document_number", "supplier__legal_name", "supplier__trade_name"]
    ordering_fields = ["document_date", "created_at", "total"]
    filterset_fields = ["status", "supplier", "branch", "destination_warehouse", "document_type"]

    def get_serializer_class(self):
        return PurchaseSummarySerializer if self.action == "list" else PurchaseSerializer

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        purchase_object = self.get_object()
        try:
            purchase = PurchaseService.receive(
                purchase_id=purchase_object.id,
                company=request.company,
                user=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(
            PurchaseSerializer(purchase, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    def perform_update(self, serializer):
        if serializer.instance.status != PurchaseStatus.DRAFT:
            raise ValidationError("Solo una compra en borrador puede editarse.")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        raise ValidationError("Las compras no se eliminan. Usa la accion de anulacion.")

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        purchase = self.get_object()
        if purchase.status != PurchaseStatus.DRAFT:
            raise ValidationError("Solo una compra en borrador puede anularse en esta etapa.")
        purchase.status = PurchaseStatus.CANCELLED
        purchase.save(update_fields=["status", "updated_at"])
        record_audit(company=request.company, actor=request.user, action="purchase.cancelled", resource=purchase)
        return Response(PurchaseSerializer(purchase, context={"request": request}).data)
