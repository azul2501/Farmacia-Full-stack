import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_activeingredient_productwarehouselocation_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="usual_supplier",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="usual_products",
                to="catalog.supplier",
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="health_surveillance",
            field=models.BooleanField(default=False),
        ),
    ]
