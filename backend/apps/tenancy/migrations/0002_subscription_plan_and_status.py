import uuid

import django.db.models.deletion
from django.db import migrations, models


def create_default_plan(apps, schema_editor):
    SubscriptionPlan = apps.get_model("tenancy", "SubscriptionPlan")
    if not SubscriptionPlan.objects.exists():
        # El precio se define luego desde el admin.
        SubscriptionPlan.objects.create(name="Plan Básico", monthly_price=0, trial_days=30, is_default=True)


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubscriptionPlan",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=80, unique=True)),
                ("monthly_price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("trial_days", models.PositiveSmallIntegerField(default=30)),
                (
                    "is_default",
                    models.BooleanField(
                        default=False, help_text="Plan asignado a las boticas que se registran solas."
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["monthly_price", "name"],
            },
        ),
        migrations.AddField(
            model_name="company",
            name="subscription_plan",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="companies",
                to="tenancy.subscriptionplan",
            ),
        ),
        migrations.AddField(
            model_name="company",
            name="subscription_status",
            field=models.CharField(
                choices=[("TRIAL", "En prueba"), ("ACTIVE", "Activa"), ("SUSPENDED", "Suspendida")],
                default="ACTIVE",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="company",
            name="trial_ends_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="company",
            name="tax_id_verified",
            field=models.BooleanField(default=False, help_text="RUC confirmado como activo y habido en SUNAT."),
        ),
        migrations.RunPython(create_default_plan, migrations.RunPython.noop),
    ]
