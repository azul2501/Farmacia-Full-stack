from django.conf import settings
from django.db import models

from apps.core.models import CompanyScopedModel


class AuditEvent(CompanyScopedModel):
    branch = models.ForeignKey(
        "tenancy.Branch", null=True, blank=True, on_delete=models.PROTECT, related_name="audit_events"
    )
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80)
    resource_type = models.CharField(max_length=80)
    resource_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "resource_type", "resource_id"]),
            models.Index(fields=["company", "created_at"]),
            models.Index(fields=["company", "branch", "created_at"], name="audit_event_company_branch_idx"),
        ]
