// ═══════════════════════════════════════════════════
//  轻量 iCal 解析器 — 解析 VEVENT 为 JS 对象
// ═══════════════════════════════════════════════════

const ICalParser = {

  /**
   * 解析 iCal 文本为事件数组
   * @param {string} text  原始 .ics 内容
   * @returns {Array<{summary:string, start:Date, end:Date, location:string}>}
   */
  parse(text) {
    const events = [];
    // 处理折叠行（RFC 5545：行首空白 = 续上一行）
    const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\r/g, '');
    const blocks = unfolded.split('BEGIN:VEVENT');

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i].split('END:VEVENT')[0];
      const ev = {};
      const lines = block.split('\n');

      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) continue;
        const keyPart = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1).trim();
        // 去掉参数 (DTSTART;TZID=... → DTSTART)
        const key = keyPart.split(';')[0].trim();

        switch (key) {
          case 'SUMMARY':
            ev.summary = value;
            break;
          case 'DTSTART':
            ev.start = ICalParser.parseDate(value);
            break;
          case 'DTEND':
            ev.end = ICalParser.parseDate(value);
            break;
          case 'LOCATION':
            ev.location = value;
            break;
          case 'DESCRIPTION':
            ev.description = value;
            break;
        }
      }

      if (ev.start && ev.end) {
        events.push(ev);
      }
    }

    return events.sort((a, b) => a.start - b.start);
  },

  /**
   * 解析 iCal 日期格式
   * 支持: 20260413T083000Z, 20260413T083000, 20260413
   */
  parseDate(str) {
    const clean = str.replace(/[^0-9TZ]/g, '');
    if (clean.length >= 15) {
      // YYYYMMDDTHHmmss
      const y = parseInt(clean.substring(0, 4));
      const m = parseInt(clean.substring(4, 6)) - 1;
      const d = parseInt(clean.substring(6, 8));
      const h = parseInt(clean.substring(9, 11));
      const min = parseInt(clean.substring(11, 13));
      const s = parseInt(clean.substring(13, 15));
      if (clean.endsWith('Z')) {
        return new Date(Date.UTC(y, m, d, h, min, s));
      }
      return new Date(y, m, d, h, min, s);
    }
    if (clean.length >= 8) {
      const y = parseInt(clean.substring(0, 4));
      const m = parseInt(clean.substring(4, 6)) - 1;
      const d = parseInt(clean.substring(6, 8));
      return new Date(y, m, d);
    }
    return new Date(str);
  },

  /**
   * 通过 CORS 代理获取 iCal
   */
  async fetchICal(url, corsProxy) {
    const proxyUrl = corsProxy + encodeURIComponent(url);
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error(`iCal fetch failed: ${resp.status}`);
    const text = await resp.text();
    return ICalParser.parse(text);
  },

  /**
   * 获取某一天的所有课程事件
   * @param {Array} events
   * @param {Date} date
   * @returns {Array}
   */
  getEventsForDate(events, date) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return events.filter(ev => ev.start >= dayStart && ev.start < dayEnd)
      .sort((a, b) => a.start - b.start);
  }
};
