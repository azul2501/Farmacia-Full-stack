from rest_framework import viewsets

from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole
from apps.core.role_policies import MANAGEMENT_CRUD
from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse
from apps.tenancy.permissions import CompanyAdministrationPermission
from apps.tenancy.serializers import (
    BranchSerializer,
    CompanySerializer,
    POSTerminalSerializer,
    WarehouseSerializer,
)


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.none()
    serializer_class = CompanySerializer
    permission_classes = [CompanyAdministrationPermission]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        if self.request.user.is_superuser:
            return Company.objects.all()
        return Company.objects.filter(memberships__user=self.request.user, memberships__is_active=True).distinct()


class BranchViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = MANAGEMENT_CRUD
    search_fields = ["code", "name", "address"]
    ordering_fields = ["code", "name", "created_at"]
    filterset_fields = ["is_active"]


class WarehouseViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Warehouse.objects.select_related("branch")
    serializer_class = WarehouseSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = MANAGEMENT_CRUD
    search_fields = ["code", "name", "branch__name"]
    ordering_fields = ["code", "name", "created_at"]
    filterset_fields = ["branch", "is_active"]


class POSTerminalViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = POSTerminal.objects.select_related("branch")
    serializer_class = POSTerminalSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = MANAGEMENT_CRUD
    search_fields = ["code", "name"]
    filterset_fields = ["branch", "is_active"]
