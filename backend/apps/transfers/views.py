from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import INVENTORY_ROLES
from apps.audit.services import record_audit
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole
from apps.transfers.models import Transfer, TransferStatus
from apps.transfers.serializers import ReceiveTransferSerializer, TransferSerializer
from apps.transfers.services import TransferService


class TransferViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Transfer.objects.select_related(
        "origin_branch", "origin_warehouse", "destination_branch", "destination_warehouse"
    ).prefetch_related("items__variant__product", "items__lot", "receipts__received_by", "receipts__items")
    serializer_class = TransferSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": INVENTORY_ROLES}
    search_fields = ["number", "origin_warehouse__name", "destination_warehouse__name"]
    ordering_fields = ["created_at", "dispatched_at", "received_at", "number"]
    filterset_fields = [
        "status",
        "origin_branch",
        "origin_warehouse",
        "destination_branch",
        "destination_warehouse",
    ]

    def _run_service(self, service, request, pk, **kwargs):
        transfer_object = self.get_object()
        try:
            transfer = service(
                transfer_id=transfer_object.id,
                company=request.company,
                user=request.user,
                **kwargs,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(TransferSerializer(transfer, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="dispatch", url_name="dispatch")
    def dispatch_transfer(self, request, pk=None):
        return self._run_service(TransferService.dispatch, request, pk)

    @action(detail=True, methods=["post"], url_path="start-transit")
    def start_transit(self, request, pk=None):
        return self._run_service(TransferService.start_transit, request, pk)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._run_service(TransferService.cancel, request, pk)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        serializer = ReceiveTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._run_service(
            TransferService.receive,
            request,
            pk,
            received_lines=serializer.validated_data["items"],
            notes=serializer.validated_data.get("notes", ""),
        )

    def destroy(self, request, *args, **kwargs):
        transfer = self.get_object()
        if transfer.status != TransferStatus.DRAFT:
            raise ValidationError("Solo una transferencia en borrador puede eliminarse.")
        record_audit(company=request.company, actor=request.user, action="transfer.deleted", resource=transfer)
        return super().destroy(request, *args, **kwargs)
