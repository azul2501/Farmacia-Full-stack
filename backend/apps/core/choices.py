from django.db import models


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "Efectivo"
    YAPE = "YAPE", "Yape"
    PLIN = "PLIN", "Plin"
    CARD = "CARD", "Tarjeta"
    TRANSFER = "TRANSFER", "Transferencia"


class PaymentCondition(models.TextChoices):
    CASH = "CASH", "Contado"
    CREDIT = "CREDIT", "Credito"
