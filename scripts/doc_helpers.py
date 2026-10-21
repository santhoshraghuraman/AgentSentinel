"""
Shared formatting and styling helpers for AgentSentinel dissertation generation.
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

FIG_DIR = os.path.abspath("reports/dissertation_figures")

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def format_paragraph(p, space_before=0, space_after=6, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=0):
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    p.alignment = align
    if first_line_indent > 0:
        p.paragraph_format.first_line_indent = Inches(first_line_indent)

def add_heading_1(doc, text):
    p = doc.add_paragraph(style='Heading 1')
    format_paragraph(p, space_before=18, space_after=10, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    p.text = "" # clear default text if any
    run = p.add_run(text.upper())
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0, 32, 96) # Dark Navy
    return p

def add_heading_2(doc, text):
    p = doc.add_paragraph(style='Heading 2')
    format_paragraph(p, space_before=14, space_after=6, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.LEFT)
    p.text = ""
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = RGBColor(15, 23, 42)
    return p

def add_heading_3(doc, text):
    p = doc.add_paragraph(style='Heading 3')
    format_paragraph(p, space_before=10, space_after=4, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.LEFT)
    p.text = ""
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.italic = True
    run.font.color.rgb = RGBColor(30, 41, 59)
    return p

def add_body_p(doc, text, first_line_indent=0.5):
    p = doc.add_paragraph()
    format_paragraph(p, space_before=0, space_after=6, line_spacing=1.5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=first_line_indent)
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    return p

def add_bullet_p(doc, text, bold_prefix=""):
    p = doc.add_paragraph(style='List Paragraph')
    format_paragraph(p, space_before=0, space_after=4, line_spacing=1.3, align=WD_ALIGN_PARAGRAPH.LEFT, first_line_indent=0)
    p.paragraph_format.left_indent = Inches(0.5)
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Times New Roman"
        r_pre.font.size = Pt(12)
        r_pre.font.bold = True
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    return p

def add_table_caption(doc, table_num, title):
    p = doc.add_paragraph()
    format_paragraph(p, space_before=12, space_after=4, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.LEFT)
    run_num = p.add_run(f"Table {table_num} ")
    run_num.font.name = "Times New Roman"
    run_num.font.size = Pt(10)
    run_num.font.bold = True
    run_title = p.add_run(title)
    run_title.font.name = "Times New Roman"
    run_title.font.size = Pt(10)
    run_title.font.italic = True
    return p

def add_figure(doc, img_filename, fig_num, caption_text, width_inches=5.8):
    img_path = os.path.join(FIG_DIR, img_filename)
    if not os.path.exists(img_path):
        print(f"Warning: Image {img_filename} not found at {img_path}")
        return None
    
    p_img = doc.add_paragraph()
    format_paragraph(p_img, space_before=10, space_after=4, line_spacing=1.0, align=WD_ALIGN_PARAGRAPH.CENTER)
    p_img.add_run().add_picture(img_path, width=Inches(width_inches))
    
    p_cap = doc.add_paragraph()
    format_paragraph(p_cap, space_before=2, space_after=12, line_spacing=1.15, align=WD_ALIGN_PARAGRAPH.CENTER)
    r1 = p_cap.add_run(f"Fig. {fig_num} ")
    r1.font.name = "Times New Roman"
    r1.font.size = Pt(10)
    r1.font.bold = True
    r2 = p_cap.add_run(caption_text)
    r2.font.name = "Times New Roman"
    r2.font.size = Pt(10)
    r2.font.italic = True
    return p_img

def add_equation(doc, eq_text, eq_num):
    p = doc.add_paragraph()
    format_paragraph(p, space_before=6, space_after=6, line_spacing=1.2, align=WD_ALIGN_PARAGRAPH.CENTER)
    r_eq = p.add_run(f"    {eq_text}")
    r_eq.font.name = "Times New Roman"
    r_eq.font.size = Pt(11)
    r_eq.font.italic = True
    
    # tab to right for equation number
    r_num = p.add_run(f"                  ({eq_num})")
    r_num.font.name = "Times New Roman"
    r_num.font.size = Pt(11)
    r_num.font.bold = True
    return p
