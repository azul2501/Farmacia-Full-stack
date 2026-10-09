from rest_framework.filters import OrderingFilter


class StableOrderingFilter(OrderingFilter):
    """Agrega la clave primaria como desempate para que la paginacion no repita ni omita filas."""

    def filter_queryset(self, request, queryset, view):
        queryset = super().filter_queryset(request, queryset, view)
        ordering = list(queryset.query.order_by) or list(queryset.model._meta.ordering or [])
        if not any(field.lstrip("-") in {"pk", "id"} for field in ordering if isinstance(field, str)):
            queryset = queryset.order_by(*ordering, "pk")
        return queryset
