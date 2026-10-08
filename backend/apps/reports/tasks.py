from decimal import Decimal

from celery import shared_task
from django.core.cache import cache
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.core.locks import distributed_lock
from apps.sales.models import Sale, SaleStatus


@shared_task
def warm_daily_sales_total(company_id: str) -> str:
    today = timezone.localdate()
    lock_key = f"locks:reports:{company_id}:{today.isoformat()}"
    with distributed_lock(lock_key):
        total = Sale.objects.filter(
            company_id=company_id,
            status=SaleStatus.COMPLETED,
            sold_at__date=today,
        ).aggregate(total=Coalesce(Sum("total"), Decimal("0")))["total"]
        cache.set(f"reports:{company_id}:sales:{today.isoformat()}", str(total), timeout=900)
        return str(total)
