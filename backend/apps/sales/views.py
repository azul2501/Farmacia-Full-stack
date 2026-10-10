from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import MANAGEMENT_ROLES, SALES_ROLES
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole
from apps.sales.models import Sale
from apps.sales.serializers import CheckoutSerializer, SaleCancelSerializer, SaleSerializer


class SaleViewSet(
    CompanyScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Sale.objects.select_related("branch", "warehouse", "terminal", "customer", "sold_by").prefetch_related(
        "items__variant__product", "items__lot", "payments"
    )
    serializer_class = SaleSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": SALES_ROLES, "cancel": MANAGEMENT_ROLES}
    search_fields = ["number", "customer__full_name", "customer__document_number"]
    ordering_fields = ["sold_at", "total", "number"]
    filterset_fields = {
        "branch": ["exact"],
        "warehouse": ["exact"],
        "terminal": ["exact"],
        "cash_session": ["exact"],
        "status": ["exact"],
        "payment_condition": ["exact"],
        "sold_by": ["exact"],
        "sold_at": ["date__gte", "date__lte"],
    }

    @action(detail=False, methods=["post"], url_path="checkout")
    def checkout(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            sale = serializer.save()
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        response_status = status.HTTP_201_CREATED if serializer.created else status.HTTP_200_OK
        return Response(SaleSerializer(sale).data, status=response_status)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        sale = self.get_object()
        serializer = SaleCancelSerializer(data=request.data, context={"request": request, "sale": sale})
        serializer.is_valid(raise_exception=True)
        try:
            cancelled = serializer.save()
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(SaleSerializer(cancelled).data)
