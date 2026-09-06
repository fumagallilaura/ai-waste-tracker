"""Observabilidade leve e proteção global da API.

- Rate limit global por IP (janela deslizante em memória) cobrindo toda /api/*.
- Métricas de requisições em memória (total, status, latência) expostas em
  /api/metrics para quem tem o APP_ADMIN_TOKEN.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque

from app.config import get_settings

logger = logging.getLogger("app.requests")

_METRICS = {
    "started_at": time.time(),
    "requests_total": 0,
    "by_status": defaultdict(int),
    "latency_sum_ms": 0.0,
    "latency_max_ms": 0.0,
    "by_path": defaultdict(lambda: [0, 0.0]),  # path -> [count, latency_sum_ms]
}

_buckets: dict[str, deque[float]] = {}
_MAX_TRACKED_IPS = 10_000


def metrics_snapshot() -> dict:
    total = _METRICS["requests_total"]
    by_path = {
        path: {"count": stats[0], "avg_ms": round(stats[1] / stats[0], 1) if stats[0] else 0}
        for path, stats in sorted(
            _METRICS["by_path"].items(), key=lambda kv: kv[1][0], reverse=True
        )[:20]
    }
    return {
        "uptime_seconds": round(time.time() - _METRICS["started_at"], 1),
        "requests_total": total,
        "by_status": dict(_METRICS["by_status"]),
        "avg_latency_ms": round(_METRICS["latency_sum_ms"] / total, 1) if total else 0,
        "max_latency_ms": round(_METRICS["latency_max_ms"], 1),
        "top_paths": by_path,
    }


def _allow(ip: str) -> bool:
    """Janela deslizante de 60s por IP para o teto global da API."""
    limit = get_settings().rate_limit_default_per_minute
    now = time.time()
    bucket = _buckets.get(ip)
    if bucket is None:
        if len(_buckets) >= _MAX_TRACKED_IPS:
            _buckets.clear()  # proteção contra crescimento infinito de memória
        bucket = _buckets[ip] = deque()
    while bucket and bucket[0] < now - 60:
        bucket.popleft()
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    return True


def observe_request(request, status_code: int, duration_ms: float) -> None:
    _METRICS["requests_total"] += 1
    _METRICS["by_status"][status_code] += 1
    _METRICS["latency_sum_ms"] += duration_ms
    _METRICS["latency_max_ms"] = max(_METRICS["latency_max_ms"], duration_ms)
    path = request.url.path
    # agrupa UUIDs para as métricas por rota não virarem cardápio infinito
    grouped = path.split("/")
    grouped = [
        seg if len(seg) < 20 else ":{id}" for seg in grouped
    ]
    stats = _METRICS["by_path"]["/".join(grouped)]
    stats[0] += 1
    stats[1] += duration_ms
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%.1f",
        request.method,
        path,
        status_code,
        duration_ms,
    )
