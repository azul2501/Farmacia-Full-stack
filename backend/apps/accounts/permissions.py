from apps.accounts.models import Role

ALL_PERMISSIONS = {
    "dashboard.view",
    "branches.view",
    "warehouses.view",
    "users.view",
    "roles.view",
    "catalogs.view",
    "suppliers.view",
    "customers.view",
    "products.view",
    "purchases.view",
    "inventory.view",
    "transfers.view",
    "cash.view",
    "pos.view",
    "sales.view",
    "sales.credit",
    "sales.discount",
    "sales.cancel",
    "reports.view",
    "settings.view",
    "payables.view",
    "receivables.view",
    "finance.view",
    "requests.view",
    "records.create",
    "records.update",
    "records.delete",
}

ROLE_PERMISSIONS = {
    Role.SUPERADMIN: ALL_PERMISSIONS,
    Role.OWNER: ALL_PERMISSIONS,
    Role.BRANCH_ADMIN: ALL_PERMISSIONS,
    Role.WAREHOUSE_OPERATOR: {
        "catalogs.view",
        "suppliers.view",
        "products.view",
        "purchases.view",
        "inventory.view",
        "transfers.view",
        "records.create",
        "records.update",
    },
    Role.CASHIER: {
        "customers.view",
        "products.view",
        "cash.view",
        "pos.view",
        "sales.view",
        "receivables.view",
        "requests.view",
        "records.create",
    },
}


def permissions_for_role(role: str, *, is_superuser: bool = False) -> list[str]:
    permissions = ALL_PERMISSIONS if is_superuser else ROLE_PERMISSIONS.get(role, set())
    return sorted(permissions)
