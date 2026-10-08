from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response

    details = response.data
    message = "La solicitud no pudo procesarse."
    if isinstance(details, dict) and "detail" in details:
        message = str(details["detail"])
    elif isinstance(details, list) and details:
        message = str(details[0])

    fields = details if isinstance(details, dict) else None
    if isinstance(details, list):
        fields = {"non_field_errors": details}

    response.data = {
        "error": {
            "code": getattr(exc, "default_code", "request_error"),
            "message": message,
            "fields": fields,
        }
    }
    return response
