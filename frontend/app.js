/**
 * Teacher Reviewer Platform
 * Bold, Screen-Filling, Mobile-First UI Engine
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

    // Clear legacy test data if any
    if (localStorage.getItem('tr_v4_large_cleaned') !== 'true') {
      localStorage.removeItem('tr_classes');
      localStorage.removeItem('tr_lessons');
      localStorage.removeItem('tr_ratings');
      localStorage.removeItem('tr_users');
      localStorage.removeItem('tr_user');
      localStorage.removeItem('tr_token');
      this.currentUser = null;
      this.token = null;
      localStorage.setItem('tr_v4_large_cleaned', 'true');
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
    // Only teacher maxim / 314159, zero dummy test data
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
        existing_rating: existingRating
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
      const label = isTeacher ? 'Учитель' : this.currentUser.name;

      container.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="bg-slate-100 px-3.5 py-2 rounded-2xl flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-800">
            <i data-lucide="${isTeacher ? 'award' : 'user'}" class="w-5 h-5 text-indigo-600"></i>
            <span class="max-w-[140px] sm:max-w-none truncate">${label}</span>
          </div>
          <button onclick="app.logout()" title="Выйти"
                  class="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 active:scale-95 text-slate-500 flex items-center justify-center transition shadow-xs">
            <i data-lucide="log-out" class="w-6 h-6"></i>
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

  // --- LOGIN VIEW (SCREEN FILLING & CHUNKY) ---
  getLoginViewHTML() {
    return `
      <div class="w-full bg-white rounded-3xl border-2 border-slate-200/90 p-7 sm:p-10 space-y-7 shadow-sm">
        <div class="text-center space-y-3">
          <div class="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
            <i data-lucide="user-check" class="w-8 h-8"></i>
          </div>
          <h2 class="text-3xl font-black text-slate-900 tracking-tight">Вход в систему</h2>
          <p class="text-base text-slate-500 font-medium">Войдите под своей учётной записью</p>
        </div>

        <form onsubmit="app.handleLoginFormSubmit(event)" class="space-y-5">
          <div>
            <label class="block text-base font-extrabold text-slate-800 mb-2">Логин</label>
            <input type="text" id="loginUsername" required placeholder="Введите логин"
                   class="w-full px-5 py-4 rounded-2xl border-2 border-slate-300 text-lg font-medium focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition">
          </div>

          <div>
            <label class="block text-base font-extrabold text-slate-800 mb-2">Пароль</label>
            <input type="password" id="loginPassword" required placeholder="Введите пароль"
                   class="w-full px-5 py-4 rounded-2xl border-2 border-slate-300 text-lg font-medium focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition">
          </div>

          <button type="submit" class="w-full py-5 rounded-2xl bg-indigo-600 active:bg-indigo-700 hover:bg-indigo-700 text-white font-black text-xl shadow-xl shadow-indigo-600/25 active:scale-[0.98] transition mt-3 flex items-center justify-center gap-2">
            <span>Войти</span>
            <i data-lucide="arrow-right" class="w-6 h-6 stroke-[3]"></i>
          </button>
        </form>
      </div>
    `;
  }

  // --- STUDENT VIEW (BOLD, PROMINENT, ZERO UNUSED VOIDS) ---
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
      // Gray disabled design when no lesson today
      actionHTML = `
        <div class="no-lesson-card rounded-3xl p-8 sm:p-12 text-center space-y-6">
          <div class="w-20 h-20 rounded-3xl bg-slate-200 text-slate-500 flex items-center justify-center mx-auto shadow-inner">
            <i data-lucide="calendar-off" class="w-10 h-10"></i>
          </div>
          <div class="space-y-2">
            <h3 class="font-black text-slate-800 text-2xl sm:text-3xl">Сегодня занятий нет</h3>
            <p class="text-base sm:text-lg text-slate-500 font-medium">Оценивание уроков на сегодня недоступно</p>
          </div>
          <div class="pt-2">
            <button disabled class="no-lesson-disabled-btn w-full py-5 px-6 rounded-2xl text-lg sm:text-xl font-black">
              Оценить урок (Нет занятий)
            </button>
          </div>
        </div>
      `;
    } else if (isBeforeLesson) {
      // Cannot rate before lesson starts
      const lesson = dash.today_lesson;
      actionHTML = `
        <div class="bg-white border-2 border-slate-200/90 rounded-3xl p-7 sm:p-10 space-y-6 shadow-sm">
          <div class="space-y-3">
            <span class="inline-flex items-center gap-2 text-sm font-black text-amber-900 bg-amber-100 px-4 py-1.5 rounded-full">
              <i data-lucide="clock" class="w-4 h-4"></i>
              Начало в ${lesson.start_time}
            </span>
            <h3 class="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">${lesson.title}</h3>
            <p class="text-base sm:text-lg text-slate-500 font-semibold">Время занятия: ${lesson.start_time} – ${lesson.end_time}</p>
          </div>

          <div class="pt-2 space-y-2">
            <button disabled class="w-full py-5 rounded-2xl bg-slate-200 text-slate-500 font-black text-lg sm:text-xl cursor-not-allowed">
              Оценить урок (Доступно с ${lesson.start_time})
            </button>
            <p class="text-sm text-center text-slate-400 font-bold">Оценку нельзя поставить до начала занятия</p>
          </div>
        </div>
      `;
    } else if (isAlreadyRated) {
      // Cannot change rating
      const r = dash.existing_rating;
      const lesson = dash.today_lesson;
      actionHTML = `
        <div class="bg-white border-2 border-slate-200/90 rounded-3xl p-7 sm:p-10 space-y-7 shadow-sm">
          <div class="flex items-start justify-between border-b-2 border-slate-100 pb-5">
            <div>
              <span class="inline-flex items-center gap-1.5 text-sm font-black text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full mb-2">
                <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
                Урок оценен
              </span>
              <h3 class="text-2xl font-black text-slate-900 mt-1">${lesson.title}</h3>
            </div>
          </div>

          <!-- Score cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div class="bg-slate-50 border-2 border-slate-200/70 p-4 rounded-2xl">
              <span class="text-xs sm:text-sm text-slate-500 font-bold block">Понятность</span>
              <span class="font-black text-2xl text-slate-900 mt-1 block">${r.score_clarity} / 10</span>
            </div>
            <div class="bg-slate-50 border-2 border-slate-200/70 p-4 rounded-2xl">
              <span class="text-xs sm:text-sm text-slate-500 font-bold block">Интерес</span>
              <span class="font-black text-2xl text-slate-900 mt-1 block">${r.score_engagement} / 10</span>
            </div>
            <div class="bg-slate-50 border-2 border-slate-200/70 p-4 rounded-2xl">
              <span class="text-xs sm:text-sm text-slate-500 font-bold block">Атмосфера</span>
              <span class="font-black text-2xl text-slate-900 mt-1 block">${r.score_atmosphere} / 10</span>
            </div>
            <div class="bg-indigo-600 text-white p-4 rounded-2xl shadow-md shadow-indigo-600/25">
              <span class="text-xs sm:text-sm text-indigo-100 font-bold block">Итог</span>
              <span class="font-black text-2xl sm:text-3xl text-amber-300 mt-1 block">${r.average_score} / 10</span>
            </div>
          </div>

          <div class="pt-1">
            <button disabled class="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold text-base cursor-not-allowed">
              Оценка зафиксирована (изменить нельзя)
            </button>
          </div>
        </div>
      `;
    } else {
      // Ready to rate: HUGE prominent button!
      const lesson = dash.today_lesson;
      actionHTML = `
        <div class="bg-white border-2 border-slate-200/90 rounded-3xl p-7 sm:p-10 space-y-6 shadow-sm">
          <div class="space-y-3">
            <span class="inline-flex items-center gap-2 text-sm font-black text-indigo-800 bg-indigo-100 px-4 py-1.5 rounded-full">
              <i data-lucide="bell-ring" class="w-4 h-4 text-indigo-600"></i>
              Занятие готово к оценке
            </span>
            <h3 class="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">${lesson.title}</h3>
            <p class="text-base sm:text-lg text-slate-500 font-semibold">${lesson.start_time} – ${lesson.end_time}</p>
          </div>

          <div class="pt-2">
            <button onclick="app.openRatingModal(${lesson.id}, '${encodeURIComponent(lesson.title)}', '${lesson.date}', '${lesson.start_time} – ${lesson.end_time}')"
                    class="w-full py-5 px-8 rounded-2xl bg-indigo-600 active:bg-indigo-700 hover:bg-indigo-700 text-white font-black text-xl sm:text-2xl shadow-xl shadow-indigo-600/30 active:scale-[0.98] transition flex items-center justify-center gap-3">
              <i data-lucide="star" class="w-7 h-7 fill-white/20"></i>
              <span>Оценить урок</span>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="space-y-6">
        <!-- Prominent Solid Date Header -->
        <div class="bg-indigo-600 text-white rounded-3xl p-6 sm:p-8 text-center shadow-lg shadow-indigo-600/20">
          <span class="text-xs sm:text-sm font-black text-indigo-200 uppercase tracking-widest block mb-1">Сегодняшняя дата</span>
          <h1 class="text-2xl sm:text-4xl font-black tracking-tight leading-snug">${todayFormatted}</h1>
        </div>

        ${actionHTML}
      </div>
    `;
  }

  // --- TEACHER VIEW (LARGE FORMAT) ---
  async getTeacherViewHTML() {
    return `
      <div class="space-y-7">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-200 pb-5">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Кабинет учителя</h1>
            <p class="text-base text-slate-500 font-medium">Управление классами, учениками и занятиями</p>
          </div>
          <div class="flex items-center gap-2 sm:gap-3">
            <button onclick="app.openModal('createLessonModal')" class="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-indigo-600 active:bg-indigo-700 text-white text-base font-black shadow-md shadow-indigo-600/20">
              + Урок
            </button>
            <button onclick="app.openModal('createStudentModal')" class="flex-1 sm:flex-initial px-5 py-3 rounded-2xl border-2 border-slate-300 hover:bg-slate-100 text-slate-800 text-base font-extrabold">
              + Ученик
            </button>
            <button onclick="app.openModal('createClassModal')" class="flex-1 sm:flex-initial px-5 py-3 rounded-2xl border-2 border-slate-300 hover:bg-slate-100 text-slate-800 text-base font-extrabold">
              + Класс
            </button>
          </div>
        </div>

        <!-- Big touch-friendly Tabs -->
        <div class="flex border-b-2 border-slate-200 text-base sm:text-lg font-black text-slate-500">
          <button onclick="app.switchTeacherTab('lessons')" id="tabBtn-lessons" class="flex-1 sm:flex-initial pb-3.5 border-b-4 border-indigo-600 text-indigo-600 px-4 text-center">
            Занятия
          </button>
          <button onclick="app.switchTeacherTab('students')" id="tabBtn-students" class="flex-1 sm:flex-initial pb-3.5 border-b-4 border-transparent hover:text-slate-800 px-4 text-center">
            Ученики
          </button>
          <button onclick="app.switchTeacherTab('classes')" id="tabBtn-classes" class="flex-1 sm:flex-initial pb-3.5 border-b-4 border-transparent hover:text-slate-800 px-4 text-center">
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
          btn.className = "flex-1 sm:flex-initial pb-3.5 border-b-4 border-indigo-600 text-indigo-600 font-black px-4 text-center";
        } else {
          btn.className = "flex-1 sm:flex-initial pb-3.5 border-b-4 border-transparent text-slate-500 hover:text-slate-800 font-bold px-4 text-center";
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
        container.innerHTML = `<div class="text-center py-20 text-slate-400 text-base font-bold">Занятий пока нет. Нажмите «+ Урок», чтобы добавить урок.</div>`;
        return;
      }
      container.innerHTML = `
        <div class="space-y-4">
          ${lessons.map(l => `
            <div class="bg-white p-5 sm:p-6 rounded-3xl border-2 border-slate-200/90 shadow-xs space-y-3">
              <div class="flex justify-between items-start gap-3">
                <div>
                  <span class="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">${l.class_name}</span>
                  <h4 class="font-black text-xl sm:text-2xl text-slate-900 mt-1.5">${l.title}</h4>
                </div>
                <div class="text-right">
                  <span class="text-xl sm:text-2xl font-black ${l.average_score ? 'text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-2xl' : 'text-slate-300'}">
                    ${l.average_score ? `${l.average_score} / 10` : '—'}
                  </span>
                </div>
              </div>
              <div class="flex justify-between items-center text-sm font-semibold text-slate-500 pt-2 border-t border-slate-100">
                <span>${l.date} • ${l.start_time}–${l.end_time}</span>
                <span>Оценок: <strong class="text-slate-900 text-base">${l.ratings_count}</strong></span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.activeTeacherTab === 'students') {
      const students = await this.apiCall('/api/teacher/students');
      if (students.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-slate-400 text-base font-bold">Учеников пока нет. Нажмите «+ Ученик», чтобы добавить ученика.</div>`;
        return;
      }
      container.innerHTML = `
        <div class="space-y-3">
          ${students.map(s => `
            <div class="bg-white p-5 rounded-3xl border-2 border-slate-200/90 shadow-xs flex justify-between items-center">
              <div>
                <h4 class="font-black text-lg sm:text-xl text-slate-900">${s.name}</h4>
                <span class="text-sm font-semibold text-slate-500">${s.class_name}</span>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold text-slate-400 block mb-0.5">Логин</span>
                <span class="font-mono text-sm sm:text-base font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">${s.username}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.activeTeacherTab === 'classes') {
      const classes = await this.apiCall('/api/teacher/classes');
      if (classes.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-slate-400 text-base font-bold">Классов пока нет. Нажмите «+ Класс», чтобы создать класс.</div>`;
        return;
      }
      container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${classes.map(c => `
            <div class="bg-white p-6 rounded-3xl border-2 border-slate-200/90 space-y-3 shadow-xs">
              <h4 class="font-black text-xl text-slate-900">${c.name}</h4>
              <p class="text-sm text-slate-500 font-medium">${c.description || 'Без описания'}</p>
              <div class="pt-3 text-sm text-slate-600 flex gap-5 font-bold border-t border-slate-100">
                <span>Учеников: <strong class="text-slate-900 text-base">${c.student_count}</strong></span>
                <span>Уроков: <strong class="text-slate-900 text-base">${c.lesson_count}</strong></span>
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
    if (window.lucide) lucide.createIcons();
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
      this.showToast("Оценка успешно сохранена!", "success");
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
    if (window.lucide) lucide.createIcons();
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
        <button onclick="app.selectCalendarDate('all')" class="whitespace-nowrap px-4 py-2 rounded-2xl text-sm font-black transition ${this.calendarDateFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border-2 border-slate-300 text-slate-800'}">
          Все дни
        </button>
      `;
      (data.dates_with_activity || []).forEach(d => {
        const isActive = this.calendarDateFilter === d.date;
        html += `
          <button onclick="app.selectCalendarDate('${d.date}')" class="whitespace-nowrap px-4 py-2 rounded-2xl text-sm font-black transition ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border-2 border-slate-300 text-slate-800'}">
            ${d.date}
          </button>
        `;
      });
      dateButtonsContainer.innerHTML = html;
    }

    const cardsContainer = document.getElementById('calendarCardsList');
    const emptyState = document.getElementById('calendarEmptyState');
    const list = data.ratings || [];

    if (list.length === 0) {
      if (cardsContainer) cardsContainer.innerHTML = '';
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      if (cardsContainer) {
        cardsContainer.innerHTML = list.map(r => `
          <div class="bg-white border-2 border-slate-200/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div class="flex justify-between items-start gap-3">
              <div>
                <span class="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">${r.class_name}</span>
                <h4 class="font-black text-slate-900 text-xl sm:text-2xl mt-1.5">${r.student_name}</h4>
                <p class="text-sm font-semibold text-slate-500">${r.lesson_title}</p>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold text-slate-400 block mb-0.5">${r.lesson_date}</span>
                <span class="text-2xl sm:text-3xl font-black text-indigo-600">${r.average_score} / 10</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 text-center pt-2 border-t-2 border-slate-100">
              <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span class="text-xs text-slate-400 font-bold block">Понятность</span>
                <span class="font-black text-lg text-slate-800 mt-0.5 block">${r.score_clarity}</span>
              </div>
              <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span class="text-xs text-slate-400 font-bold block">Интерес</span>
                <span class="font-black text-lg text-slate-800 mt-0.5 block">${r.score_engagement}</span>
              </div>
              <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span class="text-xs text-slate-400 font-bold block">Атмосфера</span>
                <span class="font-black text-lg text-slate-800 mt-0.5 block">${r.score_atmosphere}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
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
    t.className = `w-full sm:w-auto px-6 py-4 rounded-2xl text-base font-black text-white shadow-2xl flex items-center justify-center ${type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-slate-900'}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }
}

window.app = new TeacherReviewerApp();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
