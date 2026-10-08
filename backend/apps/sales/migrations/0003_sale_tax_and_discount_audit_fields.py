from django.db import migrations, models
from decimal import Decimal, ROUND_HALF_UP


def calculate_existing_tax(apps, schema_editor):
    Sale = apps.get_model("sales", "Sale")
    SaleItem = apps.get_model("sales", "SaleItem")
    cent = Decimal("0.01")
    rate = Decimal("0.18")
    for item in SaleItem.objects.select_related("variant__product").iterator():
        if item.variant.product.tax_affectation == "TAXED":
            item.tax_amount = (item.line_total * rate / (Decimal("1") + rate)).quantize(
                cent, rounding=ROUND_HALF_UP
            )
            item.save(update_fields=["tax_amount"])
    for sale in Sale.objects.iterator():
        sale.tax_total = sum(
            sale.items.values_list("tax_amount", flat=True),
            Decimal("0"),
        ).quantize(cent, rounding=ROUND_HALF_UP)
        sale.save(update_fields=["tax_total"])


def clear_calculated_tax(apps, schema_editor):
    apps.get_model("sales", "SaleItem").objects.update(tax_amount=0)
    apps.get_model("sales", "Sale").objects.update(tax_total=0)


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_activeingredient_productwarehouselocation_and_more"),
        ("sales", "0002_sale_amount_paid_sale_balance_due_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="tax_total",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=16),
        ),
        migrations.AddField(
            model_name="saleitem",
            name="discount_reason",
            field=models.CharField(blank=True, max_length=240),
        ),
        migrations.AddField(
            model_name="saleitem",
            name="tax_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.RunPython(calculate_existing_tax, clear_calculated_tax),
    ]
