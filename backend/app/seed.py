import os
import sys
from datetime import date, datetime, timedelta

try:
    from .database import get_db, init_db
except (ImportError, ValueError):
    from database import get_db, init_db

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # 1. Admin/Teacher: maxim / 314159
    cursor.execute("SELECT id FROM users WHERE username = 'maxim'")
    teacher = cursor.fetchone()
    if not teacher:
        now_str = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO users (username, password, name, role, class_id, created_at)
            VALUES (?, ?, ?, 'teacher', NULL, ?)
        """, ('maxim', '314159', 'Максим Сергеевич', now_str))
        teacher_id = cursor.lastrowid
    else:
        cursor.execute("UPDATE users SET password = '314159' WHERE username = 'maxim'")
        teacher_id = teacher[0]

    # 2. Classes
    classes_data = [
        ("10-А класс (Физмат)", "Углубленное изучение физики и математики"),
        ("11-Б класс (Информатика)", "Подготовка к профильному экзамену и олимпиадам"),
        ("Курс Python & Алгоритмы", "Программирование для начинающих разработчиков")
    ]
    
    class_ids = {}
    for name, desc in classes_data:
        cursor.execute("SELECT id FROM classes WHERE name = ?", (name,))
        row = cursor.fetchone()
        if not row:
            cursor.execute("INSERT INTO classes (name, description, created_at) VALUES (?, ?, ?)",
                           (name, desc, datetime.now().isoformat()))
            class_ids[name] = cursor.lastrowid
        else:
            class_ids[name] = row[0]

    # 3. Students
    c10a = class_ids["10-А класс (Физмат)"]
    c11b = class_ids["11-Б класс (Информатика)"]
    c_py = class_ids["Курс Python & Алгоритмы"]

    students_data = [
        ('ivan_ivanov', 'pass101', 'Иван Иванов', c10a),
        ('anna_smirnova', 'pass102', 'Анна Смирнова', c10a),
        ('dmitry_kuznetsov', 'pass103', 'Дмитрий Кузнецов', c11b),
        ('elena_popova', 'pass104', 'Елена Попова', c11b),
        ('alex_morozov', 'pass105', 'Алексей Морозов', c_py),
    ]

    student_ids = {}
    for uname, pword, name, cid in students_data:
        cursor.execute("SELECT id FROM users WHERE username = ?", (uname,))
        row = cursor.fetchone()
        if not row:
            cursor.execute("""
                INSERT INTO users (username, password, name, role, class_id, created_at)
                VALUES (?, ?, ?, 'student', ?, ?)
            """, (uname, pword, name, cid, datetime.now().isoformat()))
            student_ids[uname] = cursor.lastrowid
        else:
            cursor.execute("UPDATE users SET class_id = ?, password = ? WHERE id = ?", (cid, pword, row[0]))
            student_ids[uname] = row[0]

    # 4. Lessons with dynamic times
    now = datetime.now()
    today = now.date()
    d_today = today.strftime("%Y-%m-%d")
    d_yesterday = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    d_prev2 = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    d_prev4 = (today - timedelta(days=4)).strftime("%Y-%m-%d")
    d_tomorrow = (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # Time offsets:
    # Started 2 hours ago:
    past_start = (now - timedelta(hours=2)).strftime("%H:%M")
    past_end = (now - timedelta(hours=1)).strftime("%H:%M")
    
    # Starts in 2 hours (or late evening):
    future_hour = (now.hour + 2) % 24
    if future_hour < now.hour: # Wrapped around midnight, make it 23:59
        future_start = "23:55"
        future_end = "23:59"
    else:
        future_start = (now + timedelta(hours=2)).strftime("%H:%M")
        future_end = (now + timedelta(hours=3, minutes=30)).strftime("%H:%M")

    # Clean existing lessons for clean demo runs if requested or update them
    cursor.execute("DELETE FROM ratings")
    cursor.execute("DELETE FROM lessons")

    lessons_data = [
        # Class 10-A:
        # Lesson today already started -> Ready to be rated!
        (c10a, "Квантовая механика и строение атома", d_today, past_start, past_end, "Постулаты Бора, фотоэффект и корпускулярно-волновой дуализм."),
        # Lesson yesterday
        (c10a, "Законы термодинамики и КПД двигателей", d_yesterday, "10:00", "11:30", "Первое и второе начала термодинамики, цикл Карно."),
        # Lesson 2 days ago
        (c10a, "Электромагнитные колебания и резонанс", d_prev2, "10:00", "11:30", "Колебательный контур, формула Томсона."),

        # Class 11-B:
        # Lesson today in the FUTURE -> Cannot rate before lesson! ("нельзя ставить оценки до занятия")
        (c11b, "ЕГЭ: Динамическое программирование и деревья отрезков", d_today, future_start, future_end, "Разбор сложных олимпиадных задач."),
        # Lesson yesterday
        (c11b, "Рекурсия и графовые алгоритмы (DFS/BFS)", d_yesterday, "14:00", "15:30", "Поиск в глубину и ширину на практике."),

        # Class Python:
        # NO LESSON TODAY! Gray disabled design!
        (c_py, "Основы ООП: Классы, наследование и полиморфизм", d_prev4, "16:00", "17:30", "Создание собственных классов."),
        (c_py, "Асинхронное программирование на AsyncIO", d_tomorrow, "16:00", "17:30", "Корутины и event loop.")
    ]

    created_lessons = {}
    for cid, title, ldate, start, end, desc in lessons_data:
        cursor.execute("""
            INSERT INTO lessons (class_id, title, date, start_time, end_time, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (cid, title, ldate, start, end, desc, datetime.now().isoformat()))
        created_lessons[(cid, title, ldate)] = cursor.lastrowid

    # 5. Pre-fill ratings for calendar review
    # Anna Smirnova rated today's morning lesson (so Ivan sees Anna's rating in calendar, but Ivan has not rated yet)
    lesson_today_10a = created_lessons.get((c10a, "Квантовая механика и строение атома", d_today))
    if lesson_today_10a and 'anna_smirnova' in student_ids:
        cursor.execute("""
            INSERT INTO ratings (lesson_id, student_id, score_clarity, score_engagement, score_atmosphere, comment, created_at)
            VALUES (?, ?, 10, 10, 9, 'Отличный урок! Опыты с фотоэффектом потрясающие!', ?)
        """, (lesson_today_10a, student_ids['anna_smirnova'], f"{d_today}T{past_end}:00"))

    # Yesterday's lesson 10-A rated by both Ivan and Anna
    lesson_yest_10a = created_lessons.get((c10a, "Законы термодинамики и КПД двигателей", d_yesterday))
    if lesson_yest_10a:
        for uname, clarity, eng, atm, comm in [
            ('ivan_ivanov', 9, 10, 9, 'Очень наглядный разбор цикла Карно'),
            ('anna_smirnova', 10, 9, 10, 'Все понятно с первого раза')
        ]:
            if uname in student_ids:
                cursor.execute("""
                    INSERT INTO ratings (lesson_id, student_id, score_clarity, score_engagement, score_atmosphere, comment, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (lesson_yest_10a, student_ids[uname], clarity, eng, atm, comm, f"{d_yesterday}T12:00:00"))

    # Lesson 2 days ago rated
    lesson_prev2_10a = created_lessons.get((c10a, "Электромагнитные колебания и резонанс", d_prev2))
    if lesson_prev2_10a and 'ivan_ivanov' in student_ids:
        cursor.execute("""
            INSERT INTO ratings (lesson_id, student_id, score_clarity, score_engagement, score_atmosphere, comment, created_at)
            VALUES (?, ?, 8, 9, 10, 'Интересные аналогии с качелями для резонанса', ?)
        """, (lesson_prev2_10a, student_ids['ivan_ivanov'], f"{d_prev2}T12:00:00"))

    # Yesterday's lesson 11-B rated by Elena Popova
    lesson_yest_11b = created_lessons.get((c11b, "Рекурсия и графовые алгоритмы (DFS/BFS)", d_yesterday))
    if lesson_yest_11b and 'elena_popova' in student_ids:
        cursor.execute("""
            INSERT INTO ratings (lesson_id, student_id, score_clarity, score_engagement, score_atmosphere, comment, created_at)
            VALUES (?, ?, 10, 10, 10, 'Идеальное объяснение алгоритмов обхода графов', ?)
        """, (lesson_yest_11b, student_ids['elena_popova'], f"{d_yesterday}T16:00:00"))

    conn.commit()
    conn.close()
    print("Database re-seeded successfully with dynamic past and future times!")

if __name__ == "__main__":
    seed_database()
