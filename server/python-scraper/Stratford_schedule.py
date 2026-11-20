"""Scrape PC Connect stops and stop times from the City of Stratford schedules."""

import csv
import re
import sys
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

URL = (
    "https://www.stratford.ca/live-here/transportation/"
    "pc-connect-transit/schedules-and-maps/"
)
PROVIDER_ID = 5
OUTPUT_STOPS = Path(__file__).with_name("Stratford_Stops.csv")
OUTPUT_STOP_TIMES = Path(__file__).with_name("Stratford_stop_times.csv")

CITIES = (
    "Highway 86",
    "St. Jacobs",
    "St. Marys",
    "New Hamburg",
    "Kitchener",
    "Wallenstein",
    "Shakespeare",
    "Waterloo",
    "Listowel",
    "Dorking",
    "Elmira",
    "London",
    "Stratford",
)


def normalize_time(value):
    """Convert a published 12-hour time to HH:MM:SS."""
    value = value.strip().upper()

    if not value or re.fullmatch(r"[-–—]+", value):
        return None

    match = re.fullmatch(r"(\d{1,2}:\d{2})\s*(AM|PM)", value)

    if not match:
        raise ValueError(f"Unrecognized PC Connect schedule time: {value!r}")

    time_text, period = match.groups()
    # The Route 3 graphic confirms these accessible-table noon times are PM.
    if time_text.startswith("12:") and period == "AM":
        period = "PM"

    return datetime.strptime(
        f"{time_text} {period}", "%I:%M %p"
    ).strftime("%H:%M:%S")


def parse_stop(value):
    """Split a schedule row into its city and stop name."""
    value = " ".join(value.replace("\xa0", " ").split())
    value = re.sub(r"\s*\*.*$", "", value)
    value = re.sub(
        r"\s*\((?:outbound|inbound)\s+to[^)]*\)",
        "",
        value,
        flags=re.I,
    ).strip()

    for city in CITIES:
        if value.casefold().startswith(city.casefold()):
            stop_name = value[len(city):]
            stop_name = re.sub(r"^\s*[-–—]\s*", "", stop_name).strip()

            if not stop_name:
                raise ValueError(f"Schedule row has no stop name: {value!r}")

            return city, stop_name

    raise ValueError(f"Couldn't identify the city in schedule row: {value!r}")


def stop_key(city, stop_name):
    normalized_name = stop_name.casefold()
    normalized_name = re.sub(r"\bst\b", "street", normalized_name)
    normalized_name = re.sub(r"\brd\b", "road", normalized_name)
    normalized_name = re.sub(r"\bblvd\b", "boulevard", normalized_name)
    normalized_name = re.sub(r"\s*#\s*", " ", normalized_name)
    normalized_name = re.sub(r"[^a-z0-9]+", " ", normalized_name).strip()
    return city.casefold(), normalized_name


def parse_schedule_table(
    table, route_number, service_day, stops, stop_ids, first_record_id
):
    rows = [
        row.find_all(["th", "td"], recursive=False)
        for row in table.find_all("tr")
    ]
    rows = [row for row in rows if row]

    if len(rows) < 2:
        raise ValueError(f"Route {route_number} {service_day} table is empty.")

    headers = [" ".join(cell.get_text(" ", strip=True).split()) for cell in rows[0]]
    trip_columns = []

    for column, header in enumerate(headers[1:], start=1):
        if "BREAK" in header.upper():
            continue

        match = re.search(r"\bTrip\s*(\d+)\b", header, re.I)
        if not match:
            raise ValueError(
                f"Unexpected column in Route {route_number} {service_day}: "
                f"{header!r}"
            )

        if "↑" in header:
            direction = "up"
        elif "↓" in header:
            direction = "down"
        else:
            raise ValueError(
                f"Missing direction in Route {route_number} {service_day}: "
                f"{header!r}"
            )

        trip_columns.append((column, match.group(1), direction))

    parsed_stops = []

    for row in rows[1:]:
        if len(row) != len(headers):
            raise ValueError(
                f"Unexpected cell count in Route {route_number} {service_day}: "
                f"expected {len(headers)}, found {len(row)}."
            )

        city, stop_name = parse_stop(row[0].get_text(" ", strip=True))
        key = stop_key(city, stop_name)

        if key not in stop_ids:
            stop_id = len(stops) + 1
            stop_ids[key] = stop_id
            stops.append({
                "stop_id": stop_id,
                "provider_id": PROVIDER_ID,
                "stop_name": stop_name,
                "city_name": city,
            })

        parsed_stops.append((stop_ids[key], city, row))

    stop_times = []

    for column, trip_number, direction in trip_columns:
        trip_id = f"PC-R{route_number}-{service_day}-{trip_number}"
        scheduled_stops = []

        for stop_id, city, row in parsed_stops:
            time_value = row[column].get_text(" ", strip=True)
            time = normalize_time(time_value)

            if time is not None:
                scheduled_stops.append((stop_id, city, time))

        if direction == "up":
            scheduled_stops.reverse()

        previous_time = None

        for sequence, (stop_id, city, time) in enumerate(scheduled_stops, start=1):
            if previous_time is not None and time < previous_time:
                print(
                    f"Warning: times are not chronological for {trip_id}; "
                    f"stop_id {stop_id} has time {time}; check the published schedule.",
                    file=sys.stderr,
                )
            previous_time = time

            stop_times.append({
                "ID": first_record_id + len(stop_times),
                "Provider": PROVIDER_ID,
                "trip_id": trip_id,
                "arrival_time": time,
                "departure_time": time,
                "stop_id": stop_id,
                "stop_sequence": sequence,
                "city_name": city,
            })

    return stop_times


def scrape():
    response = requests.get(URL, timeout=30)
    response.raise_for_status()
    tables = BeautifulSoup(response.text, "html.parser").find_all("table")

    if len(tables) != 6:
        raise ValueError(f"Expected 6 PC Connect schedule tables, found {len(tables)}.")

    stops = []
    stop_times = []
    stop_ids = {}

    for table_index, table in enumerate(tables):
        route_number = table_index // 2 + 1
        service_day = "weekday" if table_index % 2 == 0 else "saturday"
        stop_times.extend(
            parse_schedule_table(
                table,
                route_number,
                service_day,
                stops,
                stop_ids,
                len(stop_times) + 1,
            )
        )

    return stops, stop_times


def main():
    stops, stop_times = scrape()

    with OUTPUT_STOPS.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["stop_id", "provider_id", "stop_name", "city_name"],
        )
        writer.writeheader()
        writer.writerows(stops)

    with OUTPUT_STOP_TIMES.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "ID",
                "Provider",
                "trip_id",
                "arrival_time",
                "departure_time",
                "stop_id",
                "stop_sequence",
                "city_name",
            ],
        )
        writer.writeheader()
        writer.writerows(stop_times)

    print(f"Unique stops: {len(stops)}")
    print(f"Stop-time records: {len(stop_times)}")
    print(f"Created {OUTPUT_STOPS.name} and {OUTPUT_STOP_TIMES.name}")


if __name__ == "__main__":
    main()
