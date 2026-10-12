import json
import os
import urllib.request
from datetime import datetime, timezone

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "demo")
BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query"
YEARS = [2023, 2024, 2025]


def fetch_year(year: int) -> dict:
    query = (
        f"{BASE}?format=geojson&starttime={year}-01-01&endtime={year + 1}-01-01"
        "&minlatitude=21&maxlatitude=32&minlongitude=97.5&maxlongitude=105.5"
        "&minmagnitude=3&orderby=time"
    )
    request = urllib.request.Request(query, headers={"User-Agent": "mars3d-dev-dataset/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    features = []
    for feature in payload.get("features") or []:
        props = feature.get("properties") or {}
        coords = (feature.get("geometry") or {}).get("coordinates") or [None, None, None]
        time_ms = props.get("time")
        time_text = ""
        if isinstance(time_ms, (int, float)):
            time_text = datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [coords[0], coords[1]]},
            "properties": {
                "mag": props.get("mag"),
                "place": props.get("place") or "",
                "time": time_text,
                "depth_km": coords[2],
                "url": props.get("url") or "",
                "source": "USGS",
                "year": year
            }
        })
    return {"type": "FeatureCollection", "name": f"yunnan-earthquakes-{year}", "features": features}


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for year in YEARS:
        collection = fetch_year(year)
        path = os.path.join(OUT_DIR, f"yunnan-earthquakes-{year}.geojson")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(collection, handle, ensure_ascii=False)
        print(year, len(collection["features"]), os.path.getsize(path))


if __name__ == "__main__":
    main()
