import csv
import re
import sys
import io
from pathlib import Path

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

csv_path = r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\csv出力\supabase_import\第83期_順位_import.csv"

def extract_values_from_line(line_str):
    """
    Extracts numerical values from a string line.
    Returns a list of integers.
    """
    # Remove period labels if they exist mixed in with numbers
    # (Though usually they are separate or handled before calling this)
    cleaned = re.sub(r'(今期|前期)', '', line_str)
    
    # Find all number-like sequences (digits with commas)
    nums = re.findall(r'[\d,]+', cleaned)
    
    values = []
    for n in nums:
        # Remove commas and check if it's a valid integer
        clean_n = n.replace(',', '')
        if clean_n.isdigit():
            values.append(int(clean_n))
            
    return values

def parse_entry_lines(entry):
    """
    Parses the raw lines of an entry to extract '今期' and '前期' data.
    """
    raw_lines = entry['lines']
    
    # Flatten the CSV rows into a single list of cell strings, 
    # but respect that some cells contain newlines which need splitting
    
    # First, let's just collect all non-empty strings from all cells in all lines
    all_text_fragments = []
    
    for row in raw_lines:
        for cell in row:
            if not cell: continue
            # Split cell by newline if present (handling "今期\n前期" case)
            parts = cell.split('\n')
            for part in parts:
                if part.strip():
                    all_text_fragments.append(part.strip())

    # Now we try to reconstruct the logic. 
    # Typically we see "今期", then a series of numbers, then "前期", then numbers.
    # OR "今期", "前期" appearing together, followed by interleaved or sequential numbers.
    
    # Let's try to bucket values into Current (今期) and Previous (前期)
    
    current_values = []
    previous_values = []
    
    # Simple state machine
    # state 0: looking for start
    # state 1: collecting 'current'
    # state 2: collecting 'previous'
    
    # HEURISTIC:
    # If we see "今期", we start collecting for current.
    # If we see "前期", we switch to previous.
    # If we see "今期" AND "前期" in the same fragment (rare if split above), 
    # or if we just have a list of numbers, we need to be careful.
    
    # Based on the sample output, it seems we often get:
    # '今期', '前期' (as labels)
    # Then a string of numbers for months ...
    
    # Let's process the fragments to extract all numbers found
    
    # Better approach might be to look at the raw lines structure again
    # The CSV structure from `view_file` showed:
    # Row 1: ..., "今期\n前期", "123,456 ... \n 234,567 ..."
    
    # So the numbers are often in the same cell, separated by newline!
    
    current_data = {
        'period_type': '今期',
        'values': []
    }
    previous_data = {
        'period_type': '前期',
        'values': []
    }

    # Re-iterate raw CSV rows to preserve the structure of "newline in cell means new row of data"
    
    # We will try to build two lists of values: current_row_vals and previous_row_vals
    # If a cell has a newline, it splits to top (current) and bottom (previous) usually.
    
    vals_top = []
    vals_bottom = []
    
    has_newline_split = False
    
    for row in raw_lines:
        for cell in row:
            if not cell: continue
            if cell in ["今期", "前期", "今期\n前期", "-"]: continue
            
            # Check for newline split in value cells
            if '\n' in cell:
                has_newline_split = True
                parts = cell.split('\n')
                vals_top.extend(extract_values_from_line(parts[0]))
                if len(parts) > 1:
                    vals_bottom.extend(extract_values_from_line(parts[1]))
            else:
                # No newline, where does it go?
                # If we haven't seen a newline split yet, it might be top row
                # If we are in a "mixed" mode it's hard.
                # But looking at data "8,777,907 6,878,502 ...", these are space separated in one cell
                vals = extract_values_from_line(cell)
                if not has_newline_split:
                    vals_top.extend(vals)
                else:
                    # If we already encountered a split cell, does this unsplit cell belong to top or bottom?
                    # Usually the split happens in the month columns.
                    # If this is a Total column at the end, it might also be split.
                    # Let's assume valid data follows the pattern of split cells.
                    # But wait, looking at Rank 2:
                    # '4,740,313 ...' is in a cell by itself.
                    # '103,444,937\n118,234,486' is the total at the end.
                    pass
                    
    # The previous logic is too fragile. Let's try the USER's suggestion:
    # "Split line logic"
    
    # Let's reconstruct "Logical Rows" from the CSV Entry
    # A Logical Row is a full set of columns for one period.
    # The CSV lines from PDF have folded/wrapped these.
    
    # Key insight from valid CSV: "Total" is usually the last number.
    # Month values are 12 items.
    
    # Let's just grab ALL numbers from the entry and try to fit them.
    all_numbers_top = []
    all_numbers_bottom = []
    
    for row in raw_lines:
        # Check if this row seems to have "top" and "bottom" structure via newlines in cells
        row_has_newline = any('\n' in c for c in row)
        
        for cell in row:
            if not cell: continue
            if cell in ["今期", "前期", "今期\n前期", "-", "Aa", "Ba", "Ab"]: continue
            # Skip non-numeric/punctuation-like
            if not any(char.isdigit() for char in cell): continue

            if '\n' in cell:
                parts = cell.split('\n')
                all_numbers_top.extend(extract_values_from_line(parts[0]))
                if len(parts) > 1:
                    all_numbers_bottom.extend(extract_values_from_line(parts[1]))
            else:
                # If the row itself had a newline elsewhere, this cell 'probably' belongs to top?
                # Or if the cell is just numbers, we add to top? 
                # This is ambiguous. But let's look at Rank 9 example:
                # Row 1 has big block of numbers for top, and big block for bottom in same cell.
                # Row 2 has values for bottom?
                
                # Let's try simpler: Collect ALL strings, split by newline, flatten.
                pass

    # Alternative strategy: 
    # 1. stringify the whole entry columns joined.
    # 2. But respect the "newline inside cell" means "next period" usually.
    
    # Let's try to extract exactly 13 numbers for "今期" and 13 for "前期".
    # We prioritize "Top" values for "今期" and "Bottom" values for "前期".
    
    # Redo collection
    v_top = []
    v_bot = []
    
    for row in raw_lines:
        for cell in row:
            if not cell: continue
            if not any(char.isdigit() for char in cell): continue
            
            if '\n' in cell:
                parts = cell.split('\n')
                v_top.extend(extract_values_from_line(parts[0]))
                if len(parts) > 1:
                    v_bot.extend(extract_values_from_line(parts[1]))
            else:
                # If no newline in cell, it usually belongs to the 'primary' or 'top' flow
                # UNLESS we are clearly in a 'second row' situation.
                # But the CSV format from the user provided view_file shows most data is packed into cells with newlines.
                # Exceptions are usually "Total" or isolated months.
                
                # If it's a generated CSV from PDF, 'row' is a physical line in CSV.
                # If the physical line corresponds to one logical line in PDF, then we are good.
                # But here Rank 9 has 3 physical rows!
                
                # Heuristic: If we haven't filled up the "Top" bucket (13 values), put it there.
                # Else put in Bottom? No, that's dangerous if data is missing.
                
                # Safest bet based on visual:
                # effectively all cells are either "Shared" (header info), "Top Only" (rare?), or "Split".
                # If a cell is NOT split, does it belong to Top or Bottom?
                # In Rank 9: 
                # Row 2 col has '2,046,720 ...' which duplicates Row 1 bottom?
                # WAit, looking at Rank 9 Line 29 in view_file:
                # Line 1: ... '11,206,044 ... \n 1,752,219 ...', '2,046,720 ...'
                # It seems '2,046,720...' is the SAME as the previous cell's bottom part?
                # "2046720" appears in the extracted text of the first cell (bottom part) and second cell (top part)??
                # Actually, looking closely at Rank 9:
                # Cell 6: '11,206,044 ... \n 1,752,219 ... 11,206,814' (Huge block)
                # Cell 7: '2,046,720 ...' (This looks like a repeat of the middle of Cell 6?)
                
                # This suggests the CSV generation from PDF might have some duplication or weirdness.
                pass
                
    # Let's proceed with the "Split Lines" logic provided in the prompt, adapted for CSV.
    # We will simulate the "Split" by treating the top part of newline cells as Line A, bottom as Line B.
    
    line_a_str = ""
    line_b_str = ""
    
    for row in raw_lines:
        for cell in row:
            if not cell: continue
            if '\n' in cell:
                parts = cell.split('\n')
                line_a_str += " " + parts[0]
                if len(parts) > 1:
                    line_b_str += " " + parts[1]
            else:
                # Ambiguous cell. Add to Line A for now.
                # (Refinement: Check if Line A already has enough data?)
                line_a_str += " " + cell
                
    # Now extract numbers
    vals_a = extract_values_from_line(line_a_str)
    vals_b = extract_values_from_line(line_b_str)
    
    # We expect 13 values (12 months + Total).
    # Sometimes we get just Totals.
    
    # Map to result
    res = []
    
    # Entry A (Current)
    res.append(map_to_monthly(vals_a, '今期', entry))
    # Entry B (Previous)
    if vals_b:
        res.append(map_to_monthly(vals_b, '前期', entry))
        
    return res

def map_to_monthly(values, period_type, entry):
    # If we have > 13 values, take the Last as Total, and the First 12 as months.
    # If we have < 13 values, assume they are months, and Total might be missing or last.
    
    # Standard: 12 months + 1 Total = 13.
    # If 13: 0-11 are months, 12 is Total.
    # If 1: 0 is Total? Or 0 is Month 6?
    # Context data says "Month 06"..."Month 05", "Total".
    
    # Heuristic: Total is usually much larger than individual months.
    # But simpler: If len == 1, it's Total.
    # If len == 13, it's Full.
    
    final_data = {}
    
    if len(values) == 13:
        months = values[:12]
        total = values[12]
    elif len(values) == 1:
        months = [0]*12
        total = values[0]
    elif len(values) > 13:
        # Too many numbers. Maybe duplication?
        # Take last as total, first 12 as months
        months = values[:12]
        total = values[-1] 
    else:
        # Intermediate. Pad with 0s?
        # Assume values provided are from Month 06 onwards.
        months = values[:]
        while len(months) < 12:
            months.append(0)
        total = sum(months) # Calculate total if missing? Or 0?
        # If the last value is clearly a Sum, we should use it.
        # But for now, let's keep it simple.
    
    return {
        'uuid': entry['uuid'],
        'rank': entry.get('rank'),
        'customer_name_raw': entry.get('name'),
        'period_type': period_type,
        'total': total,
        'month_06': months[0] if len(months)>0 else 0,
        'month_07': months[1] if len(months)>1 else 0,
        'month_08': months[2] if len(months)>2 else 0,
        'month_09': months[3] if len(months)>3 else 0,
        'month_10': months[4] if len(months)>4 else 0,
        'month_11': months[5] if len(months)>5 else 0,
        'month_12': months[6] if len(months)>6 else 0,
        'month_01': months[7] if len(months)>7 else 0,
        'month_02': months[8] if len(months)>8 else 0,
        'month_03': months[9] if len(months)>9 else 0,
        'month_04': months[10] if len(months)>10 else 0,
        'month_05': months[11] if len(months)>11 else 0,
    }

def print_result(res):
    print(f"[{'OK' if res['total']>0 else 'NG'}] {res['customer_name_raw']} {res['period_type']} ¥{res['total']:,}")
    # print(f"    Months: {res['month_06']:,} ...")

def parse_csv(file_path):
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        rows = list(reader)

    current_entry = None
    all_results = []
    
    for i, row in enumerate(rows):
        if not any(row): continue
        if "得意先名" in row: continue
        if row[0].startswith("c588") and ("月日時点" in str(row) or "塗られて" in str(row)): continue

        # New Entry Detection
        is_new_entry = False
        try:
            # Rank col is index 1.
            # It's a new entry if Rank is a number.
            if row[1] and row[1].replace(',','').isdigit():
                is_new_entry = True
        except IndexError:
            pass
            
        if is_new_entry:
            if current_entry:
                parsed = parse_entry_lines(current_entry)
                all_results.extend(parsed)
            
            current_entry = {
                "uuid": row[0],
                "rank": row[1],
                "name": row[2],
                "lines": []
            }
            current_entry["lines"].append(row)
        else:
            if current_entry:
                current_entry["lines"].append(row)

    if current_entry:
        parsed = parse_entry_lines(current_entry)
        all_results.extend(parsed)

    # Verification Output
    print(f"Parsed {len(all_results)} records.")
    for r in all_results:
        print_result(r)

if __name__ == "__main__":
    parse_csv(csv_path)
