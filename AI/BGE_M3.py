"""
Title: FR-4 - Submission Pre-screening using BGE-M3 AI
 Author: Jacob Armstrong
 date: 3/18/26
 Description: Class for AI scoring module that generates semantic embeddings for participant submissions
 and compares them against challenge criteria using the BGE-M3 model.

 
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
import numpy as np
from sentence_transformers import SentenceTransformer

class AISubmissionScreening:

    def __init__(self):
        # Load env      
        # switch out for appropriate .env file longterm
        dotenv_path = os.path.join(os.path.dirname(__file__), ".env.local")
        load_dotenv(dotenv_path)

        self.supabase: Client = create_client(
            os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Load embedding model
        self.model = SentenceTransformer("BAAI/bge-m3")

    # generates embedding given a chunk of text
    # Warning: Max size for text = 8192 tokens or ~6000 words.
    def getEmbedding(self, text):
        return self.model.encode(text,normalize_embeddings=True)

    #calculates and returns cosine simularity
    def cosineSim(self, v1, v2):
        return float(np.dot(v1, v2))
    
    # sca
    def scaleScore(self, score, min_score, max_score):
    
        if min_score == max_score:
            return 0 # avoid dividing by 0

        convertedScore = (score + 1) / 2  # [-1,1] -> [0,1]
        return min_score + convertedScore * (max_score - min_score)
    
   

    # calculates final score from criteria scores + their weights
    def calcFinalScore(self, results):         
        weighted_sum = sum(r["score"] * r["weight"] for r in results)

        min_possible = sum(r["min_score"] * r["weight"] for r in results)
        max_possible = sum(r["max_score"] * r["weight"] for r in results)

        if max_possible == min_possible:
            return 0

        #normalize
        return ((weighted_sum - min_possible) / (max_possible - min_possible)) * 100

    
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

        # generate embedding for submission text
        submissionEmbedding = self.get_embedding(submission_text)

        for c in criteria:
            # criterion embedding
            criterionText = f"{c['name']}: {c['description']}"
            criterionEmbedding = self.get_embedding(criterionText)
            
           

            # compute similarity b/w criteria and submission
            similarity = self.cosineSim(submissionEmbedding, criterionEmbedding)

            

            # scale to min/max score
            score = self.scaleScore(
                similarity,
                c["min_score"],
                c["max_score"]
            )

            # testing
            print(f"{c['name']}: {c['description']}")
            print(f"Sim Score: {similarity}" )
            print(f"Scaled Score: {score}" )  

            results.append({
            "criterion_id": c["id"],
            "score": score,
            "weight": c["weight"],
            "min_score": c["min_score"],
            "max_score": c["max_score"],
            "similarity": similarity
            })


        finalScore = self.calcFinalScore(results)
        print(f"Final Score: {finalScore}" )

        return finalScore