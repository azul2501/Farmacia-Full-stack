from django.db.models import Q
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import BasePermission


def get_request_company(request):
    from apps.accounts.models import Membership
    from apps.tenancy.models import Company

    if not request.user or not request.user.is_authenticated:
        raise NotAuthenticated("Las credenciales de autenticacion no se proveyeron.")

    if Membership.objects.filter(user=request.user, is_active=True, company__is_active=False).exists():
        raise PermissionDenied("Tu empresa se encuentra suspendida. Comunicate con soporte.")

    requested_company_id = request.META.get("HTTP_X_COMPANY_ID")
    if requested_company_id:
        if request.user.is_superuser:
            company = Company.objects.filter(id=requested_company_id, is_active=True).first()
            if not company:
                raise PermissionDenied("La empresa solicitada por X-Company-ID no existe o esta inactiva.")
            return company
        membership = (
            Membership.objects.select_related("company")
            .filter(
                user=request.user,
                company_id=requested_company_id,
                company__is_active=True,
                is_active=True,
            )
            .first()
        )
        if not membership:
            raise PermissionDenied(
                "No tienes una membresia activa en la empresa solicitada por X-Company-ID."
            )
        return membership.company

    membership = (
        Membership.objects.select_related("company")
        .filter(user=request.user, company__is_active=True, is_active=True)
        .order_by("created_at")
        .first()
    )
    if not membership:
        raise PermissionDenied("No tienes una empresa asignada. Comunicate con el administrador de la plataforma.")
    return membership.company


def get_active_membership(*, user, company):
    from apps.accounts.models import Membership

    if user.is_superuser:
        return None
    membership = (
        Membership.objects.prefetch_related("branches")
        .filter(user=user, company=company, company__is_active=True, is_active=True)
        .first()
    )
    if membership is None:
        raise PermissionDenied("El usuario no tiene una membresia activa en la empresa.")
    return membership


def allowed_branch_ids(*, user, company):
    from apps.accounts.models import Role

    if user.is_superuser:
        return None
    membership = get_active_membership(user=user, company=company)
    if membership.role in {Role.SUPERADMIN, Role.OWNER}:
        return None
    return set(membership.branches.filter(company=company, is_active=True).values_list("id", flat=True))


def ensure_same_company(*, company, entities):
    for entity in entities:
        if entity is not None and getattr(entity, "company_id", None) != company.id:
            raise PermissionDenied("Un recurso no pertenece a la empresa activa.")


def ensure_branch_access(*, user, company, branch_id):
    if branch_id is None:
        raise PermissionDenied("No se pudo determinar la sucursal del recurso.")
    get_active_membership(user=user, company=company)
    allowed = allowed_branch_ids(user=user, company=company)
    if allowed is not None and branch_id not in allowed:
        raise PermissionDenied("El usuario no tiene acceso a la sucursal solicitada.")


def ensure_resource_access(*, user, company, resource, branch_id=None):
    ensure_same_company(company=company, entities=[resource])
    resolved_branch_id = branch_id
    if resolved_branch_id is None:
        resolved_branch_id = getattr(resource, "branch_id", None)
    if resolved_branch_id is None and hasattr(resource, "warehouse"):
        resolved_branch_id = resource.warehouse.branch_id
    if resolved_branch_id is None and hasattr(resource, "register"):
        resolved_branch_id = resource.register.branch_id
    ensure_branch_access(user=user, company=company, branch_id=resolved_branch_id)


def scope_queryset_to_allowed_branches(queryset, *, user, company, branch_lookup="branch_id"):
    branches = allowed_branch_ids(user=user, company=company)
    if branches is None:
        return queryset
    return queryset.filter(**{f"{branch_lookup}__in": branches})


class HasCompanyAccess(BasePermission):
    def has_permission(self, request, view):
        request.company = get_request_company(request)
        return True


class HasCompanyRole(BasePermission):
    def has_permission(self, request, view):
        from apps.accounts.models import Membership

        if request.user.is_superuser:
            return True
        company = getattr(request, "company", None) or get_request_company(request)
        membership = Membership.objects.filter(user=request.user, company=company, is_active=True).first()
        if not membership:
            return False
        policies = getattr(view, "role_permissions", {})
        action = getattr(view, "action", request.method.lower())
        allowed_roles = policies.get(action, policies.get("*"))
        return allowed_roles is None or membership.role in allowed_roles


class CompanyScopedViewSetMixin:
    company_field = "company"

    def get_queryset(self):
        queryset = super().get_queryset()
        company = getattr(self.request, "company", None) or get_request_company(self.request)
        queryset = queryset.filter(**{self.company_field: company})
        branches = allowed_branch_ids(user=self.request.user, company=company)
        if branches is not None:
            fields = {field.name for field in queryset.model._meta.get_fields()}
            if queryset.model._meta.label_lower == "tenancy.branch":
                queryset = queryset.filter(pk__in=branches)
            elif "branch" in fields:
                queryset = queryset.filter(branch_id__in=branches)
            elif "register" in fields:
                queryset = queryset.filter(register__branch_id__in=branches)
            elif "warehouse" in fields:
                queryset = queryset.filter(warehouse__branch_id__in=branches)
            elif {"origin_branch", "destination_branch"}.issubset(fields):
                queryset = queryset.filter(Q(origin_branch_id__in=branches) | Q(destination_branch_id__in=branches))
        return queryset if queryset.ordered else queryset.order_by("pk")

    def perform_create(self, serializer):
        company = getattr(self.request, "company", None) or get_request_company(self.request)
        serializer.save(company=company)
