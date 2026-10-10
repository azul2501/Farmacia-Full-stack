from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import Membership, User


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 1
    autocomplete_fields = ("company", "branches")
    fields = ("company", "role", "branches", "is_active")
    filter_horizontal = ("branches",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    ordering = ("email",)
    list_display = ("email", "full_name", "phone", "is_staff", "is_superuser", "is_active")
    list_filter = ("is_staff", "is_superuser", "is_active", "memberships__company", "memberships__role")
    search_fields = ("email", "full_name", "phone")
    readonly_fields = ("date_joined", "last_login")
    fieldsets = (
        ("Cuenta", {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("full_name", "phone")}),
        ("Acceso Django Admin", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Fechas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "phone",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                ),
            },
        ),
    )
    inlines = (MembershipInline,)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "company")
    search_fields = ("user__email", "user__full_name", "company__trade_name", "company__tax_id")
    autocomplete_fields = ("user", "company", "branches")
    filter_horizontal = ("branches",)
    readonly_fields = ("id", "created_at", "updated_at")
    fieldsets = (
        ("Asignacion", {"fields": ("user", "company", "role", "is_active")}),
        ("Sucursales permitidas", {"fields": ("branches",)}),
        ("Auditoria", {"fields": ("id", "created_at", "updated_at")}),
    )
