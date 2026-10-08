from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import BaseModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("El correo es obligatorio.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True or extra_fields.get("is_superuser") is not True:
            raise ValueError("Un superusuario debe tener is_staff e is_superuser activos.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=180)
    phone = models.CharField(max_length=30, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]
    objects = UserManager()

    def __str__(self):
        return self.full_name or self.email


class Role(models.TextChoices):
    SUPERADMIN = "SUPERADMIN", "Superadministrador"
    OWNER = "OWNER", "Dueno"
    BRANCH_ADMIN = "BRANCH_ADMIN", "Administrador de sucursal"
    WAREHOUSE_OPERATOR = "WAREHOUSE_OPERATOR", "Almacenero"
    CASHIER = "CASHIER", "Cajero"


ALL_COMPANY_ROLES = [Role.SUPERADMIN, Role.OWNER, Role.BRANCH_ADMIN, Role.WAREHOUSE_OPERATOR, Role.CASHIER]
MANAGEMENT_ROLES = [Role.SUPERADMIN, Role.OWNER, Role.BRANCH_ADMIN]
INVENTORY_ROLES = [Role.SUPERADMIN, Role.OWNER, Role.BRANCH_ADMIN, Role.WAREHOUSE_OPERATOR]
SALES_ROLES = [Role.SUPERADMIN, Role.OWNER, Role.BRANCH_ADMIN, Role.CASHIER]


class Membership(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    company = models.ForeignKey("tenancy.Company", on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=32, choices=Role.choices)
    branches = models.ManyToManyField("tenancy.Branch", blank=True, related_name="memberships")
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "company"], name="uq_membership_user_company")]
        indexes = [models.Index(fields=["company", "role", "is_active"])]

    def __str__(self):
        return f"{self.user} - {self.company} ({self.role})"
