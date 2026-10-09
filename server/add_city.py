import argparse
import csv
import io
import json
import math
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


EARTH_RADIUS_KM = 6371.0088
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
CITY_ADDRESS_FIELDS = ("city", "town", "village", "municipality", "hamlet")


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance between two latitude/longitude points."""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = lat2_rad - lat1_rad
    delta_lon = math.radians(lon2 - lon1)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(haversine))


def lookup_city(
    latitude: float,
    longitude: float,
    radius_km: float,
    user_agent: str,
) -> str:
    """Reverse-geocode a coordinate and return its city if within the radius."""
    query = urllib.parse.urlencode(
        {
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 10,
            "lat": latitude,
            "lon": longitude,
        }
    )
    request = urllib.request.Request(
        f"{NOMINATIM_REVERSE_URL}?{query}",
        headers={"User-Agent": user_agent},
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(
            f"Reverse geocoding failed for ({latitude}, {longitude}): {exc}"
        ) from exc

    if isinstance(result, dict) and result.get("error") == "Unable to geocode":
        return ""
    if not isinstance(result, dict) or "error" in result:
        raise RuntimeError(
            f"Reverse geocoding returned no usable result for "
            f"({latitude}, {longitude}): {result}"
        )

    address = result.get("address")
    result_latitude = result.get("lat")
    result_longitude = result.get("lon")
    if not isinstance(address, dict) or result_latitude is None or result_longitude is None:
        raise ValueError(
            f"Reverse geocoding response is missing address coordinates for "
            f"({latitude}, {longitude})"
        )

    city = next(
        (address[field] for field in CITY_ADDRESS_FIELDS if address.get(field)),
        "",
    )
    if not city:
        return ""

    city_distance = distance_km(
        latitude,
        longitude,
        float(result_latitude),
        float(result_longitude),
    )
    return city if city_distance <= radius_km else ""


def valid_coordinate(value: str, field: str, row_number: int) -> float:
    try:
        coordinate = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Invalid {field} value on input row {row_number}: {value!r}"
        ) from exc

    if not math.isfinite(coordinate):
        raise ValueError(f"Non-finite {field} value on input row {row_number}")
    return coordinate


def add_city_column(
    input_path: Path,
    output_path: Path,
    radius_km: float,
    user_agent: str,
) -> None:
    city_cache: dict[tuple[float, float], str] = {}
    last_request_time = 0.0
    temp_path: str | None = None

    try:
        input_bytes = input_path.read_bytes()
        try:
            input_text = input_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            input_text = input_bytes.decode("cp1252")

        with io.StringIO(input_text, newline="") as source:
            reader = csv.DictReader(source, delimiter="\t")
            if reader.fieldnames is None:
                raise ValueError(f"Input file has no header: {input_path}")
            for required_column in ("stop_lat", "stop_lon"):
                if required_column not in reader.fieldnames:
                    raise ValueError(
                        f"Input file is missing required column {required_column!r}"
                    )

            fieldnames = list(reader.fieldnames)
            if "city" not in fieldnames:
                fieldnames.append("city")

            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                dir=output_path.parent,
                prefix=f".{output_path.name}.",
                suffix=".tmp",
                delete=False,
            ) as destination:
                temp_path = destination.name
                writer = csv.DictWriter(
                    destination,
                    fieldnames=fieldnames,
                    delimiter="\t",
                    lineterminator="\n",
                )
                writer.writeheader()

                for row_number, row in enumerate(reader, start=2):
                    latitude = valid_coordinate(row.get("stop_lat"), "stop_lat", row_number)
                    longitude = valid_coordinate(row.get("stop_lon"), "stop_lon", row_number)
                    if row.get("provider") == "2":
                        latitude, longitude = longitude, latitude
                    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                        raise ValueError(
                            f"Coordinates out of range on input row {row_number}: "
                            f"({latitude}, {longitude})"
                        )

                    coordinate = (latitude, longitude)
                    if coordinate not in city_cache:
                        delay = 1.0 - (time.monotonic() - last_request_time)
                        if last_request_time and delay > 0:
                            time.sleep(delay)
                        city_cache[coordinate] = lookup_city(
                            latitude, longitude, radius_km, user_agent
                        )
                        last_request_time = time.monotonic()

                    city = city_cache[coordinate]
                    row["city"] = city or row.get("stop_name", "")
                    writer.writerow(row)
                    stop_name = row.get("stop_name") or f"row {row_number}"
                    print(f"{stop_name} -> {row['city']}", flush=True)

        os.replace(temp_path, output_path)
    except Exception:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


def main() -> None:
    script_directory = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description=(
            "Add a city column to a tab-separated stops file using "
            "OpenStreetMap Nominatim reverse geocoding."
        )
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=script_directory / "combine.tsv",
        help="input TSV (default: combine.tsv beside this script)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=script_directory / "combine_with_city.tsv",
        help="output TSV (default: combine_with_city.tsv beside this script)",
    )
    parser.add_argument(
        "--radius-km",
        type=float,
        default=50.0,
        help="maximum distance from the returned city point (default: 25 km)",
    )
    parser.add_argument(
        "--user-agent",
        default="ontario-northland-city-enrichment/1.0",
        help="identifying User-Agent for the Nominatim request",
    )
    args = parser.parse_args()

    if args.radius_km <= 0 or not math.isfinite(args.radius_km):
        parser.error("--radius-km must be a finite number greater than zero")

    add_city_column(args.input, args.output, args.radius_km, args.user_agent)
    print(f"Wrote city-enriched TSV to {args.output}")
    print("Geocoding data: © OpenStreetMap contributors")


if __name__ == "__main__":
    main()
