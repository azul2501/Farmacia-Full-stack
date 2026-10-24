from django.contrib import admin
from unfold.admin import ModelAdmin

from apps.digemid.models import DigemidAlert, MasterBarcode, MasterProduct


@admin.register(MasterProduct)
class MasterProductAdmin(ModelAdmin):
    """Lista base: load_base_catalog. Excel de DIGEMID: import_digemid_catalog <archivo>.

    Se puede agregar o corregir a mano (por ejemplo el precio sugerido); no se borra porque las boticas
    enlazan sus productos por el código.
    """

    list_display = ("name", "concentration", "dosage_form", "presentation", "suggested_price", "source", "digemid_code")
    list_editable = ("suggested_price",)
    list_filter = ("source", "product_type", "dosage_form")
    search_fields = ("name", "active_ingredient", "digemid_code", "sanitary_registration")
    readonly_fields = ("id", "created_at", "updated_at")
    list_per_page = 50

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MasterBarcode)
class MasterBarcodeAdmin(ModelAdmin):
    list_display = ("code", "master_product", "first_company", "created_at")
    search_fields = ("code", "master_product__name", "master_product__digemid_code")
    autocomplete_fields = ("master_product", "first_company")


@admin.register(DigemidAlert)
class DigemidAlertAdmin(ModelAdmin):
    """Se sincronizan con: python manage.py sync_digemid_alerts. También se pueden agregar a mano."""

    list_display = ("__str__", "title", "is_published", "created_at")
    list_filter = ("year", "is_published")
    search_fields = ("title", "summary", "url")
    readonly_fields = ("id", "created_at", "updated_at")
    fields = ("year", "number", "title", "url", "lot_numbers", "sanitary_registrations", "summary", "is_published")
