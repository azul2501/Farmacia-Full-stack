from django.contrib import admin
from unfold.admin import ModelAdmin

from apps.catalog.models import Product
from apps.core.admin_mixins import ReadOnlyAdminMixin


@admin.register(Product)
class ProductAdmin(ReadOnlyAdminMixin, ModelAdmin):
    """Solo lectura, para dar soporte. Los productos se gestionan desde la app de cada botica."""

    list_display = ("commercial_name", "internal_code", "company", "category", "laboratory", "is_active")
    list_filter = ("is_active", "product_type", "requires_prescription")
    search_fields = ("commercial_name", "internal_code", "digemid_code", "company__trade_name", "company__tax_id")
    list_select_related = ("company", "category", "laboratory")
