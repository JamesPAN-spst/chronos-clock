// ═══════════════════════════════════════════════════
//  记忆日程模块 — 手动编辑周模板，自动生成重复课表
//  选定日期范围 + 每周7天模板 → 按需展开为课程事件
// ═══════════════════════════════════════════════════

const MemorySchedule = {
  STORAGE_KEY: 'clock_memory_schedules',

  /** 加载所有记忆日程 */
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch { return []; }
  },

  /** 保存全部记忆日程 */
  save(ranges) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ranges));
  },

  /** 删除一个 range */
  remove(id) {
    const list = this.load().filter(r => r.id !== id);
    this.save(list);
  },

  /** 新增/更新一个 range */
  upsert(range) {
    const list = this.load();
    const idx = list.findIndex(r => r.id === range.id);
    if (idx >= 0) list[idx] = range;
    else list.push(range);
    this.save(list);
  },

  /**
   * 获取某天由记忆日程生成的课程事件
   * 返回格式与 iCal 事件一致: {summary, start:Date, end:Date, location:'', _memory:true}
   */
  getEventsForDate(date) {
    const ranges = this.load();
    const events = [];
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const dow = date.getDay(); // 0=日 1=一 ... 6=六
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    for (const range of ranges) {
      if (dateStr < range.start || dateStr > range.end) continue;
      const daySlots = range.weekly[String(dow)];
      if (!daySlots || daySlots.length === 0) continue;

      for (const slot of daySlots) {
        const [sh, sm] = slot.start.split(':').map(Number);
        const [eh, em] = slot.end.split(':').map(Number);
        events.push({
          summary: slot.summary || '课程',
          start: new Date(y, m, d, sh, sm),
          end: new Date(y, m, d, eh, em),
          location: slot.location || '',
          _memory: true
        });
      }
    }

    return events.sort((a, b) => a.start - b.start);
  },

  /** 生成唯一 ID */
  genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
};
