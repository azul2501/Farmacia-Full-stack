from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("transfers", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TransferReceipt",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("notes", models.TextField(blank=True)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="tenancy.company")),
                ("received_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transfer_receipts", to=settings.AUTH_USER_MODEL)),
                ("transfer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="receipts", to="transfers.transfer")),
            ],
            options={"ordering": ["received_at", "created_at"]},
        ),
        migrations.CreateModel(
            name="TransferReceiptItem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("expected_quantity", models.DecimalField(decimal_places=3, max_digits=16)),
                ("received_quantity", models.DecimalField(decimal_places=3, max_digits=16)),
                ("difference_quantity", models.DecimalField(decimal_places=3, max_digits=16)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="tenancy.company")),
                ("receipt", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="items", to="transfers.transferreceipt")),
                ("transfer_item", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="receipt_items", to="transfers.transferitem")),
            ],
        ),
        migrations.AddIndex(
            model_name="transferreceipt",
            index=models.Index(fields=["company", "transfer", "received_at"], name="transfer_receipt_scope_idx"),
        ),
        migrations.AddConstraint(
            model_name="transferreceiptitem",
            constraint=models.CheckConstraint(condition=models.Q(("expected_quantity__gt", 0)), name="ck_transfer_receipt_expected_gt_zero"),
        ),
        migrations.AddConstraint(
            model_name="transferreceiptitem",
            constraint=models.CheckConstraint(condition=models.Q(("received_quantity__gt", 0)), name="ck_transfer_receipt_received_gt_zero"),
        ),
        migrations.AddConstraint(
            model_name="transferreceiptitem",
            constraint=models.CheckConstraint(condition=models.Q(("difference_quantity__gte", 0)), name="ck_transfer_receipt_difference_non_negative"),
        ),
    ]
