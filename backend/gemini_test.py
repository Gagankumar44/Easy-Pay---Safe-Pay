
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from google import genai

# Load the .env file from the backend folder
ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_FILE)

router = APIRouter(
    prefix="/api/gemini",
    tags=["Gemini AI"]
)


@router.post("/test")
def test_gemini_connection():

    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv(
        "GEMINI_MODEL",
        "gemini-3.5-flash-lite"
    )

    if not api_key or api_key == "PASTE_YOUR_ACTUAL_API_KEY_HERE":
        raise HTTPException(
            status_code=500,
            detail="Gemini API key is not configured."
        )

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=model,
            contents=(
                "You are testing a digital assistant "
                "for older adults in India. "
                "Reply in one short, friendly sentence "
                "saying you are ready to help."
            )
        )

        reply = response.text

        if not reply:
            raise ValueError("Empty AI response")

        return {
            "status": "connected",
            "model": model,
            "reply": reply
        }

    except Exception:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini request failed. "
                "Check your API key, model access, "
                "internet connection and API quota."
            )
        )
