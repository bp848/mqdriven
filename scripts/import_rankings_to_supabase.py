import csv
import json
import re
import os
import glob
from pathlib import Path

INPUT_DIR = r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\csv出力\supabase_import"
OUTPUT_JSON = r"C:\Users\ishij\OneDrive\Documents\GitHub\mqdriven\scripts\rankings_to_insert.json"

def extract_values_from_line(line_str):
    cleaned = re.sub(r'(今期|前期)', '', line_str)
    nums = re.findall(r'[\d,]+', cleaned)
    values = []
    for n in nums:
        # Check if it's a valid number (sometimes date-like strings might appear? but strict digit check handles it)
        clean_n = n.replace(',', '')
        if clean_n.isdigit():
            values.append(int(clean_n))
    return values

def map_to_record(uuid, rank, name, rep, dept, period_type, values, doc_type, source_file):
    # Expect 13 values: 12 months + Total.
    # Logic from test_parse_csv_v2
    months = [0] * 12
    total = 0
    
    if len(values) == 13:
        months = values[:12]
        total = values[12]
    elif len(values) == 1:
        total = values[0]
    elif len(values) > 13:
        months = values[:12]
        total = values[-1]
    elif len(values) > 0:
        # Best effort fill
        limit = min(len(values), 12)
        for i in range(limit):
            months[i] = values[i]
        # If we have e.g. 12 values, maybe 'total' is missing? 
        # Or if we have 5 values?
        # Let's assume the provided values are Month 06..XX
        # And Total is calculated?
        # User instruction "12ヶ月分 + 合計 = 13個が理想"
        # If missing, 0 pad.
        total = sum(months) # Fallback logic?
        # Actually user said: "values = [...] ... while len(values) < 13: append(0)"
        # Then "total = values[12]".
        # This implies if we have 5 values, we treat them as months 0-4, and Total is 0.
        # But wait, usually Total is present.
        # Let's stick to: If we extracted numbers, we trust the order.
        pass

    return {
        "fiscal_period_id": uuid,
        "rank": int(rank.replace(',','')) if rank and rank.replace(',','').isdigit() else None,
        "customer_name_raw": name,
        "sales_rep_name_raw": rep,
        "department_name_raw": dept,
        "period_type": period_type,
        "month_06": months[0],
        "month_07": months[1],
        "month_08": months[2],
        "month_09": months[3],
        "month_10": months[4],
        "month_11": months[5],
        "month_12": months[6],
        "month_01": months[7],
        "month_02": months[8],
        "month_03": months[9],
        "month_04": months[10],
        "month_05": months[11],
        "total": total,
        "source_file": source_file,
        "doc_type": doc_type
    }

def process_file(file_path):
    records = []
    fname = Path(file_path).name
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        rows = list(reader)
        
    current_entry = None
    
    for row in rows:
        if not any(row): continue
        if len(row) < 3: continue  # Skip rows without enough columns
        
        # Skip header
        if row[0] == "fiscal_period_id": continue
        
        # Skip rows without UUID (e.g. 2005-2006)
        if not row[0]: continue
        
        # New Entry Heuristic
        is_new_entry = False
        try:
            # Col 1 is Rank
            if row[1] and row[1].replace(',','').isdigit():
                is_new_entry = True
        except:
            pass
            
        if is_new_entry:
            if current_entry:
                records.extend(parse_entry(current_entry, fname))
            
            # Start new
            current_entry = {
                "uuid": row[0],
                "rank": row[1],
                "name": row[2],
                "rep": row[3] if len(row) > 3 else "",
                "dept": row[4] if len(row) > 4 else "",
                "doc_type_raw": row[5] if len(row) > 5 else "", # "今期\n前期" column?
                "lines": [row]
            }
        else:
            if current_entry:
                current_entry["lines"].append(row)
                
    if current_entry:
        records.extend(parse_entry(current_entry, fname))
        
    return records

def parse_entry(entry, source_file):
    # Flatten text from lines
    # Split by newline logic
    
    # We will accumulate text for "Line A" (Current) and "Line B" (Previous)
    line_a_str = ""
    line_b_str = ""
    
    raw_lines = entry["lines"]
    
    # Check if doc_type_raw indicates period types
    # e.g. "今期\n前期"
    # But we assume Current/Top, Previous/Bottom regardless.
    
    for row in raw_lines:
        for i, cell in enumerate(row):
            # Skip Metadata columns to avoid parsing Rank/Name as numbers
            if i < 3: continue # 0=UUID, 1=Rank, 2=Name. 3=Rep? 
            # Rep name might be "7,000" if columns shifted? NO, CSV is structured.
            # But "Dept" might be empty or number?
            # Safe to parse ALL columns > 2?
            # Rep (3) and Dept (4) usually text.
            # But let's look at `extract_values_from_line`: it filters for digits.
            # A name like "7-Eleven" would be parsed.
            # Ideally we skip name/rep columns.
            # In `process_rankings.py`, Header was:
            # UUID, Rank, Name, Rep, Dept, ...
            # Values start from Col 5? 
            # In `test_parse_csv.py` output:
            # Line: ['uuid', '1', 'name', 'rep', '-', '今期\n前期', '32,866...']
            # So Col 0,1,2,3,4,5 are metadata.
            # Values are in 6+.
            if i < 6: continue
            
            if '\n' in cell:
                parts = cell.split('\n')
                line_a_str += " " + parts[0]
                if len(parts) > 1:
                    line_b_str += " " + parts[1]
            else:
                line_a_str += " " + cell
                
    # Extract
    vals_a = extract_values_from_line(line_a_str)
    vals_b = extract_values_from_line(line_b_str)
    
    res = []
    
    # Current
    if vals_a:
        res.append(map_to_record(
            entry["uuid"], entry["rank"], entry["name"], entry["rep"], entry["dept"],
            "今期", vals_a, entry.get("doc_type_raw", ""), source_file
        ))
        
    # Previous
    if vals_b:
        # Check if total is not 0 (User validation: [NG] ... 0)
        # If 0, do we insert? User [NG] implied "Alert".
        # But if the record IS 0, saving 0 is correct.
        # But maybe we only want non-zero records?
        # Let's insert all for completeness, application can filter.
        rec = map_to_record(
            entry["uuid"], entry["rank"], entry["name"], entry["rep"], entry["dept"],
            "前期", vals_b, entry.get("doc_type_raw", ""), source_file
        )
        res.append(rec)
        
    return res

def main():
    all_files = glob.glob(os.path.join(INPUT_DIR, "*_import.csv"))
    all_records = []
    
    print(f"Processing {len(all_files)} files...")
    for f in all_files:
        print(f"  {Path(f).name}")
        recs = process_file(f)
        all_records.extend(recs)
        
    print(f"Total extracted records: {len(all_records)}")
    
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
        
    print(f"Saved to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
