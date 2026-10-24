class ReadOnlyAdminMixin:
    """Admin de solo lectura: ventas, productos y stock se cambian solo desde la app (mueven el kardex)."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
