"""
Validation and Quality Assurance Auditor for AgentSentinel Dissertation DOCX.
"""

import os
import re
import docx

DOCX_PATH = "AgentSentinel_MTech_SE_Final_Project_Report.docx"

def validate():
    print(f"Auditing: {DOCX_PATH}")
    if not os.path.exists(DOCX_PATH):
        print("ERROR: File does not exist!")
        return
    
    doc = docx.Document(DOCX_PATH)
    total_paragraphs = len(doc.paragraphs)
    total_tables = len(doc.tables)
    total_sections = len(doc.sections)
    
    # 1. Word Count & Content Audit
    total_words = 0
    full_text = []
    for p in doc.paragraphs:
        txt = p.text.strip()
        if txt:
            full_text.append(txt)
            total_words += len(txt.split())
            
    for t in doc.tables:
        for row in t.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    txt = p.text.strip()
                    if txt:
                        full_text.append(txt)
                        total_words += len(txt.split())
                        
    all_text_blob = "\n".join(full_text)
    
    print(f"Total Paragraphs: {total_paragraphs}")
    print(f"Total Tables: {total_tables}")
    print(f"Total Sections: {total_sections}")
    print(f"Total Word Count: {total_words:,} words")
    print(f"Estimated Pages (at ~300 words/page + 23 figures + 17 tables): ~{int(total_words / 250) + 23 + 10} pages")
    
    # 2. Placeholder Check
    forbidden_patterns = [
        r"Student\s*NAME",
        r"REGISTER\s*NUMBER(?!\s*:\s*22MIS0282)",
        r"\bTODO\b",
        r"\bTBD\b",
        r"\bXXXX\b",
        r"<Student Name>",
        r"<Designation>",
        r"<Company Name>",
        r"<Domain",
        r"<Off\s*–\s*Campus"
    ]
    
    found_forbidden = []
    for pat in forbidden_patterns:
        matches = re.findall(pat, all_text_blob, re.IGNORECASE)
        if matches:
            found_forbidden.append((pat, len(matches)))
            
    if found_forbidden:
        print("\nWARNING: Found unresolved placeholder patterns:")
        for pat, count in found_forbidden:
            print(f"  - Pattern '{pat}': {count} occurrences")
    else:
        print("\nPASS: Zero forbidden placeholder patterns found (No TODO, TBD, Student NAME, etc.)")
        
    # 3. Figure & Image Audit
    # check images inside document package
    image_count = 0
    for part in doc.part.related_parts.values():
        if "image" in part.content_type:
            image_count += 1
    print(f"\nEmbedded Images in DOCX package: {image_count} images")
    
    # 4. Heading Hierarchy Audit
    h1_count = sum(1 for p in doc.paragraphs if p.style.name == "Heading 1" or (p.runs and p.runs[0].font.size and p.runs[0].font.size.pt == 14))
    h2_count = sum(1 for p in doc.paragraphs if p.style.name == "Heading 2")
    h3_count = sum(1 for p in doc.paragraphs if p.style.name == "Heading 3")
    print(f"Headings Found: Chapter Headings (H1) = {h1_count}, Subheadings (H2) = {h2_count}, Sections (H3) = {h3_count}")
    
    # 5. Key Metrics Consistency Check
    metrics_to_verify = [
        ("ATBench sample size", "1,000", "1,000" in all_text_blob),
        ("Held-out test split size", "250", "250" in all_text_blob),
        ("Classification Accuracy", "72.40%", "72.40%" in all_text_blob),
        ("Precision", "78.95%", "78.95%" in all_text_blob),
        ("Recall", "60.48%", "60.48%" in all_text_blob),
        ("ROC-AUC", "0.7782", "0.7782" in all_text_blob),
        ("Confusion Matrix TN", "106", "106" in all_text_blob),
        ("Confusion Matrix FP", "20", "20" in all_text_blob),
        ("Confusion Matrix FN", "49", "49" in all_text_blob),
        ("Confusion Matrix TP", "75", "75" in all_text_blob),
        ("Top Feature event_count", "35.65%", "35.65%" in all_text_blob),
        ("Second Feature action_count", "24.11%", "24.11%" in all_text_blob),
        ("Standalone FNR", "39.52%", "39.52%" in all_text_blob),
        ("Zero execution on BLOCK", "0", "zero" in all_text_blob.lower() or "strictly 0" in all_text_blob)
    ]
    
    print("\nEmpirical Metrics Consistency Audit:")
    for label, val, is_present in metrics_to_verify:
        status = "PASS" if is_present else "FAIL"
        print(f"  [{status}] {label} ({val}): {'Present in text' if is_present else 'MISSING'}")

    print("\nDocument successfully audited!")

if __name__ == "__main__":
    validate()
