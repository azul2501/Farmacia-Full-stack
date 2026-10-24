"""Inicio del panel de superadmin (Django Unfold): las cifras del negocio de un vistazo."""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.sales.models import Sale, SaleStatus
from apps.tenancy.models import Company, SubscriptionStatus


def environment_callback(request):
    return ["Local", "success"] if settings.DEBUG else ["Producción", "danger"]


def dashboard_callback(request, context):
    now = timezone.now()
    companies = Company.objects.all()
    trial = Q(subscription_status=SubscriptionStatus.TRIAL)
    counts = companies.aggregate(
        total=Count("id"),
        in_trial=Count("id", filter=trial & (Q(trial_ends_at__isnull=True) | Q(trial_ends_at__gt=now))),
        trial_expired=Count("id", filter=trial & Q(trial_ends_at__lte=now)),
        paying=Count("id", filter=Q(subscription_status=SubscriptionStatus.ACTIVE)),
        suspended=Count("id", filter=Q(subscription_status=SubscriptionStatus.SUSPENDED)),
        unverified_ruc=Count("id", filter=Q(tax_id_verified=False)),
    )
    sales_24h = Sale.objects.filter(status=SaleStatus.COMPLETED, sold_at__gte=now - timedelta(hours=24)).aggregate(
        count=Count("id"), total=Coalesce(Sum("total"), Decimal("0"))
    )
    week_ago = now - timedelta(days=7)
    inactive = (
        companies.filter(created_at__lte=week_ago)
        .exclude(subscription_status=SubscriptionStatus.SUSPENDED)
        .annotate(last_sale=Max("sale__sold_at"))
        .filter(Q(last_sale__isnull=True) | Q(last_sale__lt=week_ago))
        .order_by("last_sale")[:10]
    )
    context.update(
        {
            "kpis": [
                {"label": "Boticas registradas", "value": counts["total"]},
                {"label": "En prueba", "value": counts["in_trial"]},
                {"label": "Prueba vencida", "value": counts["trial_expired"]},
                {"label": "Pagando", "value": counts["paying"]},
                {"label": "Suspendidas", "value": counts["suspended"]},
                {"label": "RUC por verificar", "value": counts["unverified_ruc"]},
                {"label": "Ventas últimas 24 h", "value": sales_24h["count"]},
                {"label": "Vendido últimas 24 h", "value": f"S/ {sales_24h['total']:,.2f}"},
            ],
            "recent_signups": companies.select_related("subscription_plan").order_by("-created_at")[:10],
            "inactive_companies": inactive,
        }
    )
    return context
