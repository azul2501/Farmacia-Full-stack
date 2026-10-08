from rest_framework import viewsets

from apps.accounts.models import MANAGEMENT_ROLES
from apps.audit.models import AuditEvent
from apps.audit.serializers import AuditEventSerializer
from apps.core.permissions import CompanyScopedViewSetMixin, HasCompanyAccess, HasCompanyRole


class AuditEventViewSet(CompanyScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor")
    serializer_class = AuditEventSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"*": MANAGEMENT_ROLES}
    search_fields = ["action", "resource_type", "actor__full_name"]
    ordering_fields = ["created_at", "action", "resource_type"]
    filterset_fields = ["action", "resource_type", "actor"]
