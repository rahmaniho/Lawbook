"""قالب‌بندی خوانای JSON: اشیا/آرایه‌های کوتاه در یک خط، بقیه با تورفتگی ۲ فاصله (سبک Prettier)."""

from __future__ import annotations

import json
from typing import Any

WIDTH = 220


def _inline(value: Any) -> str:
    if isinstance(value, dict):
        if not value:
            return "{}"
        return "{ " + ", ".join(f"{json.dumps(k, ensure_ascii=False)}: {_inline(v)}" for k, v in value.items()) + " }"
    if isinstance(value, list):
        return "[" + ", ".join(_inline(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False)


def dumps(value: Any, indent: int = 0, width: int = WIDTH) -> str:
    flat = _inline(value)
    if len(flat) + indent <= width or not isinstance(value, (dict, list)) or not value:
        return flat
    pad = " " * (indent + 2)
    if isinstance(value, dict):
        items = [f"{pad}{json.dumps(k, ensure_ascii=False)}: {dumps(v, indent + 2, width)}" for k, v in value.items()]
        return "{\n" + ",\n".join(items) + "\n" + " " * indent + "}"
    items = [pad + dumps(v, indent + 2, width) for v in value]
    return "[\n" + ",\n".join(items) + "\n" + " " * indent + "]"


def write(path, value: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(dumps(value) + "\n")
