from django.contrib import admin

from apps.audit.models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "company", "branch", "actor", "action", "resource_type", "resource_id", "ip_address")
    list_filter = ("company", "branch", "action", "resource_type", "created_at")
    search_fields = (
        "actor__email",
        "actor__full_name",
        "action",
        "resource_type",
        "resource_id",
        "company__trade_name",
    )
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "company",
        "branch",
        "actor",
        "action",
        "resource_type",
        "resource_id",
        "payload",
        "ip_address",
    )
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
