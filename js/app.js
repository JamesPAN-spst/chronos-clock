// ═══════════════════════════════════════════════════
//  Chronos · StudyClock — 主应用逻辑
//  自适应主题 · 呼吸卡片 · 聚焦模式 · FAB裂殖 · 计时 · 同步
// ═══════════════════════════════════════════════════

const App = {
  currentDate: new Date(),
  allEvents: [],
  EVENTS_KEY: 'clock_ical_events',
  ICAL_URL_KEY: 'clock_ical_url',

  todayDrawer: [],
  todayTrash: [],

  // 新增状态
  fabExpanded: false,
  focusedEl: null,
  timerState: { running: false, remaining: 25 * 60, interval: null, preset: 25, taskKey: null },
  alarmTime: null,
  alarmInterval: null,
  alarmTaskKey: null,
  _notifiedTasks: new Set(),  // 已提醒过的任务（避免重复）

  // ─── 初始化 ───
  async init() {
    this.applyTheme();
    this.bindEvents();
    this.bindVerticalSwipe();
    this.loadSavedICal();
    this.loadSyncConfig();
    this.updateExamUI();
    this.render();
    this.registerSW();
    this.startThemeWatcher();
    this.startTaskReminder();
    setTimeout(() => this.pushMessage('Chronos 已就绪', '●'), 600);
    window.addEventListener('beforeunload', () => this.autoSync());
  },

  // ═══════════════════════════════════════════
  //  自适应主题（白天明亮 / 夜间暗黑）
  // ═══════════════════════════════════════════

  applyTheme() {
    const hour = new Date().getHours();
    const isLight = hour >= 7 && hour < 19;
    document.body.classList.toggle('light-theme', isLight);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isLight ? '#f5f5f7' : '#09090b';
  },

  startThemeWatcher() {
    setInterval(() => this.applyTheme(), 60000);
  },

  // ═══════════════════════════════════════════
  //  事务到时提醒
  // ═══════════════════════════════════════════

  startTaskReminder() {
    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // 每 60 秒检查一次
    setInterval(() => this.checkTaskReminders(), 60000);
    // 启动时也立即检查一次
    setTimeout(() => this.checkTaskReminders(), 2000);
  },

  checkTaskReminders() {
    const now = new Date();
    if (!this.isSameDay(this.currentDate, now)) return;

    // 收集今日所有事务（iCal 课程 + 学习任务）
    const icalEvents = ICalParser.getEventsForDate(this.allEvents, now);
    const memEvents = MemorySchedule.getEventsForDate(now);
    const todayEvents = [...icalEvents, ...memEvents];
    const plan = Scheduler.planDay(now, todayEvents);

    const items = [];

    // iCal 课程事件
    for (const ev of todayEvents) {
      items.push({
        key: `class_${ev.start.getTime()}`,
        name: ev.summary || '课程',
        start: ev.start
      });
    }

    // 学习任务
    for (const task of plan.schedule) {
      const skipKey = `${task.courseId}_${task.unitIdx}_${task.chapterIdx}`;
      if (this.todayTrash.some(t => t.key === skipKey)) continue;
      items.push({
        key: `study_${skipKey}_${task.timeStart.getTime()}`,
        name: `${task.courseName} · ${task.title}`,
        start: task.timeStart
      });
    }

    // ─── 第一节课提前 1.5 小时闹钟 ───
    const classEvents = todayEvents.filter(ev => ev.start > now).sort((a, b) => a.start - b.start);
    if (classEvents.length > 0) {
      const first = classEvents[0];
      const alarmKey = `firstclass_alarm_${first.start.getTime()}`;
      if (!this._notifiedTasks.has(alarmKey)) {
        const ALARM_LEAD = 90 * 60 * 1000; // 1.5 小时
        const diff = first.start.getTime() - now.getTime();
        // 在 1.5h 前到 1h25min 前这个窗口触发
        if (diff <= ALARM_LEAD && diff > ALARM_LEAD - 5 * 60 * 1000) {
          this._notifiedTasks.add(alarmKey);
          const timeStr = this.formatTime(first.start);
          const mins = Math.round(diff / 60000);
          this.fireTaskReminder({
            key: alarmKey,
            name: `${first.summary || '课程'}`,
            start: first.start
          }, timeStr, `${mins}分钟后`);
        }
      }
    }

    const LEAD_MS = 10 * 60 * 1000; // 提前 10 分钟提醒

    for (const item of items) {
      if (this._notifiedTasks.has(item.key)) continue;
      const diff = item.start.getTime() - now.getTime();
      // 在开始前 10 分钟到开始后 1 分钟这个窗口内提醒
      if (diff <= LEAD_MS && diff > -60000) {
        this._notifiedTasks.add(item.key);
        const timeStr = this.formatTime(item.start);
        const mins = Math.round(diff / 60000);
        const label = mins > 0 ? `${mins}分钟后` : '现在';
        this.fireTaskReminder(item, timeStr, label);
      }
    }
  },

  fireTaskReminder(item, timeStr, label) {
    const taskName = item.name;

    // 查找对应卡片
    let card = null;
    if (item.key.startsWith('class_')) {
      card = document.querySelector(`.class-card[data-start-time="${item.start.getTime()}"]`);
    } else {
      const studyKey = item.key.replace(/^study_/, '').replace(/_\d+$/, '');
      card = document.querySelector(`.task-card[data-task-key="${studyKey}"]`);
    }

    // 卡片脉冲动画 + 滚动到视野
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.remove('card-ongoing');
      void card.offsetWidth;
      card.classList.add('card-remind');
      card.addEventListener('animationend', () => {
        card.classList.remove('card-remind');
        // 脉冲结束后，如果事件仍在进行中则保持边缘发光
        const endTime = card.dataset.endTime || card.dataset.timeEnd;
        if (endTime) {
          const endMs = Number(endTime) || 0;
          if (endMs > Date.now() || !endMs) card.classList.add('card-ongoing');
        } else {
          card.classList.add('card-ongoing');
        }
      }, { once: true });
    }

    // 播放提示音
    this.playReminderChime();

    // 浏览器原生通知（后台标签页时有用）
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Chronos · 事务提醒', {
        body: `${label} · ${timeStr}  ${taskName}`,
        icon: 'icons/icon-192.png',
        tag: 'chronos-reminder',
        renotify: true
      });
    }
  },

  playReminderChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 三和弦
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.6);
      });
    } catch(e) { /* 静音降级 */ }
  },

  // ═══════════════════════════════════════════
  //  事件绑定
  // ═══════════════════════════════════════════

  bindEvents() {
    const $ = id => document.getElementById(id);

    // FAB 裂殖菜单
    $('fabMain').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFab();
    });
    document.querySelectorAll('.fab-child').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        this.closeFab();
        switch (action) {
          case 'schedule': this.openMemory(); break;
          case 'settings': this.openSettings(); break;
          case 'sync':     this.doSyncNow(); break;
          case 'appearance': this.openAppearance(); break;
          case 'exam':     this.toggleExamWeek(); break;
        }
      });
    });
    document.addEventListener('click', (e) => {
      if (this.fabExpanded && !e.target.closest('.fab-group')) this.closeFab();
    });

    // 设置面板
    $('btnCloseSettings').addEventListener('click', () => $('settingsPanel').classList.add('hidden'));
    $('settingsPanel').addEventListener('click', e => {
      if (e.target === $('settingsPanel')) $('settingsPanel').classList.add('hidden');
    });
    $('btnRefreshICal').addEventListener('click', () => this.refreshICal());
    $('btnParseICal').addEventListener('click', () => this.parseICalText());
    $('btnResetProgress').addEventListener('click', () => {
      if (confirm('确定重置所有学习进度？此操作不可撤销。')) {
        Scheduler.resetProgress();
        this.render();
      }
    });

    // 同步按钮
    $('btnSyncNow').addEventListener('click', () => this.doSyncNow());
    $('btnSyncClean').addEventListener('click', () => this.doSyncClean());

    // 外观面板
    $('btnCloseAppearance').addEventListener('click', () => $('appearancePanel').classList.add('hidden'));
    $('appearancePanel').addEventListener('click', e => {
      if (e.target === $('appearancePanel')) $('appearancePanel').classList.add('hidden');
    });
    $('btnApplyAppearance').addEventListener('click', () => this.saveAppearance());
    $('btnResetAppearance').addEventListener('click', () => this.resetAppearance());

    // 外观滑块实时预览
    $('apFontSize').addEventListener('input', () => {
      const v = $('apFontSize').value;
      $('apFontSizeVal').textContent = v + 'px';
      document.documentElement.style.fontSize = v + 'px';
    });
    $('apCardAlpha').addEventListener('input', () => {
      const v = $('apCardAlpha').value;
      $('apCardAlphaVal').textContent = v + '%';
      this._previewCardStyle();
    });
    $('apClrCard').addEventListener('input', () => this._previewCardStyle());
    // 颜色选择器实时预览
    document.querySelectorAll('#appearancePanel .appear-color[data-var]').forEach(el => {
      el.addEventListener('input', () => {
        const varName = el.dataset.var;
        if (varName) document.body.style.setProperty(varName, el.value);
      });
    });

    // 加载已保存的外观设置
    this.loadAppearance();

    // 日期导航 — 自定义日历选择器
    $('btnToday').addEventListener('click', () => { this.currentDate = new Date(); this.render(); this.closeCustomDatePicker(); });
    $('btnDatePicker').addEventListener('click', () => this.toggleCustomDatePicker());
    // 点击外部关闭日历
    document.addEventListener('click', (e) => {
      const dp = $('customDatePicker');
      if (!dp.classList.contains('hidden') && !e.target.closest('.date-nav')) {
        dp.classList.add('hidden');
      }
    });
    $('cdpPrevMonth').addEventListener('click', (e) => { e.stopPropagation(); this._cdpMonth--; if (this._cdpMonth < 0) { this._cdpMonth = 11; this._cdpYear--; } this.renderCustomDatePicker(); });
    $('cdpNextMonth').addEventListener('click', (e) => { e.stopPropagation(); this._cdpMonth++; if (this._cdpMonth > 11) { this._cdpMonth = 0; this._cdpYear++; } this.renderCustomDatePicker(); });

    // 日历内考试周复选框
    $('cdpExamCheck').addEventListener('change', (e) => {
      e.stopPropagation();
      if (e.target.checked) {
        Scheduler.setExamWeek();
        this.pushMessage('已开启考试周模式', '📚');
      } else {
        Scheduler.clearExamWeek();
        this.pushMessage('已关闭考试周模式', '✔');
      }
      this.updateExamUI();
      this.render();
    });

    // 底部胶囊栏
    $('btnDrawer').addEventListener('click', () => this.openDrawer());
    $('btnTrash').addEventListener('click', () => this.openTrash());
    $('btnExplore').addEventListener('click', () => this.openExplore());
    $('btnCloseDrawer').addEventListener('click', () => $('drawerPanel').classList.add('hidden'));
    $('btnCloseTrash').addEventListener('click', () => $('trashPanel').classList.add('hidden'));
    $('btnCloseExplore').addEventListener('click', () => $('explorePanel').classList.add('hidden'));
    $('btnHistory').addEventListener('click', () => this.openHistory());
    $('btnCloseHistory').addEventListener('click', () => $('historyPanel').classList.add('hidden'));
    $('historyPanel').addEventListener('click', e => {
      if (e.target === $('historyPanel')) $('historyPanel').classList.add('hidden');
    });
    $('explorePanel').addEventListener('click', e => {
      if (e.target === $('explorePanel')) $('explorePanel').classList.add('hidden');
    });
    $('drawerPanel').addEventListener('click', e => {
      if (e.target === $('drawerPanel')) $('drawerPanel').classList.add('hidden');
    });
    $('trashPanel').addEventListener('click', e => {
      if (e.target === $('trashPanel')) $('trashPanel').classList.add('hidden');
    });

    // 展开详情关闭（点外部关闭，不中断计时/闹钟）
    $('expandLayer').addEventListener('click', e => {
      if (e.target === $('expandLayer')) this.closeExpand();
    });

    // 计时器/闹钟 — 长按展开的操作栏按钮
    $('btnShowAlarm').addEventListener('click', () => this.showAlarmWheel());
    $('btnShowTimer').addEventListener('click', () => this.showTimerWheel());

    // 闹钟转轮
    $('btnAlarmBack').addEventListener('click', () => this.backToTimerHome());
    $('btnConfirmAlarm').addEventListener('click', () => this.confirmAlarm());
    $('btnCancelAlarm').addEventListener('click', () => this.cancelAlarm());

    // 计时转轮
    $('btnTimerBack').addEventListener('click', () => this.backToTimerHome());
    $('btnTimerToggle').addEventListener('click', () => this.toggleTimerRun());
    $('btnTimerReset').addEventListener('click', () => this.resetTimer());

    // 记忆日程面板
    $('btnCloseMemory').addEventListener('click', () => this.closeMemory());
    $('memoryPanel').addEventListener('click', e => {
      if (e.target === $('memoryPanel')) this.closeMemory();
    });
    $('btnAddMemEvent').addEventListener('click', () => this.addMemoryEvent());
    $('btnSaveMemory').addEventListener('click', () => this.saveMemoryRange());
    document.querySelectorAll('.mem-day-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mem-day-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.memCurrentDow = parseInt(btn.dataset.dow);
        this.renderMemoryDayEvents();
      });
    });
  },

  // ═══════════════════════════════════════════
  //  上下快速滑动切日期
  // ═══════════════════════════════════════════

  bindVerticalSwipe() {
    const frame = document.getElementById('app-frame');
    let startY = 0, startX = 0, startTime = 0;

    frame.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startTime = Date.now();
    }, { passive: true });

    frame.addEventListener('touchend', (e) => {
      const endY = e.changedTouches[0].clientY;
      const endX = e.changedTouches[0].clientX;
      const dy = endY - startY;
      const dx = endX - startX;
      const dt = Date.now() - startTime;

      const velocity = Math.abs(dy) / dt;
      if (Math.abs(dy) > 80 && velocity > 0.5 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        this.changeDay(dy < 0 ? 1 : -1, dy < 0 ? 'up' : 'down');
      }
    }, { passive: true });
  },

  changeDay(delta, direction) {
    if (this.focusedEl) this.exitFocus();
    this.currentDate.setDate(this.currentDate.getDate() + delta);
    this.currentDate = new Date(this.currentDate);
    this.todayDrawer = [];
    this.todayTrash = [];

    const frame = document.getElementById('app-frame');
    const cls = direction === 'up' ? 'slide-up' : 'slide-down';
    frame.classList.add(cls);
    setTimeout(() => frame.classList.remove(cls), 400);

    this.render();
  },

  // ═══════════════════════════════════════════
  //  FAB 裂殖菜单
  // ═══════════════════════════════════════════

  toggleFab() {
    this.fabExpanded = !this.fabExpanded;
    document.getElementById('fabGroup').classList.toggle('expanded', this.fabExpanded);
    document.getElementById('fabBackdrop').classList.toggle('active', this.fabExpanded);
    if (this.fabExpanded) this.closeCustomDatePicker();
  },

  closeFab() {
    this.fabExpanded = false;
    document.getElementById('fabGroup').classList.remove('expanded');
    document.getElementById('fabBackdrop').classList.remove('active');
  },

  // ═══════════════════════════════════════════
  //  考试周模式
  // ═══════════════════════════════════════════

  toggleExamWeek() {
    const current = Scheduler.getExamWeekUntil();
    if (current && new Date() < current) {
      // 已在考试周 → 关闭
      if (confirm('取消考试周模式？将恢复常规学习安排。')) {
        Scheduler.clearExamWeek();
        this.updateExamUI();
        this.render();
      }
    } else {
      // 开启考试周
      const until = Scheduler.setExamWeek();
      const fmt = `${until.getMonth()+1}月${until.getDate()}日`;
      this.pushMessage(`已开启考试周模式，持续到 ${fmt}`, '📚');
      this.updateExamUI();
      this.render();
    }
  },

  updateExamUI() {
    const until = Scheduler.getExamWeekUntil();
    const active = until && new Date() < until;
    const fab = document.getElementById('fabExam');
    if (fab) {
      const label = fab.querySelector('.fc-label');
      if (label) label.textContent = active ? '取消考试' : '考试周';
    }
    const chk = document.getElementById('cdpExamCheck');
    if (chk) chk.checked = !!active;
  },

  openSettings() {
    const $ = id => document.getElementById(id);
    $('settingsPanel').classList.remove('hidden');
    $('inputIcalURL').value = localStorage.getItem(this.ICAL_URL_KEY) || CONFIG.icalURL;
    const cfg = Sync.getConfig();
    $('inputGHToken').value = cfg.token;
    $('inputGHRepo').value = cfg.repo;
    $('inputGHRetention').value = cfg.retention;
  },

  // ═══════════════════════════════════════════
  //  外观设置
  // ═══════════════════════════════════════════
  APPEAR_KEY: 'clock_appearance',

  _defaultAppearance() {
    const isLight = document.body.classList.contains('light-theme');
    return {
      '--glow-primary':   isLight ? '#7c3aed' : '#8b5cf6',
      '--glow-secondary': isLight ? '#0891b2' : '#06b6d4',
      '--glow-danger':    '#f43f5e',
      '--glow-success':   '#10b981',
      '--text-main':      isLight ? '#1c1c1e' : '#ffffff',
      '--text-sub':       isLight ? '#6b7280' : '#a1a1aa',
      fontSize: 16,
      cardTint: isLight ? '#ffffff' : '#ffffff',
      cardAlpha: isLight ? 60 : 5,
    };
  },

  openAppearance() {
    const $ = id => document.getElementById(id);
    $('appearancePanel').classList.remove('hidden');
    const saved = this._getAppearance();
    $('apClrPrimary').value   = saved['--glow-primary'];
    $('apClrSecondary').value = saved['--glow-secondary'];
    $('apClrDanger').value    = saved['--glow-danger'];
    $('apClrSuccess').value   = saved['--glow-success'];
    $('apClrTextMain').value  = saved['--text-main'];
    $('apClrTextSub').value   = saved['--text-sub'];
    $('apFontSize').value     = saved.fontSize;
    $('apFontSizeVal').textContent = saved.fontSize + 'px';
    $('apClrCard').value      = saved.cardTint;
    $('apCardAlpha').value    = saved.cardAlpha;
    $('apCardAlphaVal').textContent = saved.cardAlpha + '%';
  },

  _getAppearance() {
    try {
      const raw = localStorage.getItem(this.APPEAR_KEY);
      if (raw) return { ...this._defaultAppearance(), ...JSON.parse(raw) };
    } catch {}
    return this._defaultAppearance();
  },

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return { r, g, b };
  },

  _previewCardStyle() {
    const $ = id => document.getElementById(id);
    const hex = $('apClrCard').value;
    const alpha = parseInt($('apCardAlpha').value) / 100;
    const { r, g, b } = this._hexToRgb(hex);
    const val = `rgba(${r},${g},${b},${alpha})`;
    document.body.style.setProperty('--glass-bg', val);
    const sheetAlpha = Math.max(0.25, Math.min(alpha * 1.5, 0.85));
    document.body.style.setProperty('--glass-sheet-bg', `rgba(${r},${g},${b},${sheetAlpha})`);
  },

  applyAppearance(cfg) {
    const el = document.body;
    const colorVars = ['--glow-primary','--glow-secondary','--glow-danger','--glow-success'];
    colorVars.forEach(v => {
      if (cfg[v]) {
        el.style.setProperty(v, cfg[v]);
        const { r, g, b } = this._hexToRgb(cfg[v]);
        el.style.setProperty(v + '-rgb', `${r},${g},${b}`);
      }
    });
    ['--text-main','--text-sub'].forEach(v => {
      if (cfg[v]) el.style.setProperty(v, cfg[v]);
    });
    if (cfg.fontSize) document.documentElement.style.fontSize = cfg.fontSize + 'px';
    if (cfg.cardTint && cfg.cardAlpha != null) {
      const { r, g, b } = this._hexToRgb(cfg.cardTint);
      el.style.setProperty('--glass-bg', `rgba(${r},${g},${b},${cfg.cardAlpha / 100})`);
      // 面板背景：卡片透明度 ×1.5，下限 0.25 上限 0.85，配合 backdrop blur 保可读性
      const sheetAlpha = Math.max(0.25, Math.min(cfg.cardAlpha / 100 * 1.5, 0.85));
      el.style.setProperty('--glass-sheet-bg', `rgba(${r},${g},${b},${sheetAlpha})`);
    }
  },

  saveAppearance() {
    const $ = id => document.getElementById(id);
    const cfg = {
      '--glow-primary':   $('apClrPrimary').value,
      '--glow-secondary': $('apClrSecondary').value,
      '--glow-danger':    $('apClrDanger').value,
      '--glow-success':   $('apClrSuccess').value,
      '--text-main':      $('apClrTextMain').value,
      '--text-sub':       $('apClrTextSub').value,
      fontSize: parseInt($('apFontSize').value),
      cardTint: $('apClrCard').value,
      cardAlpha: parseInt($('apCardAlpha').value),
    };
    localStorage.setItem(this.APPEAR_KEY, JSON.stringify(cfg));
    this.applyAppearance(cfg);
    $('appearancePanel').classList.add('hidden');
  },

  resetAppearance() {
    localStorage.removeItem(this.APPEAR_KEY);
    const el = document.body;
    ['--glow-primary','--glow-secondary','--glow-danger','--glow-success',
     '--glow-primary-rgb','--glow-secondary-rgb','--glow-danger-rgb','--glow-success-rgb',
     '--text-main','--text-sub','--glass-bg','--glass-sheet-bg'].forEach(v => {
      el.style.removeProperty(v);
    });
    document.documentElement.style.fontSize = '';
    const def = this._defaultAppearance();
    const $ = id => document.getElementById(id);
    $('apClrPrimary').value   = def['--glow-primary'];
    $('apClrSecondary').value = def['--glow-secondary'];
    $('apClrDanger').value    = def['--glow-danger'];
    $('apClrSuccess').value   = def['--glow-success'];
    $('apClrTextMain').value  = def['--text-main'];
    $('apClrTextSub').value   = def['--text-sub'];
    $('apFontSize').value     = def.fontSize;
    $('apFontSizeVal').textContent = def.fontSize + 'px';
    $('apClrCard').value      = def.cardTint;
    $('apCardAlpha').value    = def.cardAlpha;
    $('apCardAlphaVal').textContent = def.cardAlpha + '%';
  },

  loadAppearance() {
    try {
      const raw = localStorage.getItem(this.APPEAR_KEY);
      if (raw) this.applyAppearance(JSON.parse(raw));
    } catch {}
  },

  // ═══════════════════════════════════════════
  //  自定义日历选择器
  // ═══════════════════════════════════════════

  _cdpYear: new Date().getFullYear(),
  _cdpMonth: new Date().getMonth(),

  toggleCustomDatePicker() {
    const dp = document.getElementById('customDatePicker');
    if (dp.classList.contains('hidden')) {
      this._cdpYear = this.currentDate.getFullYear();
      this._cdpMonth = this.currentDate.getMonth();
      this.renderCustomDatePicker();
      this.updateExamUI();
      dp.classList.remove('hidden');
      this.closeFab();
    } else {
      dp.classList.add('hidden');
    }
  },

  closeCustomDatePicker() {
    document.getElementById('customDatePicker').classList.add('hidden');
  },

  renderCustomDatePicker() {
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('cdpMonthLabel').textContent = `${this._cdpYear}年 ${months[this._cdpMonth]}`;

    const grid = document.getElementById('cdpGrid');
    grid.innerHTML = '';

    const firstDay = new Date(this._cdpYear, this._cdpMonth, 1);
    let startDow = firstDay.getDay();
    if (startDow === 0) startDow = 7;
    startDow--; // 0=Mon

    const daysInMonth = new Date(this._cdpYear, this._cdpMonth + 1, 0).getDate();
    const today = new Date();
    const sel = this.currentDate;

    for (let i = 0; i < startDow; i++) {
      const sp = document.createElement('span');
      sp.className = 'cdp-day cdp-empty';
      grid.appendChild(sp);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement('button');
      btn.className = 'cdp-day';
      btn.textContent = d;
      const isToday = d === today.getDate() && this._cdpMonth === today.getMonth() && this._cdpYear === today.getFullYear();
      const isSel = d === sel.getDate() && this._cdpMonth === sel.getMonth() && this._cdpYear === sel.getFullYear();
      if (isToday) btn.classList.add('cdp-today');
      if (isSel) btn.classList.add('cdp-selected');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentDate = new Date(this._cdpYear, this._cdpMonth, d);
        this.closeCustomDatePicker();
        this.render();
      });
      grid.appendChild(btn);
    }
  },

  // ═══════════════════════════════════════════
  //  长按聚焦模式
  // ═══════════════════════════════════════════

  toggleFocus(container) {
    if (this.focusedEl === container) {
      this.exitFocus();
      return;
    }
    if (this.focusedEl) this.exitFocus();
    this.focusedEl = container;
    document.body.classList.add('focus-mode');
    container.classList.add('card-focused');
  },

  exitFocus() {
    document.body.classList.remove('focus-mode');
    if (this.focusedEl) this.focusedEl.classList.remove('card-focused');
    this.focusedEl = null;
  },

  // ═══════════════════════════════════════════
  //  iOS 转轮选择器 (Wheel Picker)
  // ═══════════════════════════════════════════

  _wheelsInited: false,

  /** 初始化转轮列内容 */
  initWheels() {
    if (this._wheelsInited) return;
    this._wheelsInited = true;
    this._buildWheel('wheelAlarmH', 24, 2);  // 0-23 小时
    this._buildWheel('wheelAlarmM', 60, 2);  // 0-59 分钟
    this._buildWheel('wheelTimerM', 100, 2); // 0-99 分钟
    this._buildWheel('wheelTimerS', 60, 2);  // 0-59 秒
  },

  _buildWheel(id, count, pad) {
    const col = document.getElementById(id);
    col.innerHTML = '';
    // 顶部空白 (2 items)
    for (let i = 0; i < 2; i++) {
      const sp = document.createElement('div');
      sp.className = 'wheel-item wheel-spacer';
      sp.textContent = '';
      col.appendChild(sp);
    }
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'wheel-item';
      el.dataset.value = i;
      el.textContent = String(i).padStart(pad, '0');
      col.appendChild(el);
    }
    // 底部空白 (2 items)
    for (let i = 0; i < 2; i++) {
      const sp = document.createElement('div');
      sp.className = 'wheel-item wheel-spacer';
      sp.textContent = '';
      col.appendChild(sp);
    }
    // 滚动监听,更新 active 高亮
    col.addEventListener('scroll', () => this._updateWheelActive(col), { passive: true });
  },

  /** 滚动到指定值 */
  _scrollWheelTo(id, value) {
    const col = document.getElementById(id);
    if (!col) return;
    const itemH = 36;
    col.scrollTop = value * itemH;
    setTimeout(() => this._updateWheelActive(col), 50);
  },

  /** 获取转轮当前值 */
  _getWheelValue(id) {
    const col = document.getElementById(id);
    if (!col) return 0;
    const itemH = 36;
    const idx = Math.round(col.scrollTop / itemH);
    return idx;
  },

  /** 更新 active 样式 */
  _updateWheelActive(col) {
    const itemH = 36;
    const center = Math.round(col.scrollTop / itemH);
    const items = col.querySelectorAll('.wheel-item:not(.wheel-spacer)');
    items.forEach(el => {
      const v = parseInt(el.dataset.value);
      el.classList.toggle('active', v === center);
    });
  },

  // ═══════════════════════════════════════════
  //  长按展开 — 主页/闹钟/计时 视图切换
  // ═══════════════════════════════════════════

  backToTimerHome() {
    document.getElementById('timerHome').classList.remove('hidden');
    document.getElementById('alarmWheelView').classList.add('hidden');
    document.getElementById('timerWheelView').classList.add('hidden');
    this._syncTimerHomeStatus();
  },

  showAlarmWheel() {
    this.initWheels();
    document.getElementById('timerHome').classList.add('hidden');
    document.getElementById('alarmWheelView').classList.remove('hidden');
    document.getElementById('timerWheelView').classList.add('hidden');
    // 预设当前闹钟 or 当前时间
    if (this.alarmTime) {
      const [h, m] = this.alarmTime.split(':').map(Number);
      this._scrollWheelTo('wheelAlarmH', h);
      this._scrollWheelTo('wheelAlarmM', m);
    } else {
      const now = new Date();
      this._scrollWheelTo('wheelAlarmH', now.getHours());
      this._scrollWheelTo('wheelAlarmM', now.getMinutes());
    }
  },

  showTimerWheel() {
    this.initWheels();
    document.getElementById('timerHome').classList.add('hidden');
    document.getElementById('alarmWheelView').classList.add('hidden');
    document.getElementById('timerWheelView').classList.remove('hidden');
    // 同步当前计时器状态
    this._syncTimerWheelUI();
  },

  _syncTimerWheelUI() {
    const m = Math.floor(this.timerState.remaining / 60);
    const s = this.timerState.remaining % 60;
    if (!this.timerState.running) {
      this._scrollWheelTo('wheelTimerM', m);
      this._scrollWheelTo('wheelTimerS', s);
    }
    document.getElementById('btnTimerToggle').textContent =
      this.timerState.running ? '暂停' : (this.timerState.remaining < this.timerState.preset * 60 ? '继续' : '开始');
    // 运行中显示倒计时文字
    const display = document.getElementById('timerDisplay');
    if (this.timerState.running) {
      display.style.display = 'block';
      this.updateTimerDisplay();
      document.getElementById('timerWheelContainer').style.opacity = '0.3';
      document.getElementById('timerWheelContainer').style.pointerEvents = 'none';
    } else {
      display.style.display = 'none';
      document.getElementById('timerWheelContainer').style.opacity = '1';
      document.getElementById('timerWheelContainer').style.pointerEvents = 'auto';
    }
  },

  /** 同步主页状态提示 */
  _syncTimerHomeStatus() {
    const hints = [];
    if (this.timerState.running) {
      const m = Math.floor(this.timerState.remaining / 60);
      const s = this.timerState.remaining % 60;
      hints.push(`计时中 ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }
    if (this.alarmTime) {
      hints.push(`闹钟 ${this.alarmTime}`);
    }
    const el = document.getElementById('timerHomeStatus');
    if (el) el.textContent = hints.join(' · ');

    // 更新按钮副标题
    const alarmHint = document.getElementById('alarmBtnHint');
    const timerHint = document.getElementById('timerBtnHint');
    if (alarmHint) alarmHint.textContent = this.alarmTime ? this.alarmTime : '';
    if (timerHint) {
      if (this.timerState.running) {
        const m = Math.floor(this.timerState.remaining / 60);
        const s = this.timerState.remaining % 60;
        timerHint.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      } else {
        timerHint.textContent = '';
      }
    }
  },

  // ═══════════════════════════════════════════
  //  计时器逻辑
  // ═══════════════════════════════════════════

  syncTimerToExpand() {
    // 进入长按展开时，回到主页视图
    this.backToTimerHome();
  },

  toggleTimerRun() {
    if (this.timerState.running) {
      clearInterval(this.timerState.interval);
      this.timerState.running = false;
      this._syncTimerWheelUI();
    } else {
      // 从转轮读取时间
      if (this.timerState.remaining <= 0 || !this.timerState.taskKey) {
        const m = this._getWheelValue('wheelTimerM');
        const s = this._getWheelValue('wheelTimerS');
        const total = m * 60 + s;
        if (total <= 0) return;
        this.timerState.remaining = total;
        this.timerState.preset = m || 25;
      }
      this.timerState.taskKey = this._expandTaskKey || null;
      this.timerState.running = true;
      this._syncTimerWheelUI();
      this.timerState.interval = setInterval(() => {
        this.timerState.remaining--;
        this.updateTimerDisplay();
        this.updateMiniTimerInCard();
        this._syncTimerHomeStatus();
        // 如果计时转轮正在显示，更新倒计时文字
        const display = document.getElementById('timerDisplay');
        if (display && display.style.display !== 'none') {
          this.updateTimerDisplay();
        }
        if (this.timerState.remaining <= 0) {
          clearInterval(this.timerState.interval);
          this.timerState.running = false;
          this.pushMessage('计时结束！', '●');
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          this.timerState.taskKey = null;
          this.updateMiniTimerInCard();
          this._syncTimerWheelUI();
          this._syncTimerHomeStatus();
        }
      }, 1000);
    }
  },

  resetTimer() {
    clearInterval(this.timerState.interval);
    this.timerState.running = false;
    this.timerState.remaining = this.timerState.preset * 60;
    this.timerState.taskKey = null;
    this.updateTimerDisplay();
    this.updateMiniTimerInCard();
    this._syncTimerWheelUI();
    this._syncTimerHomeStatus();
  },

  setTimerPreset(mins) {
    if (this.timerState.running) return;
    this.timerState.remaining = mins * 60;
    this.timerState.preset = mins;
    this.updateTimerDisplay();
  },

  updateTimerDisplay() {
    const m = Math.floor(this.timerState.remaining / 60);
    const s = this.timerState.remaining % 60;
    const el = document.getElementById('timerDisplay');
    if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  /** 更新收起卡片右侧迷你计时器 */
  updateMiniTimerInCard() {
    document.querySelectorAll('.mini-timer-display').forEach(el => el.remove());
    if (!this.timerState.running || !this.timerState.taskKey) return;
    const card = document.querySelector(`.task-card[data-task-key="${this.timerState.taskKey}"]`);
    if (!card) return;
    let wrap = card.querySelector('.card-mini-timer');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'card-mini-timer';
      card.style.position = 'relative';
      card.appendChild(wrap);
    }
    let display = wrap.querySelector('.mini-timer-display');
    if (!display) {
      display = document.createElement('div');
      display.className = 'mini-timer-display';
      wrap.prepend(display);
    }
    const m = Math.floor(this.timerState.remaining / 60);
    const s = this.timerState.remaining % 60;
    display.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  // ═══════════════════════════════════════════
  //  闹钟逻辑
  // ═══════════════════════════════════════════

  syncAlarmToExpand() {
    // no-op, status synced via _syncTimerHomeStatus
  },

  confirmAlarm() {
    const h = this._getWheelValue('wheelAlarmH');
    const m = this._getWheelValue('wheelAlarmM');
    this.alarmTime = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    this.alarmTaskKey = this._expandTaskKey || null;
    this.pushMessage(`闹钟设为 ${this.alarmTime}`, '●');
    this.updateMiniAlarmInCards();
    if (this.alarmInterval) clearInterval(this.alarmInterval);
    this.alarmInterval = setInterval(() => {
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      if (t === this.alarmTime) {
        this.pushMessage('闹钟响了！', '●');
        if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
        clearInterval(this.alarmInterval);
        this.alarmInterval = null;
        this.alarmTime = null;
        this.alarmTaskKey = null;
        this.updateMiniAlarmInCards();
        this._syncTimerHomeStatus();
      }
    }, 15000);
    this.backToTimerHome();
  },

  cancelAlarm() {
    if (this.alarmInterval) clearInterval(this.alarmInterval);
    this.alarmInterval = null;
    this.alarmTime = null;
    this.alarmTaskKey = null;
    this.updateMiniAlarmInCards();
    this.pushMessage('闹钟已取消', '●');
    this.backToTimerHome();
  },

  /** 更新收起卡片右侧闹钟指示 */
  updateMiniAlarmInCards() {
    document.querySelectorAll('.mini-alarm-display').forEach(el => el.remove());
    if (!this.alarmTime || !this.alarmTaskKey) return;
    const card = document.querySelector(`.task-card[data-task-key="${this.alarmTaskKey}"]`);
    if (!card) return;
    let wrap = card.querySelector('.card-mini-timer');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'card-mini-timer';
      card.style.position = 'relative';
      card.appendChild(wrap);
    }
    const alarmEl = document.createElement('div');
    alarmEl.className = 'mini-alarm-display';
    alarmEl.textContent = this.alarmTime;
    wrap.appendChild(alarmEl);
  },

  // ═══════════════════════════════════════════
  //  记忆日程编辑器
  // ═══════════════════════════════════════════

  memCurrentDow: 1,
  memEditingRange: null,     // 当前正在编辑的 range 对象
  memWeeklyBuffer: {},       // 临时缓冲: { "0": [...], "1": [...], ... }

  openMemory() {
    const panel = document.getElementById('memoryPanel');
    panel.classList.remove('hidden');
    // 初始化空编辑状态
    this.memEditingRange = null;
    this.memWeeklyBuffer = { '0':[], '1':[], '2':[], '3':[], '4':[], '5':[], '6':[] };
    this.memCurrentDow = 1;

    // 默认日期范围：今天到 3 个月后
    const now = new Date();
    const later = new Date(now);
    later.setMonth(later.getMonth() + 3);
    document.getElementById('memStart').value = this.toDateStr(now);
    document.getElementById('memEnd').value = this.toDateStr(later);

    // 高亮当前tab
    document.querySelectorAll('.mem-day-tab').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.dow) === this.memCurrentDow);
    });

    this.renderMemoryDayEvents();
    this.renderMemoryRanges();
  },

  closeMemory() {
    document.getElementById('memoryPanel').classList.add('hidden');
  },

  /** 渲染当前选中的星期几的课程列表 */
  renderMemoryDayEvents() {
    const list = document.getElementById('memEventsList');
    const events = this.memWeeklyBuffer[String(this.memCurrentDow)] || [];
    list.innerHTML = '';

    if (events.length === 0) {
      list.innerHTML = '<p class="text-sub" style="text-align:center;padding:16px 0;">当天暂无课程，点击下方添加</p>';
      return;
    }

    events.forEach((ev, idx) => {
      const row = document.createElement('div');
      row.className = 'mem-event-row';
      row.innerHTML = `
        <input type="text" value="${this.escapeHtml(ev.summary)}" placeholder="课程名称" data-field="summary" data-idx="${idx}">
        <input type="time" value="${ev.start}" data-field="start" data-idx="${idx}">
        <input type="time" value="${ev.end}" data-field="end" data-idx="${idx}">
        <button class="mem-del-btn" data-idx="${idx}" title="删除">✕</button>
      `;
      list.appendChild(row);
    });

    // 绑定输入同步到 buffer
    list.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        const i = parseInt(inp.dataset.idx);
        const f = inp.dataset.field;
        const arr = this.memWeeklyBuffer[String(this.memCurrentDow)];
        if (arr[i]) arr[i][f] = inp.value;
      });
    });

    list.querySelectorAll('.mem-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        this.memWeeklyBuffer[String(this.memCurrentDow)].splice(i, 1);
        this.renderMemoryDayEvents();
      });
    });
  },

  /** 添加一条新事件到当前星期几 */
  addMemoryEvent() {
    const arr = this.memWeeklyBuffer[String(this.memCurrentDow)];
    arr.push({ summary: '', start: '08:00', end: '09:30' });
    this.renderMemoryDayEvents();
    // 自动滚到底部
    const list = document.getElementById('memEventsList');
    list.scrollTop = list.scrollHeight;
  },

  /** 保存当前编辑的日程模板 */
  saveMemoryRange() {
    const start = document.getElementById('memStart').value;
    const end = document.getElementById('memEnd').value;
    if (!start || !end) {
      this.pushMessage('请选择日期范围', '!');
      return;
    }
    if (start > end) {
      this.pushMessage('开始日期不能晚于结束日期', '!');
      return;
    }

    // 检查是否有任何事件
    const hasEvents = Object.values(this.memWeeklyBuffer).some(arr => arr.length > 0);
    if (!hasEvents) {
      this.pushMessage('请至少添加一个课程', '!');
      return;
    }

    // 过滤掉空名称的事件
    const weekly = {};
    for (const [dow, events] of Object.entries(this.memWeeklyBuffer)) {
      const valid = events.filter(e => e.summary.trim());
      if (valid.length > 0) weekly[dow] = valid;
    }

    const range = {
      id: this.memEditingRange ? this.memEditingRange.id : MemorySchedule.genId(),
      start,
      end,
      weekly
    };

    MemorySchedule.upsert(range);
    this.pushMessage('记忆日程已保存', '●');
    this.renderMemoryRanges();
    this.render();

    // 重置编辑状态
    this.memEditingRange = null;
    this.memWeeklyBuffer = { '0':[], '1':[], '2':[], '3':[], '4':[], '5':[], '6':[] };
    this.renderMemoryDayEvents();
  },

  /** 加载一个已有 range 到编辑器 */
  editMemoryRange(id) {
    const ranges = MemorySchedule.load();
    const r = ranges.find(x => x.id === id);
    if (!r) return;
    this.memEditingRange = r;
    document.getElementById('memStart').value = r.start;
    document.getElementById('memEnd').value = r.end;

    // 恢复 weekly buffer
    this.memWeeklyBuffer = { '0':[], '1':[], '2':[], '3':[], '4':[], '5':[], '6':[] };
    for (const [dow, events] of Object.entries(r.weekly || {})) {
      this.memWeeklyBuffer[dow] = events.map(e => ({ ...e }));
    }

    // 恢复到第一个tab
    this.memCurrentDow = 1;
    document.querySelectorAll('.mem-day-tab').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.dow) === 1);
    });
    this.renderMemoryDayEvents();
  },

  /** 渲染已保存的日程列表 */
  renderMemoryRanges() {
    const container = document.getElementById('memRangesList');
    const ranges = MemorySchedule.load();
    container.innerHTML = '';

    if (ranges.length === 0) return;

    for (const r of ranges) {
      const totalEvents = Object.values(r.weekly || {}).reduce((s, a) => s + a.length, 0);
      const card = document.createElement('div');
      card.className = 'mem-range-card';
      card.innerHTML = `
        <div class="mem-range-info">
          ${r.start} ~ ${r.end}
          <small>${totalEvents} 个课程/周</small>
        </div>
        <div class="mem-range-actions">
          <button data-edit="${r.id}">编辑</button>
          <button class="danger" data-del="${r.id}">删除</button>
        </div>
      `;
      container.appendChild(card);
    }

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this.editMemoryRange(btn.dataset.edit));
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        MemorySchedule.remove(btn.dataset.del);
        this.renderMemoryRanges();
        this.render();
        this.pushMessage('已删除日程模板', '●');
      });
    });
  },

  toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  // ═══════════════════════════════════════════
  //  GitHub 同步
  // ═══════════════════════════════════════════

  loadSyncConfig() {
    const cfg = Sync.getConfig();
    const $ = id => document.getElementById(id);
    if ($('inputGHToken'))     $('inputGHToken').value     = cfg.token;
    if ($('inputGHRepo'))      $('inputGHRepo').value      = cfg.repo;
    if ($('inputGHRetention')) $('inputGHRetention').value  = cfg.retention;
  },

  saveSyncConfig() {
    const $ = id => document.getElementById(id);
    Sync.saveConfig(
      $('inputGHToken').value.trim(),
      $('inputGHRepo').value.trim(),
      parseInt($('inputGHRetention').value) || 30
    );
  },

  async doSyncNow() {
    this.saveSyncConfig();
    if (!Sync.isConfigured()) {
      this.pushMessage('请先配置 GitHub Token 和仓库', '!');
      this.openSettings();
      return;
    }
    const statusEl = document.getElementById('syncStatus');
    if (statusEl) statusEl.textContent = '同步中...';
    try {
      const data = Sync.buildDailyData(this.currentDate, this.todayDrawer, this.todayTrash);
      await Sync.upload(data);
      this.pushMessage('已同步到 GitHub', '●');
      if (statusEl) statusEl.textContent = `已同步 ${data.date}`;
    } catch (err) {
      this.pushMessage(`同步失败: ${err.message}`, 'X');
      if (statusEl) statusEl.textContent = `失败: ${err.message}`;
    }
  },

  async doSyncClean() {
    this.saveSyncConfig();
    if (!Sync.isConfigured()) {
      this.pushMessage('请先配置 GitHub', '!');
      return;
    }
    try {
      const deleted = await Sync.cleanOld();
      this.pushMessage(`已清理 ${deleted} 个过期文件`, '●');
    } catch (err) {
      this.pushMessage(`清理失败: ${err.message}`, 'X');
    }
  },

  async autoSync() {
    if (!Sync.isConfigured()) return;
    try {
      const data = Sync.buildDailyData(this.currentDate, this.todayDrawer, this.todayTrash);
      await Sync.upload(data);
    } catch { /* silent */ }
  },

  // ─── iCal 管理 ───
  loadSavedICal() {
    try {
      const saved = localStorage.getItem(this.EVENTS_KEY);
      if (saved) {
        const raw = JSON.parse(saved);
        this.allEvents = raw.map(e => ({
          ...e, start: new Date(e.start), end: new Date(e.end)
        }));
      }
    } catch { /* ignore */ }
  },

  saveEvents() {
    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(this.allEvents));
  },

  async refreshICal() {
    const url = document.getElementById('inputIcalURL').value.trim();
    if (!url) return;
    const status = document.getElementById('icalStatus');
    status.textContent = '加载中...';
    try {
      localStorage.setItem(this.ICAL_URL_KEY, url);
      this.allEvents = await ICalParser.fetchICal(url, CONFIG.corsProxy);
      this.saveEvents();
      status.textContent = `已加载 ${this.allEvents.length} 个事件`;
      this.render();
      this.pushMessage(`已加载 ${this.allEvents.length} 个事件`, '●');
    } catch (err) {
      status.textContent = `加载失败: ${err.message}`;
    }
  },

  parseICalText() {
    const text = document.getElementById('inputIcalText').value.trim();
    if (!text) return;
    const status = document.getElementById('icalStatus');
    try {
      this.allEvents = ICalParser.parse(text);
      this.saveEvents();
      status.textContent = `已解析 ${this.allEvents.length} 个事件`;
      this.render();
      this.pushMessage(`已解析 ${this.allEvents.length} 个事件`, '●');
    } catch (err) {
      status.textContent = `解析失败: ${err.message}`;
    }
  },

  // ═══════════════════════════════════════════
  //  Push Pill 消息系统
  // ═══════════════════════════════════════════

  pushMessage(text, icon) {
    const container = document.getElementById('push-container');
    const pill = document.createElement('div');
    pill.className = 'push-pill';
    pill.innerHTML = `<div class="push-icon">${icon}</div><div>${this.escapeHtml(text)}</div>`;
    container.appendChild(pill);

    pill.animate([
      { transform: 'translateY(-50px) scaleX(0.8) scaleY(1.2)', opacity: 0 },
      { transform: 'translateY(15px) scaleX(1.1) scaleY(0.9)', opacity: 1, offset: 0.6 },
      { transform: 'translateY(0) scaleX(1) scaleY(1)', opacity: 1 }
    ], { duration: 800, easing: 'cubic-bezier(0.34,1.56,0.64,1)', fill: 'forwards' });

    setTimeout(() => {
      const exit = pill.animate([
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(-30px) scale(0.6)', opacity: 0 }
      ], { duration: 400, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'forwards' });
      exit.onfinish = () => pill.remove();
    }, 2500);
  },

  // ═══════════════════════════════════════════
  //  渲染主界面
  // ═══════════════════════════════════════════

  render() {
    this.renderHeader();
    this.renderStats();
    this.renderProgress();
    this.renderTimeline();
    this.renderWeekend();
    this.updateBadges();
  },

  renderHeader() {
    const d = this.currentDate;
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const wd = weekdays[d.getDay()];
    const isToday = this.isSameDay(d, new Date());

    // 问候语
    const hour = new Date().getHours();
    let greet = 'GOOD EVENING';
    if (hour < 12) greet = 'GOOD MORNING';
    else if (hour < 18) greet = 'GOOD AFTERNOON';
    // 考试周标记
    const examActive = Scheduler.isExamWeek(d);
    document.getElementById('greeting').textContent = examActive ? '📚 EXAM WEEK' : greet;

    document.getElementById('dateTitle').textContent = `${m}月${day}日 周${wd}`;
    document.getElementById('navDateText').textContent = `${m}月${day}日 周${wd}`;

    const todayBtn = document.getElementById('btnToday');
    todayBtn.classList.toggle('is-today', isToday);
  },

  renderStats() {
    const weekly = Scheduler.getWeeklyStats();
    document.getElementById('weekLearned').textContent = weekly.learned;
    document.getElementById('weekReviewed').textContent = weekly.reviewed;

    const todayEvents = ICalParser.getEventsForDate(this.allEvents, this.currentDate);
    const plan = Scheduler.planDay(this.currentDate, todayEvents);
    document.getElementById('daySlots').textContent = plan.stats.freeDay ? '自由' : plan.stats.assigned;
  },

  renderProgress() {
    const progress = Scheduler.getCourseProgress();
    const container = document.getElementById('progressStrip');
    container.innerHTML = '';

    for (const p of progress) {
      const item = document.createElement('div');
      item.className = 'progress-item';
      item.innerHTML = `
        <span class="progress-icon">${p.icon}</span>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width:${p.percent}%; background:${p.color}"></div>
        </div>
        <span class="progress-pct">${p.percent}%</span>
      `;
      container.appendChild(item);
    }
  },

  renderTimeline() {
    const icalEvents = ICalParser.getEventsForDate(this.allEvents, this.currentDate);
    const memEvents = MemorySchedule.getEventsForDate(this.currentDate);
    const todayEvents = [...icalEvents, ...memEvents];
    const plan = Scheduler.planDay(this.currentDate, todayEvents);
    const container = document.getElementById('timeline');
    container.innerHTML = '';

    // 周五自由日
    if (plan.stats.freeDay) {
      container.innerHTML = `
        <div class="empty-state fade-in">
          <p>${plan.stats.reason}</p>
        </div>
      `;
      return;
    }

    // 合并课程事件和学习任务，按时间排序
    const merged = [];

    for (const ev of todayEvents) {
      merged.push({
        type: 'class',
        start: ev.start,
        end: ev.end,
        summary: ev.summary || '课程',
        location: ev.location || ''
      });
    }

    for (const task of plan.schedule) {
      // 跳过已被右滑丢弃的
      const skipKey = `${task.courseId}_${task.unitIdx}_${task.chapterIdx}`;
      if (this.todayTrash.some(t => t.key === skipKey)) continue;

      merged.push({
        type: 'study',
        start: task.timeStart,
        end: task.timeEnd,
        task
      });
    }

    merged.sort((a, b) => a.start - b.start);

    // 检测当前活跃
    const now = new Date();
    let activeId = null;
    if (this.isSameDay(this.currentDate, now)) {
      for (const item of merged) {
        if (item.type === 'study') {
          if (item.start <= now && item.end > now) { activeId = item; break; }
        }
      }
      if (!activeId) {
        for (const item of merged) {
          if (item.type === 'study' && item.start > now) { activeId = item; break; }
        }
      }
    }

    if (merged.length === 0) {
      container.innerHTML = `
        <div class="empty-state fade-in">
          <p>没有安排的学习任务<br><small>请在设置中加载 iCal 课表</small></p>
        </div>
      `;
      return;
    }

    // 渲染
    for (const item of merged) {
      const wrapper = document.createElement('div');
      wrapper.className = 'fade-in';

      const isOngoing = this.isSameDay(this.currentDate, now) && item.start <= now && item.end > now;

      if (item.type === 'class') {
        const classKey = `class_${item.start.getTime()}`;
        const classDone = this.todayDrawer.some(d => d.key === classKey);
        const classSkipped = this.todayTrash.some(d => d.key === classKey);
        if (classSkipped) { continue; }
        wrapper.innerHTML = `
          <div class="task-container">
            <div class="swipe-actions">
              <div class="action-btn btn-archive">✓</div>
              <div class="action-btn btn-skip">✕</div>
            </div>
            <div class="class-card task-card ${classDone ? 'task-done-overlay' : ''} ${isOngoing && !classDone ? 'card-ongoing' : ''}"
                 data-start-time="${item.start.getTime()}" data-end-time="${item.end.getTime()}"
                 data-task-key="${classKey}" data-is-class="1"
                 data-course="class" data-unit="0" data-chapter="0" data-type="class"
                 data-url="" data-title="${this.escapeHtml(item.summary)}" data-course-name="课程"
                 data-color="" data-icon="" data-done="${classDone ? '1' : '0'}"
                 data-time-start="${this.formatTime(item.start)}" data-time-end="${this.formatTime(item.end)}">
              <div class="task-time">${this.formatTime(item.start)}</div>
              <div class="task-indicator"></div>
              <div class="task-info">
                <div class="class-label">课程</div>
                <div class="task-title">${this.escapeHtml(item.summary)}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        const t = item.task;
        const isDone = t.type === 'review'
          ? Scheduler.isReviewDone(t.courseId, t.unitIdx)
          : Scheduler.isDone(t.courseId, t.unitIdx, t.chapterIdx);
        const isActive = item === activeId;
        const taskKey = `${t.courseId}_${t.unitIdx}_${t.chapterIdx}`;

        wrapper.innerHTML = `
          <div class="task-container">
            <div class="swipe-actions">
              <div class="action-btn btn-archive">✓</div>
              <div class="action-btn btn-skip">✕</div>
            </div>
            <div class="task-card ${isActive ? 'active-gel' : ''} ${isDone ? 'task-done-overlay' : ''} ${isOngoing && !isDone ? 'card-ongoing' : ''}"
                 style="position:relative"
                 data-task-key="${taskKey}"
                 data-course="${t.courseId}" data-unit="${t.unitIdx}" data-chapter="${t.chapterIdx}" data-type="${t.type}"
                 data-url="${t.url}" data-title="${this.escapeHtml(t.title)}" data-course-name="${this.escapeHtml(t.courseName)}"
                 data-color="${t.courseColor}" data-icon="${t.courseIcon}"
                 data-time-start="${this.formatTime(item.start)}" data-time-end="${this.formatTime(item.end)}"
                 data-end-time="${item.end.getTime()}"
                 data-done="${isDone ? '1' : '0'}">
              <div class="task-time">${this.formatTime(item.start)}</div>
              <div class="task-indicator" style="border-color:${t.courseColor}"></div>
              <div class="task-info">
                <div class="task-course" style="color:${t.courseColor}">${t.courseName}</div>
                <div class="task-title">${t.title}</div>
                <div class="task-desc">${this.formatTime(item.start)} — ${this.formatTime(item.end)}</div>
              </div>
              <div class="task-notes-actions">
                <a href="${this.escapeHtml(t.url)}" target="_blank" class="pill-btn glow-primary" style="font-size:.75rem;padding:6px 14px">打开 →</a>
              </div>
            </div>
          </div>
        `;
      }

      container.appendChild(wrapper);
    }

    // 绑定滑动引擎
    this.bindSwipeEngine();
    // 恢复迷你计时/闹钟指示
    this.updateMiniTimerInCard();
    this.updateMiniAlarmInCards();
  },

  renderWeekend() {
    const dow = this.currentDate.getDay();
    const section = document.getElementById('weekendSection');
    const grid = document.getElementById('weekendGrid');

    if (dow === 5 || dow === 6 || dow === 0) {
      section.classList.remove('hidden');
      grid.innerHTML = '';
      for (const c of CONFIG.weekendCourses) {
        const card = document.createElement('a');
        card.href = c.url;
        card.target = '_blank';
        card.className = 'weekend-card fade-in';
        card.innerHTML = `<span class="wk-icon">${c.icon}</span><span class="wk-name">${c.name}</span>`;
        grid.appendChild(card);
      }
    } else {
      section.classList.add('hidden');
    }
  },

  updateBadges() {
    const db = document.getElementById('drawerBadge');
    const tb = document.getElementById('trashBadge');
    if (this.todayDrawer.length > 0) {
      db.textContent = this.todayDrawer.length;
      db.classList.remove('hidden');
    } else {
      db.classList.add('hidden');
    }
    if (this.todayTrash.length > 0) {
      tb.textContent = this.todayTrash.length;
      tb.classList.remove('hidden');
    } else {
      tb.classList.add('hidden');
    }
  },

  // ═══════════════════════════════════════════
  //  胶体滑动引擎 (Gelatin Swipe Engine)
  // ═══════════════════════════════════════════

  bindSwipeEngine() {
    // 清除旧的全局滑动监听器，避免内存泄漏
    if (this._swipeCleanups) {
      this._swipeCleanups.forEach(fn => fn());
    }
    this._swipeCleanups = [];
    const cards = document.querySelectorAll('#timeline .task-card[data-course]');
    cards.forEach(card => this.attachSwipe(card));
  },

  attachSwipe(card) {
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    let isClick = true;
    let longPressTimer = null;
    let longPressFired = false;

    const onDown = (e) => {
      isDragging = true;
      isClick = true;
      longPressFired = false;
      startX = e.clientX || e.touches[0].clientX;
      card.style.transition = 'none';

      // 长按展开计时/闹钟（500ms）
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        isDragging = false;
        card.style.transform = 'translateX(0) scale(1)';
        this.openTimerFromCard(card);
        if (navigator.vibrate) navigator.vibrate(30);
      }, 500);
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (clientX === undefined) return;
      const dx = clientX - startX;
      if (Math.abs(dx) > 5) {
        isClick = false;
        clearTimeout(longPressTimer);
      }

      currentX = dx * 0.5;
      const stretch = 1 + (Math.abs(currentX) / 1000);
      const squash  = 1 - (Math.abs(currentX) / 2000);
      card.style.transform = `translateX(${currentX}px) scaleX(${stretch}) scaleY(${squash})`;

      const container = card.closest('.task-container');
      if (container) {
        const archiveBtn = container.querySelector('.btn-archive');
        const skipBtn = container.querySelector('.btn-skip');
        if (archiveBtn) archiveBtn.style.opacity = currentX < -30 ? 1 : 0;
        if (skipBtn)    skipBtn.style.opacity    = currentX > 30 ? 1 : 0;
      }
    };

    const onUp = () => {
      clearTimeout(longPressTimer);
      if (longPressFired) return;
      if (!isDragging) return;
      isDragging = false;

      card.style.transition = 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';

      if (isClick && Math.abs(currentX) < 5) {
        card.style.transform = 'translateX(0) scale(1)';
        currentX = 0;
        if (!this.focusedEl) this.openExpandFromCard(card);
        return;
      }

      const THRESHOLD = 80;
      if (currentX < -THRESHOLD) {
        this.swipeArchive(card);
      } else if (currentX > THRESHOLD) {
        this.swipeTrash(card);
      } else {
        currentX = 0;
        card.style.transform = 'translateX(0) scale(1)';
      }
    };

    card.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    // 注册清理函数
    this._swipeCleanups.push(() => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    });
  },

  swipeArchive(card) {
    const t = this.getTaskDataFromCard(card);
    // 飞出动画
    card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    card.style.transform = 'translateX(-120%) rotate(-8deg)';
    card.style.opacity = '0';

    setTimeout(() => {
      const isClass = card.dataset.isClass === '1';
      const key = isClass ? card.dataset.taskKey : `${t.courseId}_${t.unitIdx}_${t.chapterIdx}`;
      // 标记完成（学校课程不记学习进度）
      if (!isClass) {
        if (t.type === 'review') {
          Scheduler.markReviewDone(t.courseId, t.unitIdx);
        } else {
          Scheduler.markDone(t.courseId, t.unitIdx, t.chapterIdx);
        }
      }
      this.todayDrawer.push({ ...t, key });
      this.pushMessage(`已完成: ${t.title}`, '✓');
      this.render();
    }, 350);
  },

  swipeTrash(card) {
    const t = this.getTaskDataFromCard(card);
    card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    card.style.transform = 'translateX(120%) rotate(8deg)';
    card.style.opacity = '0';

    setTimeout(() => {
      const isClass = card.dataset.isClass === '1';
      const key = isClass ? card.dataset.taskKey : `${t.courseId}_${t.unitIdx}_${t.chapterIdx}`;
      this.todayTrash.push({ ...t, key });
      this.pushMessage(`已跳过: ${t.title}`, '✕');
      this.render();
    }, 350);
  },

  getTaskDataFromCard(card) {
    return {
      courseId: card.dataset.course,
      unitIdx: parseInt(card.dataset.unit),
      chapterIdx: parseInt(card.dataset.chapter),
      type: card.dataset.type,
      url: card.dataset.url,
      title: card.dataset.title,
      courseName: card.dataset.courseName,
      courseColor: card.dataset.color,
      courseIcon: card.dataset.icon,
      timeStart: card.dataset.timeStart,
      timeEnd: card.dataset.timeEnd,
      taskKey: card.dataset.taskKey,
    };
  },

  // ═══════════════════════════════════════════
  //  展开详情 (Full-screen Expand)
  // ═══════════════════════════════════════════

  openExpandFromCard(card) {
    const t = this.getTaskDataFromCard(card);
    const isDone = card.dataset.done === '1';
    const isClass = card.dataset.isClass === '1';
    this._expandTaskKey = isClass ? t.taskKey : `${t.courseId}_${t.unitIdx}_${t.chapterIdx}`;
    this._expandTaskData = t;

    document.getElementById('exTime').textContent = t.timeStart;
    if (isClass) {
      document.getElementById('exCourse').textContent = '课程';
      document.getElementById('exTitle').textContent = t.title;
      document.getElementById('exDesc').textContent = `${t.timeStart} — ${t.timeEnd} · 学校课程`;
    } else {
      document.getElementById('exCourse').innerHTML = `<span style="color:${t.courseColor}">${t.courseName}</span>`;
      document.getElementById('exTitle').textContent = t.title;
      document.getElementById('exDesc').textContent = `${t.timeStart} — ${t.timeEnd} · ${t.type === 'review' ? '复习任务' : '学习任务'}`;
    }

    const actions = document.getElementById('exActions');
    if (isClass) {
      actions.innerHTML = isDone
        ? '<span style="color:var(--glow-success);font-weight:600">已完成</span>'
        : `<button class="pill-btn glow-success" id="btnCompleteExpand">完成 ✓</button>`;
    } else {
      actions.innerHTML = `
        <a href="${this.escapeHtml(t.url)}" target="_blank" class="pill-btn glow-primary">开始学习 →</a>
        ${isDone ? '<span style="color:var(--glow-success);font-weight:600">已完成</span>' : `
          <button class="pill-btn glow-success" id="btnCompleteExpand">完成 ✓</button>
        `}
      `;
    }

    // 绑定完成按钮事件（通过闭包捕获任务数据，避免状态丢失）
    const btnComplete = document.getElementById('btnCompleteExpand');
    if (btnComplete) {
      let fired = false;
      const taskSnapshot = { ...t };
      const handler = (e) => {
        if (fired) return;
        fired = true;
        e.stopPropagation();
        e.preventDefault();
        App.completeFromExpand(t.courseId, t.unitIdx, t.chapterIdx, t.type, taskSnapshot);
      };
      btnComplete.addEventListener('click', handler);
      btnComplete.addEventListener('touchend', handler);
    }

    // 单击展开：显示信息区，隐藏计时区
    document.getElementById('expandInfoSection').classList.remove('hidden');
    document.getElementById('expandTimerSection').classList.add('hidden');

    const layer = document.getElementById('expandLayer');
    layer.classList.remove('hidden');
    requestAnimationFrame(() => layer.classList.add('visible'));
  },

  /** 长按展开：显示计时器 + 闹钟 */
  openTimerFromCard(card) {
    const t = this.getTaskDataFromCard(card);
    this._expandTaskKey = `${t.courseId}_${t.unitIdx}_${t.chapterIdx}`;

    document.getElementById('exTimerCourse').innerHTML = `<span style="color:${t.courseColor}">${t.courseName}</span>`;
    document.getElementById('exTimerTitle').textContent = t.title;

    // 隐藏信息区，显示计时区
    document.getElementById('expandInfoSection').classList.add('hidden');
    document.getElementById('expandTimerSection').classList.remove('hidden');

    // 同步计时器和闹钟状态
    this.syncTimerToExpand();
    this.syncAlarmToExpand();

    const layer = document.getElementById('expandLayer');
    layer.classList.remove('hidden');
    requestAnimationFrame(() => layer.classList.add('visible'));
  },

  closeExpand() {
    const layer = document.getElementById('expandLayer');
    layer.classList.remove('visible');
    setTimeout(() => layer.classList.add('hidden'), 400);
  },

  completeFromExpand(courseId, unitIdx, chapterIdx, type, taskData) {
    // 视觉反馈：先让按钮变化
    const btn = document.querySelector('#exActions button.glow-success');
    if (btn) {
      btn.textContent = '已完成 ✓';
      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';
    }

    const isClass = type === 'class';
    if (!isClass) {
      if (type === 'review') {
        Scheduler.markReviewDone(courseId, unitIdx);
      } else {
        Scheduler.markDone(courseId, unitIdx, chapterIdx);
      }
    }

    // 收集到「已完成」抽屉
    if (taskData) {
      const key = isClass && taskData.taskKey ? taskData.taskKey : `${courseId}_${unitIdx}_${chapterIdx}`;
      this.todayDrawer.push({ ...taskData, key });
    }

    // 短暂延迟后关闭，让用户看到反馈
    setTimeout(() => {
      this.closeExpand();
      this.pushMessage('任务完成！', '✓');
      this.render();
    }, 300);
  },

  // ═══════════════════════════════════════════
  //  抽屉 & 垃圾桶面板
  // ═══════════════════════════════════════════

  openDrawer() {
    const panel = document.getElementById('drawerPanel');
    const list = document.getElementById('drawerList');
    const empty = document.getElementById('drawerEmpty');
    panel.classList.remove('hidden');

    if (this.todayDrawer.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = this.todayDrawer.map(t => `
        <div class="panel-list-item">
          <div class="task-indicator" style="border-color:${t.courseColor}; background:${t.courseColor};"></div>
          <div class="task-info">
            <div class="task-course" style="color:${t.courseColor}">${t.courseName}</div>
            <div class="task-title">${this.escapeHtml(t.title)}</div>
          </div>
          <span style="color:var(--glow-success)">✓</span>
        </div>
      `).join('');
    }
  },

  openTrash() {
    const panel = document.getElementById('trashPanel');
    const list = document.getElementById('trashList');
    const empty = document.getElementById('trashEmpty');
    panel.classList.remove('hidden');

    if (this.todayTrash.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = this.todayTrash.map((t, i) => `
        <div class="panel-list-item">
          <div class="task-indicator" style="border-color:${t.courseColor};"></div>
          <div class="task-info">
            <div class="task-course" style="color:${t.courseColor}">${t.courseName}</div>
            <div class="task-title">${this.escapeHtml(t.title)}</div>
          </div>
          <button class="icon-btn" style="font-size:.8rem" onclick="App.restoreFromTrash(${i})">↩</button>
        </div>
      `).join('');
    }
  },

  restoreFromTrash(idx) {
    this.todayTrash.splice(idx, 1);
    this.pushMessage('任务已恢复', '↩');
    this.render();
    this.openTrash(); // 刷新列表
  },

  /** 从 localStorage 中读取所有完成记录，按日期倒序展示 */
  openHistory() {
    const panel = document.getElementById('historyPanel');
    const list = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    panel.classList.remove('hidden');

    // 构建课程 ID → { name, color } 的映射
    const courseMap = {};
    CONFIG.mainCourses.forEach(c => { courseMap[c.id] = { name: c.name, color: c.color }; });
    CONFIG.weekendCourses.forEach(c => { courseMap[c.id] = { name: c.name, color: c.color }; });

    // 构建章节 ID → 章节标题的映射
    const chapterMap = {};
    CONFIG.mainCourses.forEach(c => {
      c.units.forEach((u, ui) => {
        u.chapters.forEach((ch, ci) => {
          chapterMap[`${c.id}_${ui}_${ci}`] = ch.title || ch.name || ch;
        });
      });
    });

    const progress = Scheduler.getProgress();
    const entries = [];
    for (const [key, val] of Object.entries(progress)) {
      if (!val.done) continue;
      const isReview = key.startsWith('review_');
      let courseId, label;
      if (isReview) {
        const parts = key.replace('review_', '').split('_');
        courseId = parts[0];
        label = `复习 · Unit ${parts[1]}`;
      } else {
        const parts = key.split('_');
        courseId = parts[0];
        label = chapterMap[key] || `${parts[1]}.${parts[2]}`;
      }
      const info = courseMap[courseId] || { name: courseId, color: '#888' };
      entries.push({ courseId, courseName: info.name, color: info.color, label, date: val.date });
    }

    // 按日期倒序
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (entries.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      // 按日期分组
      const groups = {};
      entries.forEach(e => {
        const d = new Date(e.date);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!groups[dayKey]) groups[dayKey] = [];
        groups[dayKey].push(e);
      });

      list.innerHTML = Object.entries(groups).map(([day, items]) => `
        <div class="history-day-group">
          <div class="history-day-label">${day}</div>
          ${items.map(e => {
            const t = new Date(e.date);
            const time = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
            return `
              <div class="panel-list-item">
                <div class="task-indicator" style="border-color:${e.color}; background:${e.color};"></div>
                <div class="task-info" style="flex:1;min-width:0">
                  <div class="task-course" style="color:${e.color}">${e.courseName}</div>
                  <div class="task-title">${this.escapeHtml(e.label)}</div>
                </div>
                <span style="color:var(--text-sub);font-size:.72rem;white-space:nowrap">${time}</span>
              </div>
            `;
          }).join('')}
        </div>
      `).join('');
    }
  },

  openExplore() {
    const panel = document.getElementById('explorePanel');
    const list = document.getElementById('exploreList');
    panel.classList.remove('hidden');
    list.innerHTML = CONFIG.weekendCourses.map(c => `
      <a class="explore-item" href="${c.url}" target="_blank">
        <span class="exp-icon" style="background:${c.color}">${c.icon}</span>
        <span class="exp-name">${c.name}</span>
      </a>
    `).join('');
  },

  // ─── 工具函数 ───
  formatTime(date) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  },

  formatRelativeDate(date) {
    const today = new Date();
    const diff = Math.round((date - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === -1) return '昨天';
    if (diff > 0) return `${diff}天后`;
    return `${-diff}天前`;
  },

  isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ─── PWA ───
  async registerSW() {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('sw.js'); } catch { /* ignore */ }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
