#!/usr/bin/env python3
from pathlib import Path
from textwrap import wrap

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "first-phone-kit.pdf"
LOGO = ROOT / "assets" / "sanctify-logo-nav.png"

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 54
CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

INK = colors.HexColor("#17201f")
INK_SOFT = colors.HexColor("#4d5956")
MUTED = colors.HexColor("#6a7471")
BRAND = colors.HexColor("#2f9f95")
BRAND_DARK = colors.HexColor("#126c66")
BRAND_SOFT = colors.HexColor("#dff1ec")
CORAL = colors.HexColor("#e46c62")
GOLD = colors.HexColor("#ba8d32")
LINE = colors.HexColor("#d8e5e1")
PAPER = colors.HexColor("#fbfcfb")


def text_width(text, font="Helvetica", size=10):
    return canvas.Canvas(None).stringWidth(text, font, size)


def split_lines(text, font="Helvetica", size=10, max_width=CONTENT_WIDTH):
    words = text.split()
    lines = []
    current = []
    for word in words:
        candidate = " ".join(current + [word])
        if text_width(candidate, font, size) <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


class KitPdf:
    def __init__(self):
        self.c = canvas.Canvas(str(OUTPUT), pagesize=letter)
        self.page = 1
        self.logo = ImageReader(str(LOGO))

    def save(self):
        self.c.save()
        reader = PdfReader(str(OUTPUT))
        if len(reader.pages) < 4:
            raise RuntimeError("First-Phone Kit PDF rendered fewer pages than expected")

    def new_page(self):
        self.footer()
        self.c.showPage()
        self.page += 1
        self.header()

    def header(self):
        self.c.setFillColor(PAPER)
        self.c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
        self.c.drawImage(self.logo, MARGIN, PAGE_HEIGHT - 62, width=92, height=39, preserveAspectRatio=True, mask="auto")
        self.c.setStrokeColor(LINE)
        self.c.setLineWidth(0.7)
        self.c.line(MARGIN, PAGE_HEIGHT - 76, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 76)

    def footer(self):
        self.c.setStrokeColor(LINE)
        self.c.setLineWidth(0.7)
        self.c.line(MARGIN, 42, PAGE_WIDTH - MARGIN, 42)
        self.c.setFont("Helvetica", 8)
        self.c.setFillColor(MUTED)
        self.c.drawString(MARGIN, 28, "Sanctify First-Phone Kit")
        self.c.drawRightString(PAGE_WIDTH - MARGIN, 28, f"Page {self.page}")

    def paragraph(self, text, x, y, width=CONTENT_WIDTH, size=10.5, leading=15, font="Helvetica", color=INK_SOFT):
        self.c.setFont(font, size)
        self.c.setFillColor(color)
        for line in split_lines(text, font, size, width):
            self.c.drawString(x, y, line)
            y -= leading
        return y

    def heading(self, text, x, y, size=28, width=CONTENT_WIDTH):
        self.c.setFont("Helvetica-Bold", size)
        self.c.setFillColor(INK)
        lines = split_lines(text, "Helvetica-Bold", size, width)
        for line in lines:
            self.c.drawString(x, y, line)
            y -= size + 4
        return y

    def kicker(self, text, x, y):
        self.c.setFillColor(GOLD)
        self.c.setFont("Helvetica-Bold", 9)
        self.c.drawString(x, y, text.upper())
        return y - 18

    def rounded_box(self, x, y, w, h, fill, stroke=LINE):
        self.c.setFillColor(fill)
        self.c.setStrokeColor(stroke)
        self.c.setLineWidth(0.8)
        self.c.roundRect(x, y, w, h, 8, stroke=1, fill=1)

    def checkbox_item(self, text, x, y, width=CONTENT_WIDTH):
        self.rounded_box(x, y - 34, width, 36, colors.white)
        self.c.setStrokeColor(BRAND_DARK)
        self.c.setLineWidth(1.1)
        self.c.rect(x + 12, y - 22, 11, 11, stroke=1, fill=0)
        self.paragraph(text, x + 34, y - 12, width - 48, size=9.5, leading=12, font="Helvetica-Bold", color=INK)
        return y - 46

    def card(self, title, body, x, y, w, h, label=None):
        self.rounded_box(x, y - h, w, h, colors.white)
        current_y = y - 22
        if label:
            self.c.setFont("Helvetica-Bold", 8)
            self.c.setFillColor(BRAND_DARK)
            self.c.drawString(x + 18, current_y, label.upper())
            current_y -= 20
        self.c.setFont("Helvetica-Bold", 13)
        self.c.setFillColor(INK)
        self.c.drawString(x + 18, current_y, title)
        current_y -= 20
        self.paragraph(body, x + 18, current_y, w - 36, size=9.3, leading=13, color=INK_SOFT)

    def cover(self):
        self.c.setFillColor(PAPER)
        self.c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
        self.c.drawImage(self.logo, MARGIN, PAGE_HEIGHT - 86, width=124, height=52, preserveAspectRatio=True, mask="auto")
        self.rounded_box(MARGIN, 120, CONTENT_WIDTH, 520, colors.white)
        y = 590
        y = self.kicker("Sanctify parent resource", MARGIN + 34, y)
        y -= 18
        y = self.heading("First-Phone Kit", MARGIN + 34, y, size=42, width=CONTENT_WIDTH - 68)
        y -= 10
        y = self.paragraph(
            "A calmer way to hand a child their first connected device.",
            MARGIN + 34,
            y,
            CONTENT_WIDTH - 68,
            size=16,
            leading=22,
            font="Helvetica-Bold",
            color=BRAND_DARK,
        )
        y -= 20
        y = self.paragraph(
            "Use this before the phone leaves your hand. The goal is not fear. The goal is a shared standard, honest conversation, and a protection plan your child understands.",
            MARGIN + 34,
            y,
            CONTENT_WIDTH - 68,
            size=11.5,
            leading=17,
        )
        y -= 22
        col_w = (CONTENT_WIDTH - 92) / 3
        self.card("Agree", "Name the family standard before the device creates its own.", MARGIN + 34, y, col_w, 126, "Step 1")
        self.card("Covenant", "Make the rules simple enough for a child to repeat.", MARGIN + 46 + col_w, y, col_w, 126, "Step 2")
        self.card("Protect", "Turn the agreement into background protection across devices.", MARGIN + 58 + (col_w * 2), y, col_w, 126, "Step 3")
        y -= 170
        self.c.setFillColor(BRAND_DARK)
        self.c.roundRect(MARGIN + 34, y - 44, 190, 44, 8, stroke=0, fill=1)
        self.c.setFillColor(colors.white)
        self.c.setFont("Helvetica-Bold", 12)
        self.c.drawString(MARGIN + 52, y - 28, "sanctify.faith")
        self.footer()
        self.c.showPage()
        self.page += 1
        self.header()

    def checklist_page(self):
        y = PAGE_HEIGHT - 112
        y = self.kicker("Step 1", MARGIN, y)
        y = self.heading("Parent pre-flight checklist", MARGIN, y, size=29)
        y -= 4
        y = self.paragraph("Before the device is handed over, make the boundary concrete.", MARGIN, y, size=11.5, leading=17)
        y -= 18
        items = [
            "We agreed where the phone sleeps at night.",
            "We agreed which apps need approval before install.",
            "We agreed what happens when a site or app is blocked.",
            "We agreed who the child can ask for help when tempted or confused.",
            "We agreed that parents can review device settings without it becoming a fight.",
            "We installed protection before the first unsupervised use.",
            "We chose a faith standard that matches how our household actually lives.",
            "We scheduled a one-week check-in instead of waiting for a crisis.",
        ]
        for item in items:
            y = self.checkbox_item(item, MARGIN, y)
        self.new_page()

    def covenant_page(self):
        y = PAGE_HEIGHT - 112
        y = self.kicker("Step 2", MARGIN, y)
        y = self.heading("First-phone family covenant", MARGIN, y, size=29)
        y -= 8
        statements = [
            "I will bring confusing, tempting, or frightening content to my parent instead of hiding it.",
            "I will not use private browsing, alternate accounts, or another device to work around our family rules.",
            "I understand that protection is here to guard peace, trust, and formation, not to embarrass me.",
            "When I make a mistake, I can tell the truth and receive help.",
        ]
        for statement in statements:
            self.rounded_box(MARGIN, y - 58, CONTENT_WIDTH, 58, BRAND_SOFT)
            self.c.setFillColor(BRAND_DARK)
            self.c.rect(MARGIN, y - 58, 5, 58, stroke=0, fill=1)
            self.paragraph(statement, MARGIN + 22, y - 23, CONTENT_WIDTH - 44, size=11, leading=15, font="Helvetica-Bold", color=INK)
            y -= 74
        y -= 12
        self.c.setFont("Helvetica-Bold", 13)
        self.c.setFillColor(INK)
        self.c.drawString(MARGIN, y, "Signatures")
        y -= 40
        for label in ["Parent signature", "Child signature", "Date"]:
            self.c.setStrokeColor(colors.HexColor("#8fa19c"))
            self.c.setLineWidth(1.1)
            self.c.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
            self.c.setFont("Helvetica-Bold", 9)
            self.c.setFillColor(MUTED)
            self.c.drawString(MARGIN, y - 16, label)
            y -= 72
        self.new_page()

    def conversation_page(self):
        y = PAGE_HEIGHT - 112
        y = self.kicker("Step 3", MARGIN, y)
        y = self.heading("Conversation script", MARGIN, y, size=29)
        y -= 4
        y = self.paragraph("Keep the first talk short enough that your child can remember it.", MARGIN, y, size=11.5, leading=17)
        y -= 24
        col_gap = 14
        col_w = (CONTENT_WIDTH - (col_gap * 2)) / 3
        self.card("Open with trust", "This phone is a privilege because we trust you, and it also brings doors into places we do not want shaping your heart.", MARGIN, y, col_w, 170, "Say this")
        self.card("Name the standard", "Our family follows a faith standard. That means some things are not for us, even when other families allow them.", MARGIN + col_w + col_gap, y, col_w, 170, "Say this")
        self.card("Make mistakes survivable", "If something slips through, tell us. You will not be punished for asking for help when you need it.", MARGIN + (col_w + col_gap) * 2, y, col_w, 170, "Say this")
        y -= 218
        y = self.kicker("Step 4", MARGIN, y)
        y = self.heading("Early warning signs", MARGIN, y, size=26)
        y -= 8
        warnings = [
            "The device suddenly becomes private, hidden, or emotionally charged.",
            "The child becomes defensive about settings, app installs, or browser history.",
            "Sleep changes after late-night use.",
            "Faith practices, schoolwork, or family time start losing ground to the screen.",
            "A blocked moment becomes shame instead of a chance to ask for help.",
        ]
        for warning in warnings:
            self.c.setFillColor(CORAL)
            self.c.circle(MARGIN + 5, y - 4, 3, stroke=0, fill=1)
            y = self.paragraph(warning, MARGIN + 18, y, CONTENT_WIDTH - 18, size=10.5, leading=15, font="Helvetica-Bold", color=INK)
            y -= 8
        self.new_page()

    def implementation_page(self):
        y = PAGE_HEIGHT - 112
        y = self.kicker("Bring the standard into the device", MARGIN, y)
        y = self.heading("Sanctify turns the covenant into protection that runs in the background.", MARGIN, y, size=27)
        y -= 8
        y = self.paragraph(
            "Choose the faith profile, connect the household devices, and give blocked moments a calm path back toward peace.",
            MARGIN,
            y,
            size=12,
            leading=18,
        )
        y -= 26
        self.rounded_box(MARGIN, y - 172, CONTENT_WIDTH, 172, colors.white)
        steps = [
            ("1", "Choose the faith profile", "Start with the standard your household already follows."),
            ("2", "Connect household devices", "Protect phones, tablets, laptops, smart TVs, and home Wi-Fi."),
            ("3", "Review after one week", "Ask what felt clear, what felt hard, and what needs to change."),
        ]
        step_y = y - 30
        for number, title, body in steps:
            self.c.setFillColor(BRAND)
            self.c.circle(MARGIN + 28, step_y - 4, 12, stroke=0, fill=1)
            self.c.setFillColor(colors.white)
            self.c.setFont("Helvetica-Bold", 10)
            self.c.drawCentredString(MARGIN + 28, step_y - 8, number)
            self.c.setFillColor(INK)
            self.c.setFont("Helvetica-Bold", 12)
            self.c.drawString(MARGIN + 54, step_y + 2, title)
            self.paragraph(body, MARGIN + 54, step_y - 14, CONTENT_WIDTH - 82, size=9.5, leading=12)
            step_y -= 48
        y -= 220
        self.c.setFillColor(BRAND_DARK)
        self.c.roundRect(MARGIN, y - 58, 230, 58, 8, stroke=0, fill=1)
        self.c.setFillColor(colors.white)
        self.c.setFont("Helvetica-Bold", 14)
        self.c.drawString(MARGIN + 20, y - 24, "Start the 7-day trial")
        self.c.setFont("Helvetica", 10)
        self.c.drawString(MARGIN + 20, y - 41, "app.sanctify.faith/signup")
        self.c.linkURL("https://app.sanctify.faith/signup", (MARGIN, y - 58, MARGIN + 230, y), relative=0)
        self.c.setFillColor(INK_SOFT)
        self.c.setFont("Helvetica", 10)
        self.c.drawString(MARGIN, y - 88, "Keep this kit nearby and revisit it after the first week.")
        self.footer()


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = KitPdf()
    pdf.cover()
    pdf.checklist_page()
    pdf.covenant_page()
    pdf.conversation_page()
    pdf.implementation_page()
    pdf.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
