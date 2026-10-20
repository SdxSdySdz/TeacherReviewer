/**
 * Teacher Reviewer Platform
 * Central Server API Engine & Interactive Class/Student Management
 */

class TeacherReviewerApp {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('tr_user') || 'null');
    this.token = localStorage.getItem('tr_token') || null;

    const now = new Date();
    this.todayStr = this.formatDateYMD(now);
    this.currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.activeTeacherTab = 'classes'; // Default to classes tab
    this.selectedClassDetail = null;   // When a class is clicked
    this.calendarDateFilter = 'all';
    this.calendarClassFilter = '';
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
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('tr_token');
        localStorage.removeItem('tr_user');
      }
    }

    this.renderHeaderNav();
    await this.renderMainView();

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // --- CENTRAL API CALL ---
  async apiCall(endpoint, options = {}) {
    options.headers = options.headers || {};
    if (this.token) {
      options.headers['Authorization'] = `Bearer ${this.token}`;
    }
    options.headers['Content-Type'] = 'application/json';

    const baseUrl = (window.location.hostname === '5-129-242-87.sslip.io') ? '' : 'https://5-129-242-87.sslip.io';
    const resp = await fetch(`${baseUrl}${endpoint}`, options);
    if (resp.ok) {
      return await resp.json();
    }
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.detail || `Ошибка: ${resp.status}`);
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
      await this.renderTeacherContent();
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
              <span class="text-xs sm:text-sm text-slate-500 font-bold block">Комфорт</span>
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
        <div class="bg-indigo-600 text-white rounded-3xl p-6 sm:p-8 text-center shadow-lg shadow-indigo-600/20">
          <span class="text-xs sm:text-sm font-black text-indigo-200 uppercase tracking-widest block mb-1">Сегодняшняя дата</span>
          <h1 class="text-2xl sm:text-4xl font-black tracking-tight leading-snug">${todayFormatted}</h1>
        </div>

        ${actionHTML}
      </div>
    `;
  }

  // --- TEACHER VIEW ---
  async getTeacherViewHTML() {
    return `
      <div class="space-y-7">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-200 pb-5">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Кабинет учителя</h1>
            <p class="text-base text-slate-500 font-medium">Классы, ученики и оценивание занятий</p>
          </div>
          <div class="flex items-center gap-2 sm:gap-3">
            <button onclick="app.openModal('createClassModal')" class="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-indigo-600 active:bg-indigo-700 text-white text-base font-black shadow-md shadow-indigo-600/20">
              + Класс
            </button>
            <button onclick="app.openModal('createStudentModal')" class="flex-1 sm:flex-initial px-5 py-3 rounded-2xl border-2 border-slate-300 hover:bg-slate-100 text-slate-800 text-base font-extrabold">
              + Ученик
            </button>
            <button onclick="app.openModal('createLessonModal')" class="flex-1 sm:flex-initial px-5 py-3 rounded-2xl border-2 border-slate-300 hover:bg-slate-100 text-slate-800 text-base font-extrabold">
              + Урок
            </button>
          </div>
        </div>

        <!-- Big touch-friendly Tabs -->
        <div class="flex border-b-2 border-slate-200 text-base sm:text-lg font-black text-slate-500">
          <button onclick="app.switchTeacherTab('classes')" id="tabBtn-classes" class="flex-1 sm:flex-initial pb-3.5 border-b-4 ${this.activeTeacherTab === 'classes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'} px-4 text-center">
            Классы
          </button>
          <button onclick="app.switchTeacherTab('lessons')" id="tabBtn-lessons" class="flex-1 sm:flex-initial pb-3.5 border-b-4 ${this.activeTeacherTab === 'lessons' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'} px-4 text-center">
            Занятия
          </button>
          <button onclick="app.switchTeacherTab('students')" id="tabBtn-students" class="flex-1 sm:flex-initial pb-3.5 border-b-4 ${this.activeTeacherTab === 'students' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'} px-4 text-center">
            Все ученики
          </button>
        </div>

        <div id="teacherTabContent"></div>
      </div>
    `;
  }

  switchTeacherTab(tab) {
    this.activeTeacherTab = tab;
    this.selectedClassDetail = null;
    ['classes', 'lessons', 'students'].forEach(t => {
      const btn = document.getElementById(`tabBtn-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = "flex-1 sm:flex-initial pb-3.5 border-b-4 border-indigo-600 text-indigo-600 font-black px-4 text-center";
        } else {
          btn.className = "flex-1 sm:flex-initial pb-3.5 border-b-4 border-transparent text-slate-500 hover:text-slate-800 font-bold px-4 text-center";
        }
      }
    });
    this.renderTeacherContent();
  }

  async renderTeacherContent() {
    const container = document.getElementById('teacherTabContent');
    if (!container) return;

    if (this.selectedClassDetail) {
      await this.renderClassDetailView(this.selectedClassDetail);
      return;
    }

    // 1. Tab: CLASSES
    if (this.activeTeacherTab === 'classes') {
      try {
        const classes = await this.apiCall('/api/teacher/classes');
        if (classes.length === 0) {
          container.innerHTML = `
            <div class="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-10 text-center space-y-4">
              <div class="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <i data-lucide="folder-plus" class="w-8 h-8"></i>
              </div>
              <h3 class="font-black text-2xl text-slate-800">Классов пока нет</h3>
              <p class="text-slate-500 font-medium">Создайте первый класс, чтобы добавлять в него учеников и уроки</p>
              <button onclick="app.openModal('createClassModal')" class="px-6 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-base shadow-md">
                + Создать класс
              </button>
            </div>
          `;
          if (window.lucide) lucide.createIcons();
          return;
        }

        container.innerHTML = `
          <div class="space-y-4">
            <p class="text-sm font-bold text-slate-400 uppercase tracking-wider">Нажмите на класс для просмотра учеников</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              ${classes.map(c => `
                <div class="bg-white hover:bg-slate-50/80 active:scale-[0.99] border-2 border-slate-200/90 rounded-3xl p-6 transition shadow-xs flex flex-col justify-between space-y-4 group">
                  <div class="cursor-pointer" onclick="app.openClassDetail(${c.id}, '${encodeURIComponent(c.name)}')">
                    <div class="flex justify-between items-start gap-2">
                      <h4 class="font-black text-2xl text-slate-900 group-hover:text-indigo-600 transition">${c.name}</h4>
                      <div class="flex items-center gap-1.5">
                        <button onclick="event.stopPropagation(); app.deleteClass(${c.id}, '${encodeURIComponent(c.name)}')"
                                title="Удалить класс"
                                class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 flex items-center justify-center transition">
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                        <span class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                          <i data-lucide="chevron-right" class="w-5 h-5"></i>
                        </span>
                      </div>
                    </div>
                    <p class="text-sm text-slate-500 font-medium mt-1">${c.description || 'Без описания'}</p>
                  </div>

                  <div class="pt-3 border-t-2 border-slate-100 flex items-center justify-between">
                    <div class="flex gap-4 text-sm font-extrabold text-slate-700">
                      <span class="inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl">
                        <i data-lucide="users" class="w-4 h-4"></i>
                        Учеников: <strong>${c.student_count}</strong>
                      </span>
                      <span class="inline-flex items-center gap-1.5 text-slate-600 py-1">
                        <i data-lucide="book-open" class="w-4 h-4"></i>
                        Уроков: <strong>${c.lesson_count}</strong>
                      </span>
                    </div>

                    <button onclick="event.stopPropagation(); app.openModal('createStudentModal', ${c.id})"
                            class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold text-xs transition">
                      + Ученик
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<div class="text-rose-600 font-bold text-center py-10">${err.message}</div>`;
      }
    }

    // 2. Tab: LESSONS
    else if (this.activeTeacherTab === 'lessons') {
      try {
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
      } catch (err) {
        container.innerHTML = `<div class="text-rose-600 font-bold text-center py-10">${err.message}</div>`;
      }
    }

    // 3. Tab: ALL STUDENTS
    else if (this.activeTeacherTab === 'students') {
      try {
        const students = await this.apiCall('/api/teacher/students');
        if (students.length === 0) {
          container.innerHTML = `<div class="text-center py-20 text-slate-400 text-base font-bold">Учеников пока нет. Нажмите «+ Ученик», чтобы добавить ученика.</div>`;
          return;
        }
        container.innerHTML = `
          <div class="space-y-3">
            ${students.map(s => `
              <div class="bg-white p-5 rounded-3xl border-2 border-slate-200/90 shadow-xs flex justify-between items-center gap-3">
                <div>
                  <h4 class="font-black text-lg sm:text-xl text-slate-900">${s.name}</h4>
                  <span class="text-sm font-semibold text-slate-500">${s.class_name}</span>
                  <span class="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg ml-2">${s.username}</span>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick="app.openEditStudentModal(${s.id}, '${encodeURIComponent(s.name)}', '${encodeURIComponent(s.username)}', ${s.class_id})"
                          title="Редактировать ученика"
                          class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold transition flex items-center gap-1.5">
                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    <span>Изменить</span>
                  </button>
                  <button onclick="app.deleteStudent(${s.id}, '${encodeURIComponent(s.name)}')"
                          title="Удалить ученика"
                          class="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<div class="text-rose-600 font-bold text-center py-10">${err.message}</div>`;
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  // --- CLASS DETAIL VIEW ---
  async openClassDetail(classId, encodedName) {
    const className = decodeURIComponent(encodedName);
    this.selectedClassDetail = { id: classId, name: className };
    await this.renderTeacherContent();
  }

  backToClasses() {
    this.selectedClassDetail = null;
    this.renderTeacherContent();
  }

  async renderClassDetailView(cls) {
    const container = document.getElementById('teacherTabContent');
    if (!container) return;

    try {
      const students = await this.apiCall(`/api/teacher/students?class_id=${cls.id}`);

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Back button & Actions -->
          <div class="flex items-center justify-between gap-2">
            <button onclick="app.backToClasses()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2 transition">
              <i data-lucide="arrow-left" class="w-4 h-4"></i>
              <span>Все классы</span>
            </button>
            <div class="flex items-center gap-2">
              <button onclick="app.openModal('createStudentModal', ${cls.id})" class="px-4 py-2 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-sm flex items-center gap-2 shadow-sm">
                <i data-lucide="user-plus" class="w-4 h-4"></i>
                <span>+ Добавить ученика</span>
              </button>
              <button onclick="app.deleteClass(${cls.id}, '${encodeURIComponent(cls.name)}')" title="Удалить класс" class="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm flex items-center gap-1.5 transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
                <span class="hidden sm:inline">Удалить класс</span>
              </button>
            </div>
          </div>

          <div class="bg-indigo-50/70 border-2 border-indigo-100 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span class="text-xs font-black text-indigo-600 uppercase tracking-widest block mb-1">Выбранный класс</span>
              <h2 class="text-3xl font-black text-slate-900">${cls.name}</h2>
            </div>
            <div class="bg-white px-4 py-2.5 rounded-2xl border border-indigo-100 shadow-xs self-start sm:self-auto">
              <span class="text-xs text-slate-400 font-bold block">Учеников в классе</span>
              <span class="text-2xl font-black text-indigo-700">${students.length}</span>
            </div>
          </div>

          <!-- Students List -->
          <div>
            <h3 class="text-lg font-black text-slate-900 mb-3">Список учеников класса</h3>
            ${students.length === 0 ? `
              <div class="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-3">
                <i data-lucide="users" class="w-10 h-10 mx-auto text-slate-300"></i>
                <p class="text-slate-500 font-bold">В этом классе пока нет учеников</p>
                <button onclick="app.openModal('createStudentModal', ${cls.id})" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm">
                  + Добавить первого ученика
                </button>
              </div>
            ` : `
              <div class="space-y-3">
                ${students.map(s => `
                  <div class="bg-white border-2 border-slate-200/90 rounded-2xl p-4 sm:p-5 flex justify-between items-center gap-3 shadow-xs">
                    <div>
                      <h4 class="font-black text-lg text-slate-900">${s.name}</h4>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs text-slate-400">Логин:</span>
                        <span class="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">${s.username}</span>
                        <span class="text-xs text-slate-400 ml-2">Оценок: <strong>${s.ratings_count || 0}</strong></span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <button onclick="app.openEditStudentModal(${s.id}, '${encodeURIComponent(s.name)}', '${encodeURIComponent(s.username)}', ${s.class_id})"
                              title="Редактировать"
                              class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-bold transition flex items-center gap-1">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        <span class="hidden sm:inline">Изменить</span>
                      </button>
                      <button onclick="app.deleteStudent(${s.id}, '${encodeURIComponent(s.name)}')"
                              title="Удалить"
                              class="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="text-rose-600 font-bold text-center py-10">${err.message}</div>`;
    }

    if (window.lucide) lucide.createIcons();
  }

  // --- DELETE CLASS ---
  async deleteClass(classId, encodedName) {
    const className = decodeURIComponent(encodedName);
    const ok = confirm(`Вы действительно хотите удалить класс «${className}»?\nВсе ученики этого класса и их оценки будут безвозвратно удалены.`);
    if (!ok) return;

    try {
      await this.apiCall(`/api/teacher/classes/${classId}`, { method: 'DELETE' });
      this.showToast(`Класс «${className}» удалён`, "success");
      if (this.selectedClassDetail?.id === classId) {
        this.selectedClassDetail = null;
      }
      await this.renderTeacherContent();
    } catch (err) {
      this.showToast(err.message || "Ошибка удаления класса", "error");
    }
  }

  // --- DELETE STUDENT ---
  async deleteStudent(studentId, encodedName) {
    const studentName = decodeURIComponent(encodedName);
    const ok = confirm(`Удалить ученика ${studentName}?`);
    if (!ok) return;

    try {
      await this.apiCall(`/api/teacher/students/${studentId}`, { method: 'DELETE' });
      this.showToast(`Ученик ${studentName} удалён`, "success");
      await this.renderTeacherContent();
    } catch (err) {
      this.showToast(err.message || "Ошибка удаления ученика", "error");
    }
  }

  // --- EDIT STUDENT ---
  async openEditStudentModal(studentId, encodedName, encodedUsername, classId) {
    const name = decodeURIComponent(encodedName);
    const username = decodeURIComponent(encodedUsername);

    document.getElementById('editStudentId').value = studentId;
    document.getElementById('editStudentName').value = name;
    document.getElementById('editStudentUsername').value = username;
    document.getElementById('editStudentPassword').value = '';

    const select = document.getElementById('editStudentClassId');
    if (select) {
      select.innerHTML = '<option value="" disabled selected>Загрузка...</option>';
      try {
        const classes = await this.apiCall('/api/teacher/classes');
        select.innerHTML = classes.map(c => `
          <option value="${c.id}" ${c.id === Number(classId) ? 'selected' : ''}>${c.name}</option>
        `).join('');
      } catch (e) {
        select.innerHTML = '<option value="" disabled selected>Ошибка загрузки классов</option>';
      }
    }

    const modal = document.getElementById('editStudentModal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  async handleUpdateStudent(e) {
    e.preventDefault();
    const studentId = parseInt(document.getElementById('editStudentId').value);
    const classId = parseInt(document.getElementById('editStudentClassId').value);
    const name = document.getElementById('editStudentName').value.trim();
    const username = document.getElementById('editStudentUsername').value.trim();
    const password = document.getElementById('editStudentPassword').value.trim();

    const payload = {
      name,
      username,
      class_id: classId
    };
    if (password) {
      payload.password = password;
    }

    try {
      await this.apiCall(`/api/teacher/students/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      this.closeModal('editStudentModal');
      this.showToast("Данные ученика успешно обновлены!", "success");
      await this.renderTeacherContent();
    } catch (err) {
      this.showToast(err.message || "Ошибка обновления ученика", "error");
    }
  }

  // --- RATING MODAL ---
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
      const classes = await this.apiCall('/api/classes');
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
                <span class="text-xs text-slate-400 font-bold block">Комфорт</span>
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

  // --- ASYNC MODAL OPENER ---
  async openModal(id, preselectedClassId = null) {
    if (id === 'createStudentModal' || id === 'createLessonModal') {
      const selectId = id === 'createStudentModal' ? 'newStudentClassId' : 'newLessonClassId';
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = '<option value="" disabled selected>Загрузка классов...</option>';
        try {
          const classes = await this.apiCall('/api/teacher/classes');
          if (classes.length === 0) {
            select.innerHTML = '<option value="" disabled selected>Сначала создайте хотя бы один класс</option>';
          } else {
            select.innerHTML = classes.map(c => `
              <option value="${c.id}" ${preselectedClassId && Number(preselectedClassId) === c.id ? 'selected' : ''}>
                ${c.name}
              </option>
            `).join('');

            if (preselectedClassId) {
              select.value = String(preselectedClassId);
            }
          }
        } catch (err) {
          select.innerHTML = '<option value="" disabled selected>Ошибка загрузки классов</option>';
        }
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
    const name = document.getElementById('newClassName').value.trim();
    const desc = document.getElementById('newClassDesc').value.trim();
    try {
      await this.apiCall('/api/teacher/classes', {
        method: 'POST',
        body: JSON.stringify({ name, description: desc })
      });
      this.closeModal('createClassModal');
      document.getElementById('newClassName').value = '';
      document.getElementById('newClassDesc').value = '';
      this.showToast(`Класс «${name}» успешно создан!`, "success");
      await this.renderTeacherContent();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async handleCreateStudent(e) {
    e.preventDefault();
    const classSelect = document.getElementById('newStudentClassId');
    const classId = parseInt(classSelect.value);
    if (!classId) {
      this.showToast("Пожалуйста, выберите класс", "error");
      return;
    }
    const name = document.getElementById('newStudentName').value.trim();
    const username = document.getElementById('newStudentUsername').value.trim();
    const password = document.getElementById('newStudentPassword').value.trim();

    try {
      await this.apiCall('/api/teacher/students', {
        method: 'POST',
        body: JSON.stringify({ class_id: classId, name, username, password })
      });
      this.closeModal('createStudentModal');
      document.getElementById('newStudentName').value = '';
      document.getElementById('newStudentUsername').value = '';
      this.showToast(`Ученик ${name} успешно добавлен!`, "success");
      await this.renderTeacherContent();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async handleCreateLesson(e) {
    e.preventDefault();
    const classSelect = document.getElementById('newLessonClassId');
    const classId = parseInt(classSelect.value);
    if (!classId) {
      this.showToast("Пожалуйста, выберите класс", "error");
      return;
    }
    const title = document.getElementById('newLessonTitle').value.trim();
    const date = document.getElementById('newLessonDate').value;
    const start = document.getElementById('newLessonStartTime').value;
    const end = document.getElementById('newLessonEndTime').value;

    try {
      await this.apiCall('/api/teacher/lessons', {
        method: 'POST',
        body: JSON.stringify({ class_id: classId, title, date, start_time: start, end_time: end })
      });
      this.closeModal('createLessonModal');
      document.getElementById('newLessonTitle').value = '';
      this.showToast(`Урок «${title}» создан!`, "success");
      await this.renderTeacherContent();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  // --- AUTH ACTIONS ---
  async handleLoginFormSubmit(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
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
    this.selectedClassDetail = null;
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
