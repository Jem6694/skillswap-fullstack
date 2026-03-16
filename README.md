# SkillSwap Full-Stack MVP

A simple full-stack hackathon project for matching students who want to teach and learn skills.

## Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Flask
- Database: SQLite

## How to run
1. Open the project folder in VS Code.
2. Open the terminal in VS Code.
3. Create a virtual environment:
   - Windows: `python -m venv .venv`
   - Mac/Linux: `python3 -m venv .venv`
4. Activate it:
   - Windows PowerShell: `.venv\Scripts\Activate.ps1`
   - Windows CMD: `.venv\Scripts\activate`
   - Mac/Linux: `source .venv/bin/activate`
5. Install packages:
   - `pip install -r requirements.txt`
6. Start the app:
   - `python app.py`
7. Open your browser at:
   - `http://127.0.0.1:5000`

## Demo flow
- Click **Initialize App**
- Click **Load Demo Data**
- Create your own profile
- Click **Find Matches**
- Send a request
- Accept or decline from another user by creating/logging in as that user later if you expand auth

## Notes
- This MVP does not include authentication yet.
- Data is stored in `skillswap.db`.
