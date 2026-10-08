from django.conf import settings
from django.db import models

from apps.core.models import CompanyScopedModel


class CustomerRequestStatus(models.TextChoices):
    DRAFT = "DRAFT", "Borrador"
    PENDING = "PENDING", "Pendiente"
    CONFIRMED = "CONFIRMED", "Confirmada"
    PREPARED = "PREPARED", "Preparada"
    PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED", "Parcialmente atendida"
    FULFILLED = "FULFILLED", "Atendida"
    CANCELLED = "CANCELLED", "Cancelada"
    EXPIRED = "EXPIRED", "Vencida"


class ServiceType(models.TextChoices):
    STORE_PICKUP = "STORE_PICKUP", "Recojo en tienda"
    SCHEDULED_DELIVERY = "SCHEDULED_DELIVERY", "Entrega programada"


class CustomerRequest(CompanyScopedModel):
    code = models.CharField(max_length=40)
    customer = models.ForeignKey("catalog.Customer", on_delete=models.PROTECT, related_name="scheduled_requests")
    contact_phone = models.CharField(max_length=30)
    branch = models.ForeignKey("tenancy.Branch", on_delete=models.PROTECT, related_name="customer_requests")
    scheduled_at = models.DateTimeField()
    service_type = models.CharField(max_length=32, choices=ServiceType.choices)
    delivery_address = models.CharField(max_length=250, blank=True)
    status = models.CharField(max_length=32, choices=CustomerRequestStatus.choices, default=CustomerRequestStatus.DRAFT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="customer_requests_created"
    )
    converted_sale = models.OneToOneField(
        "sales.Sale", null=True, blank=True, on_delete=models.PROTECT, related_name="source_request"
    )

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "code"], name="uq_customer_request_code")]
        indexes = [models.Index(fields=["company", "branch", "status", "scheduled_at"])]
        ordering = ["scheduled_at", "created_at"]


class CustomerRequestItem(CompanyScopedModel):
    request = models.ForeignKey(CustomerRequest, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.ProductVariant", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=16, decimal_places=3)
    reference_price = models.DecimalField(max_digits=14, decimal_places=2)
    authorized_discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    preferred_lot = models.ForeignKey("inventory.Lot", null=True, blank=True, on_delete=models.PROTECT)
    notes = models.CharField(max_length=240, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="ck_customer_request_qty_gt_zero"),
            models.CheckConstraint(
                condition=models.Q(reference_price__gte=0), name="ck_customer_request_price_non_negative"
            ),
            models.CheckConstraint(
                condition=models.Q(authorized_discount__gte=0), name="ck_customer_request_discount_non_negative"
            ),
        ]
