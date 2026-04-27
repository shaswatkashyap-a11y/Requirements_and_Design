import re
import logging
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# SOW categories with example phrases the classifier learns from

SOW_CATEGORIES = {
    "executive_summary": [
    "executive summary", "overview", "project overview",
    "introduction", "background", "purpose of this document",
    "statement of work", "sow overview", "project summary",
    "key activities", "project description",
    ],
    "scope": [
        "scope of work", "project scope", "scope and objectives",
        "in scope", "out of scope", "scope exclusions", "boundaries",
    ],
    "objectives": [
        "objectives", "goals", "project goals", "business objectives",
        "desired outcomes", "success criteria", "expected results",
    ],
    "requirements": [
        "requirements", "functional requirements",
        "non-functional requirements", "technical requirements",
        "business requirements", "specifications", "user stories",
    ],
    "deliverables": [
        "deliverables", "project deliverables", "key deliverables",
        "outputs", "work products", "what will be delivered",
    ],
    "timeline": [
        "timeline", "schedule", "milestones", "project plan",
        "phases", "delivery schedule", "key dates", "sprint plan",
    ],
    "technical_approach": [
        "technical approach", "architecture", "technology stack",
        "solution design", "proposed solution", "methodology",
    ],
    "roles_responsibilities": [
        "roles and responsibilities", "team structure",
        "project team", "resource allocation", "stakeholders",
    ],
    "assumptions_constraints": [
        "assumptions", "constraints", "dependencies",
        "risks", "risk factors", "limitations",
    ],
    "acceptance_criteria": [
        "acceptance criteria", "definition of done",
        "quality criteria", "sign off criteria",
    ],
    "budget_pricing": [
        "budget", "pricing", "cost estimate", "payment terms",
        "compensation", "billing", "cost breakdown",
    ],
    "terms_conditions": [
        "terms and conditions", "legal terms", "contract terms",
        "intellectual property", "confidentiality", "warranty",
    ],
    "change_management": [
        "change management", "change control",
        "change request process", "scope changes",
    ],
    "communication": [
        "communication plan", "reporting", "status reporting",
        "meetings", "escalation", "governance",
    ],
    "appendix": [
        "appendix", "annexure", "attachments",
        "glossary", "definitions", "abbreviations",
    ],
}

CONFIDENCE_THRESHOLD=0.30

class SectionClassifier:
    """Classifies parsed sections into SOW categories using
    sentence-transformer embeddings. Runs on CPU, ~80MB model."""

    def __init__(self) -> None:
        logger.info("Loading embedding model (one-time, ~80MB)...")
        self.model=SentenceTransformer("all-MiniLM-L6-v2")

        self.category_names=list(SOW_CATEGORIES.keys())
        self.category_vectors=np.array([
            np.mean(self.model.encode(phrases),axis=0)
            for phrases in SOW_CATEGORIES.values() 
            ])
        logger.info("Embedding model ready.")

    def classify(self, title:str, content:str=""):
        """Classify a Single Section
            Returns (section type , Confidence Score)
        """

        # strip markdown noise before embedding
        clean_title = re.sub(r"[*_#`]", "", title).strip()
        clean_title = re.sub(r"[:.]+$", "", clean_title).strip()

        
        #Checking simillarity with only title 
        title_vec = self.model.encode([clean_title])[0]
        sims=self._cosine_sim(title_vec,self.category_vectors)
        best_idx=int(np.argmax(sims))
        best_score=float(sims[best_idx])

        if best_score >= CONFIDENCE_THRESHOLD:
            return self.category_names[best_idx], round(best_score,3)

        #fallback : title and first 300 characters of content
        #Only 300 characters because more text actually hurts — the embedding gets diluted by irrelevant details and the similarity score drops.

        if content:
            combined = f"{clean_title}. {content[:300]}"
            combined_vec=self.model.encode([combined])[0]
            sims2=self._cosine_sim(combined_vec,self.category_vectors)
            best_idx2=int(np.argmax(sims2))
            best_score2=float(sims2[best_idx2])

            if best_score2>=CONFIDENCE_THRESHOLD:
                return self.category_names[best_idx2],round(best_score2,3)

            best_score=max(best_score,best_score2)

        return "unknown", round(best_score,3)
    
    def classify_batch(self, sections:list[dict]):
        """
        Classify a list of sections in one pass.
        Each dict must have 'title' and optionally 'content'.
        Returns the same dicts with 'section_type' and 'confidence' added.
        """
        for section in sections:
            section_type,confidence=self.classify(section["title"],section["content"])
            section["section_type"]=section_type
            section["confidence"]= confidence

            logger.info(
                f"  '{section['title']}' -> {section_type} ({confidence})"
            )

        return sections

    @staticmethod
    def _cosine_sim(vec:np.ndarray,matrix:np.ndarray):
        dot=np.dot(matrix,vec)
        magnitudes=np.linalg.norm(matrix,axis=1) * np.linalg.norm(vec)
        return dot/(magnitudes + 1e-8)