from rest_framework import serializers

from apps.audit.models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", read_only=True, allow_null=True)

    class Meta:
        model = AuditEvent
        exclude = ["company"]
        read_only_fields = [field.name for field in AuditEvent._meta.fields if field.name != "company"]
