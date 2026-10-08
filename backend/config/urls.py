from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.views import (
    ChangeOwnPasswordView,
    CompanyUserViewSet,
    CookieTokenLogoutView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    SessionContextView,
)
from apps.audit.views import AuditEventViewSet
from apps.cash.views import CashRegisterViewSet, CashSessionViewSet
from apps.catalog.views import (
    ActiveIngredientViewSet,
    CategoryViewSet,
    CustomerViewSet,
    LaboratoryViewSet,
    ProductBarcodeViewSet,
    ProductVariantViewSet,
    ProductViewSet,
    ProductWarehouseLocationViewSet,
    SupplierViewSet,
    TherapeuticActionViewSet,
)
from apps.core.views import HealthView
from apps.customer_requests.views import CustomerRequestViewSet
from apps.finance.views import (
    FinancialCategoryViewSet,
    FinancialMovementViewSet,
    PayableAccountViewSet,
    ReceivableAccountViewSet,
)
from apps.inventory.views import InventoryMovementViewSet, LotViewSet, StockViewSet
from apps.purchases.views import PurchaseViewSet
from apps.reports.views import BasicSalesReportView, DashboardReportView
from apps.sales.views import SaleViewSet
from apps.tenancy.views import BranchViewSet, CompanyViewSet, POSTerminalViewSet, WarehouseViewSet
from apps.transfers.views import TransferViewSet

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")
router.register("audit-events", AuditEventViewSet, basename="audit-event")
router.register("users", CompanyUserViewSet, basename="company-user")
router.register("branches", BranchViewSet, basename="branch")
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("pos-terminals", POSTerminalViewSet, basename="pos-terminal")
router.register("categories", CategoryViewSet, basename="category")
router.register("laboratories", LaboratoryViewSet, basename="laboratory")
router.register("active-ingredients", ActiveIngredientViewSet, basename="active-ingredient")
router.register("therapeutic-actions", TherapeuticActionViewSet, basename="therapeutic-action")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("customers", CustomerViewSet, basename="customer")
router.register("products", ProductViewSet, basename="product")
router.register("product-variants", ProductVariantViewSet, basename="product-variant")
router.register("product-barcodes", ProductBarcodeViewSet, basename="product-barcode")
router.register("product-locations", ProductWarehouseLocationViewSet, basename="product-location")
router.register("lots", LotViewSet, basename="lot")
router.register("stock", StockViewSet, basename="stock")
router.register("inventory-movements", InventoryMovementViewSet, basename="inventory-movement")
router.register("purchases", PurchaseViewSet, basename="purchase")
router.register("cash-registers", CashRegisterViewSet, basename="cash-register")
router.register("cash-sessions", CashSessionViewSet, basename="cash-session")
router.register("sales", SaleViewSet, basename="sale")
router.register("transfers", TransferViewSet, basename="transfer")
router.register("payables", PayableAccountViewSet, basename="payable")
router.register("receivables", ReceivableAccountViewSet, basename="receivable")
router.register("financial-categories", FinancialCategoryViewSet, basename="financial-category")
router.register("financial-movements", FinancialMovementViewSet, basename="financial-movement")
router.register("customer-requests", CustomerRequestViewSet, basename="customer-request")

api_patterns = [
    path("auth/login/", CookieTokenObtainPairView.as_view(), name="cookie-token-obtain"),
    path("auth/refresh/", CookieTokenRefreshView.as_view(), name="cookie-token-refresh"),
    path("auth/logout/", CookieTokenLogoutView.as_view(), name="cookie-token-logout"),
    path("auth/token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/context/", SessionContextView.as_view(), name="session-context"),
    path("auth/password/change/", ChangeOwnPasswordView.as_view(), name="change-own-password"),
    path("reports/dashboard/", DashboardReportView.as_view(), name="dashboard-report"),
    path("reports/sales/", BasicSalesReportView.as_view(), name="sales-report"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", HealthView.as_view(), name="health"),
    path("api/v1/", include(api_patterns)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
