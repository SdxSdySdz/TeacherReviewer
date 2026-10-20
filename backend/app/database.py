import sqlite3
import os
from pathlib import Path

DB_PATH = os.environ.get("DATABASE_PATH", str(Path(__file__).parent.parent / "teacher_reviewer.db"))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
        class_id INTEGER NULL REFERENCES classes(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        date TEXT NOT NULL,          -- YYYY-MM-DD
        start_time TEXT NOT NULL,    -- HH:MM
        end_time TEXT NOT NULL,      -- HH:MM
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score_clarity INTEGER NOT NULL CHECK(score_clarity >= 0 AND score_clarity <= 10),
        score_engagement INTEGER NOT NULL CHECK(score_engagement >= 0 AND score_engagement <= 10),
        score_atmosphere INTEGER NOT NULL CHECK(score_atmosphere >= 0 AND score_atmosphere <= 10),
        comment TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(lesson_id, student_id)
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lessons_class ON lessons(class_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ratings_lesson ON ratings(lesson_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ratings_student ON ratings(student_id);")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)
