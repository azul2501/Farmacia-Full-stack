from contextlib import contextmanager

from django.core.cache import cache


class LockNotAcquired(RuntimeError):
    pass


@contextmanager
def distributed_lock(key: str, *, timeout: int = 60, blocking_timeout: int = 5):
    lock_factory = getattr(cache, "lock", None)
    if lock_factory is None:
        # LocMemCache de desarrollo no implementa locks distribuidos.
        yield
        return

    lock = lock_factory(key, timeout=timeout, blocking_timeout=blocking_timeout)
    acquired = lock.acquire(blocking=True)
    if not acquired:
        raise LockNotAcquired(f"No se pudo adquirir el lock {key}.")
    try:
        yield
    finally:
        lock.release()
