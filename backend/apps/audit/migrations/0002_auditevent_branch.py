from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial"), ("tenancy", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="auditevent",
            name="branch",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="audit_events",
                to="tenancy.branch",
            ),
        ),
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(fields=["company", "branch", "created_at"], name="audit_event_company_branch_idx"),
        ),
    ]
