import os
import sys
from datetime import datetime

try:
    from .database import get_db, init_db
except (ImportError, ValueError):
    from database import get_db, init_db

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Clear all test ratings, lessons, students, and classes
    cursor.execute("DELETE FROM ratings")
    cursor.execute("DELETE FROM lessons")
    cursor.execute("DELETE FROM users WHERE username != 'maxim'")
    cursor.execute("DELETE FROM classes")

    # Ensure single admin/teacher: maxim / 314159
    cursor.execute("SELECT id FROM users WHERE username = 'maxim'")
    teacher = cursor.fetchone()
    now_str = datetime.now().isoformat()
    if not teacher:
        cursor.execute("""
            INSERT INTO users (username, password, name, role, class_id, created_at)
            VALUES ('maxim', '314159', 'Максим Сергеевич', 'teacher', NULL, ?)
        """, (now_str,))
    else:
        cursor.execute("UPDATE users SET password = '314159', role = 'teacher', class_id = NULL WHERE username = 'maxim'")

    conn.commit()
    conn.close()
    print("Database cleaned. Only teacher 'maxim' remains.")

if __name__ == "__main__":
    seed_database()
