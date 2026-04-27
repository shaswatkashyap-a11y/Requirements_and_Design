# scripts/test_classifier.py
from app.services.sectionClassifier import SectionClassifier

c = SectionClassifier()

titles = [
    "**STATEMENT OF WORK**",
    "**Key Activities**",
    "**Implementation Timeline**",
    "**Out of Scope:**",
    "1.2 CUSTOMER ASSUMPTIONS:",
    "1.6 PROGRAM STRUCTURE:",
    "1.7 COMMUNICATION PLAN:",
    "SECTION 3. COMPENSATION.",
]

print("=== after (dirty titles) ===")
for t in titles:
    st, conf = c.classify(t)
    print(f"  {t:<40} -> {st:<25} ({conf})")