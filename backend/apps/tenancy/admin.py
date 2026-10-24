from datetime import timedelta

from django import forms
from django.contrib import admin, messages
from django.db.models import Max
from django.utils import timezone
from django.utils.crypto import get_random_string
from unfold.admin import ModelAdmin, TabularInline

from apps.accounts.models import User
from apps.tenancy.models import Branch, Company, POSTerminal, SubscriptionPlan, SubscriptionStatus, Warehouse
from apps.tenancy.ruc import is_valid_ruc_format
from apps.tenancy.signup import provision_store, trial_settings


class CompanyCreationForm(forms.ModelForm):
    """Alta completa de una botica desde el panel: crea también su tienda y el usuario dueño."""

    address = forms.CharField(label="Dirección de la tienda", max_length=250)
    owner_full_name = forms.CharField(label="Nombre del dueño", max_length=180)
    owner_email = forms.EmailField(label="Correo del dueño (para entrar a la app)")
    owner_phone = forms.CharField(label="Celular del dueño", max_length=30)

    class Meta:
        model = Company
        fields = ["trade_name", "legal_name", "tax_id", "subscription_plan"]
        labels = {
            "trade_name": "Nombre comercial",
            "legal_name": "Razón social",
            "tax_id": "RUC",
            "subscription_plan": "Plan (vacío = plan por defecto)",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["legal_name"].required = False
        self.fields["legal_name"].help_text = "Si la dejas vacía, se usa el nombre comercial."

    def clean_tax_id(self):
        ruc = self.cleaned_data["tax_id"].strip()
        if not is_valid_ruc_format(ruc):
            raise forms.ValidationError("El RUC no es válido: 11 dígitos, empieza con 10 o 20.")
        return ruc

    def clean_owner_email(self):
        email = self.cleaned_data["owner_email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Ya existe un usuario con este correo.")
        return email


class BranchInline(TabularInline):
    model = Branch
    extra = 0
    fields = ("code", "name", "address", "phone", "is_active")


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(ModelAdmin):
    list_display = ("name", "monthly_price", "trial_days", "is_default", "is_active")
    list_editable = ("monthly_price", "trial_days", "is_default", "is_active")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.is_default:
            # Solo un plan puede ser el que reciben las boticas nuevas.
            SubscriptionPlan.objects.exclude(pk=obj.pk).filter(is_default=True).update(is_default=False)


@admin.register(Company)
class CompanyAdmin(ModelAdmin):
    list_display = (
        "trade_name",
        "tax_id",
        "tax_id_verified",
        "subscription_status",
        "subscription_plan",
        "trial_ends_at",
        "last_sale_at",
        "created_at",
    )
    list_filter = ("subscription_status", "subscription_plan", "tax_id_verified", "is_active")
    search_fields = ("trade_name", "legal_name", "tax_id")
    readonly_fields = ("id", "created_at", "updated_at")
    fieldsets = (
        ("Botica", {"fields": ("legal_name", "trade_name", "tax_id", "tax_id_verified", "is_active")}),
        ("Suscripción", {"fields": ("subscription_plan", "subscription_status", "trial_ends_at")}),
        ("Operación", {"fields": ("timezone", "currency")}),
        ("Auditoría", {"fields": ("id", "created_at", "updated_at")}),
    )
    inlines = (BranchInline,)
    actions = ("activate_plan", "extend_trial_15_days", "suspend")
    add_fieldsets = (
        ("Botica", {"fields": ("trade_name", "legal_name", "tax_id", "address", "subscription_plan")}),
        ("Dueño", {"fields": ("owner_full_name", "owner_email", "owner_phone")}),
    )

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            kwargs["form"] = CompanyCreationForm
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        return self.add_fieldsets if obj is None else super().get_fieldsets(request, obj)

    def get_inlines(self, request, obj):
        return () if obj is None else self.inlines

    def save_model(self, request, obj, form, change):
        if change:
            return super().save_model(request, obj, form, change)
        default_plan, trial_ends_at = trial_settings()
        obj.subscription_plan = obj.subscription_plan or default_plan
        if obj.subscription_plan:
            trial_ends_at = timezone.now() + timedelta(days=obj.subscription_plan.trial_days)
        obj.subscription_status = SubscriptionStatus.TRIAL
        obj.trial_ends_at = trial_ends_at
        obj.legal_name = obj.legal_name or obj.trade_name
        super().save_model(request, obj, form, change)
        password = get_random_string(10) + "-Bf1"
        data = form.cleaned_data
        provision_store(
            company=obj,
            address=data["address"],
            phone=data["owner_phone"],
            owner_full_name=data["owner_full_name"],
            owner_email=data["owner_email"],
            owner_password=password,
        )
        self.message_user(
            request,
            f"Botica lista para vender. Acceso del dueño: {data['owner_email']} · contraseña temporal: {password} "
            "(pásasela y que la cambie desde la app).",
            messages.SUCCESS,
        )

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related("subscription_plan")
        return queryset.annotate(_last_sale=Max("sale__sold_at"))

    @admin.display(description="Última venta", ordering="_last_sale")
    def last_sale_at(self, obj):
        return obj._last_sale

    @admin.action(description="Activar plan (la botica pagó)")
    def activate_plan(self, request, queryset):
        updated = queryset.update(subscription_status=SubscriptionStatus.ACTIVE, is_active=True)
        self.message_user(request, f"{updated} botica(s) activadas.", messages.SUCCESS)

    @admin.action(description="Extender la prueba 15 días")
    def extend_trial_15_days(self, request, queryset):
        now = timezone.now()
        for company in queryset:
            start = company.trial_ends_at if company.trial_ends_at and company.trial_ends_at > now else now
            company.trial_ends_at = start + timedelta(days=15)
            company.subscription_status = SubscriptionStatus.TRIAL
            company.save(update_fields=["trial_ends_at", "subscription_status", "updated_at"])
        self.message_user(request, f"Prueba extendida en {queryset.count()} botica(s).", messages.SUCCESS)

    @admin.action(description="Suspender (puede entrar, no puede vender)")
    def suspend(self, request, queryset):
        updated = queryset.update(subscription_status=SubscriptionStatus.SUSPENDED)
        self.message_user(request, f"{updated} botica(s) suspendidas.", messages.WARNING)


@admin.register(Branch)
class BranchAdmin(ModelAdmin):
    list_display = ("name", "code", "company", "address", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "address", "company__trade_name", "company__tax_id")
    autocomplete_fields = ("company",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Warehouse)
class WarehouseAdmin(ModelAdmin):
    list_display = ("name", "code", "branch", "company", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "branch__name", "company__trade_name", "company__tax_id")
    autocomplete_fields = ("company", "branch")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(POSTerminal)
class POSTerminalAdmin(ModelAdmin):
    list_display = ("name", "code", "branch", "company", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "branch__name", "company__trade_name", "company__tax_id")
    autocomplete_fields = ("company", "branch")
    readonly_fields = ("id", "created_at", "updated_at")
