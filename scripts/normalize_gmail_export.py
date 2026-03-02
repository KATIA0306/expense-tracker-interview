#!/usr/bin/env python3
"""Normalize Gmail export CSV to match emailData_exercise format: id, from, to, subject, date, body, threadId."""

import csv
import os
from datetime import datetime

def parse_iso_date(iso_str):
    """Convert ISO 8601 to RFC 2822-like format for consistency with emailData_exercise."""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
    except (ValueError, AttributeError):
        return iso_str

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    in_path = os.path.join(project_root, "Gmail export.csv")
    out_path = os.path.join(project_root, "Gmail export.csv")

    with open(in_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    # Map: ID->id, Thread->threadId, Date->date (convert format), From->from, To->to, Subject->subject, Body->body
    # Drop: Labels, Link
    target_columns = ["id", "from", "to", "subject", "date", "body", "threadId"]
    col_map = {
        "ID": "id",
        "Thread": "threadId",
        "Date": "date",
        "From": "from",
        "To": "to",
        "Subject": "subject",
        "Body": "body",
    }

    normalized = []
    for row in rows:
        new_row = {}
        for old_col, new_col in col_map.items():
            if old_col in row:
                val = row[old_col]
                if old_col == "Date" and val:
                    val = parse_iso_date(val)
                new_row[new_col] = val or ""
        normalized.append(new_row)

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=target_columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(normalized)

    print(f"Normalized {len(normalized)} rows. Columns: {target_columns}")

if __name__ == "__main__":
    main()
