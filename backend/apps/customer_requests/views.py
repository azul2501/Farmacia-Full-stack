from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import SALES_ROLES
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole
from apps.customer_requests.models import CustomerRequest, CustomerRequestStatus
from apps.customer_requests.serializers import (
    ConvertCustomerRequestSerializer,
    CustomerRequestSerializer,
)
from apps.customer_requests.services import CustomerRequestService
from apps.sales.serializers import SaleSerializer


class CustomerRequestViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = CustomerRequest.objects.select_related(
        "customer", "branch", "created_by", "converted_sale"
    ).prefetch_related("items__variant__product", "items__preferred_lot")
    serializer_class = CustomerRequestSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": SALES_ROLES}
    search_fields = ["code", "customer__full_name", "customer__document_number", "contact_phone"]
    ordering_fields = ["scheduled_at", "created_at", "code"]
    filterset_fields = ["customer", "branch", "status", "service_type"]

    def destroy(self, request, *args, **kwargs):
        raise ValidationError("Las solicitudes no se eliminan; deben cancelarse.")

    def _transition(self, request, pk, target_status):
        customer_request_object = self.get_object()
        try:
            customer_request = CustomerRequestService.transition(
                request_id=customer_request_object.id,
                company=request.company,
                user=request.user,
                target_status=target_status,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(CustomerRequestSerializer(customer_request, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self._transition(request, pk, CustomerRequestStatus.PENDING)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        return self._transition(request, pk, CustomerRequestStatus.CONFIRMED)

    @action(detail=True, methods=["post"])
    def prepare(self, request, pk=None):
        return self._transition(request, pk, CustomerRequestStatus.PREPARED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._transition(request, pk, CustomerRequestStatus.CANCELLED)

    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        customer_request_object = self.get_object()
        serializer = ConvertCustomerRequestSerializer(
            data=request.data,
            context={"request": request, "request_id": customer_request_object.id},
        )
        serializer.is_valid(raise_exception=True)
        try:
            sale = serializer.save()
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(
            SaleSerializer(sale).data,
            status=status.HTTP_201_CREATED if serializer.created else status.HTTP_200_OK,
        )
