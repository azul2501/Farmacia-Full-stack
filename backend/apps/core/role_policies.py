from apps.accounts.models import ALL_COMPANY_ROLES, INVENTORY_ROLES, MANAGEMENT_ROLES, SALES_ROLES


def crud_policy(write_roles, read_roles=ALL_COMPANY_ROLES):
    return {
        "list": read_roles,
        "retrieve": read_roles,
        "create": write_roles,
        "update": write_roles,
        "partial_update": write_roles,
        "destroy": write_roles,
    }


MANAGEMENT_CRUD = crud_policy(MANAGEMENT_ROLES)
INVENTORY_CRUD = crud_policy(INVENTORY_ROLES)
SALES_CRUD = crud_policy(SALES_ROLES)
