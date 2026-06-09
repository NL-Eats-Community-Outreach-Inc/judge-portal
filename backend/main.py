from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from AI.BGE_M3 import score_submission, get_supabase

supabase = get_supabase()

app = FastAPI()

class SubmissionRequest(BaseModel):
    submission_id: str
    event_id: str
    org_id: str
    content: str

@app.post("/score")
def score(req: SubmissionRequest):
    try:
        submission_response = supabase.table("submissions") \
            .select("id, event_id") \
            .eq("id", req.submission_id) \
            .limit(1) \
            .execute()

        if not submission_response.data:
            raise HTTPException(status_code=404, detail="Submission not found")

        submission_event_id = submission_response.data[0]["event_id"]

        if submission_event_id != req.event_id:
            raise HTTPException(
                status_code=400,
                detail="Request event_id does not match submission event_id"
            )

        if not req.content.strip():
            score = 0.0
        else:
            score = round(score_submission(submission_event_id, req.org_id, req.content), 2)

        supabase.table("submission_ai_scores") \
            .upsert({
                "submission_id": req.submission_id,
                "event_id": submission_event_id,
                "score": score
            }, on_conflict="submission_id") \
            .execute()
        
        return {
            "success": True,
            "score": score
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
