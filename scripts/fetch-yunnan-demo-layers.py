"""Download public Yunnan demo layers and clip them to the map bounds."""
import json
import math
import os
import urllib.request

PLACE_ZH = {
    "Chengdu": "成都",
    "Kunming": "昆明",
    "Neijiang": "内江",
    "Mianyang": "绵阳",
    "Lupanshui": "六盘水",
    "Baoshan": "保山",
    "Xichang": "西昌",
    "Gejiu": "个旧",
    "Dali": "大理",
    "Lijiang": "丽江",
    "Zhaotong": "昭通",
    "Puer": "普洱",
    "Pu'er": "普洱",
    "Yuxi": "玉溪",
    "Qujing": "曲靖",
    "Lincang": "临沧",
    "Chuxiong": "楚雄",
    "Wenshan": "文山",
    "Jinghong": "景洪",
    "Mangshi": "芒市",
    "Luzhou": "泸州",
    "Yibin": "宜宾",
    "Panzhihua": "攀枝花",
    "Guiyang": "贵阳",
    "Zunyi": "遵义",
    "Anshun": "安顺",
    "Liupanshui": "六盘水"
}

RIVER_ZH = {
    "Ayeyarwady": "伊洛瓦底江",
    "Chang Jiang": "长江",
    "Dadu": "大渡河",
    "Hong": "红河",
    "Jinsha": "金沙江",
    "Lancang": "澜沧江",
    "Min": "岷江",
    "Nanpan": "南盘江",
    "Nmai": "恩梅开江",
    "Nu": "怒江",
    "Tongtian": "通天河"
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "demo")
BBOX = (97.5, 21.0, 105.5, 32.0)  # west, south, east, north
UA = {"User-Agent": "mars3d-dev-dataset/1.0"}


def fetch_json(url: str):
    request = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def point_in_ring(lon: float, lat: float, ring) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    geo_type = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if geo_type == "Polygon":
        return bool(coords) and point_in_ring(lon, lat, coords[0])
    if geo_type == "MultiPolygon":
        return any(polygon and point_in_ring(lon, lat, polygon[0]) for polygon in coords)
    return False


def geometry_intersects_bbox(geometry: dict, bbox) -> bool:
    west, south, east, north = bbox
    coords = []

    def walk(node):
        if isinstance(node, list):
            if len(node) >= 2 and isinstance(node[0], (int, float)) and isinstance(node[1], (int, float)):
                coords.append(node)
            else:
                for child in node:
                    walk(child)

    walk(geometry.get("coordinates"))
    if not coords:
        return False
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return not (max(lons) < west or min(lons) > east or max(lats) < south or min(lats) > north)


def level_and_color(count: int):
    if count >= 8:
        return "较多", "#ff4d4f"
    if count >= 1:
        return "有记录", "#faad14"
    return "无记录", "#5b8c9a"


def load_earthquakes():
    points = []
    for year in (2023, 2024, 2025):
        path = os.path.join(OUT_DIR, f"yunnan-earthquakes-{year}.geojson")
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        for feature in payload.get("features") or []:
            coords = (feature.get("geometry") or {}).get("coordinates") or []
            if len(coords) < 2:
                continue
            props = feature.get("properties") or {}
            points.append({
                "lon": coords[0],
                "lat": coords[1],
                "mag": props.get("mag") or 0,
                "feature": feature
            })
    return points


def write_geojson(name: str, features):
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump({"type": "FeatureCollection", "name": name, "features": features}, handle, ensure_ascii=False)
    print(name, len(features), os.path.getsize(path))


def build_prefectures(points):
    payload = fetch_json("https://geo.datav.aliyun.com/areas_v3/bound/530000_full.json")
    features = []
    for feature in payload.get("features") or []:
        props = feature.get("properties") or {}
        name = props.get("name") or ""
        if not name or name == "云南":
            continue
        geometry = feature.get("geometry") or {}
        inside = [p for p in points if point_in_geometry(p["lon"], p["lat"], geometry)]
        count = len(inside)
        max_mag = round(max((p["mag"] or 0) for p in inside), 1) if inside else None
        level, color = level_and_color(count)
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "name": name,
                "adcode": props.get("adcode"),
                "eq_count": count,
                "eq_max_mag": max_mag if max_mag is not None else "无",
                "level": level,
                "source": "阿里云 DataV 行政区划；地震次数来自 USGS 2023-2025 年 M≥3.0",
                "style": {
                    "color": color,
                    "opacity": 0.45,
                    "outline": True,
                    "outlineColor": "#ffffff",
                    "outlineWidth": 2,
                    "clampToGround": True
                }
            }
        })
    features.sort(key=lambda item: item["properties"]["eq_count"], reverse=True)
    write_geojson("yunnan-prefectures.geojson", features)
    summary_path = os.path.join(os.path.dirname(__file__), "_prefecture-summary.json")
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump([
            {
                "name": feature["properties"]["name"],
                "eq_count": feature["properties"]["eq_count"],
                "eq_max_mag": feature["properties"]["eq_max_mag"],
                "level": feature["properties"]["level"]
            }
            for feature in features
        ], handle, ensure_ascii=False, indent=2)
    for feature in features:
        props = feature["properties"]
        print(f"  {props['name']}: {props['eq_count']} max={props['eq_max_mag']} {props['level']}")


def build_places():
    payload = fetch_json(
        "https://cdn.jsdelivr.net/gh/martynafford/natural-earth-geojson@master/50m/cultural/ne_50m_populated_places.json"
    )
    west, south, east, north = BBOX
    features = []
    for feature in payload.get("features") or []:
        coords = (feature.get("geometry") or {}).get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = coords[0], coords[1]
        if not (west <= lon <= east and south <= lat <= north):
            continue
        props = feature.get("properties") or {}
        pop = props.get("POP_MAX") or 0
        if pop < 50000:
            continue
        english = props.get("NAME") or props.get("NAMEASCII") or ""
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 4), round(lat, 4)]},
            "properties": {
                "name": PLACE_ZH.get(english, english),
                "name_en": english,
                "admin": props.get("ADM1NAME") or "",
                "country": props.get("ADM0NAME") or "",
                "population": pop,
                "source": "Natural Earth populated places"
            }
        })
    features.sort(key=lambda item: item["properties"]["population"], reverse=True)
    write_geojson("yunnan-places.geojson", features)
    with open(os.path.join(os.path.dirname(__file__), "_place-names.json"), "w", encoding="utf-8") as handle:
        json.dump([feature["properties"] for feature in features], handle, ensure_ascii=False, indent=2)


def build_rivers():
    payload = fetch_json(
        "https://cdn.jsdelivr.net/gh/martynafford/natural-earth-geojson@master/50m/physical/ne_50m_rivers_lake_centerlines.json"
    )
    features = []
    for feature in payload.get("features") or []:
        geometry = feature.get("geometry") or {}
        if not geometry_intersects_bbox(geometry, BBOX):
            continue
        props = feature.get("properties") or {}
        english = props.get("name") or props.get("name_en") or "河流"
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "name": RIVER_ZH.get(english, english),
                "name_en": english,
                "source": "Natural Earth rivers"
            }
        })
    write_geojson("yunnan-rivers.geojson", features)


def probe_tile(url: str):
    request = urllib.request.Request(url, headers=UA, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(32)
            print("TILE", response.status, response.headers.get("Content-Type"), len(body), url)
    except Exception as error:
        print("TILE FAIL", type(error).__name__, error, url)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    points = load_earthquakes()
    print("earthquakes", len(points))
    build_prefectures(points)
    combined = [p["feature"] for p in points]
    write_geojson("yunnan-earthquakes-2023-2025.geojson", combined)
    build_places()
    build_rivers()
    lat, lon, zoom = 25.0, 102.0, 5
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    print("tile xyz", zoom, x, y)
    probe_tile(
        f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-04-15/GoogleMapsCompatible_Level9/{zoom}/{y}/{x}.jpg"
    )
    probe_tile(
        f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-10-15/GoogleMapsCompatible_Level9/{zoom}/{y}/{x}.jpg"
    )
    probe_tile(
        f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2024-10-15/GoogleMapsCompatible_Level7/{zoom}/{y}/{x}.png"
    )
    probe_tile(
        f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{y}/{x}"
    )


if __name__ == "__main__":
    main()
