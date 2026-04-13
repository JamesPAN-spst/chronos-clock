// ═══════════════════════════════════════════════════
//  排程引擎 — 根据课表空闲时段动态分配学习任务
// ═══════════════════════════════════════════════════

const Scheduler = {

  // ─── 进度管理（localStorage）───
  STORAGE_KEY: 'clock_progress',

  getProgress() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
    } catch { return {}; }
  },

  saveProgress(progress) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
  },

  /**
   * 标记章节完成
   * @param {string} courseId  e.g. 'cpp'
   * @param {number} unitIdx
   * @param {number} chapterIdx
   */
  markDone(courseId, unitIdx, chapterIdx) {
    const p = this.getProgress();
    const key = `${courseId}_${unitIdx}_${chapterIdx}`;
    p[key] = { done: true, date: new Date().toISOString() };
    this.saveProgress(p);
  },

  isDone(courseId, unitIdx, chapterIdx) {
    const p = this.getProgress();
    return !!p[`${courseId}_${unitIdx}_${chapterIdx}`];
  },

  /**
   * 标记复习完成
   */
  markReviewDone(courseId, unitIdx) {
    const p = this.getProgress();
    p[`review_${courseId}_${unitIdx}`] = { done: true, date: new Date().toISOString() };
    this.saveProgress(p);
  },

  isReviewDone(courseId, unitIdx) {
    const p = this.getProgress();
    return !!p[`review_${courseId}_${unitIdx}`];
  },

  // ─── 获取下一个待学习章节 ───

  /**
   * 获取某门课接下来要学的章节列表
   * @param {Object} course  CONFIG.mainCourses 中的一项
   * @returns {Array<{courseId, unitIdx, chapterIdx, title, url, type:'learn'|'review'}>}
   */
  getNextChapters(course) {
    const queue = [];

    for (let ui = 0; ui < course.units.length; ui++) {
      const unit = course.units[ui];
      let allDone = true;

      for (let ci = 0; ci < unit.chapters.length; ci++) {
        if (!this.isDone(course.id, ui, ci)) {
          allDone = false;
          queue.push({
            courseId: course.id,
            courseName: course.name,
            courseColor: course.color,
            courseIcon: course.icon,
            unitIdx: ui,
            chapterIdx: ci,
            unitTitle: unit.title,
            title: unit.chapters[ci].title,
            url: unit.chapters[ci].url,
            type: 'learn'
          });
        }
      }

      // 单元全部完成 → 插入复习（单章节单元跳过）
      if (allDone && unit.chapters.length > 1 && !this.isReviewDone(course.id, ui)) {
        queue.push({
          courseId: course.id,
          courseName: course.name,
          courseColor: course.color,
          courseIcon: course.icon,
          unitIdx: ui,
          chapterIdx: -1,
          unitTitle: unit.title,
          title: `复习: ${unit.title}`,
          url: course.baseURL,
          type: 'review'
        });
      }
    }

    return queue;
  },

  // ─── 空闲时段计算 ───

  /**
   * 计算一天中的空闲学习时段
   * @param {Array} classEvents  当天的课程事件
   * @param {Date} date
   * @returns {Array<{start:Date, end:Date, minutes:number}>}
   */
  findFreeSlots(classEvents, date) {
    const [startH, startM] = CONFIG.dayStart.split(':').map(Number);
    const [endH, endM] = CONFIG.dayEnd.split(':').map(Number);
    const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();

    const dayStart = new Date(y, mo, d, startH, startM);
    const dayEnd   = new Date(y, mo, d, endH, endM);

    // 固定保留时段：午餐 12:00-13:15、晚餐 18:30-19:30
    const blocked = [
      { start: new Date(y, mo, d, 12, 0),  end: new Date(y, mo, d, 13, 15) },
      { start: new Date(y, mo, d, 18, 30), end: new Date(y, mo, d, 19, 30) },
    ];

    // 课前/课后预留 60 分钟路程缓冲
    const travelMin = 60;
    const expanded = classEvents.map(ev => ({
      start: new Date(ev.start.getTime() - travelMin * 60000),
      end:   new Date(ev.end.getTime()   + travelMin * 60000),
      summary: ev.summary
    }));

    // 合并所有占用时段（课程+缓冲 & 用餐）
    const occupied = [...expanded, ...blocked].sort((a, b) => a.start - b.start);

    const slots = [];
    let cursor = dayStart;

    for (const ev of occupied) {
      const evStart = ev.start < dayStart ? dayStart : ev.start;
      const evEnd   = ev.end > dayEnd ? dayEnd : ev.end;

      if (cursor < evStart) {
        const gap = (evStart - cursor) / 60000;
        if (gap >= CONFIG.minSlotMinutes) {
          slots.push({ start: new Date(cursor), end: new Date(evStart), minutes: gap });
        }
      }
      if (evEnd > cursor) {
        cursor = new Date(evEnd);
      }
    }

    // 最后一个占用后到 dayEnd
    if (cursor < dayEnd) {
      const gap = (dayEnd - cursor) / 60000;
      if (gap >= CONFIG.minSlotMinutes) {
        slots.push({ start: new Date(cursor), end: dayEnd, minutes: gap });
      }
    }

    return slots;
  },

  /**
   * 将空闲时段切分为 40 分钟学习块
   */
  slotToSessions(slot) {
    const sessions = [];
    let cursor = new Date(slot.start);
    const totalMin = CONFIG.sessionMinutes + CONFIG.bufferMinutes;

    while ((slot.end - cursor) / 60000 >= CONFIG.sessionMinutes) {
      const sessionEnd = new Date(cursor.getTime() + CONFIG.sessionMinutes * 60000);
      sessions.push({
        start: new Date(cursor),
        end: sessionEnd
      });
      cursor = new Date(cursor.getTime() + totalMin * 60000);
    }

    return sessions;
  },

  // ─── 课程亲和度映射 ───

  /**
   * 根据课程事件名称推断对应的自学课程 ID
   * @param {string} summary  iCal 事件标题
   * @returns {string|null}  匹配的课程 ID 或 null
   */
  classAffinityCourse(summary) {
    if (!summary) return null;
    const s = summary.toLowerCase();
    // MC2 / Maths et Calcul → 数学全景
    if (s.includes('mc2') || s.includes('maths et calcul') || s.includes('calcul')) return 'math';
    // Numeration / Logique → 计算机结构（数字逻辑相关）
    if (s.includes('numeration') || s.includes('logique') || s.includes('architecture')) return 'arch';
    // C++ / Programmation → C++ 全栈
    if (s.includes('c++') || s.includes('programmation') || s.includes('coding')) return 'cpp';
    return null;
  },

  // ─── 每日规划引擎 ───

  /**
   * 为指定日期生成完整学习计划
   * @param {Date} date
   * @param {Array} classEvents  iCal 解析出的当天课程
   * @returns {Object} { schedule: Array, stats: Object }
   */
  planDay(date, classEvents) {
    const dow = date.getDay(); // 0=Sun, 5=Fri

    // 周五留给用户
    if (CONFIG.freeDays.includes(dow)) {
      return {
        schedule: [],
        stats: { freeDay: true, reason: '周五自由日 — 好好放松' },
        classEvents
      };
    }

    // 找到空闲时段
    const freeSlots = this.findFreeSlots(classEvents, date);

    // 将空闲时段切成学习块，并标记每个块前面刚上完的课程
    const sortedEvents = [...classEvents].sort((a, b) => a.start - b.start);
    let allSessions = [];
    for (const slot of freeSlots) {
      const blockSessions = this.slotToSessions(slot);

      // 找出此空闲时段前刚结束的课程（亲和度标记，含路程缓冲）
      let precedingClass = null;
      for (const ev of sortedEvents) {
        if (ev.end <= slot.start && (slot.start - ev.end) / 60000 <= 75) {
          precedingClass = ev.summary;
        }
      }
      const affinity = this.classAffinityCourse(precedingClass);

      for (const s of blockSessions) {
        s.affinity = affinity; // 可能为 null
        allSessions.push(s);
      }
    }

    // 获取待学队列
    const queues = {};
    let totalRemaining = 0;

    // 判断是否考试周
    const examMode = this.isExamWeek(date);

    if (examMode && CONFIG.examCourses?.length) {
      // 考试周：使用复习课程，每门课生成一个可重复的复习任务
      for (const ec of CONFIG.examCourses) {
        queues[ec.id] = [{
          courseId: ec.id,
          courseName: ec.name,
          courseColor: ec.color,
          courseIcon: ec.icon,
          unitIdx: 0,
          chapterIdx: 0,
          unitTitle: ec.name,
          title: ec.name,
          url: ec.url,
          type: 'review'
        }];
        totalRemaining++;
      }
    } else {
      for (const course of CONFIG.mainCourses) {
        queues[course.id] = this.getNextChapters(course);
        totalRemaining += queues[course.id].length;
      }
    }

    // 基础轮转顺序
    const courseOrder = examMode
      ? CONFIG.examCourses.map(c => c.id)
      : ['cpp', 'math', 'arch'];

    // ── 简化排程：每门课每天最多 1 块，课多少排 ──
    // 课程数决定学习块数：0-2 课 → 3 块，3-4 课 → 2 块，5+ 课 → 1 块
    // 考试模式统一 3 块
    const classCount = classEvents.length;
    let maxBlocks;
    if (examMode) {
      maxBlocks = 3;
    } else if (classCount >= 5) {
      maxBlocks = 1;
    } else if (classCount >= 3) {
      maxBlocks = 2;
    } else {
      maxBlocks = 3;
    }
    maxBlocks = Math.min(maxBlocks, allSessions.length, courseOrder.length);

    // 选出今天要安排的课程（最多 maxBlocks 门，每门 1 块）
    // 优先选有亲和度的课程（今天上了这门课），其余按轮转补齐
    const affinityCourses = new Set();
    for (const s of allSessions) {
      if (s.affinity && queues[s.affinity]?.length > 0) {
        affinityCourses.add(s.affinity);
      }
    }

    // 用"日序号"做轮转偏移，让每天起始课程不同
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const rotateOffset = dayOfYear % courseOrder.length;

    const pickedCourses = [];
    // 先放亲和课
    for (const cid of affinityCourses) {
      if (pickedCourses.length >= maxBlocks) break;
      if (queues[cid]?.length > 0) pickedCourses.push(cid);
    }
    // 再按轮转补齐
    for (let i = 0; i < courseOrder.length && pickedCourses.length < maxBlocks; i++) {
      const cid = courseOrder[(rotateOffset + i) % courseOrder.length];
      if (!pickedCourses.includes(cid) && queues[cid]?.length > 0) {
        pickedCourses.push(cid);
      }
    }

    // 选时间块：优先晚间（18:00+），然后按时间顺序
    const sortedByPriority = [...allSessions].sort((a, b) => {
      const aEvening = a.start.getHours() >= 18 ? 0 : 1;
      const bEvening = b.start.getHours() >= 18 ? 0 : 1;
      return aEvening - bEvening || a.start - b.start;
    });
    const selectedSessions = sortedByPriority.slice(0, pickedCourses.length)
      .sort((a, b) => a.start - b.start);

    // 一一对应分配
    const schedule = [];
    for (let i = 0; i < selectedSessions.length; i++) {
      const session = selectedSessions[i];
      const cid = pickedCourses[i];
      const assigned = queues[cid]?.shift();
      if (assigned) {
        schedule.push({
          ...assigned,
          timeStart: session.start,
          timeEnd: session.end
        });
      }
    }

    return {
      schedule,
      classEvents,
      freeSlots,
      stats: {
        totalSlots: allSessions.length,
        assigned: schedule.length,
        totalRemaining,
        examMode
      }
    };
  },

  /**
   * 考试周管理（localStorage 存 exam_week_until ISO 日期）
   */
  EXAM_KEY: 'exam_week_until',

  isExamWeek(date) {
    const until = localStorage.getItem(this.EXAM_KEY);
    if (!until) return false;
    const untilDate = new Date(until);
    return date <= untilDate;
  },

  /**
   * 设置考试周（从现在到下下周一 00:00）
   */
  setExamWeek() {
    const now = new Date();
    // 找到下下周一
    const dow = now.getDay(); // 0=Sun
    const daysUntilNextMonday = dow === 0 ? 1 : (8 - dow);
    const nextNextMonday = new Date(now);
    nextNextMonday.setDate(now.getDate() + daysUntilNextMonday + 7);
    nextNextMonday.setHours(0, 0, 0, 0);
    localStorage.setItem(this.EXAM_KEY, nextNextMonday.toISOString());
    return nextNextMonday;
  },

  clearExamWeek() {
    localStorage.removeItem(this.EXAM_KEY);
  },

  getExamWeekUntil() {
    const until = localStorage.getItem(this.EXAM_KEY);
    return until ? new Date(until) : null;
  },

  /**
   * 考试模式下的课程顺序：优先安排有更多复习任务的课
   */
  getExamCourseOrder(queues) {
    const counts = Object.entries(queues).map(([id, q]) => ({
      id,
      reviews: q.filter(x => x.type === 'review').length
    }));
    counts.sort((a, b) => b.reviews - a.reviews);
    return counts.map(c => c.id);
  },

  // ─── 本周概览 ───

  /**
   * 获取本周完成统计
   */
  getWeeklyStats() {
    const p = this.getProgress();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    let learned = 0;
    let reviewed = 0;

    for (const [key, val] of Object.entries(p)) {
      if (!val.done || !val.date) continue;
      const d = new Date(val.date);
      if (d >= weekStart) {
        if (key.startsWith('review_')) reviewed++;
        else learned++;
      }
    }

    return { learned, reviewed, weekStart };
  },

  /**
   * 获取各课程总进度
   */
  getCourseProgress() {
    const result = [];
    for (const course of CONFIG.mainCourses) {
      let total = 0;
      let done = 0;
      for (let ui = 0; ui < course.units.length; ui++) {
        for (let ci = 0; ci < course.units[ui].chapters.length; ci++) {
          total++;
          if (this.isDone(course.id, ui, ci)) done++;
        }
      }
      result.push({
        id: course.id,
        name: course.name,
        icon: course.icon,
        color: course.color,
        total,
        done,
        percent: total > 0 ? Math.round((done / total) * 100) : 0
      });
    }
    return result;
  },

  /**
   * 重置所有进度
   */
  resetProgress() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};
