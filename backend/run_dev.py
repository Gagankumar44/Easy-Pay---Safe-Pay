"""Development server: test/probe files must not interrupt spoken replies."""
from pathlib import Path
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app",host="127.0.0.1",port=8001,reload=True,
                reload_dirs=[str(Path(__file__).resolve().parent)],
                reload_excludes=["data/*","test_*.py"])
