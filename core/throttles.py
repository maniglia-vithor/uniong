from rest_framework.throttling import SimpleRateThrottle


class PorIPThrottle(SimpleRateThrottle):
    """Limita por IP, mesmo para usuários autenticados."""

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class AuthThrottle(PorIPThrottle):
    scope = 'auth'


class DoacaoPublicaThrottle(PorIPThrottle):
    scope = 'doacao_publica'
