"""
Fill trips.price for every provider.

Fares are end-to-end: the price of riding a trip from its first stop
to its last stop.

  Middlesex Connect   scraped from middlesex.ca (flat fare, Routes 1-3)
  Ontario Northland   fare_table.csv (copy prices from their tariff/site)
  RobertQ             fare_table.csv
  Middlesex Route 4   fare_table.csv (distance-based, published as an image)
  VIA Rail            left empty: prices change by date and fare class

A trip with no known fare keeps price = NULL. Never write 0 for "unknown".
A trip that already has a price in the database is never overwritten.

Usage:
  set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only, never VITE_);
  the key can be a secret key (sb_secret_...) or a legacy service_role key
  python fares.py            # writes trip_prices.csv, changes nothing
  python fares.py --upload   # also writes prices to the trips table
"""

import csv
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

VIA, ONTARIO_NORTHLAND, ROBERTQ, MIDDLESEX = 1, 2, 3, 4

MIDDLESEX_FARES_URL = "https://www.middlesex.ca/fares-passes"
# Route 4 (London-Sarnia) is priced by distance, not the flat fare.
MIDDLESEX_ROUTE_4_CITIES = {"Sarnia", "Strathroy", "Komoka", "Mt. Brydges"}

FARE_TABLE = Path(__file__).with_name("fare_table.csv")
OUTPUT = Path(__file__).with_name("trip_prices.csv")
PAGE_SIZE = 1000


# ---------- Supabase ----------

def supabase():
    url = os.environ.get("SUPABASE_URL", "https://nlcyutwxvxgtrlbvmusi.supabase.co").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_BnzoBXv8vGkksHAJY_fa9A_v-AX9enO")

    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.")

    session = requests.Session()
    session.headers.update({"apikey": key})

    # Legacy service_role keys are JWTs ("eyJ...") and also go in the
    # Authorization header. New secret keys ("sb_secret_...") only use apikey.
    if key.startswith("eyJ"):
        session.headers["Authorization"] = f"Bearer {key}"
    return url + "/rest/v1", session


def fetch_all(api, session, table, columns):
    rows = []

    while True:
        response = session.get(
            f"{api}/{table}",
            params={"select": columns, "limit": PAGE_SIZE, "offset": len(rows)},
            timeout=30,
        )
        response.raise_for_status()
        page = response.json()
        rows.extend(page)

        if len(page) < PAGE_SIZE:
            return rows


# ---------- Trip endpoints ----------

def trip_endpoints(stops, stop_times):
    """Return {trip_id: {provider, origin, destination, cities}}."""
    city = {(s["provider"], s["stop_id"]): s["city_name"] for s in stops}
    by_trip = {}

    for row in stop_times:
        by_trip.setdefault(row["trip_id"], []).append(row)

    trips = {}

    for trip_id, rows in by_trip.items():
        rows.sort(key=lambda r: r["stop_sequence"])
        provider = rows[0]["Provider"]
        cities = [city.get((provider, r["stop_id"])) for r in rows]

        trips[trip_id] = {
            "provider": provider,
            "origin": cities[0],
            "destination": cities[-1],
            "cities": set(cities),
        }

    return trips


# ---------- Fare sources ----------

def scrape_middlesex_flat_fare():
    """Read the Routes 1-3 one-way fare from the Middlesex fares page."""
    response = requests.get(MIDDLESEX_FARES_URL, timeout=30)
    response.raise_for_status()
    text = BeautifulSoup(response.text, "html.parser").get_text(" ", strip=True)
    return parse_middlesex_flat_fare(text)


def parse_middlesex_flat_fare(text):
    match = re.search(
        r"Routes?\s*1\s*[-–]\s*3\s+are\s+\$(\d+(?:\.\d{2})?)\s+one-way",
        text,
        re.I,
    )

    if not match:
        raise ValueError(
            "Couldn't find the Routes 1-3 fare on the Middlesex page. "
            "The page wording probably changed."
        )

    return float(match.group(1))


def load_fare_table():
    """Return {(provider, origin, destination): price} for filled-in rows."""
    fares = {}

    with open(FARE_TABLE, newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            price = row["price"].strip()

            if not price:
                continue

            key = (int(row["provider_id"]), row["origin_city"], row["destination_city"])
            fares[key] = float(price)

    return fares


def price_for(trip, middlesex_flat, fare_table):
    provider = trip["provider"]

    if provider == VIA:
        return None, "dynamic pricing, not stored"

    if provider == MIDDLESEX and not (trip["cities"] & MIDDLESEX_ROUTE_4_CITIES):
        return middlesex_flat, "middlesex.ca flat fare"

    key = (provider, trip["origin"], trip["destination"])
    reverse = (provider, trip["destination"], trip["origin"])

    if key in fare_table:
        return fare_table[key], "fare_table.csv"

    if reverse in fare_table:
        return fare_table[reverse], "fare_table.csv (reverse direction)"

    return None, "missing from fare_table.csv"


# ---------- Main ----------

def main():
    upload = "--upload" in sys.argv
    api, session = supabase()

    stops = fetch_all(api, session, "Stops", "provider,stop_id,city_name")
    stop_times = fetch_all(api, session, "stop_times", "Provider,trip_id,stop_id,stop_sequence")
    trips = trip_endpoints(stops, stop_times)
    existing = {
        t["trip_id"]: t["price"]
        for t in fetch_all(api, session, "trips", "trip_id,price")
        if t["price"] is not None
    }

    middlesex_flat = scrape_middlesex_flat_fare()
    fare_table = load_fare_table()
    print(f"Middlesex Routes 1-3 fare: ${middlesex_flat:.2f}")

    results = []

    for trip_id, trip in sorted(trips.items()):
        if trip_id in existing:
            # Prices already in the table are kept as they are.
            price, source = existing[trip_id], "already set in database"
        else:
            price, source = price_for(trip, middlesex_flat, fare_table)

        results.append({
            "trip_id": trip_id,
            "provider_id": trip["provider"],
            "origin_city": trip["origin"],
            "destination_city": trip["destination"],
            "price": "" if price is None else f"{price:.2f}",
            "source": source,
        })

    with open(OUTPUT, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)

    priced = [
        r for r in results
        if r["price"] and r["source"] != "already set in database"
    ]
    print(
        f"{len(existing)} trips already priced (left untouched); "
        f"{len(priced)} new prices found. See {OUTPUT.name}."
    )

    if not upload:
        print("Dry run. Re-run with --upload to write prices to Supabase.")
        return

    for row in priced:
        response = session.patch(
            f"{api}/trips?trip_id=eq.{quote(row['trip_id'], safe='')}",
            json={"price": float(row["price"])},
            timeout=30,
        )
        response.raise_for_status()

    print(f"Uploaded {len(priced)} prices.")


if __name__ == "__main__":
    main()
