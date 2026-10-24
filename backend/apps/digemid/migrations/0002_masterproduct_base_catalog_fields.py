from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("digemid", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="masterproduct",
            name="product_type",
            field=models.CharField(default="MEDICINE", help_text="MEDICINE o SUPPLY (insumo).", max_length=16),
        ),
        migrations.AddField(
            model_name="masterproduct",
            name="suggested_price",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Precio de venta referencial por unidad.",
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="masterproduct",
            name="source",
            field=models.CharField(
                blank=True, help_text="De dónde viene: DIGEMID, RM 220-2024, lista base.", max_length=60
            ),
        ),
    ]
