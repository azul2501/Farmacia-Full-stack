from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.response import Response

from apps.accounts.models import MANAGEMENT_ROLES
from apps.cash.models import CashSession, CashSessionStatus
from apps.core.permissions import HasCompanyAccess, HasCompanyRole, allowed_branch_ids, ensure_branch_access
from apps.inventory.models import Stock
from apps.sales.models import Sale, SalePayment, SaleStatus
from apps.tenancy.models import Branch
from apps.transfers.models import Transfer, TransferStatus


class DashboardReportSerializer(serializers.Serializer):
    date = serializers.DateField()
    salesToday = serializers.DecimalField(max_digits=16, decimal_places=2)
    salesByBranch = serializers.ListField(child=serializers.DictField())
    salesByPaymentMethod = serializers.ListField(child=serializers.DictField())
    lowStock = serializers.IntegerField()
    expiringLots = serializers.IntegerField()
    expiredLots = serializers.IntegerField()
    openCashRegisters = serializers.IntegerField()
    cashDifferences = serializers.DecimalField(max_digits=16, decimal_places=2)
    pendingTransfers = serializers.IntegerField()


class BasicSalesReportSerializer(serializers.Serializer):
    total = serializers.DecimalField(max_digits=16, decimal_places=2)
    count = serializers.IntegerField()
    byDay = serializers.ListField(child=serializers.DictField())


class DashboardReportView(generics.GenericAPIView):
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"get": MANAGEMENT_ROLES}
    serializer_class = DashboardReportSerializer

    def get(self, request):
        today = timezone.localdate()
        next_month = today + timedelta(days=30)
        sales = Sale.objects.filter(company=request.company, status=SaleStatus.COMPLETED, sold_at__date=today)
        stock = Stock.objects.filter(company=request.company)
        cash_sessions = CashSession.objects.filter(company=request.company)
        transfers = Transfer.objects.filter(company=request.company)
        branches = allowed_branch_ids(user=request.user, company=request.company)
        if branches is not None:
            sales = sales.filter(branch_id__in=branches)
            stock = stock.filter(warehouse__branch_id__in=branches)
            cash_sessions = cash_sessions.filter(register__branch_id__in=branches)
            transfers = transfers.filter(Q(origin_branch_id__in=branches) | Q(destination_branch_id__in=branches))
        sales_by_branch = list(
            sales.values("branch_id", branch_name=F("branch__name"))
            .annotate(total=Coalesce(Sum("total"), Decimal("0")), count=Count("id"))
            .order_by("branch_name")
        )
        payments = list(
            SalePayment.objects.filter(company=request.company, sale__in=sales)
            .values("method")
            .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
            .order_by("method")
        )
        low_stock = stock.filter(quantity__lte=F("variant__minimum_stock")).count()
        expiring = stock.filter(
            quantity__gt=0,
            lot__expiry_date__range=(today, next_month),
        ).count()
        expired = stock.filter(
            quantity__gt=0,
            lot__expiry_date__lt=today,
        ).count()
        open_cash = cash_sessions.filter(status=CashSessionStatus.OPEN).count()
        cash_differences = cash_sessions.filter(
            status=CashSessionStatus.CLOSED_WITH_DIFFERENCE,
            closed_at__date=today,
        ).aggregate(total=Coalesce(Sum("difference"), Decimal("0")))["total"]
        pending_transfers = transfers.filter(
            status__in=[TransferStatus.DISPATCHED, TransferStatus.IN_TRANSIT],
        ).count()

        return Response(
            {
                "date": today,
                "salesToday": sales.aggregate(total=Coalesce(Sum("total"), Decimal("0")))["total"],
                "salesByBranch": sales_by_branch,
                "salesByPaymentMethod": payments,
                "lowStock": low_stock,
                "expiringLots": expiring,
                "expiredLots": expired,
                "openCashRegisters": open_cash,
                "cashDifferences": cash_differences,
                "pendingTransfers": pending_transfers,
            }
        )


class BasicSalesReportView(generics.GenericAPIView):
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    role_permissions = {"get": MANAGEMENT_ROLES}
    serializer_class = BasicSalesReportSerializer

    def get(self, request):
        queryset = Sale.objects.filter(company=request.company, status=SaleStatus.COMPLETED)
        branches = allowed_branch_ids(user=request.user, company=request.company)
        if branches is not None:
            queryset = queryset.filter(branch_id__in=branches)
        date_from = request.query_params.get("dateFrom")
        date_to = request.query_params.get("dateTo")
        branch = request.query_params.get("branch")
        if date_from:
            queryset = queryset.filter(sold_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(sold_at__date__lte=date_to)
        if branch:
            branch_obj = get_object_or_404(Branch, id=branch, company=request.company)
            ensure_branch_access(user=request.user, company=request.company, branch_id=branch_obj.id)
            queryset = queryset.filter(branch=branch_obj)
        return Response(
            {
                "total": queryset.aggregate(total=Coalesce(Sum("total"), Decimal("0")))["total"],
                "count": queryset.count(),
                "byDay": list(
                    queryset.values(day=F("sold_at__date"))
                    .annotate(total=Coalesce(Sum("total"), Decimal("0")), count=Count("id"))
                    .order_by("day")
                ),
            }
        )
