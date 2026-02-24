import pdfplumber
import csv
import re
import os
from pathlib import Path

# =============================
# 設定
# =============================
# ユーザー環境のパス（そのまま維持）
OUTPUT_DIR = r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\csv出力"

# 各期の「最終版のみ」を使用（途中月のファイルは除外）
# ※ 同じ期で複数ある場合、最も期間が長いもの（通期）だけ残す
PDF_FILES = {
    # 期名: ファイルパス
    "第75期": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第75期　2015.06-05　お客様ランキング表.pdf",
    "第76期": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第76期　2016.06-05　お客様ランキング表02 (1).pdf",
    "第77期": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第77期　2017.06-05　お客様ランキング表_順位.pdf",
    "第78期": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第78期 2018.06-05 お客様ランキング表_順位別.pdf",
    "第79期": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第79期 2020.06-05 お客様ランキング表_最終_順位別.pdf",
    "第80期": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第80期 2020.06-05 お客様ランキング表_順位別 .pdf",
    "第81期_順位": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第81期 2021.06-05 お客様ランキング表(順位).pdf",
    "第81期_担当": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第81期ランキング表(担当別).pdf",
    "第82期_順位": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第82期 2022.06-2023.05 お客様ランキング表_順位別.pdf", 
    "第82期_担当": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第82期 2022.06-12 ランキング表(担当別).pdf",
    "第83期_順位": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第83期 2023.06-2024.05 お客様ランキング表.pdf",
    "第83期_担当": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第83期 2023.06-2024.05担当別ランキング表.pdf",
    "第84期_順位": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第84期 2024.06-2025.05 お客様ランキング表.pdf",
    "第84期_担当": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\第84期 2024.06-2025.05 担当別ランキング表.pdf",
    "2005-2006": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\20051001～ 20060930　売上順位表（上位300社).pdf",
    "2006-2007": r"C:\Users\ishij\Downloads\ランキング表-20260219T030449Z-1-001\ランキング表\20061001～ 20070930　売上順位表（500社）.pdf",
}

# Supabase fiscal_periodsテーブルのIDマップ
# SELECT period_name, id FROM fiscal_periods ORDER BY start_date; の結果に基づく
PERIOD_ID_MAP = {
    # 第75期 (2015-06-01 ~ 2016-05-31)
    "第75期": "85f5223a-1d17-406d-94c6-e10708faa472",
    # 第76期 (2016-06-01 ~ 2017-05-31)
    "第76期": "e144e2ff-25b1-46da-a368-7df8959aaa4e",
    # 第77期 (2017-06-01 ~ 2018-05-31)
    "第77期": "a9c906b2-de3b-437e-ae10-dcbf7007b9a9",
    # 第78期 (2018-06-01 ~ 2019-05-31)
    "第78期": "5e6c15e5-0f32-436a-aadb-8bb67b403f67",
    # 第79期 (2019-06-01 ~ 2020-05-31)
    "第79期": "70fe82b2-9638-4c66-acb3-56a063128099",
    # 第80期 (2020-06-01 ~ 2021-05-31)
    "第80期": "23ac2561-e779-4394-aa14-23bcfd421b06",
    
    # 第81期 (2021-06-01 ~ 2022-05-31)
    "第81期_順位": "0bfc3c17-787f-4da4-b5f7-305850bb12c0",
    "第81期_担当": "0bfc3c17-787f-4da4-b5f7-305850bb12c0",
    
    # 第82期 (2022-06-01 ~ 2023-05-31)
    "第82期_順位": "514abe0a-2e7e-40ba-86b8-d5225484d5f3",
    "第82期_担当": "514abe0a-2e7e-40ba-86b8-d5225484d5f3",
    
    # 第83期 (2023-06-01 ~ 2024-05-31)
    "第83期_順位": "c588c222-2584-4d31-bffd-615a4bea7b2c",
    "第83期_担当": "c588c222-2584-4d31-bffd-615a4bea7b2c",
    
    # 第84期 (2024-06-01 ~ 2025-05-31)
    "第84期_順位": "ea6a6e35-2c65-4ca0-8dfc-4196959a2984",
    "第84期_担当": "ea6a6e35-2c65-4ca0-8dfc-4196959a2984",

    # 注意: 2005-2006, 2006-2007はDBに存在しないため、UUIDは割り当てられません。
}


# =============================
# PDF → 行データ抽出
# =============================
def extract_rows(pdf_path):
    rows = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        for row in table:
                            if row and any(cell for cell in row if cell):
                                rows.append([str(c).strip() if c else "" for c in row])
                else:
                    text = page.extract_text()
                    if text:
                        for line in text.splitlines():
                            line = line.strip()
                            if line:
                                rows.append([line])
    except Exception as e:
        print(f"  ⚠️  {Path(pdf_path).name}: {e}")
    return rows

# =============================
# 重複行の除去
# =============================
def deduplicate_rows(rows):
    seen = set()
    result = []
    for row in rows:
        key = tuple(row)
        if key not in seen:
            seen.add(key)
            result.append(row)
    return result

# =============================
# 1ファイル処理
# =============================
def process_one(label, pdf_path, output_dir):
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        print(f"  ❌ 見つかりません: {pdf_path.name}")
        return []

    print(f"  📄 [{label}] {pdf_path.name}")
    rows = extract_rows(str(pdf_path))
    rows = deduplicate_rows(rows)
    
    # ----------------------------------------------------
    # UUIDの付与 (Supabaseインポート用)
    # ----------------------------------------------------
    period_id = PERIOD_ID_MAP.get(label)
    
    # Supabaseインポート用のクリーンなデータを作成
    # 1列目にfiscal_period_idを追加
    import_ready_rows = []
    
    if rows:
        # ヘッダー行の判定（簡易的）
        # もし1行目に「順位」「No」「Rank」などの言葉が含まれていればヘッダーとみなす
        header_keywords = ["順位", "No", "Rank", "得意先名", "氏名", "担当"]
        first_row = rows[0]
        is_header = any(keyword in str(cell) for cell in first_row for keyword in header_keywords)
        
        for i, row in enumerate(rows):
            if i == 0 and is_header:
                # ヘッダー行には識別子を入れる
                new_row = ["fiscal_period_id"] + row
            else:
                # データ行にはUUIDを入れる（なければ空文字）
                new_row = [period_id if period_id else ""] + row
            import_ready_rows.append(new_row)
    else:
        import_ready_rows = []

    # 1. 元のリクエスト通りのCSV出力 (メタデータ付き)
    out_path = Path(output_dir) / f"{label}.csv"
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["# 期・区分", label, "元ファイル", pdf_path.name, "FiscalPeriodID", period_id])
        writer.writerow([])
        writer.writerows(rows)

    # 2. Supabaseインポート用CSV出力 (クリーン、UUID付き)
    # カラム名が一致しないとインポートできない可能性があるため、ヘッダーも重要
    # サブディレクトリに保存
    import_dir = Path(output_dir) / "supabase_import"
    os.makedirs(import_dir, exist_ok=True)
    import_path = import_dir / f"{label}_import.csv"
    
    with open(import_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(import_ready_rows)

    print(f"     → ✅ {len(rows)} 行")
    print(f"        出力1: {out_path.name}")
    print(f"        出力2: {import_path.name} (Supabase用)")
    
    return rows

# =============================
# 統合CSV作成
# =============================
def create_combined(all_data, output_dir):
    out_path = Path(output_dir) / "【統合・重複除去済み】全期間ランキング.csv"
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["期・区分", "内容"])
        for label, rows in all_data.items():
            writer.writerow([])
            writer.writerow([f"=== {label} ==="])
            writer.writerows(rows)
    print(f"\n📊 統合CSV: {out_path.name}")

# =============================
# メイン
# =============================
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"📁 出力先: {OUTPUT_DIR}")
    print(f"✅ 処理対象: {len(PDF_FILES)} 件\n{'='*50}\n")

    all_data = {}
    for label, path in PDF_FILES.items():
        rows = process_one(label, path, OUTPUT_DIR)
        if rows:
            all_data[label] = rows

    create_combined(all_data, OUTPUT_DIR)
    print(f"\n{'='*50}")
    print(f"✅ 完了！")
    print(f"ℹ️  Supabaseへのインポートには 'csv出力/supabase_import' フォルダ内のCSVを使用してください。")
    print(f"ℹ️  '2005-2006'などはDBに登録されていないため、UUID列は空になっています。")

if __name__ == "__main__":
    main()
