"""Healthcheck para o orquestrador/monitoramento: não expõe nenhum dado."""
from django.db import connection
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def banco_disponivel():
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception:
        return False
    return True


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def health(request):
    if not banco_disponivel():
        return Response({'status': 'erro', 'banco': 'indisponivel'}, status=503)
    return Response({'status': 'ok'})
