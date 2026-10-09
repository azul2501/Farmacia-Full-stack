from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, Role
from apps.accounts.permissions import permissions_for_role
from apps.accounts.serializers import (
    AccessTokenSerializer,
    ChangeOwnPasswordSerializer,
    CompanyUserSerializer,
    ResetUserPasswordSerializer,
    SessionContextSerializer,
)
from apps.audit.services import record_audit
from apps.core.permissions import (
    CompanyScopedViewSetMixin,
    HasCompanyAccess,
    HasCompanyRole,
    allowed_branch_ids,
    get_request_company,
)
from apps.tenancy.models import Branch


def _set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        domain=settings.JWT_COOKIE_DOMAIN,
        path="/",
    )


class CookieTokenObtainPairView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=TokenObtainPairSerializer,
        responses=AccessTokenSerializer,
        description="Inicia sesión y guarda el refresh token en una cookie HttpOnly.",
    )
    def post(self, request):
        serializer = TokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = Response({"access": serializer.validated_data["access"]})
        _set_refresh_cookie(response, serializer.validated_data["refresh"])
        return response


class CookieTokenRefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=None,
        responses=AccessTokenSerializer,
        description="Rota el refresh token recibido mediante cookie HttpOnly.",
    )
    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response({"detail": "No existe una sesión renovable."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        response = Response({"access": serializer.validated_data["access"]})
        if rotated_refresh := serializer.validated_data.get("refresh"):
            _set_refresh_cookie(response, rotated_refresh)
        return response


class CookieTokenLogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=None,
        responses={204: None},
        description="Invalida el refresh token y elimina su cookie.",
    )
    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            path="/",
            domain=settings.JWT_COOKIE_DOMAIN,
            samesite=settings.JWT_COOKIE_SAMESITE,
        )
        return response


class SessionContextView(generics.GenericAPIView):
    serializer_class = SessionContextSerializer

    def get(self, request):
        company = get_request_company(request)
        membership = (
            Membership.objects.select_related("user", "company")
            .prefetch_related("branches")
            .get(user=request.user, company=company)
        )
        available_branches = membership.branches.filter(is_active=True)
        if membership.role in {Role.SUPERADMIN, Role.OWNER} or request.user.is_superuser:
            available_branches = Branch.objects.filter(company=company, is_active=True)
        serializer = SessionContextSerializer(
            {
                "user": request.user,
                "active_company": company,
                "membership": membership,
                "available_branches": available_branches,
                "permissions": permissions_for_role(membership.role, is_superuser=request.user.is_superuser),
            }
        )
        return Response(serializer.data)


class ChangeOwnPasswordView(generics.GenericAPIView):
    serializer_class = ChangeOwnPasswordSerializer
    permission_classes = [HasCompanyAccess]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        record_audit(
            company=request.company,
            actor=request.user,
            action="user.password_changed",
            resource=request.user,
            payload={"user_id": str(request.user.pk)},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompanyUserViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Membership.objects.select_related("user", "company").prefetch_related("branches")
    serializer_class = CompanyUserSerializer
    permission_classes = [HasCompanyAccess, HasCompanyRole]
    company_field = "company"
    role_permissions = {
        "*": [Role.SUPERADMIN, Role.OWNER, Role.BRANCH_ADMIN],
    }
    search_fields = ["user__email", "user__full_name"]
    ordering_fields = ["user__full_name", "user__email", "created_at"]
    filterset_fields = ["role", "is_active", "branches"]

    def get_queryset(self):
        queryset = super().get_queryset()
        branches = allowed_branch_ids(user=self.request.user, company=self.request.company)
        if branches is None:
            return queryset
        return queryset.filter(
            branches__id__in=branches,
            role__in=[Role.BRANCH_ADMIN, Role.WAREHOUSE_OPERATOR, Role.CASHIER],
        ).distinct()

    def perform_create(self, serializer):
        membership = serializer.save()
        branch_ids = [str(item) for item in membership.branches.values_list("id", flat=True)]
        record_audit(
            company=self.request.company,
            actor=self.request.user,
            action="membership.created",
            resource=membership,
            payload={"role": membership.role, "branches": branch_ids},
        )

    def perform_update(self, serializer):
        membership = serializer.save()
        branch_ids = [str(item) for item in membership.branches.values_list("id", flat=True)]
        record_audit(
            company=self.request.company,
            actor=self.request.user,
            action="membership.updated",
            resource=membership,
            payload={"role": membership.role, "branches": branch_ids},
        )

    @extend_schema(request=ResetUserPasswordSerializer, responses={204: None})
    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        membership = self.get_object()
        user = membership.user
        if user.id == request.user.id:
            raise ValidationError({"detail": "Para cambiar tu propia clave usa la opcion de cambio de clave."})
        if user.is_superuser:
            raise ValidationError({"detail": "No se puede restablecer la clave de un superusuario."})
        # Un usuario global con acceso a otra empresa solo puede cambiar su clave el mismo.
        if Membership.objects.filter(user=user).exclude(company=request.company).exists():
            raise ValidationError(
                {"detail": "El usuario también pertenece a otra empresa; debe cambiar su clave el mismo."}
            )
        serializer = ResetUserPasswordSerializer(data=request.data, context={"user": user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        record_audit(
            company=request.company,
            actor=request.user,
            action="user.password_reset",
            resource=membership,
            payload={"user_id": str(user.id)},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        record_audit(
            company=self.request.company,
            actor=self.request.user,
            action="membership.deleted",
            resource=instance,
            payload={"user_id": str(instance.user_id), "role": instance.role},
        )
        instance.delete()
