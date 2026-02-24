import json
import os
import math
from pathlib import Path

INPUT_JSON = r"C:\Users\ishij\OneDrive\Documents\GitHub\mqdriven\scripts\rankings_to_insert.json"
OUTPUT_DIR = r"C:\Users\ishij\OneDrive\Documents\GitHub\mqdriven\scripts\sql_batches"

BATCH_SIZE = 2000

def escape_sql(val):
    if val is None:
        return "NULL"
    if isinstance(val, str):
        return "'" + val.replace("'", "''") + "'"
    return str(val)

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        records = json.load(f)
        
    print(f"Total records: {len(records)}")
    
    total_batches = math.ceil(len(records) / BATCH_SIZE)
    
    for i in range(total_batches):
        batch = records[i*BATCH_SIZE : (i+1)*BATCH_SIZE]
        
        values_list = []
        for r in batch:
            # fiscal_period_id must be a valid UUID. If it's empty string, we should make it NULL (or skip?)
            # The parsing logic put mapping logic. If key not found, it might be "".
            # If "", we can't insert into uuid column.
            # But earlier log said "2005-2006... UUID列は空".
            # If UUID is empty, we set it to NULL.
            fid = r.get("fiscal_period_id")
            if not fid:
                fid_val = "NULL" 
            else:
                fid_val = f"'{fid}'"

            # Construct row
            # Columns match the table schema found earlier
            val_str = f"({fid_val}, {escape_sql(r.get('rank'))}, {escape_sql(r.get('customer_name_raw'))}, {escape_sql(r.get('sales_rep_name_raw'))}, {escape_sql(r.get('department_name_raw'))}, {escape_sql(r.get('period_type'))}, {r.get('month_06',0)}, {r.get('month_07',0)}, {r.get('month_08',0)}, {r.get('month_09',0)}, {r.get('month_10',0)}, {r.get('month_11',0)}, {r.get('month_12',0)}, {r.get('month_01',0)}, {r.get('month_02',0)}, {r.get('month_03',0)}, {r.get('month_04',0)}, {r.get('month_05',0)}, {r.get('total',0)}, {escape_sql(r.get('source_file'))}, {escape_sql(r.get('doc_type'))})"
            values_list.append(val_str)
            
        sql = f"""
INSERT INTO customer_sales_ranking (
    fiscal_period_id, rank, customer_name_raw, sales_rep_name_raw, department_name_raw, period_type,
    month_06, month_07, month_08, month_09, month_10, month_11, month_12, 
    month_01, month_02, month_03, month_04, month_05, total,
    source_file, doc_type
) VALUES 
{",\n".join(values_list)};
"""
        
        filename = os.path.join(OUTPUT_DIR, f"batch_{i+1:03d}.sql")
        with open(filename, "w", encoding="utf-8") as out:
            out.write(sql)
            
    print(f"Generated {total_batches} SQL files in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
