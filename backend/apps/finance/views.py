from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import MANAGEMENT_ROLES, SALES_ROLES
from apps.cash.models import CashSession
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole
from apps.core.role_policies import MANAGEMENT_CRUD
from apps.finance.models import FinancialCategory, FinancialMovement, PayableAccount, ReceivableAccount
from apps.finance.serializers import (
    AccountTransactionInputSerializer,
    FinancialCategorySerializer,
    FinancialMovementSerializer,
    ManualFinancialMovementInputSerializer,
    PayableAccountSerializer,
    PayablePaymentSerializer,
    ReceivableAccountSerializer,
    ReceivableCollectionSerializer,
    VoidFinancialMovementInputSerializer,
)
from apps.finance.services import FinanceService
from apps.tenancy.models import Branch


class PayableAccountViewSet(CompanyScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = PayableAccount.objects.select_related("supplier", "purchase", "branch", "created_by").prefetch_related(
        "payments__performed_by"
    )
    serializer_class = PayableAccountSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": MANAGEMENT_ROLES}
    search_fields = ["supplier__legal_name", "supplier__document_number", "purchase__document_number"]
    ordering_fields = ["due_date", "original_amount", "balance", "created_at"]
    filterset_fields = ["supplier", "purchase", "branch", "status", "due_date"]

    @action(detail=True, methods=["post"], url_path="payments")
    def register_payment(self, request, pk=None):
        account_object = self.get_object()
        serializer = AccountTransactionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cash_session_id = data.pop("cash_session", None)
        cash_session = None
        if cash_session_id:
            cash_session = get_object_or_404(CashSession, id=cash_session_id, company=request.company)
        try:
            payment, created = FinanceService.register_payable_payment(
                account_id=account_object.id,
                company=request.company,
                user=request.user,
                cash_session=cash_session,
                **data,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(
            PayablePaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ReceivableAccountViewSet(CompanyScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ReceivableAccount.objects.select_related("customer", "sale", "branch", "created_by").prefetch_related(
        "collections__performed_by"
    )
    serializer_class = ReceivableAccountSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": SALES_ROLES}
    search_fields = ["customer__full_name", "customer__document_number", "sale__number"]
    ordering_fields = ["due_date", "original_amount", "balance", "created_at"]
    filterset_fields = ["customer", "sale", "branch", "status", "due_date"]

    @action(detail=True, methods=["post"], url_path="collections")
    def register_collection(self, request, pk=None):
        account_object = self.get_object()
        serializer = AccountTransactionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cash_session_id = data.pop("cash_session", None)
        cash_session = None
        if cash_session_id:
            cash_session = get_object_or_404(CashSession, id=cash_session_id, company=request.company)
        try:
            collection, created = FinanceService.register_receivable_collection(
                account_id=account_object.id,
                company=request.company,
                user=request.user,
                cash_session=cash_session,
                **data,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(
            ReceivableCollectionSerializer(collection).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class FinancialCategoryViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = FinancialCategory.objects.all()
    serializer_class = FinancialCategorySerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = MANAGEMENT_CRUD
    search_fields = ["name"]
    ordering_fields = ["category_type", "name", "created_at"]
    filterset_fields = ["category_type", "is_active"]


class FinancialMovementViewSet(CompanyScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = FinancialMovement.objects.select_related("branch", "cash_session", "category", "created_by")
    serializer_class = FinancialMovementSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": MANAGEMENT_ROLES}
    search_fields = ["beneficiary_or_source", "document_number", "reference", "description"]
    ordering_fields = ["date", "amount", "created_at"]
    filterset_fields = ["branch", "cash_session", "category", "direction", "origin", "method", "status", "date"]

    @action(detail=False, methods=["post"], url_path="manual")
    def create_manual(self, request):
        serializer = ManualFinancialMovementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        branch = get_object_or_404(Branch, id=data.pop("branch"), company=request.company)
        category = get_object_or_404(FinancialCategory, id=data.pop("category"), company=request.company)
        cash_session_id = data.pop("cash_session", None)
        cash_session = None
        if cash_session_id:
            cash_session = get_object_or_404(CashSession, id=cash_session_id, company=request.company)
        try:
            movement = FinanceService.record_manual_movement(
                company=request.company,
                branch=branch,
                category=category,
                cash_session=cash_session,
                user=request.user,
                **data,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(FinancialMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        movement_object = self.get_object()
        serializer = VoidFinancialMovementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            movement = FinanceService.void_manual_movement(
                movement_id=movement_object.id,
                company=request.company,
                user=request.user,
                reason=serializer.validated_data["reason"],
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(FinancialMovementSerializer(movement).data)
