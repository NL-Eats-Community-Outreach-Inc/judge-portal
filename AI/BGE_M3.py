import os
from dotenv import load_dotenv
from supabase import create_client, Client
import numpy as np
from sentence_transformers import SentenceTransformer
from pathlib import Path

_MODEL: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _MODEL
    if _MODEL is None:
        _MODEL = SentenceTransformer("BAAI/bge-m3")
    return _MODEL

class AISubmissionScreening:

    def __init__(self):
        # Load env      
        dotenv_path = Path(__file__).resolve().parent.parent / ".env.local"
        load_dotenv(dotenv_path)

        url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not url or not key:
            raise RuntimeError("Missing Supabase env vars; check repo-root .env.local location")

        self.supabase = create_client(url, key)

        # Load embedding model
        self.model = get_model()

    # generates embedding given a chunk of text
    # Warning: Max size for text = 8192 tokens or ~6000 words.
    def getEmbedding(self, text):
        return self.model.encode(text,normalize_embeddings=True)

    #calculates and returns cosine simularity
    def cosineSim(self, v1, v2):
        return float(np.dot(v1, v2))
    
    # ai-gen start (ChatGPT-3.5, 1)
    # Tune these two constants to your observed raw similarity range.
    # Set min just below your worst expected score, max at your best.
    BGE_SCORE_MIN = 0.35
    BGE_SCORE_MAX = 0.80

    def scaleScore(self, raw_similarity: float) -> float:
        """
        Rescale BGE-M3 cosine score to [0, 1] using the model's realistic
        output range. Clamps outliers so they don't distort the result.
        """
        clamped = max(self.BGE_SCORE_MIN, min(self.BGE_SCORE_MAX, raw_similarity))
        return (clamped - self.BGE_SCORE_MIN) / (self.BGE_SCORE_MAX - self.BGE_SCORE_MIN) * 100

    def calcFinalScore(self, results: list[dict]) -> float:
        """
        Weighted average of [0,1] scores scaled to 0-100.
        Weights from DB are used as-is — no min/max normalization.
        """
        if not results:
            return 0.0
        total_weight = sum(r["weight"] for r in results)
        if total_weight == 0:
            return 0.0
        weighted_sum = sum(r["score"] * r["weight"] for r in results)
        return (weighted_sum / total_weight)
    
    def chunkText(self, text: str, chunk_size: int = 100, overlap: int = 25) -> list[str]:
        """
        Split submission into overlapping word-level chunks.
        At 300-500 words, produces ~5 paragraph-sized chunks.
        Overlap prevents relevant content from being split across chunk boundaries.
        """
        words = text.split()
        if len(words) <= chunk_size:
            return [text]  # short enough — no chunking needed
        chunks = []
        step = chunk_size - overlap
        for i in range(0, len(words), step):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk:
                chunks.append(chunk)
        return chunks

    def scoreAgainstCriterion(self, submission_text: str, criterion_embedding: np.ndarray) -> float:
        """
        Embed each chunk and return the MAX cosine similarity against the criterion.
        Max-pool: the best-matching paragraph represents actual coverage of that
        criterion. Averaging would dilute focused content with unrelated paragraphs.
        """
        chunks = self.chunkText(submission_text)
        chunk_embeddings = self.model.encode(chunks, normalize_embeddings=True)
        # shape: (n_chunks,) — one similarity score per chunk
        similarities = chunk_embeddings @ criterion_embedding
        return float(np.max(similarities))
    # ai-gen end

    #Fetch criteria from supabase Criteria table
    def fetchChallengeCriteria(self, event_id: str):

        response = self.supabase.table("criteria") \
            .select("id, name, description, min_score, max_score, weight, category") \
            .eq("event_id", event_id) \
            .order("display_order") \
            .execute()
        
        if not response.data:
            print("Warning: No criteria found")
        
        return response.data

    # score a submission, calc final score, and normalize
    def scoreSubmission(self, event_id, submission_text):
        criteria = self.fetchChallengeCriteria(event_id)
        
        results = []

        for c in criteria:
            # criterion embedding
            criterionText = f"{c['name']}: {c['description']}"
            criterionEmbedding = self.getEmbedding(criterionText)
            
            # compute similarity b/w criteria and submission
            similarity = self.scoreAgainstCriterion(submission_text, criterionEmbedding)

            # scale score and clamp outliers
            score = self.scaleScore(similarity)

            # testing
            #print(f"{c['name']}: {c['description']}")
            #print(f"Sim Score: {similarity}" )
            #print(f"Scaled Score: {score}" )  

            results.append({
            "criterion_id": c["id"],
            "score": score,
            "weight": c["weight"],
            "similarity": similarity
            })


        finalScore = self.calcFinalScore(results)
        #print(f"Final Score: {finalScore}" )

        return finalScore
