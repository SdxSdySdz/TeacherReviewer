/**
 * Teacher Reviewer Platform
 * Core Application Engine
 */

const API_BASE = window.location.origin.includes('http') ? '' : '';

// Initial Fallback / Seed Data for Standalone / GitHub Pages demo mode
const DEFAULT_INITIAL_STATE = {
  classes: [
    { id: 1, name: "10-А класс (Физмат)", description: "Углубленное изучение физики и математики", created_at: "2026-10-01" },
    { id: 2, name: "11-Б класс (Информатика)", description: "Подготовка к профильному экзамену и олимпиадам", created_at: "2026-10-01" },
    { id: 3, name: "Курс Python & Алгоритмы", description: "Программирование для начинающих разработчиков", created_at: "2026-10-01" }
  ],
  users: [
    { id: 1, username: "maxim", password: "314159", name: "Максим Сергеевич", role: "teacher", class_id: null },
    { id: 2, username: "ivan_ivanov", password: "pass101", name: "Иван Иванов", role: "student", class_id: 1 },
    { id: 3, username: "anna_smirnova", password: "pass102", name: "Анна Смирнова", role: "student", class_id: 1 },
    { id: 4, username: "dmitry_kuznetsov", password: "pass103", name: "Дмитрий Кузнецов", role: "student", class_id: 2 },
    { id: 5, username: "elena_popova", password: "pass104", name: "Елена Попова", role: "student", class_id: 2 },
    { id: 6, username: "alex_morozov", password: "pass105", name: "Алексей Морозов", role: "student", class_id: 3 }
  ],
  // Lessons with dynamic dates (relative to current client date)
  getLessons: function(todayStr, yesterdayStr, prev2Str, prev4Str, tomorrowStr, pastStart, pastEnd, futureStart, futureEnd) {
    return [
      { id: 1, class_id: 1, title: "Квантовая механика и строение атома", date: todayStr, start_time: pastStart, end_time: pastEnd, description: "Постулаты Бора, фотоэффект и корпускулярно-волновой дуализм.", created_at: todayStr },
      { id: 2, class_id: 1, title: "Законы термодинамики и КПД двигателей", date: yesterdayStr, start_time: "10:00", end_time: "11:30", description: "Первое и второе начала термодинамики, цикл Карно.", created_at: yesterdayStr },
      { id: 3, class_id: 1, title: "Электромагнитные колебания и резонанс", date: prev2Str, start_time: "10:00", end_time: "11:30", description: "Колебательный контур, формула Томсона.", created_at: prev2Str },
      { id: 4, class_id: 2, title: "ЕГЭ: Динамическое программирование и деревья отрезков", date: todayStr, start_time: futureStart, end_time: futureEnd, description: "Разбор олимпиадных задач на ДП.", created_at: todayStr },
      { id: 5, class_id: 2, title: "Рекурсия и графовые алгоритмы (DFS/BFS)", date: yesterdayStr, start_time: "14:00", end_time: "15:30", description: "Поиск в глубину и ширину на графах.", created_at: yesterdayStr },
      { id: 6, class_id: 3, title: "Основы ООП: Классы, наследование и полиморфизм", date: prev4Str, start_time: "16:00", end_time: "17:30", description: "Создание собственных классов в Python.", created_at: prev4Str },
      { id: 7, class_id: 3, title: "Асинхронное программирование на AsyncIO", date: tomorrowStr, start_time: "16:00", end_time: "17:30", description: "Event loop, корутины и задачи.", created_at: todayStr }
    ];
  },
  getRatings: function(todayStr, yesterdayStr, prev2Str) {
    return [
      { id: 1, lesson_id: 1, student_id: 3, score_clarity: 10, score_engagement: 10, score_atmosphere: 9, comment: "Отличный урок! Опыты с фотоэффектом потрясающие!", created_at: `${todayStr}T10:15:00` },
      { id: 2, lesson_id: 2, student_id: 2, score_clarity: 9, score_engagement: 10, score_atmosphere: 9, comment: "Очень наглядный разбор цикла Карно", created_at: `${yesterdayStr}T12:00:00` },
      { id: 3, lesson_id: 2, student_id: 3, score_clarity: 10, score_engagement: 9, score_atmosphere: 10, comment: "Все понятно с первого раза", created_at: `${yesterdayStr}T12:05:00` },
      { id: 4, lesson_id: 3, student_id: 2, score_clarity: 8, score_engagement: 9, score_atmosphere: 10, comment: "Интересные аналогии с качелями для резонанса", created_at: `${prev2Str}T12:00:00` },
      { id: 5, lesson_id: 5, student_id: 5, score_clarity: 10, score_engagement: 10, score_atmosphere: 10, comment: "Идеальное объяснение алгоритмов обхода графов", created_at: `${yesterdayStr}T16:00:00` }
    ];
  }
};

class TeacherReviewerApp {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('tr_token') || null;
    this.cachedUser = JSON.parse(localStorage.getItem('tr_user') || 'null');
    
    // Dates
    const now = new Date();
    this.todayStr = this.formatDateYMD(now);
    this.yesterdayStr = this.formatDateYMD(new Date(now.getTime() - 86400000));
    this.prev2Str = this.formatDateYMD(new Date(now.getTime() - 2 * 86400000));
    this.prev4Str = this.formatDateYMD(new Date(now.getTime() - 4 * 86400000));
    this.tomorrowStr = this.formatDateYMD(new Date(now.getTime() + 86400000));
    this.currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.activeTeacherTab = 'lessons';
    this.calendarDateFilter = 'all';
    this.calendarClassFilter = '';
    this.calendarSearchQuery = '';

    // Initialize standalone storage if needed
    this.initStandaloneStore();
  }

  formatDateYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDateRussian(dateObj) {
    const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    const weekdays = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    return `${weekdays[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()} г.`;
  }

  initStandaloneStore() {
    if (!localStorage.getItem('tr_classes')) {
      localStorage.setItem('tr_classes', JSON.stringify(DEFAULT_INITIAL_STATE.classes));
    }
    if (!localStorage.getItem('tr_users')) {
      localStorage.setItem('tr_users', JSON.stringify(DEFAULT_INITIAL_STATE.users));
    }
    if (!localStorage.getItem('tr_lessons')) {
      const now = new Date();
      const pastH = Math.max(0, now.getHours() - 2);
      const pastStart = `${String(pastH).padStart(2, '0')}:00`;
      const pastEnd = `${String(pastH + 1).padStart(2, '0')}:30`;
      const futureH = (now.getHours() + 2) % 24;
      const futureStart = futureH < now.getHours() ? "23:55" : `${String(futureH).padStart(2, '0')}:00`;
      const futureEnd = futureH < now.getHours() ? "23:59" : `${String(futureH + 1).padStart(2, '0')}:30`;
      const lessons = DEFAULT_INITIAL_STATE.getLessons(this.todayStr, this.yesterdayStr, this.prev2Str, this.prev4Str, this.tomorrowStr, pastStart, pastEnd, futureStart, futureEnd);
      localStorage.setItem('tr_lessons', JSON.stringify(lessons));
    }
    if (!localStorage.getItem('tr_ratings')) {
      const ratings = DEFAULT_INITIAL_STATE.getRatings(this.todayStr, this.yesterdayStr, this.prev2Str);
      localStorage.setItem('tr_ratings', JSON.stringify(ratings));
    }
  }

  async init() {
    // Update Header Today Date
    const todayFormatted = this.formatDateRussian(new Date());
    const headerToday = document.getElementById('headerTodayText');
    if (headerToday) {
      headerToday.textContent = `Сегодня: ${todayFormatted}`;
    }

    // Set default date in lesson creation modal
    const dateInput = document.getElementById('newLessonDate');
    if (dateInput) {
      dateInput.value = this.todayStr;
    }

    // Check if we have an active session
    if (this.token && this.cachedUser) {
      this.currentUser = this.cachedUser;
      try {
        // Try verifying with API
        const me = await this.apiCall('/api/auth/me');
        if (me && me.id) {
          this.currentUser = me;
          localStorage.setItem('tr_user', JSON.stringify(me));
        }
      } catch (err) {
        console.warn('API /me check failed, relying on local session:', err);
      }
    }

    this.renderHeaderNav();
    await this.renderMainView();

    // Re-initialize Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // --- API HELPER WITH LOCAL FALLBACK ---
  async apiCall(endpoint, options = {}) {
    options.headers = options.headers || {};
    if (this.token) {
      options.headers['Authorization'] = `Bearer ${this.token}`;
    }
    options.headers['Content-Type'] = 'application/json';

    try {
      const resp = await fetch(endpoint, options);
      if (resp.ok) {
        return await resp.json();
      }
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.detail || `Ошибка сервера: ${resp.status}`);
    } catch (e) {
      // If server unreachable or error, use standalone local engine for seamless demo
      console.warn(`Falling back to local data store for ${endpoint}:`, e.message);
      return this.handleLocalRequest(endpoint, options);
    }
  }

  // Standalone storage router for complete resilience
  handleLocalRequest(endpoint, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};

    const users = JSON.parse(localStorage.getItem('tr_users') || '[]');
    const classes = JSON.parse(localStorage.getItem('tr_classes') || '[]');
    const lessons = JSON.parse(localStorage.getItem('tr_lessons') || '[]');
    const ratings = JSON.parse(localStorage.getItem('tr_ratings') || '[]');

    if (endpoint === '/api/auth/login' && method === 'POST') {
      const user = users.find(u => u.username === body.username && u.password === body.password);
      if (!user) throw new Error("Неверный логин или пароль");
      const c = classes.find(cl => cl.id === user.class_id);
      const userObj = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        class_id: user.class_id,
        class_name: c ? c.name : null
      };
      return { token: `local_token_${user.id}`, user: userObj };
    }

    if (endpoint === '/api/auth/me') {
      if (!this.currentUser) throw new Error("Требуется авторизация");
      return this.currentUser;
    }

    if (endpoint === '/api/auth/demo-accounts') {
      return users.map(u => {
        const c = classes.find(cl => cl.id === u.class_id);
        return { ...u, class_name: c ? c.name : null };
      });
    }

    // Student Dashboard
    if (endpoint === '/api/student/dashboard') {
      if (!this.currentUser) throw new Error("Не авторизован");
      const classId = this.currentUser.class_id;
      const c = classes.find(cl => cl.id === classId) || { id: classId, name: "Класс" };
      
      const todayLessons = lessons.filter(l => l.class_id === classId && l.date === this.todayStr);
      const hasLessonToday = todayLessons.length > 0;
      const todayLesson = hasLessonToday ? todayLessons[0] : null;

      let status = "no_lesson";
      let canRate = false;
      let rateReason = null;
      let existingRating = null;

      if (!hasLessonToday) {
        status = "no_lesson";
        canRate = false;
        rateReason = "На сегодня занятий нет. Оценка недоступна.";
      } else {
        const existing = ratings.find(r => r.lesson_id === todayLesson.id && r.student_id === this.currentUser.id);
        if (existing) {
          status = "already_rated";
          canRate = false;
          rateReason = "Вы уже оценили этот урок. Менять оценку нельзя.";
          existingRating = {
            ...existing,
            average_score: Math.round(((existing.score_clarity + existing.score_engagement + existing.score_atmosphere) / 3.0) * 10) / 10
          };
        } else {
          // Rule: cannot rate before lesson starts!
          if (this.currentTimeStr < todayLesson.start_time) {
            status = "before_lesson";
            canRate = false;
            rateReason = `Нельзя ставить оценку до занятия. Урок начнется в ${todayLesson.start_time}.`;
          } else {
            status = "can_rate";
            canRate = true;
            rateReason = "Урок начался. Вы можете оценить занятие.";
          }
        }
      }

      const recentLessons = lessons
        .filter(l => l.class_id === classId && l.date <= this.todayStr)
        .map(l => {
          const r = ratings.find(rt => rt.lesson_id === l.id && rt.student_id === this.currentUser.id);
          return {
            id: l.id,
            title: l.title,
            date: l.date,
            start_time: l.start_time,
            end_time: l.end_time,
            score_clarity: r ? r.score_clarity : null,
            score_engagement: r ? r.score_engagement : null,
            score_atmosphere: r ? r.score_atmosphere : null,
            rated_at: r ? r.created_at : null
          };
        });

      return {
        today_date: this.todayStr,
        today_formatted: this.formatDateRussian(new Date()),
        current_time: this.currentTimeStr,
        student: this.currentUser,
        has_lesson_today: hasLessonToday,
        today_lesson: todayLesson,
        status: status,
        can_rate: canRate,
        rate_reason: rateReason,
        existing_rating: existingRating,
        recent_lessons: recentLessons
      };
    }

    // Student Rate
    if (endpoint === '/api/student/rate' && method === 'POST') {
      const lesson = lessons.find(l => l.id === body.lesson_id);
      if (!lesson) throw new Error("Занятие не найдено");
      if (lesson.class_id !== this.currentUser.class_id) {
        throw new Error("Вы можете оценивать уроки только своего класса");
      }
      if (lesson.date > this.todayStr) {
        throw new Error("Нельзя ставить оценку до занятия. Урок запланирован на будущую дату.");
      }
      if (lesson.date === this.todayStr && this.currentTimeStr < lesson.start_time) {
        throw new Error(`Нельзя ставить оценку до занятия. Урок начнется сегодня в ${lesson.start_time}.`);
      }
      const existing = ratings.find(r => r.lesson_id === body.lesson_id && r.student_id === this.currentUser.id);
      if (existing) {
        throw new Error("Вы уже оценили этот урок. Менять оценку нельзя!");
      }

      const newRating = {
        id: ratings.length + 1,
        lesson_id: body.lesson_id,
        student_id: this.currentUser.id,
        score_clarity: parseInt(body.score_clarity),
        score_engagement: parseInt(body.score_engagement),
        score_atmosphere: parseInt(body.score_atmosphere),
        comment: body.comment || "",
        created_at: new Date().toISOString()
      };
      ratings.push(newRating);
      localStorage.setItem('tr_ratings', JSON.stringify(ratings));

      const c = classes.find(cl => cl.id === lesson.class_id);
      return {
        ...newRating,
        lesson_title: lesson.title,
        lesson_date: lesson.date,
        class_id: lesson.class_id,
        class_name: c ? c.name : "",
        student_name: this.currentUser.name,
        average_score: Math.round(((newRating.score_clarity + newRating.score_engagement + newRating.score_atmosphere) / 3.0) * 10) / 10
      };
    }

    // Calendar ratings
    if (endpoint.startsWith('/api/calendar/ratings')) {
      const url = new URL('http://local' + endpoint);
      const dateFilter = url.searchParams.get('date');
      const classFilter = url.searchParams.get('class_id');

      let list = ratings.map(r => {
        const l = lessons.find(ls => ls.id === r.lesson_id) || {};
        const c = classes.find(cl => cl.id === l.class_id) || {};
        const u = users.find(us => us.id === r.student_id) || {};
        return {
          id: r.id,
          lesson_id: r.lesson_id,
          lesson_title: l.title || "Занятие",
          lesson_date: l.date || "",
          start_time: l.start_time || "",
          end_time: l.end_time || "",
          class_id: c.id,
          class_name: c.name || "",
          student_id: u.id,
          student_name: u.name || "Ученик",
          score_clarity: r.score_clarity,
          score_engagement: r.score_engagement,
          score_atmosphere: r.score_atmosphere,
          average_score: Math.round(((r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0) * 10) / 10,
          comment: r.comment || "",
          created_at: r.created_at
        };
      });

      if (dateFilter && dateFilter !== 'all') {
        list = list.filter(r => r.lesson_date === dateFilter);
      }
      if (classFilter) {
        list = list.filter(r => String(r.class_id) === String(classFilter));
      }

      list.sort((a, b) => b.lesson_date.localeCompare(a.lesson_date) || b.created_at.localeCompare(a.created_at));

      const datesWithActivity = Array.from(new Set(lessons.map(l => l.date)))
        .sort((a, b) => b.localeCompare(a))
        .map(d => ({
          date: d,
          lessons_count: lessons.filter(l => l.date === d).length,
          ratings_count: ratings.filter(r => {
            const l = lessons.find(ls => ls.id === r.lesson_id);
            return l && l.date === d;
          }).length
        }));

      const total = list.length;
      const avgC = total ? Math.round((list.reduce((s, r) => s + r.score_clarity, 0) / total) * 100) / 100 : 0;
      const avgE = total ? Math.round((list.reduce((s, r) => s + r.score_engagement, 0) / total) * 100) / 100 : 0;
      const avgA = total ? Math.round((list.reduce((s, r) => s + r.score_atmosphere, 0) / total) * 100) / 100 : 0;
      const overall = total ? Math.round(((avgC + avgE + avgA) / 3.0) * 100) / 100 : 0;

      return {
        dates_with_activity: datesWithActivity,
        selected_date: dateFilter || 'all',
        total_ratings: total,
        summary: {
          avg_clarity: avgC,
          avg_engagement: avgE,
          avg_atmosphere: avgA,
          overall_avg: overall
        },
        ratings: list
      };
    }

    // Teacher Classes
    if (endpoint === '/api/teacher/classes') {
      if (method === 'GET') {
        return classes.map(c => {
          const sCount = users.filter(u => u.class_id === c.id && u.role === 'student').length;
          const classLessons = lessons.filter(l => l.class_id === c.id);
          const lCount = classLessons.length;
          const cLessonIds = classLessons.map(l => l.id);
          const cRatings = ratings.filter(r => cLessonIds.includes(r.lesson_id));
          const avg = cRatings.length ? Math.round((cRatings.reduce((s, r) => s + (r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0, 0) / cRatings.length) * 100) / 100 : null;
          return {
            id: c.id,
            name: c.name,
            description: c.description,
            created_at: c.created_at,
            student_count: sCount,
            lesson_count: lCount,
            average_rating: avg
          };
        });
      }
      if (method === 'POST') {
        const newClass = {
          id: classes.length + 1,
          name: body.name,
          description: body.description || "",
          created_at: new Date().toISOString()
        };
        classes.push(newClass);
        localStorage.setItem('tr_classes', JSON.stringify(classes));
        return { ...newClass, student_count: 0, lesson_count: 0, average_rating: null };
      }
    }

    // Teacher Students
    if (endpoint === '/api/teacher/students') {
      if (method === 'GET') {
        return users.filter(u => u.role === 'student').map(u => {
          const c = classes.find(cl => cl.id === u.class_id) || {};
          const rCount = ratings.filter(r => r.student_id === u.id).length;
          return {
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            class_id: u.class_id,
            class_name: c.name || "—",
            created_at: u.created_at || "2026-10-01",
            ratings_count: rCount
          };
        });
      }
      if (method === 'POST') {
        if (users.find(u => u.username === body.username)) {
          throw new Error("Пользователь с таким логином уже существует");
        }
        const c = classes.find(cl => cl.id === body.class_id);
        const newStudent = {
          id: users.length + 1,
          username: body.username,
          password: body.password,
          name: body.name,
          role: "student",
          class_id: body.class_id,
          created_at: new Date().toISOString()
        };
        users.push(newStudent);
        localStorage.setItem('tr_users', JSON.stringify(users));
        return {
          id: newStudent.id,
          username: newStudent.username,
          name: newStudent.name,
          role: "student",
          class_id: newStudent.class_id,
          class_name: c ? c.name : "",
          created_at: newStudent.created_at,
          ratings_count: 0
        };
      }
    }

    // Teacher Lessons
    if (endpoint.startsWith('/api/teacher/lessons')) {
      if (method === 'GET') {
        return lessons.map(l => {
          const c = classes.find(cl => cl.id === l.class_id) || {};
          const lRatings = ratings.filter(r => r.lesson_id === l.id);
          const avg = lRatings.length ? Math.round((lRatings.reduce((s, r) => s + (r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0, 0) / lRatings.length) * 100) / 100 : null;
          return {
            id: l.id,
            class_id: l.class_id,
            class_name: c.name || "",
            title: l.title,
            date: l.date,
            start_time: l.start_time,
            end_time: l.end_time,
            description: l.description,
            created_at: l.created_at,
            ratings_count: lRatings.length,
            average_score: avg
          };
        }).sort((a, b) => b.date.localeCompare(a.date));
      }
      if (method === 'POST') {
        const c = classes.find(cl => cl.id === body.class_id);
        const newLesson = {
          id: lessons.length + 1,
          class_id: body.class_id,
          title: body.title,
          date: body.date,
          start_time: body.start_time,
          end_time: body.end_time,
          description: body.description || "",
          created_at: new Date().toISOString()
        };
        lessons.push(newLesson);
        localStorage.setItem('tr_lessons', JSON.stringify(lessons));
        return {
          ...newLesson,
          class_name: c ? c.name : "",
          ratings_count: 0,
          average_score: null
        };
      }
    }

    // Teacher Stats
    if (endpoint === '/api/teacher/stats') {
      const studentCount = users.filter(u => u.role === 'student').length;
      const totalRatings = ratings.length;
      const avgC = totalRatings ? Math.round((ratings.reduce((s, r) => s + r.score_clarity, 0) / totalRatings) * 100) / 100 : 0;
      const avgE = totalRatings ? Math.round((ratings.reduce((s, r) => s + r.score_engagement, 0) / totalRatings) * 100) / 100 : 0;
      const avgA = totalRatings ? Math.round((ratings.reduce((s, r) => s + r.score_atmosphere, 0) / totalRatings) * 100) / 100 : 0;
      const overall = totalRatings ? Math.round(((avgC + avgE + avgA) / 3.0) * 100) / 100 : 0;
      return {
        total_classes: classes.length,
        total_students: studentCount,
        total_lessons: lessons.length,
        total_ratings: totalRatings,
        avg_clarity: avgC,
        avg_engagement: avgE,
        avg_atmosphere: avgA,
        avg_overall: overall
      };
    }

    throw new Error(`Endpoint ${endpoint} not handled`);
  }

  // --- NAVIGATION & RENDERING ---

  renderHeaderNav() {
    const container = document.getElementById('authNavContainer');
    if (!container) return;

    if (this.currentUser) {
      const isTeacher = this.currentUser.role === 'teacher';
      const roleBadgeClass = isTeacher ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-800';
      const roleName = isTeacher ? '👨‍🏫 Учитель' : `🎓 ${this.currentUser.class_name || 'Ученик'}`;

      container.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="text-right hidden sm:block">
            <div class="text-xs font-bold text-slate-800 leading-tight">${this.currentUser.name}</div>
            <div class="text-[10px] font-medium text-slate-500">${this.currentUser.username}</div>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${roleBadgeClass}">
            ${roleName}
          </span>
          <button onclick="app.logout()" title="Выйти из аккаунта"
                  class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button onclick="app.showLoginModal()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition">
          Войти
        </button>
      `;
    }
  }

  async renderMainView() {
    const root = document.getElementById('appRoot');
    if (!root) return;

    // Reset gray disabled theme by default
    document.body.classList.remove('theme-no-lesson');

    if (!this.currentUser) {
      root.innerHTML = this.getLoginViewHTML();
    } else if (this.currentUser.role === 'teacher') {
      root.innerHTML = await this.getTeacherViewHTML();
      await this.loadTeacherTabData();
    } else {
      root.innerHTML = await this.getStudentViewHTML();
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // --- LOGIN VIEW ---

  getLoginViewHTML() {
    return `
      <div class="max-w-md mx-auto my-6 bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 space-y-6">
        <div class="text-center space-y-2">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
            <i data-lucide="lock" class="w-8 h-8"></i>
          </div>
          <h2 class="text-2xl font-black text-slate-900 tracking-tight">Вход в систему</h2>
          <p class="text-xs text-slate-500">Введите логин и пароль ученика или учителя</p>
        </div>

        <form onsubmit="app.handleLoginFormSubmit(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Логин</label>
            <div class="relative">
              <i data-lucide="user" class="w-4 h-4 absolute left-3.5 top-3 text-slate-400"></i>
              <input type="text" id="loginUsername" required placeholder="Введите логин..."
                     class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition font-medium">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Пароль</label>
            <div class="relative">
              <i data-lucide="key" class="w-4 h-4 absolute left-3.5 top-3 text-slate-400"></i>
              <input type="password" id="loginPassword" required placeholder="Введите пароль..."
                     class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition font-mono">
            </div>
          </div>

          <button type="submit" class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-200 transition transform active:scale-98">
            Войти в личный кабинет
          </button>
        </form>

        <div class="border-t border-slate-100 pt-5 space-y-3">
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">
            Быстрый вход для проверки:
          </div>
          <div class="bg-indigo-50/60 rounded-2xl p-3 border border-indigo-100 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-indigo-900">👨‍🏫 Админ Учитель:</span>
              <button onclick="app.quickLogin('maxim', '314159')" class="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px]">
                maxim / 314159
              </button>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600">🎓 Ученик 10-А (урок есть):</span>
              <button onclick="app.quickLogin('ivan_ivanov', 'pass101')" class="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-[11px]">
                ivan_ivanov
              </button>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600">🎓 Ученик Python (нет урока):</span>
              <button onclick="app.quickLogin('alex_morozov', 'pass105')" class="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-[11px]">
                alex_morozov
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- STUDENT VIEW (with gray disabled design when no lesson) ---

  async getStudentViewHTML() {
    let dash;
    try {
      dash = await this.apiCall('/api/student/dashboard');
    } catch (err) {
      console.error(err);
      dash = {
        today_date: this.todayStr,
        today_formatted: this.formatDateRussian(new Date()),
        student: this.currentUser,
        status: 'no_lesson',
        can_rate: false,
        rate_reason: 'Ошибка получения данных с сервера'
      };
    }

    const todayFormatted = dash.today_formatted;
    const isNoLessonDay = dash.status === 'no_lesson';
    const isBeforeLesson = dash.status === 'before_lesson';
    const isAlreadyRated = dash.status === 'already_rated';
    const canRate = dash.can_rate;

    // Apply or remove Gray Disabled Design on body
    if (isNoLessonDay) {
      document.body.classList.add('theme-no-lesson');
    } else {
      document.body.classList.remove('theme-no-lesson');
    }

    // Card styling based on lesson status
    let cardWrapperClass = "bg-white border border-slate-200 shadow-xl";
    if (isNoLessonDay) {
      cardWrapperClass = "no-lesson-card";
    }

    // Build the status body and rating button
    let actionBlockHTML = "";

    if (isNoLessonDay) {
      // -----------------------------------------------------------------
      // "в день когда урока нет должен быть серый недоступный дизайн"
      // -----------------------------------------------------------------
      actionBlockHTML = `
        <div class="py-8 text-center space-y-4">
          <div class="w-20 h-20 rounded-full bg-slate-300/70 text-slate-500 flex items-center justify-center mx-auto border-4 border-slate-200">
            <i data-lucide="calendar-x-2" class="w-10 h-10"></i>
          </div>
          <div class="space-y-1">
            <h3 class="text-xl font-bold text-slate-700">Сегодня занятий нет</h3>
            <p class="text-sm text-slate-500 max-w-md mx-auto">
              Для вашего класса (<span class="font-semibold text-slate-600">${this.currentUser.class_name || 'Ваш класс'}</span>) на сегодняшнюю дату уроки не запланированы.
            </p>
          </div>
          <div class="pt-2">
            <!-- Disabled Gray Button -->
            <button disabled class="no-lesson-disabled-btn px-8 py-3.5 rounded-2xl font-bold text-sm inline-flex items-center gap-2 shadow-none">
              <i data-lucide="lock" class="w-4 h-4"></i>
              <span>Оценить урок (Недоступно)</span>
            </button>
            <p class="text-xs text-slate-400 mt-2 font-medium">Оценка уроков возможна только в день и время проведения занятия</p>
          </div>
        </div>
      `;
    } else if (isBeforeLesson) {
      // -----------------------------------------------------------------
      // "нельзя ставить оценки до занятия"
      // -----------------------------------------------------------------
      const lesson = dash.today_lesson;
      actionBlockHTML = `
        <div class="space-y-6">
          <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <i data-lucide="clock" class="w-5 h-5"></i>
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Урок еще не начался
                </span>
                <span class="text-xs text-amber-700 font-semibold">Начало в ${lesson.start_time}</span>
              </div>
              <h4 class="text-lg font-bold text-amber-950">${lesson.title}</h4>
              <p class="text-xs text-amber-800 leading-relaxed">${lesson.description || 'План урока будет разобран во время занятия.'}</p>
            </div>
          </div>

          <div class="text-center py-4 space-y-3">
            <!-- Disabled Button: Cannot rate before lesson -->
            <button disabled class="px-8 py-3.5 rounded-2xl bg-slate-300 text-slate-500 font-bold text-sm inline-flex items-center gap-2 cursor-not-allowed">
              <i data-lucide="lock" class="w-4 h-4"></i>
              <span>Оценить урок (Доступно с ${lesson.start_time})</span>
            </button>
            <p class="text-xs text-slate-500">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5 inline mr-1 text-amber-600"></i>
              <strong>Правило:</strong> Нельзя ставить оценки до занятия. Кнопка станет активной после начала урока в <strong>${lesson.start_time}</strong>.
            </p>
          </div>
        </div>
      `;
    } else if (isAlreadyRated) {
      // -----------------------------------------------------------------
      // "нельзя менять оценку"
      // -----------------------------------------------------------------
      const r = dash.existing_rating;
      const lesson = dash.today_lesson;
      actionBlockHTML = `
        <div class="space-y-6">
          <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
            <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <i data-lucide="check-check" class="w-6 h-6"></i>
            </div>
            <div class="space-y-1 flex-grow">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  Оценка выставлена и зафиксирована
                </span>
                <span class="text-xs text-emerald-700 font-medium">Изменение невозможно</span>
              </div>
              <h4 class="text-lg font-bold text-emerald-950">${lesson.title}</h4>
              <p class="text-xs text-emerald-800">${lesson.start_time} - ${lesson.end_time} • Учитель: Максим Сергеевич</p>
            </div>
          </div>

          <!-- Submitted Scores Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Понятность</span>
              <span class="text-2xl font-black text-indigo-600">${r.score_clarity}</span>
              <span class="text-xs text-slate-400 font-semibold">/ 10</span>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Интерес</span>
              <span class="text-2xl font-black text-emerald-600">${r.score_engagement}</span>
              <span class="text-xs text-slate-400 font-semibold">/ 10</span>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Атмосфера</span>
              <span class="text-2xl font-black text-violet-600">${r.score_atmosphere}</span>
              <span class="text-xs text-slate-400 font-semibold">/ 10</span>
            </div>
            <div class="bg-gradient-to-tr from-slate-900 to-indigo-950 text-white p-4 rounded-2xl text-center shadow-md">
              <span class="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-1">Итоговый балл</span>
              <span class="text-2xl font-black text-amber-400">${r.average_score}</span>
              <span class="text-xs text-slate-400 font-semibold">/ 10</span>
            </div>
          </div>

          ${r.comment ? `
            <div class="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs text-slate-700">
              <strong class="font-bold text-slate-900 block mb-1">Ваш отзыв учителю:</strong>
              "${r.comment}"
            </div>
          ` : ''}

          <div class="text-center py-2">
            <button disabled class="px-7 py-3 rounded-2xl bg-slate-200 text-slate-500 font-bold text-sm inline-flex items-center gap-2 cursor-not-allowed">
              <i data-lucide="lock" class="w-4 h-4"></i>
              <span>Оценка принята (Менять оценку нельзя)</span>
            </button>
            <p class="text-xs text-slate-400 mt-1.5">Спасибо за обратную связь! Оценка учтена в журнале учителя.</p>
          </div>
        </div>
      `;
    } else {
      // -----------------------------------------------------------------
      // LESSON READY TO BE RATED! ("кнопка оценить урок")
      // -----------------------------------------------------------------
      const lesson = dash.today_lesson;
      actionBlockHTML = `
        <div class="space-y-6">
          <div class="bg-indigo-50/70 border border-indigo-200 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm flex items-center gap-1">
                  <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  Урок проведен
                </span>
                <span class="text-xs font-semibold text-indigo-700">Время: ${lesson.start_time} - ${lesson.end_time}</span>
              </div>
              <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">${lesson.title}</h3>
              <p class="text-xs text-slate-600 max-w-xl">${lesson.description || 'Тема занятия завершена. Пожалуйста, поделитесь впечатлениями!'}</p>
            </div>
            
            <!-- MAIN BUTTON: ОЦЕНИТЬ УРОК -->
            <button onclick="app.openRatingModal(${lesson.id}, '${encodeURIComponent(lesson.title)}', '${lesson.date}', '${lesson.start_time} - ${lesson.end_time}')"
                    class="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-base shadow-xl shadow-indigo-300 hover:shadow-indigo-400 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2.5 shrink-0 pulse-active">
              <i data-lucide="star" class="w-5 h-5 text-amber-300 fill-amber-300"></i>
              <span>Оценить урок</span>
            </button>
          </div>

          <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 flex items-center gap-3">
            <i data-lucide="info" class="w-5 h-5 text-indigo-600 shrink-0"></i>
            <div>
              Нажмите кнопку <strong>«Оценить урок»</strong>, чтобы открыть окно с тремя шкалами от 0 до 10 (Понятность, Интерес, Атмосфера).
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="max-w-4xl mx-auto space-y-6">
        
        <!-- Welcome & Date Banner -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-0.5">Личный кабинет ученика</div>
            <h1 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              ${this.currentUser.name}
            </h1>
            <p class="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span class="font-semibold text-slate-700">${this.currentUser.class_name || 'Класс не назначен'}</span>
              <span>•</span>
              <span>Логин: <code class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">${this.currentUser.username}</code></span>
            </p>
          </div>

          <!-- PROMINENT TODAY DATE -->
          <div class="bg-gradient-to-tr from-slate-900 to-indigo-950 text-white px-5 py-3.5 rounded-2xl shadow-md text-right shrink-0">
            <div class="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Сегодняшняя дата</div>
            <div class="text-base sm:text-lg font-black text-white flex items-center gap-2 mt-0.5">
              <i data-lucide="calendar" class="w-5 h-5 text-indigo-400"></i>
              <span>${todayFormatted}</span>
            </div>
          </div>
        </div>

        <!-- MAIN CARD FOR TODAY'S LESSON -->
        <div class="rounded-3xl p-6 sm:p-8 ${cardWrapperClass} transition-all duration-300">
          <div class="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-6">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <i data-lucide="book-open" class="w-4 h-4"></i>
              </div>
              <h2 class="text-lg font-bold text-slate-900">Занятие на сегодня</h2>
            </div>
            
            <!-- Quick calendar trigger button -->
            <button onclick="app.openCalendarModal()" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline">
              <i data-lucide="calendar-days" class="w-4 h-4"></i>
              Смотреть оценки других учеников
            </button>
          </div>

          ${actionBlockHTML}
        </div>

        <!-- RECENT PREVIOUS LESSONS -->
        ${dash.recent_lessons && dash.recent_lessons.length > 0 ? `
          <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
                <i data-lucide="history" class="w-4 h-4 text-slate-400"></i>
                История предыдущих уроков вашего класса
              </h3>
              <button onclick="app.openCalendarModal()" class="text-xs text-indigo-600 hover:underline font-semibold">Все оценки</button>
            </div>
            <div class="divide-y divide-slate-100 text-xs">
              ${dash.recent_lessons.map(l => {
                const hasScore = l.score_clarity !== null && l.score_clarity !== undefined;
                return `
                  <div class="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div class="font-bold text-slate-800 text-sm">${l.title}</div>
                      <div class="text-slate-400 text-[11px] mt-0.5">${l.date} • ${l.start_time} - ${l.end_time}</div>
                    </div>
                    <div>
                      ${hasScore ? `
                        <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg">
                          <i data-lucide="check" class="w-3.5 h-3.5"></i>
                          Оценено (${Math.round(((l.score_clarity + l.score_engagement + l.score_atmosphere)/3.0)*10)/10}/10)
                        </span>
                      ` : `
                        <span class="text-slate-400 font-medium">Не оценено</span>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;
  }

  // --- TEACHER VIEW ---

  async getTeacherViewHTML() {
    return `
      <div class="space-y-6">
        <!-- Top Teacher Bar -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="space-y-2">
            <span class="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">
              Панель управления учителя
            </span>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight">Максим Сергеевич</h1>
            <p class="text-xs text-indigo-200 max-w-lg leading-relaxed">
              Персональный сервис оценки занятий. Управляйте классами, создавайте учеников с логинами и паролями, планируйте уроки и анализируйте отзывы.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button onclick="app.openModal('createLessonModal')" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center gap-2">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span>Запланировать урок</span>
            </button>
            <button onclick="app.openModal('createStudentModal')" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center gap-2">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>Добавить ученика</span>
            </button>
            <button onclick="app.openModal('createClassModal')" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center gap-2">
              <i data-lucide="folder-plus" class="w-4 h-4"></i>
              <span>Создать класс</span>
            </button>
          </div>
        </div>

        <!-- Teacher Dashboard Stats Grid -->
        <div id="teacherStatsContainer" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Injected by loadTeacherStats -->
        </div>

        <!-- Tabs Navigation -->
        <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div class="flex border-b border-slate-200 overflow-x-auto text-xs font-bold text-slate-500 bg-slate-50/70 p-2 gap-1.5">
            <button onclick="app.switchTeacherTab('lessons')" id="tabBtn-lessons"
                    class="px-4 py-2.5 rounded-xl transition flex items-center gap-2 text-indigo-600 bg-white shadow-sm border border-slate-200">
              <i data-lucide="calendar" class="w-4 h-4"></i>
              <span>Занятия (Уроки)</span>
            </button>
            <button onclick="app.switchTeacherTab('students')" id="tabBtn-students"
                    class="px-4 py-2.5 rounded-xl transition flex items-center gap-2 hover:text-slate-800">
              <i data-lucide="users" class="w-4 h-4"></i>
              <span>Ученики и доступы</span>
            </button>
            <button onclick="app.switchTeacherTab('classes')" id="tabBtn-classes"
                    class="px-4 py-2.5 rounded-xl transition flex items-center gap-2 hover:text-slate-800">
              <i data-lucide="layers" class="w-4 h-4"></i>
              <span>Классы</span>
            </button>
          </div>

          <!-- Tab Content Area -->
          <div id="teacherTabContent" class="p-6">
            <!-- Dynamic Tab Content -->
          </div>
        </div>
      </div>
    `;
  }

  async loadTeacherTabData() {
    await this.loadTeacherStats();
    await this.renderTeacherTab();
  }

  async loadTeacherStats() {
    const container = document.getElementById('teacherStatsContainer');
    if (!container) return;
    try {
      const stats = await this.apiCall('/api/teacher/stats');
      container.innerHTML = `
        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center justify-between text-slate-400 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Средний балл</span>
            <i data-lucide="star" class="w-5 h-5 text-amber-500 fill-amber-500"></i>
          </div>
          <div class="text-3xl font-black text-slate-900">${stats.avg_overall} <span class="text-sm font-semibold text-slate-400">/ 10</span></div>
          <div class="text-[11px] text-slate-500 mt-1">Понятность: <strong>${stats.avg_clarity}</strong> • Атмосфера: <strong>${stats.avg_atmosphere}</strong></div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center justify-between text-slate-400 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Всего учеников</span>
            <i data-lucide="users" class="w-5 h-5 text-indigo-500"></i>
          </div>
          <div class="text-3xl font-black text-slate-900">${stats.total_students}</div>
          <div class="text-[11px] text-slate-500 mt-1">В <strong>${stats.total_classes}</strong> классах</div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center justify-between text-slate-400 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Всего уроков</span>
            <i data-lucide="book-open" class="w-5 h-5 text-emerald-500"></i>
          </div>
          <div class="text-3xl font-black text-slate-900">${stats.total_lessons}</div>
          <div class="text-[11px] text-slate-500 mt-1">Запланировано и проведено</div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div class="flex items-center justify-between text-slate-400 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Получено отзывов</span>
            <i data-lucide="message-square" class="w-5 h-5 text-violet-500"></i>
          </div>
          <div class="text-3xl font-black text-slate-900">${stats.total_ratings}</div>
          <div class="text-[11px] text-indigo-600 mt-1 font-semibold cursor-pointer hover:underline" onclick="app.openCalendarModal()">Смотреть в журнале →</div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error(err);
    }
  }

  switchTeacherTab(tabName) {
    this.activeTeacherTab = tabName;
    ['lessons', 'students', 'classes'].forEach(t => {
      const btn = document.getElementById(`tabBtn-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.className = "px-4 py-2.5 rounded-xl transition flex items-center gap-2 text-indigo-600 bg-white shadow-sm border border-slate-200 font-bold";
        } else {
          btn.className = "px-4 py-2.5 rounded-xl transition flex items-center gap-2 hover:text-slate-800 font-medium text-slate-500";
        }
      }
    });
    this.renderTeacherTab();
  }

  async renderTeacherTab() {
    const container = document.getElementById('teacherTabContent');
    if (!container) return;

    if (this.activeTeacherTab === 'lessons') {
      const lessons = await this.apiCall('/api/teacher/lessons');
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-slate-900 text-base">Список занятий всех классов</h3>
            <button onclick="app.openModal('createLessonModal')" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-sm flex items-center gap-1.5">
              <i data-lucide="plus" class="w-4 h-4"></i>
              Добавить урок
            </button>
          </div>
          <div class="overflow-x-auto rounded-2xl border border-slate-200">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th class="p-3">Дата</th>
                  <th class="p-3">Время</th>
                  <th class="p-3">Класс</th>
                  <th class="p-3">Тема занятия</th>
                  <th class="p-3 text-center">Оценок</th>
                  <th class="p-3 text-center">Средний балл</th>
                  <th class="p-3">Статус</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${lessons.map(l => {
                  const isToday = l.date === this.todayStr;
                  const isPast = l.date < this.todayStr;
                  let statusBadge = "";
                  if (isToday) {
                    if (this.currentTimeStr < l.start_time) {
                      statusBadge = `<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">Сегодня в ${l.start_time}</span>`;
                    } else {
                      statusBadge = `<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Проводится / Проведен</span>`;
                    }
                  } else if (isPast) {
                    statusBadge = `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">Завершен</span>`;
                  } else {
                    statusBadge = `<span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-medium">Запланирован</span>`;
                  }

                  return `
                    <tr class="hover:bg-slate-50">
                      <td class="p-3 font-semibold text-slate-900">${l.date}</td>
                      <td class="p-3 text-slate-600">${l.start_time} - ${l.end_time}</td>
                      <td class="p-3 font-medium text-indigo-700">${l.class_name}</td>
                      <td class="p-3 font-semibold text-slate-900">${l.title}</td>
                      <td class="p-3 text-center font-bold">${l.ratings_count}</td>
                      <td class="p-3 text-center font-black ${l.average_score ? 'text-indigo-600' : 'text-slate-300'}">
                        ${l.average_score ? `${l.average_score} / 10` : '—'}
                      </td>
                      <td class="p-3">${statusBadge}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (this.activeTeacherTab === 'students') {
      const students = await this.apiCall('/api/teacher/students');
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-bold text-slate-900 text-base">Ученики и доступы в систему</h3>
              <p class="text-xs text-slate-500">Логины и пароли для входа учеников в личный кабинет</p>
            </div>
            <button onclick="app.openModal('createStudentModal')" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-sm flex items-center gap-1.5">
              <i data-lucide="plus" class="w-4 h-4"></i>
              Добавить ученика
            </button>
          </div>
          <div class="overflow-x-auto rounded-2xl border border-slate-200">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th class="p-3">ФИО Ученика</th>
                  <th class="p-3">Класс</th>
                  <th class="p-3">Логин</th>
                  <th class="p-3">Оценок выставлено</th>
                  <th class="p-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${students.map(s => `
                  <tr class="hover:bg-slate-50">
                    <td class="p-3 font-bold text-slate-900">${s.name}</td>
                    <td class="p-3 font-medium text-slate-700">${s.class_name}</td>
                    <td class="p-3 font-mono text-indigo-700 font-semibold">${s.username}</td>
                    <td class="p-3">${s.ratings_count} отзывов</td>
                    <td class="p-3 text-right">
                      <button onclick="app.copyCredentials('${s.username}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition">
                        Скопировать логин
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (this.activeTeacherTab === 'classes') {
      const classes = await this.apiCall('/api/teacher/classes');
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-slate-900 text-base">Учебные классы</h3>
            <button onclick="app.openModal('createClassModal')" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-sm flex items-center gap-1.5">
              <i data-lucide="plus" class="w-4 h-4"></i>
              Создать класс
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${classes.map(c => `
              <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition shadow-sm space-y-3">
                <div class="flex items-start justify-between">
                  <h4 class="font-bold text-slate-900 text-base">${c.name}</h4>
                  <span class="text-xs font-bold text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    ${c.average_rating ? `★ ${c.average_rating}` : 'Нет оценок'}
                  </span>
                </div>
                <p class="text-xs text-slate-500">${c.description || 'Без описания'}</p>
                <div class="pt-2 border-t border-slate-200 flex justify-between text-xs text-slate-600 font-medium">
                  <span>Учеников: <strong>${c.student_count}</strong></span>
                  <span>Уроков: <strong>${c.lesson_count}</strong></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (window.lucide) lucide.createIcons();
  }

  // --- RATING MODAL (3 SLIDERS 0-10) ---

  openRatingModal(lessonId, encodedTitle, date, schedule) {
    const title = decodeURIComponent(encodedTitle);
    const modal = document.getElementById('ratingModal');
    const card = document.getElementById('ratingModalCard');
    
    document.getElementById('modalLessonId').value = lessonId;
    document.getElementById('modalLessonTitle').textContent = title;
    document.getElementById('modalLessonSchedule').textContent = `${date} • ${schedule}`;
    
    // Reset sliders to sensible defaults
    this.updateSliderLive('Clarity', 8);
    this.updateSliderLive('Engagement', 8);
    this.updateSliderLive('Atmosphere', 9);
    document.getElementById('sliderClarity').value = 8;
    document.getElementById('sliderEngagement').value = 8;
    document.getElementById('sliderAtmosphere').value = 9;
    document.getElementById('ratingComment').value = '';

    modal.classList.remove('hidden');
    setTimeout(() => {
      card.classList.add('modal-open');
    }, 10);
  }

  closeRatingModal() {
    const modal = document.getElementById('ratingModal');
    const card = document.getElementById('ratingModalCard');
    card.classList.remove('modal-open');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 200);
  }

  updateSliderLive(type, value) {
    const val = parseInt(value);
    const badge = document.getElementById(`badge${type}`);
    const desc = document.getElementById(`label${type}Desc`);
    
    if (badge) {
      badge.textContent = `${val} / 10`;
    }

    const descriptions = {
      Clarity: [
        "Совсем непонятно (0)", "Почти ничего не понял (1)", "Очень трудно усвоить (2)",
        "Сложно, много пробелов (3)", "Понятно менее половины (4)", "Средне, есть вопросы (5)",
        "В целом понятно (6)", "Хорошо объяснено (7)", "Очень понятно и доступно (8)",
        "Отлично усвоил материал (9)", "Идеально понятно до мелочей (10)"
      ],
      Engagement: [
        "Совсем не интересно (0)", "Было скучно (1)", "Мало интереса (2)",
        "Было однообразно (3)", "Местами интересно (4)", "Обычный урок (5)",
        "Интересно (6)", "Хорошая вовлеченность (7)", "Очень интересно и живо (8)",
        "Захватывающе и полезно (9)", "Максимальный восторг и польза (10)"
      ],
      Atmosphere: [
        "Очень напряженно (0)", "Некомфортно (1)", "Чувствовалась строгость (2)",
        "Хотелось быстрее уйти (3)", "Немного скованно (4)", "Нейтральная обстановка (5)",
        "Спокойно и нормально (6)", "Хорошая дружелюбная среда (7)", "Очень комфортно и тепло (8)",
        "Отличная поддержка учителя (9)", "Идеальная мотивирующая атмосфера (10)"
      ]
    };

    if (desc && descriptions[type]) {
      desc.textContent = descriptions[type][val];
    }

    // Update live average
    const c = parseInt(document.getElementById('sliderClarity')?.value || 8);
    const e = parseInt(document.getElementById('sliderEngagement')?.value || 8);
    const a = parseInt(document.getElementById('sliderAtmosphere')?.value || 9);
    const avg = Math.round(((c + e + a) / 3.0) * 10) / 10;
    const avgElem = document.getElementById('modalLiveAverage');
    if (avgElem) {
      avgElem.textContent = avg.toFixed(1);
    }
  }

  async handleRatingSubmit(e) {
    e.preventDefault();
    const lessonId = parseInt(document.getElementById('modalLessonId').value);
    const clarity = parseInt(document.getElementById('sliderClarity').value);
    const engagement = parseInt(document.getElementById('sliderEngagement').value);
    const atmosphere = parseInt(document.getElementById('sliderAtmosphere').value);
    const comment = document.getElementById('ratingComment').value;

    const btn = document.getElementById('btnSubmitRating');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin">⏳</span> Сохранение...`;

    try {
      await this.apiCall('/api/student/rate', {
        method: 'POST',
        body: JSON.stringify({
          lesson_id: lessonId,
          score_clarity: clarity,
          score_engagement: engagement,
          score_atmosphere: atmosphere,
          comment: comment
        })
      });

      this.closeRatingModal();
      this.showToast("Успех! Оценка сохранена. Изменить её больше нельзя.", "success");
      await this.renderMainView();
    } catch (err) {
      this.showToast(err.message || "Ошибка отправки оценки", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>Оценить</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  // --- CALENDAR & RATINGS TABLE MODAL ---

  async openCalendarModal() {
    const modal = document.getElementById('calendarModal');
    const card = document.getElementById('calendarModalCard');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
      card.classList.add('modal-open');
    }, 10);

    // Populate class filter dropdown
    const classSelect = document.getElementById('calendarClassSelect');
    try {
      const classes = JSON.parse(localStorage.getItem('tr_classes') || '[]');
      classSelect.innerHTML = `<option value="">Все классы</option>` + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {}

    await this.fetchAndRenderCalendarRatings();
  }

  closeCalendarModal() {
    const modal = document.getElementById('calendarModal');
    const card = document.getElementById('calendarModalCard');
    card.classList.remove('modal-open');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 200);
  }

  async fetchAndRenderCalendarRatings() {
    const dateParam = this.calendarDateFilter || 'all';
    const classParam = this.calendarClassFilter || '';
    
    let url = `/api/calendar/ratings?date=${encodeURIComponent(dateParam)}`;
    if (classParam) {
      url += `&class_id=${encodeURIComponent(classParam)}`;
    }

    try {
      const data = await this.apiCall(url);
      this.cachedCalendarData = data;
      this.renderCalendarUI(data);
    } catch (err) {
      console.error(err);
      this.showToast("Ошибка загрузки данных календаря", "error");
    }
  }

  renderCalendarUI(data) {
    // 1. Summary Cards
    document.getElementById('calTotalRatings').textContent = data.total_ratings;
    document.getElementById('calAvgScore').textContent = `${data.summary.overall_avg} / 10`;
    document.getElementById('calAvgClarity').textContent = data.summary.avg_clarity;
    document.getElementById('calAvgEngagement').textContent = data.summary.avg_engagement;

    // 2. Date Filter Buttons
    const dateButtonsContainer = document.getElementById('calendarDateButtons');
    if (dateButtonsContainer) {
      let buttonsHTML = `
        <button onclick="app.selectCalendarDate('all')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${this.calendarDateFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'}">
          Все дни
        </button>
      `;

      data.dates_with_activity.forEach(d => {
        const isToday = d.date === this.todayStr;
        const isYesterday = d.date === this.yesterdayStr;
        const label = isToday ? `Сегодня (${d.date})` : isYesterday ? `Вчера (${d.date})` : d.date;
        const isActive = this.calendarDateFilter === d.date;

        buttonsHTML += `
          <button onclick="app.selectCalendarDate('${d.date}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'}">
            ${label}
            <span class="ml-1 text-[10px] opacity-75">(${d.ratings_count})</span>
          </button>
        `;
      });

      dateButtonsContainer.innerHTML = buttonsHTML;
    }

    // 3. Table Rows
    const tbody = document.getElementById('calendarTableBody');
    const emptyState = document.getElementById('calendarEmptyState');
    
    let filteredRatings = data.ratings || [];
    if (this.calendarSearchQuery) {
      const q = this.calendarSearchQuery.toLowerCase();
      filteredRatings = filteredRatings.filter(r => 
        r.student_name.toLowerCase().includes(q) ||
        r.lesson_title.toLowerCase().includes(q) ||
        (r.comment && r.comment.toLowerCase().includes(q))
      );
    }

    if (filteredRatings.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      tbody.innerHTML = filteredRatings.map(r => {
        let badgeColor = "bg-slate-100 text-slate-800";
        if (r.average_score >= 9) badgeColor = "bg-emerald-100 text-emerald-800 border border-emerald-300";
        else if (r.average_score >= 7) badgeColor = "bg-indigo-100 text-indigo-800 border border-indigo-200";
        else if (r.average_score >= 5) badgeColor = "bg-amber-100 text-amber-800 border border-amber-300";
        else badgeColor = "bg-rose-100 text-rose-800 border border-rose-300";

        return `
          <tr class="hover:bg-slate-50 transition">
            <td class="p-3 font-semibold text-slate-900 whitespace-nowrap">
              ${r.lesson_date}
              <div class="text-[10px] text-slate-400 font-normal">${r.created_at ? r.created_at.slice(11, 16) : ''}</div>
            </td>
            <td class="p-3 font-bold text-slate-900 whitespace-nowrap">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                  ${r.student_name.slice(0, 1)}
                </div>
                <span>${r.student_name}</span>
              </div>
            </td>
            <td class="p-3 text-slate-600 whitespace-nowrap">${r.class_name}</td>
            <td class="p-3 font-medium text-slate-900 max-w-xs truncate" title="${r.lesson_title}">${r.lesson_title}</td>
            <td class="p-3 text-center font-bold text-indigo-600">${r.score_clarity}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${r.score_engagement}</td>
            <td class="p-3 text-center font-bold text-violet-600">${r.score_atmosphere}</td>
            <td class="p-3 text-center whitespace-nowrap">
              <span class="px-2.5 py-1 rounded-lg font-black text-xs ${badgeColor}">
                ${r.average_score} / 10
              </span>
            </td>
            <td class="p-3 text-slate-600 max-w-xs italic text-[11px]">
              ${r.comment ? `"${r.comment}"` : '<span class="text-slate-300">Без отзыва</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }

    if (window.lucide) lucide.createIcons();
  }

  selectCalendarDate(date) {
    this.calendarDateFilter = date;
    this.fetchAndRenderCalendarRatings();
  }

  filterCalendar() {
    this.calendarClassFilter = document.getElementById('calendarClassSelect')?.value || '';
    this.calendarSearchQuery = document.getElementById('calendarSearchInput')?.value || '';
    if (this.cachedCalendarData) {
      this.renderCalendarUI(this.cachedCalendarData);
    } else {
      this.fetchAndRenderCalendarRatings();
    }
  }

  // --- TEACHER MODAL ACTIONS ---

  openModal(modalId) {
    // Populate select options for classes in student and lesson modals
    if (modalId === 'createStudentModal' || modalId === 'createLessonModal') {
      const classes = JSON.parse(localStorage.getItem('tr_classes') || '[]');
      const selectId = modalId === 'createStudentModal' ? 'newStudentClassId' : 'newLessonClassId';
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    }

    if (modalId === 'createStudentModal') {
      this.generateRandomPassword();
    }

    const m = document.getElementById(modalId);
    if (m) m.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('hidden');
  }

  generateRandomPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById('newStudentPassword');
    if (input) input.value = "pass_" + pass;
  }

  async handleCreateClass(e) {
    e.preventDefault();
    const name = document.getElementById('newClassName').value;
    const desc = document.getElementById('newClassDesc').value;
    try {
      await this.apiCall('/api/teacher/classes', {
        method: 'POST',
        body: JSON.stringify({ name: name, description: desc })
      });
      this.closeModal('createClassModal');
      this.showToast(`Класс «${name}» успешно создан!`, "success");
      await this.loadTeacherTabData();
    } catch (err) {
      this.showToast(err.message || "Ошибка создания класса", "error");
    }
  }

  async handleCreateStudent(e) {
    e.preventDefault();
    const classId = parseInt(document.getElementById('newStudentClassId').value);
    const name = document.getElementById('newStudentName').value;
    const username = document.getElementById('newStudentUsername').value;
    const password = document.getElementById('newStudentPassword').value;

    try {
      await this.apiCall('/api/teacher/students', {
        method: 'POST',
        body: JSON.stringify({
          class_id: classId,
          name: name,
          username: username,
          password: password
        })
      });
      this.closeModal('createStudentModal');
      this.showToast(`Ученик ${name} добавлен! Логин: ${username}`, "success");
      await this.loadTeacherTabData();
    } catch (err) {
      this.showToast(err.message || "Ошибка добавления ученика", "error");
    }
  }

  async handleCreateLesson(e) {
    e.preventDefault();
    const classId = parseInt(document.getElementById('newLessonClassId').value);
    const title = document.getElementById('newLessonTitle').value;
    const date = document.getElementById('newLessonDate').value;
    const start = document.getElementById('newLessonStartTime').value;
    const end = document.getElementById('newLessonEndTime').value;
    const desc = document.getElementById('newLessonDesc').value;

    try {
      await this.apiCall('/api/teacher/lessons', {
        method: 'POST',
        body: JSON.stringify({
          class_id: classId,
          title: title,
          date: date,
          start_time: start,
          end_time: end,
          description: desc
        })
      });
      this.closeModal('createLessonModal');
      this.showToast(`Занятие «${title}» запланировано на ${date}!`, "success");
      await this.loadTeacherTabData();
    } catch (err) {
      this.showToast(err.message || "Ошибка создания занятия", "error");
    }
  }

  copyCredentials(username) {
    navigator.clipboard.writeText(`Логин: ${username}`);
    this.showToast(`Логин «${username}» скопирован в буфер обмена!`, "success");
  }

  // --- AUTH ACTIONS ---

  async handleLoginFormSubmit(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    await this.performLogin(u, p);
  }

  async quickLogin(username, password) {
    await this.performLogin(username, password);
  }

  async performLogin(username, password) {
    try {
      const resp = await this.apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      this.token = resp.token;
      this.currentUser = resp.user;
      localStorage.setItem('tr_token', resp.token);
      localStorage.setItem('tr_user', JSON.stringify(resp.user));

      this.renderHeaderNav();
      await this.renderMainView();
      this.showToast(`Добро пожаловать, ${resp.user.name}!`, "success");
    } catch (err) {
      this.showToast(err.message || "Ошибка входа", "error");
    }
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('tr_token');
    localStorage.removeItem('tr_user');
    this.renderHeaderNav();
    this.renderMainView();
    this.showToast("Вы успешно вышли из системы", "info");
  }

  navigateHome() {
    this.renderMainView();
  }

  // --- TOAST NOTIFICATIONS ---

  showToast(message, type = "info") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      info: 'bg-slate-900 text-white'
    };

    toast.className = `toast px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 max-w-sm ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Global instance
window.app = new TeacherReviewerApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
