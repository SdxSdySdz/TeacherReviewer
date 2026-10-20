import os
import sys
from pathlib import Path
from datetime import date, datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

try:
    from .database import get_db, init_db
    from .auth import create_token, get_current_user, require_teacher, require_student
    from .models import (
        LoginRequest, LoginResponse, UserResponse,
        ClassCreate, ClassResponse,
        StudentCreate, StudentResponse,
        LessonCreate, LessonResponse,
        RatingCreate, RatingResponse
    )
    from .seed import seed_database
except (ImportError, ValueError):
    from database import get_db, init_db
    from auth import create_token, get_current_user, require_teacher, require_student
    from models import (
        LoginRequest, LoginResponse, UserResponse,
        ClassCreate, ClassResponse,
        StudentCreate, StudentResponse,
        LessonCreate, LessonResponse,
        RatingCreate, RatingResponse
    )
    from seed import seed_database

app = FastAPI(
    title="Teacher Reviewer Platform",
    description="Система оценивания уроков учителя учениками",
    version="1.0.0"
)

# Enable CORS for cross-origin frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to ensure DB is initialized and seeded
@app.on_event("startup")
def on_startup():
    init_db()
    seed_database()

# Helper for current time and date in Moscow/Russian timezone context
def get_now():
    return datetime.now()

RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
RU_WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]

def format_date_ru(d: date) -> str:
    weekday = RU_WEEKDAYS[d.weekday()]
    month = RU_MONTHS[d.month - 1]
    return f"{weekday}, {d.day} {month} {d.year} г."

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.password, u.name, u.role, u.class_id, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.username = ?
    """, (req.username.strip(),))
    row = cursor.fetchone()
    conn.close()

    if not row or row["password"] != req.password.strip():
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    user_dict = {
        "id": row["id"],
        "username": row["username"],
        "name": row["name"],
        "role": row["role"],
        "class_id": row["class_id"],
        "class_name": row["class_name"]
    }
    token = create_token(user_id=row["id"], role=row["role"], username=row["username"])
    return {"token": token, "user": user_dict}

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(user: dict = Depends(get_current_user)):
    return user

@app.get("/api/auth/demo-accounts")
def get_demo_accounts():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.password, u.name, u.role, u.class_id, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        ORDER BY u.role DESC, u.id ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- TEACHER ENDPOINTS ---

@app.get("/api/teacher/classes", response_model=List[ClassResponse])
def get_classes(user: dict = Depends(require_teacher)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            c.id, c.name, c.description, c.created_at,
            COUNT(DISTINCT u.id) as student_count,
            COUNT(DISTINCT l.id) as lesson_count,
            ROUND(AVG((r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0), 2) as average_rating
        FROM classes c
        LEFT JOIN users u ON u.class_id = c.id AND u.role = 'student'
        LEFT JOIN lessons l ON l.class_id = c.id
        LEFT JOIN ratings r ON r.lesson_id = l.id
        GROUP BY c.id
        ORDER BY c.id ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/teacher/classes", response_model=ClassResponse)
def create_class(data: ClassCreate, user: dict = Depends(require_teacher)):
    conn = get_db()
    cursor = conn.cursor()
    now_str = get_now().isoformat()
    cursor.execute(
        "INSERT INTO classes (name, description, created_at) VALUES (?, ?, ?)",
        (data.name.strip(), data.description.strip(), now_str)
    )
    cid = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        "id": cid,
        "name": data.name.strip(),
        "description": data.description.strip(),
        "created_at": now_str,
        "student_count": 0,
        "lesson_count": 0,
        "average_rating": None
    }

@app.get("/api/teacher/students", response_model=List[StudentResponse])
def get_students(user: dict = Depends(require_teacher)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            u.id, u.username, u.name, u.role, u.class_id, c.name as class_name, u.created_at,
            COUNT(r.id) as ratings_count
        FROM users u
        JOIN classes c ON u.class_id = c.id
        LEFT JOIN ratings r ON r.student_id = u.id
        WHERE u.role = 'student'
        GROUP BY u.id
        ORDER BY c.name ASC, u.name ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/teacher/students", response_model=StudentResponse)
def create_student(data: StudentCreate, user: dict = Depends(require_teacher)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if class exists
    cursor.execute("SELECT name FROM classes WHERE id = ?", (data.class_id,))
    class_row = cursor.fetchone()
    if not class_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Выбранный класс не существует")
    
    # Check if username is taken
    cursor.execute("SELECT id FROM users WHERE username = ?", (data.username.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    now_str = get_now().isoformat()
    cursor.execute("""
        INSERT INTO users (username, password, name, role, class_id, created_at)
        VALUES (?, ?, ?, 'student', ?, ?)
    """, (data.username.strip(), data.password.strip(), data.name.strip(), data.class_id, now_str))
    uid = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "id": uid,
        "username": data.username.strip(),
        "name": data.name.strip(),
        "role": "student",
        "class_id": data.class_id,
        "class_name": class_row["name"],
        "created_at": now_str,
        "ratings_count": 0
    }

@app.get("/api/teacher/lessons", response_model=List[LessonResponse])
def get_lessons(class_id: Optional[int] = None, user: dict = Depends(require_teacher)):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT 
            l.id, l.class_id, c.name as class_name, l.title, l.date, l.start_time, l.end_time,
            l.description, l.created_at,
            COUNT(r.id) as ratings_count,
            ROUND(AVG((r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0), 2) as average_score
        FROM lessons l
        JOIN classes c ON l.class_id = c.id
        LEFT JOIN ratings r ON r.lesson_id = l.id
    """
    params = []
    if class_id:
        query += " WHERE l.class_id = ?"
        params.append(class_id)
    query += " GROUP BY l.id ORDER BY l.date DESC, l.start_time DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/teacher/lessons", response_model=LessonResponse)
def create_lesson(data: LessonCreate, user: dict = Depends(require_teacher)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM classes WHERE id = ?", (data.class_id,))
    class_row = cursor.fetchone()
    if not class_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Класс не найден")

    now_str = get_now().isoformat()
    cursor.execute("""
        INSERT INTO lessons (class_id, title, date, start_time, end_time, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (data.class_id, data.title.strip(), data.date, data.start_time, data.end_time, data.description.strip(), now_str))
    lid = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "id": lid,
        "class_id": data.class_id,
        "class_name": class_row["name"],
        "title": data.title.strip(),
        "date": data.date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "description": data.description.strip(),
        "created_at": now_str,
        "ratings_count": 0,
        "average_score": None,
        "has_rated": False,
        "can_rate": False
    }

@app.get("/api/teacher/stats")
def get_teacher_stats(user: dict = Depends(require_teacher)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM classes")
    total_classes = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")
    total_students = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM lessons")
    total_lessons = cursor.fetchone()[0]

    cursor.execute("""
        SELECT 
            COUNT(r.id) as total_ratings,
            ROUND(AVG(r.score_clarity), 2) as avg_clarity,
            ROUND(AVG(r.score_engagement), 2) as avg_engagement,
            ROUND(AVG(r.score_atmosphere), 2) as avg_atmosphere,
            ROUND(AVG((r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0), 2) as avg_overall
        FROM ratings r
    """)
    stats_row = dict(cursor.fetchone())
    conn.close()

    return {
        "total_classes": total_classes,
        "total_students": total_students,
        "total_lessons": total_lessons,
        "total_ratings": stats_row["total_ratings"] or 0,
        "avg_clarity": stats_row["avg_clarity"] or 0.0,
        "avg_engagement": stats_row["avg_engagement"] or 0.0,
        "avg_atmosphere": stats_row["avg_atmosphere"] or 0.0,
        "avg_overall": stats_row["avg_overall"] or 0.0
    }

# --- STUDENT ENDPOINTS ---

@app.get("/api/student/dashboard")
def get_student_dashboard(user: dict = Depends(require_student)):
    today_dt = get_now()
    today_str = today_dt.strftime("%Y-%m-%d")
    current_time_str = today_dt.strftime("%H:%M")
    
    conn = get_db()
    cursor = conn.cursor()

    class_id = user["class_id"]
    cursor.execute("SELECT id, name FROM classes WHERE id = ?", (class_id,))
    class_info = dict(cursor.fetchone() or {"id": class_id, "name": "Неизвестный класс"})

    # Look for lessons scheduled for today for this student's class
    cursor.execute("""
        SELECT id, class_id, title, date, start_time, end_time, description, created_at
        FROM lessons
        WHERE class_id = ? AND date = ?
        ORDER BY start_time ASC
    """, (class_id, today_str))
    today_lessons = [dict(r) for r in cursor.fetchall()]

    has_lesson_today = len(today_lessons) > 0
    today_lesson = today_lessons[0] if has_lesson_today else None

    status = "no_lesson"
    can_rate = False
    rate_reason = None
    existing_rating = None

    if not has_lesson_today:
        status = "no_lesson"
        can_rate = False
        rate_reason = "На сегодня занятий нет. Оценка недоступна."
    else:
        # Check if student has already rated this lesson
        cursor.execute("""
            SELECT id, score_clarity, score_engagement, score_atmosphere, comment, created_at
            FROM ratings
            WHERE lesson_id = ? AND student_id = ?
        """, (today_lesson["id"], user["id"]))
        rating_row = cursor.fetchone()

        if rating_row:
            status = "already_rated"
            can_rate = False
            rate_reason = "Вы уже оценили этот урок. Менять оценку нельзя."
            existing_rating = dict(rating_row)
            existing_rating["average_score"] = round(
                (existing_rating["score_clarity"] + existing_rating["score_engagement"] + existing_rating["score_atmosphere"]) / 3.0, 1
            )
        else:
            # Check time: "нельзя ставить оценки до занятия"
            # If current_time < lesson.start_time, rating is forbidden!
            if current_time_str < today_lesson["start_time"]:
                status = "before_lesson"
                can_rate = False
                rate_reason = f"Нельзя ставить оценку до занятия. Урок начнется в {today_lesson['start_time']}."
            else:
                status = "can_rate"
                can_rate = True
                rate_reason = "Урок начался. Вы можете оценить занятие."

    # Fetch recent past lessons for this class to give context
    cursor.execute("""
        SELECT l.id, l.title, l.date, l.start_time, l.end_time,
               r.score_clarity, r.score_engagement, r.score_atmosphere, r.created_at as rated_at
        FROM lessons l
        LEFT JOIN ratings r ON r.lesson_id = l.id AND r.student_id = ?
        WHERE l.class_id = ? AND l.date <= ?
        ORDER BY l.date DESC, l.start_time DESC
        LIMIT 10
    """, (user["id"], class_id, today_str))
    recent_lessons = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "today_date": today_str,
        "today_formatted": format_date_ru(today_dt.date()),
        "current_time": current_time_str,
        "student": {
            "id": user["id"],
            "name": user["name"],
            "username": user["username"],
            "class_id": class_id,
            "class_name": class_info["name"]
        },
        "has_lesson_today": has_lesson_today,
        "today_lesson": today_lesson,
        "status": status,
        "can_rate": can_rate,
        "rate_reason": rate_reason,
        "existing_rating": existing_rating,
        "recent_lessons": recent_lessons
    }

@app.post("/api/student/rate", response_model=RatingResponse)
def submit_rating(data: RatingCreate, user: dict = Depends(require_student)):
    today_dt = get_now()
    today_str = today_dt.strftime("%Y-%m-%d")
    current_time_str = today_dt.strftime("%H:%M")

    conn = get_db()
    cursor = conn.cursor()

    # 1. Fetch lesson
    cursor.execute("""
        SELECT l.id, l.class_id, l.title, l.date, l.start_time, l.end_time, c.name as class_name
        FROM lessons l
        JOIN classes c ON l.class_id = c.id
        WHERE l.id = ?
    """, (data.lesson_id,))
    lesson = cursor.fetchone()

    if not lesson:
        conn.close()
        raise HTTPException(status_code=404, detail="Занятие не найдено")

    # 2. Check that lesson belongs to student's class
    if lesson["class_id"] != user["class_id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Вы можете оценивать уроки только своего класса")

    # 3. Check time constraint: "нельзя ставить оценки до занятия"
    if lesson["date"] > today_str:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя ставить оценку до занятия. Урок запланирован на будущую дату ({lesson['date']})."
        )
    
    if lesson["date"] == today_str and current_time_str < lesson["start_time"]:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя ставить оценку до занятия. Урок начнется сегодня в {lesson['start_time']}."
        )

    # 4. Check immutability: "нельзя менять оценку"
    cursor.execute("SELECT id FROM ratings WHERE lesson_id = ? AND student_id = ?", (data.lesson_id, user["id"]))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Вы уже оценили этот урок. Изменение оценки строго запрещено."
        )

    # 5. Insert rating
    now_str = get_now().isoformat()
    cursor.execute("""
        INSERT INTO ratings (lesson_id, student_id, score_clarity, score_engagement, score_atmosphere, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        data.lesson_id,
        user["id"],
        data.score_clarity,
        data.score_engagement,
        data.score_atmosphere,
        data.comment.strip() if data.comment else "",
        now_str
    ))
    rid = cursor.lastrowid
    conn.commit()
    conn.close()

    avg_score = round((data.score_clarity + data.score_engagement + data.score_atmosphere) / 3.0, 1)

    return {
        "id": rid,
        "lesson_id": data.lesson_id,
        "lesson_title": lesson["title"],
        "lesson_date": lesson["date"],
        "class_id": lesson["class_id"],
        "class_name": lesson["class_name"],
        "student_id": user["id"],
        "student_name": user["name"],
        "score_clarity": data.score_clarity,
        "score_engagement": data.score_engagement,
        "score_atmosphere": data.score_atmosphere,
        "average_score": avg_score,
        "comment": data.comment.strip() if data.comment else "",
        "created_at": now_str
    }

# --- CALENDAR & RATINGS TABLE ENDPOINT ---
# "на главной странице есть иконка календаря где можно увидеть таблицу с остальными учениками и оценки других учеников. в разные дни"

@app.get("/api/calendar/ratings")
def get_calendar_ratings(
    date_filter: Optional[str] = Query(None, alias="date"),
    class_filter: Optional[int] = Query(None, alias="class_id"),
    user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    # Get distinct dates with lessons and ratings count
    cursor.execute("""
        SELECT l.date, COUNT(DISTINCT l.id) as lessons_count, COUNT(r.id) as ratings_count
        FROM lessons l
        LEFT JOIN ratings r ON r.lesson_id = l.id
        GROUP BY l.date
        ORDER BY l.date DESC
    """)
    dates_with_activity = [dict(r) for r in cursor.fetchall()]

    query = """
        SELECT 
            r.id, r.lesson_id, l.title as lesson_title, l.date as lesson_date,
            l.start_time, l.end_time,
            c.id as class_id, c.name as class_name,
            u.id as student_id, u.name as student_name,
            r.score_clarity, r.score_engagement, r.score_atmosphere,
            ROUND((r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0, 1) as average_score,
            r.comment, r.created_at
        FROM ratings r
        JOIN lessons l ON r.lesson_id = l.id
        JOIN classes c ON l.class_id = c.id
        JOIN users u ON r.student_id = u.id
    """
    conditions = []
    params = []

    if date_filter and date_filter.lower() != "all":
        conditions.append("l.date = ?")
        params.append(date_filter)

    if class_filter:
        conditions.append("c.id = ?")
        params.append(class_filter)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY l.date DESC, r.created_at DESC"

    cursor.execute(query, params)
    ratings = [dict(r) for r in cursor.fetchall()]

    # Calculate summary metrics for the selected view
    total_ratings = len(ratings)
    avg_clarity = round(sum(r["score_clarity"] for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0.0
    avg_engagement = round(sum(r["score_engagement"] for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0.0
    avg_atmosphere = round(sum(r["score_atmosphere"] for r in ratings) / total_ratings, 2) if total_ratings > 0 else 0.0
    overall_avg = round((avg_clarity + avg_engagement + avg_atmosphere) / 3.0, 2) if total_ratings > 0 else 0.0

    conn.close()

    return {
        "dates_with_activity": dates_with_activity,
        "selected_date": date_filter or "all",
        "total_ratings": total_ratings,
        "summary": {
            "avg_clarity": avg_clarity,
            "avg_engagement": avg_engagement,
            "avg_atmosphere": avg_atmosphere,
            "overall_avg": overall_avg
        },
        "ratings": ratings
    }

# Mount static files to serve the complete Single Page Application
frontend_dir = os.environ.get("FRONTEND_DIR", str(Path(__file__).resolve().parent.parent.parent / "frontend"))

if os.path.exists(frontend_dir):
    # Mount frontend directory at root so /index.html, /style.css, /app.js work directly
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
else:
    @app.get("/")
    def serve_index():
        return {"message": "Teacher Reviewer API running. Frontend folder not found."}
