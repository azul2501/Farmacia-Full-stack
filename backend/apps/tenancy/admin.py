from django.contrib import admin

from apps.tenancy.models import Branch, Company, POSTerminal, Warehouse


class BranchInline(admin.TabularInline):
    model = Branch
    extra = 1
    fields = ("code", "name", "address", "phone", "is_active")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("trade_name", "legal_name", "tax_id", "currency", "is_active", "created_at")
    list_filter = ("is_active", "currency", "timezone")
    search_fields = ("trade_name", "legal_name", "tax_id")
    readonly_fields = ("id", "created_at", "updated_at")
    fieldsets = (
        ("Empresa cliente", {"fields": ("legal_name", "trade_name", "tax_id", "is_active")}),
        ("Operacion", {"fields": ("timezone", "currency")}),
        ("Auditoria", {"fields": ("id", "created_at", "updated_at")}),
    )
    inlines = (BranchInline,)


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "company", "address", "is_active")
    list_filter = ("is_active", "company")
    search_fields = ("name", "code", "address", "company__trade_name", "company__tax_id")
    autocomplete_fields = ("company",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "branch", "company", "is_active")
    list_filter = ("is_active", "company", "branch")
    search_fields = ("name", "code", "branch__name", "company__trade_name", "company__tax_id")
    autocomplete_fields = ("company", "branch")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(POSTerminal)
class POSTerminalAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "branch", "company", "is_active")
    list_filter = ("is_active", "company", "branch")
    search_fields = ("name", "code", "branch__name", "company__trade_name", "company__tax_id")
    autocomplete_fields = ("company", "branch")
    readonly_fields = ("id", "created_at", "updated_at")
