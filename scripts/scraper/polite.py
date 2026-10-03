"""
ابزار درخواست «مؤدبانه» برای برداشت داده‌های عمومی قوانین

- رعایت robots.txt (urllib.robotparser)؛ آدرس‌های غیرمجاز هرگز درخواست نمی‌شوند
- محدودیت نرخ برای هر میزبان (پیش‌فرض: حداقل ۵ ثانیه + تأخیر تصادفی بین درخواست‌ها)
- احترام به Retry-After در پاسخ‌های 429/503 و تلاش مجدد با backoff نمایی
- User-Agent شفاف با آدرس تماس
- کش روی دیسک تا هیچ صفحه‌ای بی‌دلیل دوباره درخواست نشود
"""

from __future__ import annotations

import hashlib
import json
import random
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_UA = "KetabcheGhanoonBot/1.0 (+https://github.com/rahmaniho/Lawbook; legal-research; contact via GitHub issues)"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"


class RobotsDisallowed(Exception):
    pass


@dataclass
class PoliteSession:
    user_agent: str = DEFAULT_UA
    min_interval: float = 5.0
    jitter: float = 2.0
    max_retries: int = 4
    timeout: float = 45.0
    use_cache: bool = True
    cache_dir: Path = CACHE_DIR
    _robots: dict[str, urllib.robotparser.RobotFileParser] = field(default_factory=dict)
    _last: dict[str, float] = field(default_factory=dict)

    # --- robots.txt -------------------------------------------------------
    def robots_for(self, url: str) -> urllib.robotparser.RobotFileParser:
        parts = urllib.parse.urlsplit(url)
        base = f"{parts.scheme}://{parts.netloc}"
        rp = self._robots.get(base)
        if rp is None:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(base + "/robots.txt")
            try:
                req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": self.user_agent})
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    rp.parse(r.read().decode("utf-8", "replace").splitlines())
            except Exception:
                # نبود robots.txt یعنی محدودیتی اعلام نشده؛ با این حال نرخ درخواست محدود می‌ماند
                rp.parse([])
            self._robots[base] = rp
            delay = rp.crawl_delay(self.user_agent)
            if delay:
                self.min_interval = max(self.min_interval, float(delay))
        return rp

    def allowed(self, url: str) -> bool:
        return self.robots_for(url).can_fetch(self.user_agent, url)

    # --- نرخ درخواست ------------------------------------------------------
    def _throttle(self, url: str) -> None:
        host = urllib.parse.urlsplit(url).netloc
        wait = self._last.get(host, 0) + self.min_interval + random.uniform(0, self.jitter) - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self._last[host] = time.monotonic()

    # --- کش ---------------------------------------------------------------
    def _cache_path(self, url: str) -> Path:
        return self.cache_dir / (hashlib.sha256(url.encode()).hexdigest()[:32] + ".json")

    def get_text(self, url: str, *, encoding: str = "utf-8") -> str:
        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt اجازه دریافت نمی‌دهد: {url}")
        cp = self._cache_path(url)
        if self.use_cache and cp.exists():
            return json.loads(cp.read_text(encoding="utf-8"))["body"]
        delay = self.min_interval
        for attempt in range(self.max_retries + 1):
            self._throttle(url)
            req = urllib.request.Request(url, headers={"User-Agent": self.user_agent, "Accept-Language": "fa,en;q=0.5"})
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    body = r.read().decode(encoding, "replace")
                if self.use_cache:
                    self.cache_dir.mkdir(parents=True, exist_ok=True)
                    cp.write_text(json.dumps({"url": url, "fetchedAt": time.time(), "body": body}, ensure_ascii=False), encoding="utf-8")
                return body
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < self.max_retries:
                    retry_after = e.headers.get("Retry-After")
                    time.sleep(float(retry_after) if retry_after and retry_after.isdigit() else delay)
                    delay *= 2
                    continue
                raise
            except (urllib.error.URLError, TimeoutError):
                if attempt < self.max_retries:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise
        raise RuntimeError("unreachable")
