import csv
import re
from pathlib import Path

csv_path = r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\csv出力\supabase_import\第83期_順位_import.csv"

def parse_csv(file_path):
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        rows = list(reader)

    print(f"Total rows: {len(rows)}")
    
    # Simple state machine to capture "entries"
    # An entry starts with a row that has a Rank and Customer Name
    
    current_entry = None
    
    for i, row in enumerate(rows):
        # Skip empty rows
        if not any(row):
            continue
            
        # Check if this row looks like a header (Rank/No/Name)
        if "得意先名" in row:
            continue
        
        # Check for Metadata/Comments
        if row[0].startswith("c588") and "月日時点" in str(row):
             continue

        # Extract basic info (assuming standard columns based on view_file)
        # Col 0: uuid, Col 1: Rank, Col 2: Name, Col 3: Rep, Col 4: Dept?, Col 5: Type
        
        # Heuristic: If Col 1 is a number, it's a new entry
        is_new_entry = False
        try:
            if row[1] and row[1].isdigit():
                is_new_entry = True
        except IndexError:
            pass
            
        if is_new_entry:
            # Process previous entry if exists
            if current_entry:
                print_entry(current_entry)
            
            # Start new entry
            current_entry = {
                "uuid": row[0],
                "rank": row[1],
                "name": row[2],
                "rep": row[3],
                "dept": row[4],
                "lines": []
            }
            # Add this row as a line
            current_entry["lines"].append(row)
        else:
            # Continuation of current entry (e.g. "前期" row or wrapped numbers)
            if current_entry:
                current_entry["lines"].append(row)

    if current_entry:
        print_entry(current_entry)

def clean_num(s):
    if not s: return 0
    s = str(s).replace(",", "").strip()
    try:
        return int(s)
    except:
        return 0

def print_entry(e):
    # This function tries to make sense of the lines in an entry
    print(f"Entry: Rank {e['rank']} - {e['name']}")
    for line in e['lines']:
        print(f"  Line: {line}")
    print("-" * 20)

if __name__ == "__main__":
    parse_csv(csv_path)
