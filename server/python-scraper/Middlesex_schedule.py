
import csv
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

URL = "https://www.middlesex.ca/schedules"
PROVIDER_ID = 4

# Table numbers are 1-based, matching the website.
# Table 7 is mixed, so it must provide AM/PM information.
TABLE_PERIODS = {
    1: "AM",
    2: "PM",
    3: "AM",
    4: "PM",
    5: "AM",
    6: "PM",
    7: None
}


def expand_table(rows):
    """Expand colspan/rowspan cells into a consistent grid."""
    grid = []
    pending = {}

    for row in rows:
        cells = []
        column = 0

        while column in pending:
            cells.append(pending[column]["text"])
            pending[column]["remaining"] -= 1

            if pending[column]["remaining"] == 0:
                del pending[column]

            column += 1

        for cell in row.find_all(["th", "td"], recursive=False):
            while column in pending:
                cells.append(pending[column]["text"])
                pending[column]["remaining"] -= 1

                if pending[column]["remaining"] == 0:
                    del pending[column]

                column += 1

            text = cell.get_text(" ", strip=True)
            colspan = int(cell.get("colspan", 1))
            rowspan = int(cell.get("rowspan", 1))

            for offset in range(colspan):
                cells.append(text)

                if rowspan > 1:
                    pending[column + offset] = {
                        "text": text,
                        "remaining": rowspan - 1
                    }

            column += colspan

        grid.append(cells)

    return grid


def detect_period(value):
    """Return AM or PM if explicitly present in a cell."""
    value = value.upper().replace(".", "")
    match = re.search(r"\b(AM|PM)\b", value)

    if match:
        return match.group(1)

    return None


def normalize_time(value, default_period=None):
    """Convert a schedule time to 24-hour HH:MM:SS format."""
    value = value.strip().upper()

    if not value or value == "-":
        return None

    # Find the time and any attached AM/PM indicator.
    match = re.search(
        r"(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM|A|P)?\b",
        value
    )

    if not match:
        return None

    time_text = match.group(1)
    period = match.group(2)

    if period == "A":
        period = "AM"
    elif period == "P":
        period = "PM"

    hour = int(time_text.split(":")[0])

    # Explicit AM/PM takes priority over the table default.
    if period:
        fmt = "%I:%M:%S %p" if time_text.count(":") == 2 else "%I:%M %p"

        try:
            return datetime.strptime(
                f"{time_text} {period}", fmt
            ).strftime("%H:%M:%S")
        except ValueError:
            return None

    # Already in unambiguous 24-hour format.
    if hour > 12:
        fmt = "%H:%M:%S" if time_text.count(":") == 2 else "%H:%M"

        try:
            return datetime.strptime(time_text, fmt).strftime("%H:%M:%S")
        except ValueError:
            return None

    # Without a period, a 1–12 hour time needs the table's default.
    if default_period is None:
        return None

    fmt = "%I:%M:%S %p" if time_text.count(":") == 2 else "%I:%M %p"

    try:
        return datetime.strptime(
            f"{time_text} {default_period}", fmt
        ).strftime("%H:%M:%S")
    except ValueError:
        return None


# Download the schedule page.
response = requests.get(URL, timeout=30)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")
tables = soup.find_all("table", class_="table")

if len(tables) < 7:
    raise ValueError(
        f"Expected 7 tables, but found {len(tables)}."
    )


# Combined output for every table.
stops = []
stop_times = []

# Keep the same stop ID when a stop appears in another table.
stop_id_by_key = {}

# Keep trip IDs unique across the combined schedules.
trip_id_by_key = {}
used_trip_ids = set()
next_trip_id = 1

record_id = 1

for table_number, table in enumerate(tables[:7], start=1):
    print(f"Processing table {table_number}...")

    grid = expand_table(table.find_all("tr"))

    if len(grid) < 3:
        print(f"Skipping table {table_number}: too few rows.")
        continue

    city_row = grid[0]
    stop_row = grid[1]
    default_period = TABLE_PERIODS[table_number]

    # Associate each column with its city.
    city_by_column = {}
    current_city = ""

    for column, city in enumerate(city_row):
        if city.strip():
            current_city = city.strip()

        city_by_column[column] = current_city

    # Create stop records, reusing IDs across tables.
    stop_id_by_column = {}

    for column in range(1, len(stop_row)):
        stop_name = stop_row[column].strip()
        city_name = city_by_column.get(column, "")

        if not stop_name:
            continue

        # A stop with the same name in a different city is separate.
        stop_key = (city_name, stop_name)

        if stop_key not in stop_id_by_key:
            stop_id = len(stops) + 1
            stop_id_by_key[stop_key] = stop_id

            stops.append({
                "stop_id": stop_id,
                "provider_id": PROVIDER_ID,
                "stop_name": stop_name,
                "city_name": city_name
            })

        stop_id_by_column[column] = stop_id_by_key[stop_key]

    # Process the trip rows.
    for row in grid[2:]:
        if not row:
            continue

        trip_name = row[0].strip()

        # Ignore headings or other non-trip rows.
        trip_match = re.search(r"\bTrip\s*(\d+)\b", trip_name, re.I)

        if not trip_match:
            continue

        source_trip_id = int(trip_match.group(1))
        trip_key = (table_number, trip_name)

        # Preserve source trip numbers when possible.
        # If another table already used that ID, assign a unique one.
        if trip_key not in trip_id_by_key:
            if source_trip_id not in used_trip_ids:
                assigned_trip_id = source_trip_id
            else:
                assigned_trip_id = max(
                    used_trip_ids, default=0
                ) + 1

                while assigned_trip_id in used_trip_ids:
                    assigned_trip_id += 1

            trip_id_by_key[trip_key] = assigned_trip_id
            used_trip_ids.add(assigned_trip_id)

        trip_id = trip_id_by_key[trip_key]

        # If the row contains a period marker, use it as a fallback
        # for cells that do not include AM/PM themselves.
        row_periods = {
            detect_period(value)
            for value in row
            if detect_period(value)
        }

        row_period = (
            next(iter(row_periods))
            if len(row_periods) == 1
            else default_period
        )

        
        # Collect all valid stops for this trip first.
        trip_stops = []

        for column in range(1, min(len(row), len(stop_row))):
            if column not in stop_id_by_column:
                continue

            time_value = row[column].strip()

            if not time_value or time_value == "-":
                continue

            cell_period = detect_period(time_value)
            period = cell_period or row_period

            time = normalize_time(time_value, period)

            if time is None:
                print(
                    f"Warning: couldn't interpret time {time_value!r} "
                    f"in table {table_number}, trip {trip_name!r}, "
                    f"column {column}."
                )
                continue

            trip_stops.append({
                "time": time,
                "stop_id": stop_id_by_column[column],
                "city_name": city_by_column.get(column, ""),
                "column": column
            })


        # Sort stops by ascending 24-hour time.
        trip_stops.sort(key=lambda stop: (stop["time"], stop["column"]))

        # Assign stop_sequence after sorting.
        for sequence, stop in enumerate(trip_stops, start=1):
            stop_times.append({
                "ID": record_id,
                "Provider": PROVIDER_ID,
                "trip_id": trip_id,
                "arrival_time": stop["time"],
                "departure_time": stop["time"],
                "stop_id": stop["stop_id"],
                "stop_sequence": sequence,
                "city_name": stop["city_name"]
            })

            record_id += 1


# Write the combined Stops.csv file.
with open("Stops.csv", "w", newline="", encoding="utf-8") as file:
    writer = csv.DictWriter(
        file,
        fieldnames=[
            "stop_id", "provider_id", "stop_name", "city_name"
        ]
    )
    writer.writeheader()
    writer.writerows(stops)


# Write the combined stop_times.csv file.
with open("stop_times.csv", "w", newline="", encoding="utf-8") as file:
    writer = csv.DictWriter(
        file,
        fieldnames=[
            "ID", "Provider", "trip_id", "arrival_time",
            "departure_time", "stop_id", "stop_sequence", "city_name"
        ]
    )
    writer.writeheader()
    writer.writerows(stop_times)


print("\nScraping complete.")
print(f"Unique stops: {len(stops)}")
print(f"Stop-time records: {len(stop_times)}")
print("Created Stops.csv and stop_times.csv")