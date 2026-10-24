from django.contrib import admin
from unfold.admin import ModelAdmin

from apps.core.admin_mixins import ReadOnlyAdminMixin
from apps.sales.models import Sale


@admin.register(Sale)
class SaleAdmin(ReadOnlyAdminMixin, ModelAdmin):
    """Solo lectura, para dar soporte cuando una botica reporta un problema."""

    list_display = ("number", "company", "branch", "status", "total", "payment_condition", "sold_by", "sold_at")
    list_filter = ("status", "payment_condition", "sold_at")
    search_fields = ("number", "company__trade_name", "company__tax_id", "sold_by__email")
    list_select_related = ("company", "branch", "sold_by")
    date_hierarchy = "sold_at"
