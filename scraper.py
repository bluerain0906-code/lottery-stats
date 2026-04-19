"""
台灣彩券歷史資料爬蟲（大樂透 + 威力彩）
資料來源：https://api.taiwanlottery.com/TLCAPIWeB/Lottery/...
輸出：data.json（與 index.html 同資料夾）

執行：
    python scraper.py              # 增量更新（近兩個月）
    python scraper.py --full       # 全量重抓（2014 起）
"""

import argparse
import datetime as dt
import json
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error

HERE = Path(__file__).parent
OUT_FILE = HERE / "data.json"

API_BASE = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery"
GAMES = {
    "lotto649": {
        "endpoint": f"{API_BASE}/Lotto649Result",
        "result_key": "lotto649Res",
    },
    "super_lotto": {
        "endpoint": f"{API_BASE}/SuperLotto638Result",
        "result_key": "superLotto638Res",
    },
}

START_YEAR = 2014
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


def http_get(url: str, params: dict) -> dict:
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    full = f"{url}?{qs}"
    req = urllib.request.Request(full, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_record(game: str, item: dict) -> dict | None:
    """drawNumberSize 結構：前 6 碼一般號（已排序）+ 最後 1 碼特別號/第二區。"""
    try:
        nums = item.get("drawNumberSize") or []
        if len(nums) < 7:
            return None
        main = sorted(int(n) for n in nums[:6])
        special = int(nums[6])
        date = (item.get("lotteryDate") or "")[:10]
        period = str(item.get("period") or "")
        if game == "lotto649":
            return {"period": period, "date": date, "numbers": main, "special": special}
        return {"period": period, "date": date, "first_area": main, "second_area": special}
    except Exception as e:
        print(f"[warn] parse {game} fail: {e} raw={item}", file=sys.stderr)
        return None


def fetch_month(game: str, year: int, month: int) -> list:
    month_str = f"{year:04d}-{month:02d}"
    params = {"period": "", "month": month_str, "pageNum": 1, "pageSize": 50}
    try:
        data = http_get(GAMES[game]["endpoint"], params)
    except urllib.error.HTTPError as e:
        print(f"[warn] HTTP {e.code} for {game} {month_str}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"[warn] fetch fail {game} {month_str}: {e}", file=sys.stderr)
        return []

    if data.get("rtCode") != 0:
        return []
    content = data.get("content") or {}
    items = content.get(GAMES[game]["result_key"]) or []
    out = [parse_record(game, x) for x in items]
    return [x for x in out if x]


def load_existing() -> dict:
    if OUT_FILE.exists():
        try:
            return json.loads(OUT_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"updated_at": "", "lotto649": [], "super_lotto": []}


def merge(existing: list, new: list) -> list:
    seen = {r["period"] for r in existing if r.get("period")}
    for r in new:
        if r.get("period") and r["period"] not in seen:
            existing.append(r)
            seen.add(r["period"])
    existing.sort(key=lambda r: r.get("date", ""), reverse=True)
    return existing


def run(full: bool):
    existing = load_existing()
    now = dt.date.today()

    if full:
        existing = {"updated_at": "", "lotto649": [], "super_lotto": []}
        start_year, start_month = START_YEAR, 1
    else:
        start_year = now.year if now.month > 1 else now.year - 1
        start_month = now.month - 1 if now.month > 1 else 12

    for game in GAMES.keys():
        print(f"[info] fetching {game} from {start_year}-{start_month:02d} ...")
        collected = []
        y, m = start_year, start_month
        while (y, m) <= (now.year, now.month):
            batch = fetch_month(game, y, m)
            if batch:
                print(f"  {y}-{m:02d}: +{len(batch)}")
                collected.extend(batch)
            time.sleep(0.25)
            m += 1
            if m > 12:
                y, m = y + 1, 1
        existing[game] = merge(existing.get(game, []), collected)
        print(f"[info] {game}: total {len(existing[game])} records")

    existing["updated_at"] = now.isoformat()
    OUT_FILE.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[done] wrote {OUT_FILE}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true", help="全量重抓 2014 起")
    args = ap.parse_args()
    run(full=args.full)
