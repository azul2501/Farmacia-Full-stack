from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import SALES_ROLES
from apps.cash.models import CashRegister, CashSession
from apps.cash.serializers import (
    CashCountInputSerializer,
    CashCountSerializer,
    CashMovementInputSerializer,
    CashMovementSerializer,
    CashRegisterSerializer,
    CashSessionSerializer,
    CloseCashSerializer,
    OpenCashSerializer,
)
from apps.cash.services import CashService
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole
from apps.core.role_policies import MANAGEMENT_CRUD


class CashRegisterViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = CashRegister.objects.select_related("branch")
    serializer_class = CashRegisterSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = MANAGEMENT_CRUD | {"open_cash": SALES_ROLES}
    search_fields = ["code", "name", "branch__name"]
    filterset_fields = ["branch", "is_active"]

    @action(detail=False, methods=["post"], url_path="open")
    def open_cash(self, request):
        serializer = OpenCashSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        register = get_object_or_404(self.get_queryset(), id=serializer.validated_data["register"])
        try:
            session = CashService.open_session(
                company=request.company,
                register_id=register.id,
                user=request.user,
                opening_amount=serializer.validated_data["opening_amount"],
                notes=serializer.validated_data.get("notes", ""),
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(CashSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class CashSessionViewSet(CompanyScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = CashSession.objects.select_related("register", "opened_by", "closed_by").prefetch_related("movements")
    serializer_class = CashSessionSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {
        "list": SALES_ROLES,
        "retrieve": SALES_ROLES,
        "add_movement": SALES_ROLES,
        "close_cash": SALES_ROLES,
        "counts": SALES_ROLES,
    }
    filterset_fields = ["register", "status", "opened_by"]
    ordering_fields = ["opened_at", "closed_at", "difference"]

    @action(detail=True, methods=["post"], url_path="movements")
    def add_movement(self, request, pk=None):
        session_object = self.get_object()
        serializer = CashMovementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            movement = CashService.record_movement(
                session_id=session_object.id,
                company=request.company,
                user=request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(CashMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="close")
    def close_cash(self, request, pk=None):
        session_object = self.get_object()
        serializer = CloseCashSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            session = CashService.close_session(
                session_id=session_object.id,
                company=request.company,
                user=request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(CashSessionSerializer(session).data)

    @action(detail=True, methods=["get", "post"], url_path="counts")
    def counts(self, request, pk=None):
        if request.method == "GET":
            session = self.get_object()
            return Response(CashCountSerializer(session.counts.select_related("performed_by"), many=True).data)
        serializer = CashCountInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session_object = self.get_object()
        try:
            count = CashService.create_count(
                session_id=session_object.id,
                company=request.company,
                user=request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages) from exc
        return Response(CashCountSerializer(count).data, status=status.HTTP_201_CREATED)
