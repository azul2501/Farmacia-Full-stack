from uuid import UUID

from apps.audit.models import AuditEvent


def _resource_branch(resource):
    branch_id = getattr(resource, "branch_id", None)
    if branch_id:
        return branch_id
    for relation in ("warehouse", "register"):
        related = getattr(resource, relation, None)
        if related is not None and getattr(related, "branch_id", None):
            return related.branch_id
    session = getattr(resource, "session", None)
    if session is not None:
        return session.register.branch_id
    return getattr(resource, "origin_branch_id", None)


def record_audit(*, company, actor, action, resource, payload=None, ip_address=None, branch=None):
    try:
        resource_id = UUID(str(resource.pk))
    except (TypeError, ValueError, AttributeError):
        resource_id = None
    return AuditEvent.objects.create(
        company=company,
        branch_id=branch or _resource_branch(resource),
        actor=actor,
        action=action,
        resource_type=resource._meta.label_lower,
        resource_id=resource_id,
        payload=payload or {},
        ip_address=ip_address,
    )
