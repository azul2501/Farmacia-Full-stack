from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import record_audit
from apps.core.permissions import ensure_resource_access
from apps.customer_requests.models import CustomerRequest, CustomerRequestStatus
from apps.sales.services import PaymentInput, SaleLineInput, SaleService


class CustomerRequestService:
    TRANSITIONS = {
        CustomerRequestStatus.DRAFT: {CustomerRequestStatus.PENDING, CustomerRequestStatus.CANCELLED},
        CustomerRequestStatus.PENDING: {CustomerRequestStatus.CONFIRMED, CustomerRequestStatus.CANCELLED},
        CustomerRequestStatus.CONFIRMED: {CustomerRequestStatus.PREPARED, CustomerRequestStatus.CANCELLED},
        CustomerRequestStatus.PREPARED: {CustomerRequestStatus.CANCELLED},
    }

    @classmethod
    @transaction.atomic
    def transition(cls, *, request_id, company, user, target_status):
        customer_request = CustomerRequest.objects.select_for_update().get(id=request_id, company=company)
        ensure_resource_access(user=user, company=company, resource=customer_request)
        if target_status not in cls.TRANSITIONS.get(customer_request.status, set()):
            raise ValidationError("El cambio de estado solicitado no esta permitido.")
        previous = customer_request.status
        customer_request.status = target_status
        customer_request.save(update_fields=["status", "updated_at"])
        record_audit(
            company=company,
            actor=user,
            action="customer_request.status_changed",
            resource=customer_request,
            payload={"from": previous, "to": target_status},
        )
        return customer_request

    @staticmethod
    @transaction.atomic
    def convert_to_sale(
        *,
        request_id,
        company,
        user,
        warehouse,
        terminal,
        cash_session_id,
        idempotency_key,
        payments,
        payment_condition,
        payment_due_date=None,
    ):
        customer_request = (
            CustomerRequest.objects.select_for_update()
            .select_related("branch", "customer")
            .prefetch_related("items__variant__product", "items__preferred_lot")
            .get(id=request_id, company=company)
        )
        if customer_request.status in {
            CustomerRequestStatus.CANCELLED,
            CustomerRequestStatus.FULFILLED,
            CustomerRequestStatus.EXPIRED,
        }:
            raise ValidationError("La solicitud no puede convertirse en su estado actual.")
        ensure_resource_access(user=user, company=company, resource=customer_request)
        if customer_request.converted_sale_id:
            return customer_request.converted_sale, False
        if not customer_request.items.exists():
            raise ValidationError("La solicitud no contiene productos.")
        if warehouse.company_id != company.id or warehouse.branch_id != customer_request.branch_id:
            raise ValidationError("El almacen no pertenece a la sucursal de la solicitud.")
        if terminal.company_id != company.id or terminal.branch_id != customer_request.branch_id:
            raise ValidationError("El terminal no pertenece a la sucursal de la solicitud.")
        lines = [
            SaleLineInput(
                variant_id=item.variant_id,
                lot_id=item.preferred_lot_id,
                quantity=item.quantity,
                unit_price=None,
                discount=item.authorized_discount,
                discount_reason=item.notes or f"Descuento autorizado en solicitud {customer_request.code}",
            )
            for item in customer_request.items.all()
        ]
        sale, created = SaleService.checkout(
            company=company,
            branch=customer_request.branch,
            warehouse=warehouse,
            terminal=terminal,
            cash_session_id=cash_session_id,
            user=user,
            customer=customer_request.customer,
            idempotency_key=idempotency_key,
            lines=lines,
            payments=[PaymentInput(**payment) for payment in payments],
            payment_condition=payment_condition,
            payment_due_date=payment_due_date,
        )
        customer_request.converted_sale = sale
        customer_request.status = CustomerRequestStatus.FULFILLED
        customer_request.save(update_fields=["converted_sale", "status", "updated_at"])
        record_audit(
            company=company,
            actor=user,
            action="customer_request.converted",
            resource=customer_request,
            payload={"sale_id": str(sale.id)},
        )
        return sale, created
