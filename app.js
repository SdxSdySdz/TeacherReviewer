/**
 * Teacher Reviewer Platform
 * Clean, Minimalist Engine
 */

class TeacherReviewerApp {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('tr_user') || 'null');
    this.token = localStorage.getItem('tr_token') || null;

    const now = new Date();
    this.todayStr = this.formatDateYMD(now);
    this.currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.activeTeacherTab = 'lessons';
    this.calendarDateFilter = 'all';
    this.calendarClassFilter = '';

    // Clear legacy test data from localStorage
    if (localStorage.getItem('tr_v2_cleaned') !== 'true') {
      localStorage.removeItem('tr_classes');
      localStorage.removeItem('tr_lessons');
      localStorage.removeItem('tr_ratings');
      localStorage.removeItem('tr_users');
      localStorage.removeItem('tr_user');
      localStorage.removeItem('tr_token');
      this.currentUser = null;
      this.token = null;
      localStorage.setItem('tr_v2_cleaned', 'true');
    }

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
    // Clean initial state: only teacher maxim 314159, no fake students, classes, or lessons
    if (!localStorage.getItem('tr_classes')) {
      localStorage.setItem('tr_classes', JSON.stringify([]));
    }
    if (!localStorage.getItem('tr_users')) {
      localStorage.setItem('tr_users', JSON.stringify([
        { id: 1, username: "maxim", password: "314159", name: "Максим Сергеевич", role: "teacher", class_id: null }
      ]));
    }
    if (!localStorage.getItem('tr_lessons')) {
      localStorage.setItem('tr_lessons', JSON.stringify([]));
    }
    if (!localStorage.getItem('tr_ratings')) {
      localStorage.setItem('tr_ratings', JSON.stringify([]));
    }
  }

  async init() {
    const todayFormatted = this.formatDateRussian(new Date());
    const headerToday = document.getElementById('headerTodayText');
    if (headerToday) {
      headerToday.textContent = `Сегодня: ${todayFormatted}`;
    }

    const dateInput = document.getElementById('newLessonDate');
    if (dateInput) {
      dateInput.value = this.todayStr;
    }

    if (this.token && this.currentUser) {
      try {
        const me = await this.apiCall('/api/auth/me');
        if (me && me.id) {
          this.currentUser = me;
          localStorage.setItem('tr_user', JSON.stringify(me));
        }
      } catch (e) {
        console.warn('API /me check failed:', e);
      }
    }

    this.renderHeaderNav();
    await this.renderMainView();

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // --- API CALL & LOCAL FALLBACK ---
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
      throw new Error(errData.detail || `Ошибка: ${resp.status}`);
    } catch (e) {
      return this.handleLocalRequest(endpoint, options);
    }
  }

  handleLocalRequest(endpoint, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};

    const users = JSON.parse(localStorage.getItem('tr_users') || '[]');
    const classes = JSON.parse(localStorage.getItem('tr_classes') || '[]');
    const lessons = JSON.parse(localStorage.getItem('tr_lessons') || '[]');
    const ratings = JSON.parse(localStorage.getItem('tr_ratings') || '[]');

    if (endpoint === '/api/auth/login' && method === 'POST') {
      const u = users.find(user => user.username === body.username && user.password === body.password);
      if (!u) throw new Error("Неверный логин или пароль");
      const c = classes.find(cl => cl.id === u.class_id);
      const userObj = {
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        class_id: u.class_id,
        class_name: c ? c.name : null
      };
      return { token: `token_${u.id}`, user: userObj };
    }

    if (endpoint === '/api/auth/me') {
      if (!this.currentUser) throw new Error("Не авторизован");
      return this.currentUser;
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

    // Rate
    if (endpoint === '/api/student/rate' && method === 'POST') {
      const lesson = lessons.find(l => l.id === body.lesson_id);
      if (!lesson) throw new Error("Занятие не найдено");
      if (lesson.class_id !== this.currentUser.class_id) throw new Error("Не ваш класс");
      if (lesson.date > this.todayStr) throw new Error("Нельзя оценивать до занятия");
      if (lesson.date === this.todayStr && this.currentTimeStr < lesson.start_time) {
        throw new Error(`Нельзя ставить оценку до занятия. Начало в ${lesson.start_time}.`);
      }
      const existing = ratings.find(r => r.lesson_id === body.lesson_id && r.student_id === this.currentUser.id);
      if (existing) throw new Error("Вы уже оценили этот урок. Менять оценку нельзя!");

      const newRating = {
        id: ratings.length + 1,
        lesson_id: body.lesson_id,
        student_id: this.currentUser.id,
        score_clarity: parseInt(body.score_clarity),
        score_engagement: parseInt(body.score_engagement),
        score_atmosphere: parseInt(body.score_atmosphere),
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

    // Calendar
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
          class_id: c.id,
          class_name: c.name || "",
          student_id: u.id,
          student_name: u.name || "Ученик",
          score_clarity: r.score_clarity,
          score_engagement: r.score_engagement,
          score_atmosphere: r.score_atmosphere,
          average_score: Math.round(((r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0) * 10) / 10,
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
          ratings_count: ratings.filter(r => {
            const l = lessons.find(ls => ls.id === r.lesson_id);
            return l && l.date === d;
          }).length
        }));

      return {
        dates_with_activity: datesWithActivity,
        selected_date: dateFilter || 'all',
        total_ratings: list.length,
        ratings: list
      };
    }

    // Teacher Classes
    if (endpoint === '/api/teacher/classes') {
      if (method === 'GET') {
        return classes.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          student_count: users.filter(u => u.class_id === c.id && u.role === 'student').length,
          lesson_count: lessons.filter(l => l.class_id === c.id).length
        }));
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
        return newClass;
      }
    }

    // Teacher Students
    if (endpoint === '/api/teacher/students') {
      if (method === 'GET') {
        return users.filter(u => u.role === 'student').map(u => {
          const c = classes.find(cl => cl.id === u.class_id) || {};
          return {
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            class_id: u.class_id,
            class_name: c.name || "—"
          };
        });
      }
      if (method === 'POST') {
        if (users.find(u => u.username === body.username)) {
          throw new Error("Логин уже занят");
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
          class_name: c ? c.name : ""
        };
      }
    }

    // Teacher Lessons
    if (endpoint.startsWith('/api/teacher/lessons')) {
      if (method === 'GET') {
        return lessons.map(l => {
          const c = classes.find(cl => cl.id === l.class_id) || {};
          const lRatings = ratings.filter(r => r.lesson_id === l.id);
          const avg = lRatings.length ? Math.round((lRatings.reduce((s, r) => s + (r.score_clarity + r.score_engagement + r.score_atmosphere) / 3.0, 0) / lRatings.length) * 10) / 10 : null;
          return {
            id: l.id,
            class_id: l.class_id,
            class_name: c.name || "",
            title: l.title,
            date: l.date,
            start_time: l.start_time,
            end_time: l.end_time,
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

    throw new Error(`Endpoint ${endpoint} not handled`);
  }

  // --- NAVIGATION ---
  renderHeaderNav() {
    const container = document.getElementById('authNavContainer');
    if (!container) return;

    if (this.currentUser) {
      const isTeacher = this.currentUser.role === 'teacher';
      const label = isTeacher ? 'Учитель' : `${this.currentUser.name} (${this.currentUser.class_name || 'Ученик'})`;

      container.innerHTML = `
        <div class="flex items-center gap-2 text-xs">
          <span class="font-medium text-slate-700">${label}</span>
          <button onclick="app.logout()" title="Выйти" class="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = ``;
    }
  }

  async renderMainView() {
    const root = document.getElementById('appRoot');
    if (!root) return;

    document.body.classList.remove('theme-no-lesson');

    if (!this.currentUser) {
      root.innerHTML = this.getLoginViewHTML();
    } else if (this.currentUser.role === 'teacher') {
      root.innerHTML = await this.getTeacherViewHTML();
      await this.renderTeacherTab();
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
      <div class="max-w-sm mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
        <div class="text-center space-y-1">
          <h2 class="text-xl font-bold text-slate-900">Вход в систему</h2>
          <p class="text-xs text-slate-400">Введите логин и пароль</p>
        </div>

        <form onsubmit="app.handleLoginFormSubmit(event)" class="space-y-3.5">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Логин</label>
            <input type="text" id="loginUsername" required placeholder="Логин"
                   class="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-indigo-500 outline-none">
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Пароль</label>
            <input type="password" id="loginPassword" required placeholder="Пароль"
                   class="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-indigo-500 outline-none">
          </div>

          <button type="submit" class="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition">
            Войти
          </button>
        </form>
      </div>
    `;
  }

  // --- STUDENT VIEW ---
  async getStudentViewHTML() {
    let dash;
    try {
      dash = await this.apiCall('/api/student/dashboard');
    } catch (e) {
      dash = {
        today_formatted: this.formatDateRussian(new Date()),
        status: 'no_lesson',
        can_rate: false
      };
    }

    const todayFormatted = dash.today_formatted;
    const isNoLessonDay = dash.status === 'no_lesson';
    const isBeforeLesson = dash.status === 'before_lesson';
    const isAlreadyRated = dash.status === 'already_rated';

    if (isNoLessonDay) {
      document.body.classList.add('theme-no-lesson');
    } else {
      document.body.classList.remove('theme-no-lesson');
    }

    let actionHTML = "";

    if (isNoLessonDay) {
      // Gray disabled design when no lesson
      actionHTML = `
        <div class="no-lesson-card rounded-2xl p-8 text-center space-y-3">
          <div class="w-12 h-12 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center mx-auto">
            <i data-lucide="calendar-off" class="w-6 h-6"></i>
          </div>
          <div>
            <h3 class="font-bold text-slate-700 text-base">Сегодня занятий нет</h3>
            <p class="text-xs text-slate-500 mt-1">Оценивание недоступно</p>
          </div>
          <button disabled class="no-lesson-disabled-btn px-6 py-2.5 rounded-xl text-xs font-semibold">
            Оценить урок (Недоступно)
          </button>
        </div>
      `;
    } else if (isBeforeLesson) {
      // Cannot rate before lesson starts
      const lesson = dash.today_lesson;
      actionHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div class="space-y-1">
            <span class="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Начало в ${lesson.start_time}</span>
            <h3 class="text-lg font-bold text-slate-900">${lesson.title}</h3>
            <p class="text-xs text-slate-500">${lesson.start_time} - ${lesson.end_time}</p>
          </div>
          <div>
            <button disabled class="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 font-semibold text-xs cursor-not-allowed">
              Оценить урок (Доступно с ${lesson.start_time})
            </button>
            <p class="text-[11px] text-slate-400 mt-1.5">Нельзя ставить оценки до занятия</p>
          </div>
        </div>
      `;
    } else if (isAlreadyRated) {
      // Cannot change rating
      const r = dash.existing_rating;
      const lesson = dash.today_lesson;
      actionHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Урок оценен</span>
              <h3 class="text-base font-bold text-slate-900 mt-1">${lesson.title}</h3>
            </div>
            <span class="text-xs text-slate-400">Оценка зафиксирована</span>
          </div>

          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="bg-slate-50 p-2.5 rounded-xl">
              <span class="text-[10px] text-slate-400 block">Понятность</span>
              <span class="font-bold text-sm text-slate-800">${r.score_clarity} / 10</span>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl">
              <span class="text-[10px] text-slate-400 block">Интерес</span>
              <span class="font-bold text-sm text-slate-800">${r.score_engagement} / 10</span>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-xl">
              <span class="text-[10px] text-slate-400 block">Атмосфера</span>
              <span class="font-bold text-sm text-slate-800">${r.score_atmosphere} / 10</span>
            </div>
            <div class="bg-slate-900 text-white p-2.5 rounded-xl">
              <span class="text-[10px] text-slate-300 block">Итог</span>
              <span class="font-bold text-sm text-amber-300">${r.average_score} / 10</span>
            </div>
          </div>

          <button disabled class="w-full py-2 rounded-xl bg-slate-100 text-slate-400 font-medium text-xs cursor-not-allowed">
            Оценка сохранена (менять оценку нельзя)
          </button>
        </div>
      `;
    } else {
      // Ready to rate
      const lesson = dash.today_lesson;
      actionHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div class="space-y-1">
            <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">Занятие завершено</span>
            <h3 class="text-lg font-bold text-slate-900">${lesson.title}</h3>
            <p class="text-xs text-slate-500">${lesson.start_time} - ${lesson.end_time}</p>
          </div>
          <button onclick="app.openRatingModal(${lesson.id}, '${encodeURIComponent(lesson.title)}', '${lesson.date}', '${lesson.start_time} - ${lesson.end_time}')"
                  class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition">
            Оценить урок
          </button>
        </div>
      `;
    }

    return `
      <div class="max-w-lg mx-auto space-y-5">
        <!-- Date Header -->
        <div class="text-center space-y-1">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Сегодняшняя дата</span>
          <h1 class="text-2xl font-bold text-slate-900">${todayFormatted}</h1>
        </div>

        ${actionHTML}
      </div>
    `;
  }

  // --- TEACHER VIEW ---
  async getTeacherViewHTML() {
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 class="text-xl font-bold text-slate-900">Кабинет учителя</h1>
            <p class="text-xs text-slate-500">Управление классами, учениками и занятиями</p>
          </div>
          <div class="flex gap-2">
            <button onclick="app.openModal('createLessonModal')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold">
              + Урок
            </button>
            <button onclick="app.openModal('createStudentModal')" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold">
              + Ученик
            </button>
            <button onclick="app.openModal('createClassModal')" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold">
              + Класс
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 border-b border-slate-200 text-xs font-semibold text-slate-500">
          <button onclick="app.switchTeacherTab('lessons')" id="tabBtn-lessons" class="pb-2.5 border-b-2 border-indigo-600 text-indigo-600">
            Занятия
          </button>
          <button onclick="app.switchTeacherTab('students')" id="tabBtn-students" class="pb-2.5 border-b-2 border-transparent hover:text-slate-800">
            Ученики
          </button>
          <button onclick="app.switchTeacherTab('classes')" id="tabBtn-classes" class="pb-2.5 border-b-2 border-transparent hover:text-slate-800">
            Классы
          </button>
        </div>

        <div id="teacherTabContent"></div>
      </div>
    `;
  }

  switchTeacherTab(tab) {
    this.activeTeacherTab = tab;
    ['lessons', 'students', 'classes'].forEach(t => {
      const btn = document.getElementById(`tabBtn-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = "pb-2.5 border-b-2 border-indigo-600 text-indigo-600 font-semibold";
        } else {
          btn.className = "pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-medium";
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
      if (lessons.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400 text-xs">Занятий пока нет. Нажмите «+ Урок», чтобы добавить занятие.</div>`;
        return;
      }
      container.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                <th class="pb-2">Дата</th>
                <th class="pb-2">Время</th>
                <th class="pb-2">Класс</th>
                <th class="pb-2">Тема</th>
                <th class="pb-2 text-center">Оценок</th>
                <th class="pb-2 text-center">Средний балл</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${lessons.map(l => `
                <tr>
                  <td class="py-2.5 font-medium">${l.date}</td>
                  <td class="py-2.5">${l.start_time} - ${l.end_time}</td>
                  <td class="py-2.5">${l.class_name}</td>
                  <td class="py-2.5 font-semibold text-slate-900">${l.title}</td>
                  <td class="py-2.5 text-center">${l.ratings_count}</td>
                  <td class="py-2.5 text-center font-bold ${l.average_score ? 'text-indigo-600' : 'text-slate-300'}">
                    ${l.average_score ? `${l.average_score} / 10` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTeacherTab === 'students') {
      const students = await this.apiCall('/api/teacher/students');
      if (students.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400 text-xs">Учеников пока нет. Нажмите «+ Ученик», чтобы добавить ученика.</div>`;
        return;
      }
      container.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-slate-400 font-semibold border-b border-slate-100 pb-2">
                <th class="pb-2">ФИО</th>
                <th class="pb-2">Класс</th>
                <th class="pb-2">Логин</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${students.map(s => `
                <tr>
                  <td class="py-2.5 font-semibold text-slate-900">${s.name}</td>
                  <td class="py-2.5">${s.class_name}</td>
                  <td class="py-2.5 font-mono text-indigo-700">${s.username}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.activeTeacherTab === 'classes') {
      const classes = await this.apiCall('/api/teacher/classes');
      if (classes.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400 text-xs">Классов пока нет. Нажмите «+ Класс», чтобы создать.</div>`;
        return;
      }
      container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${classes.map(c => `
            <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
              <h4 class="font-bold text-sm text-slate-900">${c.name}</h4>
              <p class="text-xs text-slate-400">${c.description || 'Без описания'}</p>
              <div class="pt-2 text-[11px] text-slate-500 flex gap-3">
                <span>Учеников: <strong>${c.student_count}</strong></span>
                <span>Уроков: <strong>${c.lesson_count}</strong></span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (window.lucide) lucide.createIcons();
  }

  // --- RATING MODAL (3 SLIDERS 0-10) ---
  openRatingModal(lessonId, encodedTitle, date, schedule) {
    const title = decodeURIComponent(encodedTitle);
    const modal = document.getElementById('ratingModal');
    
    document.getElementById('modalLessonId').value = lessonId;
    document.getElementById('modalLessonTitle').textContent = title;
    document.getElementById('modalLessonSchedule').textContent = `${date} • ${schedule}`;
    
    this.updateSliderLive('Clarity', 8);
    this.updateSliderLive('Engagement', 8);
    this.updateSliderLive('Atmosphere', 9);
    document.getElementById('sliderClarity').value = 8;
    document.getElementById('sliderEngagement').value = 8;
    document.getElementById('sliderAtmosphere').value = 9;

    modal.classList.remove('hidden');
  }

  closeRatingModal() {
    document.getElementById('ratingModal').classList.add('hidden');
  }

  updateSliderLive(type, val) {
    const badge = document.getElementById(`badge${type}`);
    if (badge) badge.textContent = `${val} / 10`;

    const c = parseInt(document.getElementById('sliderClarity')?.value || 8);
    const e = parseInt(document.getElementById('sliderEngagement')?.value || 8);
    const a = parseInt(document.getElementById('sliderAtmosphere')?.value || 9);
    const avg = Math.round(((c + e + a) / 3.0) * 10) / 10;
    const avgElem = document.getElementById('modalLiveAverage');
    if (avgElem) avgElem.textContent = `${avg.toFixed(1)} / 10`;
  }

  async handleRatingSubmit(e) {
    e.preventDefault();
    const lessonId = parseInt(document.getElementById('modalLessonId').value);
    const clarity = parseInt(document.getElementById('sliderClarity').value);
    const engagement = parseInt(document.getElementById('sliderEngagement').value);
    const atmosphere = parseInt(document.getElementById('sliderAtmosphere').value);

    try {
      await this.apiCall('/api/student/rate', {
        method: 'POST',
        body: JSON.stringify({
          lesson_id: lessonId,
          score_clarity: clarity,
          score_engagement: engagement,
          score_atmosphere: atmosphere
        })
      });

      this.closeRatingModal();
      this.showToast("Оценка сохранена!", "success");
      await this.renderMainView();
    } catch (err) {
      this.showToast(err.message || "Ошибка отправки", "error");
    }
  }

  // --- CALENDAR MODAL ---
  async openCalendarModal() {
    const modal = document.getElementById('calendarModal');
    modal.classList.remove('hidden');

    const classSelect = document.getElementById('calendarClassSelect');
    try {
      const classes = JSON.parse(localStorage.getItem('tr_classes') || '[]');
      classSelect.innerHTML = `<option value="">Все классы</option>` + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {}

    await this.fetchAndRenderCalendarRatings();
  }

  closeCalendarModal() {
    document.getElementById('calendarModal').classList.add('hidden');
  }

  async fetchAndRenderCalendarRatings() {
    const dateParam = this.calendarDateFilter || 'all';
    const classParam = this.calendarClassFilter || '';
    
    let url = `/api/calendar/ratings?date=${encodeURIComponent(dateParam)}`;
    if (classParam) url += `&class_id=${encodeURIComponent(classParam)}`;

    try {
      const data = await this.apiCall(url);
      this.renderCalendarUI(data);
    } catch (err) {
      this.showToast("Ошибка загрузки календаря", "error");
    }
  }

  renderCalendarUI(data) {
    const dateButtonsContainer = document.getElementById('calendarDateButtons');
    if (dateButtonsContainer) {
      let html = `
        <button onclick="app.selectCalendarDate('all')" class="px-2.5 py-1 rounded text-xs font-semibold ${this.calendarDateFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}">
          Все дни
        </button>
      `;
      (data.dates_with_activity || []).forEach(d => {
        const isActive = this.calendarDateFilter === d.date;
        html += `
          <button onclick="app.selectCalendarDate('${d.date}')" class="px-2.5 py-1 rounded text-xs font-semibold ${isActive ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}">
            ${d.date}
          </button>
        `;
      });
      dateButtonsContainer.innerHTML = html;
    }

    const tbody = document.getElementById('calendarTableBody');
    const emptyState = document.getElementById('calendarEmptyState');
    const list = data.ratings || [];

    if (list.length === 0) {
      tbody.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      tbody.innerHTML = list.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5">${r.lesson_date}</td>
          <td class="py-2.5 font-semibold text-slate-900">${r.student_name}</td>
          <td class="py-2.5">${r.class_name}</td>
          <td class="py-2.5">${r.lesson_title}</td>
          <td class="py-2.5 text-center">${r.score_clarity}</td>
          <td class="py-2.5 text-center">${r.score_engagement}</td>
          <td class="py-2.5 text-center">${r.score_atmosphere}</td>
          <td class="py-2.5 text-center font-bold text-indigo-600">${r.average_score} / 10</td>
        </tr>
      `).join('');
    }
  }

  selectCalendarDate(d) {
    this.calendarDateFilter = d;
    this.fetchAndRenderCalendarRatings();
  }

  filterCalendar() {
    this.calendarClassFilter = document.getElementById('calendarClassSelect')?.value || '';
    this.fetchAndRenderCalendarRatings();
  }

  // --- TEACHER ACTIONS ---
  openModal(id) {
    if (id === 'createStudentModal' || id === 'createLessonModal') {
      const classes = JSON.parse(localStorage.getItem('tr_classes') || '[]');
      const selectId = id === 'createStudentModal' ? 'newStudentClassId' : 'newLessonClassId';
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    }
    if (id === 'createStudentModal') {
      this.generateRandomPassword();
    }
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
  }

  generateRandomPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 6; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
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
        body: JSON.stringify({ name, description: desc })
      });
      this.closeModal('createClassModal');
      this.showToast(`Класс «${name}» создан`, "success");
      await this.renderTeacherTab();
    } catch (err) {
      this.showToast(err.message, "error");
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
        body: JSON.stringify({ class_id: classId, name, username, password })
      });
      this.closeModal('createStudentModal');
      this.showToast(`Ученик ${name} создан`, "success");
      await this.renderTeacherTab();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async handleCreateLesson(e) {
    e.preventDefault();
    const classId = parseInt(document.getElementById('newLessonClassId').value);
    const title = document.getElementById('newLessonTitle').value;
    const date = document.getElementById('newLessonDate').value;
    const start = document.getElementById('newLessonStartTime').value;
    const end = document.getElementById('newLessonEndTime').value;

    try {
      await this.apiCall('/api/teacher/lessons', {
        method: 'POST',
        body: JSON.stringify({ class_id: classId, title, date, start_time: start, end_time: end })
      });
      this.closeModal('createLessonModal');
      this.showToast(`Урок «${title}» создан`, "success");
      await this.renderTeacherTab();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  // --- AUTH ACTIONS ---
  async handleLoginFormSubmit(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    try {
      const resp = await this.apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p })
      });
      this.token = resp.token;
      this.currentUser = resp.user;
      localStorage.setItem('tr_token', resp.token);
      localStorage.setItem('tr_user', JSON.stringify(resp.user));
      this.renderHeaderNav();
      await this.renderMainView();
    } catch (err) {
      this.showToast(err.message || "Неверный логин или пароль", "error");
    }
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('tr_token');
    localStorage.removeItem('tr_user');
    this.renderHeaderNav();
    this.renderMainView();
  }

  navigateHome() {
    this.renderMainView();
  }

  showToast(msg, type = "info") {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg ${type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-slate-900'}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}

window.app = new TeacherReviewerApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
