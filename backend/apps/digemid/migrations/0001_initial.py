import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("tenancy", "0002_subscription_plan_and_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="MasterProduct",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "digemid_code",
                    models.CharField(help_text="CodProd del catálogo de DIGEMID.", max_length=32, unique=True),
                ),
                ("name", models.CharField(max_length=250)),
                ("concentration", models.CharField(blank=True, max_length=160)),
                ("dosage_form", models.CharField(blank=True, max_length=160)),
                ("presentation", models.CharField(blank=True, max_length=300)),
                ("fractions", models.CharField(blank=True, max_length=60)),
                ("sanitary_registration", models.CharField(blank=True, db_index=True, max_length=80)),
                ("holder", models.CharField(blank=True, max_length=250)),
                ("manufacturer", models.CharField(blank=True, max_length=250)),
                ("active_ingredient", models.CharField(blank=True, max_length=300)),
                ("status", models.CharField(blank=True, max_length=60)),
            ],
            options={
                "ordering": ["name", "concentration"],
                "indexes": [models.Index(fields=["name"], name="digemid_master_name_idx")],
            },
        ),
        migrations.CreateModel(
            name="DigemidAlert",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("year", models.PositiveSmallIntegerField()),
                ("number", models.PositiveIntegerField()),
                ("title", models.CharField(max_length=400)),
                ("url", models.URLField(max_length=300, unique=True)),
                ("summary", models.TextField(blank=True)),
                ("sanitary_registrations", models.JSONField(blank=True, default=list)),
                ("lot_numbers", models.JSONField(blank=True, default=list)),
                ("is_published", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["-year", "-number"],
                "constraints": [
                    models.UniqueConstraint(fields=("year", "number"), name="uq_digemid_alert_year_number")
                ],
            },
        ),
        migrations.CreateModel(
            name="MasterBarcode",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("code", models.CharField(max_length=64, unique=True)),
                (
                    "first_company",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="tenancy.company",
                    ),
                ),
                (
                    "master_product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="barcodes",
                        to="digemid.masterproduct",
                    ),
                ),
            ],
        ),
    ]
