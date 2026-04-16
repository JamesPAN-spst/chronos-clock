#!/usr/bin/env node
// ═══════════════════════════════════════════════════
//  Chronos Telegram 通知脚本
//  GitHub Actions cron 调用，发送每日学习计划
// ═══════════════════════════════════════════════════

const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const CHAT_ID   = process.env.TG_CHAT_ID;
const ICAL_URL  = process.env.ICAL_URL || '';
const CORS_PROXY = '';  // 服务端不需要 CORS 代理

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('Missing TG_BOT_TOKEN or TG_CHAT_ID');
  process.exit(1);
}

// ─── 内联课程配置（与 config.js 同步） ───

const CONFIG = {
  dayStart: '08:00',
  dayEnd: '23:30',
  sessionMinutes: 40,
  bufferMinutes: 5,
  minSlotMinutes: 45,
  weeklyUnits: 3,
  maxDailySessions: 4,
  freeDays: [5],

  mainCourses: [
    {
      id: 'cpp', name: 'C++ 全栈', icon: '💻', color: '#4FC3F7',
      baseURL: 'https://jamespan-spst.github.io/cst/',
      units: [
        { title: 'C++ 基础', chapters: 13 },
        { title: '面向对象编程 OOP', chapters: 9 },
        { title: 'STL & Algorithms', chapters: 9 },
        { title: '现代 C++ (C++11~23)', chapters: 9 },
        { title: '内存管理 Memory', chapters: 7 },
        { title: '模板与泛型 Templates', chapters: 6 },
        { title: '并发编程 Concurrency', chapters: 7 },
        { title: '设计模式 Design Patterns', chapters: 6 },
        { title: '构建与工具链 Build & CI', chapters: 4 },
      ]
    },
    {
      id: 'math', name: '数学全景', icon: '📐', color: '#81C784',
      baseURL: 'https://jamespan-spst.github.io/math_univers/',
      units: [
        { title: 'MC2 微积分+线代', chapters: 1 },
        { title: 'EDO 常微分方程', chapters: 6 },
        { title: 'Topologie 点集拓扑', chapters: 7 },
        { title: 'Groupes 群论', chapters: 6 },
        { title: 'Analyse réelle 实分析', chapters: 7 },
        { title: 'Anneaux 环论', chapters: 6 },
        { title: 'Algèbre lin. II 线代进阶', chapters: 6 },
      ]
    },
    {
      id: 'arch', name: '计算机结构', icon: '🔧', color: '#FFB74D',
      baseURL: 'https://jamespan-spst.github.io/Computer_Architecture/',
      units: [
        { title: 'Phase 0 电子基础', chapters: 4 },
        { title: 'Phase 1 数字逻辑', chapters: 4 },
        { title: 'Phase 2 存储与时序', chapters: 4 },
        { title: 'Phase 3 处理器 CPU', chapters: 4 },
        { title: 'Phase 3 Cache 与虚拟内存', chapters: 4 },
        { title: 'Phase 4 软硬交界', chapters: 4 },
        { title: 'Phase 5 互联与总线', chapters: 4 },
      ]
    }
  ],

  examCourses: [
    { id: 'review_mc2', name: 'MC2 复习', icon: '📝' },
    { id: 'review_edo', name: 'EDO 复习', icon: '📝' },
    { id: 'review_numlog', name: '数字逻辑复习', icon: '📝' },
    { id: 'review_calculs', name: '数学分析精练', icon: '📝' },
  ]
};

// ─── 时区工具 ───

function parisNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
}

function fmt(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fmtDate(d) {
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  return `${d.getMonth()+1}月${d.getDate()}日 ${days[d.getDay()]}`;
}

// ─── iCal 解析 ───

async function fetchClassEvents(date) {
  if (!ICAL_URL) return [];

  try {
    const res = await fetch(ICAL_URL, { signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    return parseVCal(text, date);
  } catch (e) {
    console.warn('iCal fetch failed:', e.message);
    return [];
  }
}

function parseVCal(text, date) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');

  const dateStr = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key) => {
      const m = block.match(new RegExp(`${key}[^:]*:(.+)`));
      return m ? m[1].trim() : '';
    };

    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    const summary = get('SUMMARY');

    if (!dtstart.startsWith(dateStr)) continue;

    const parseTime = (dt) => {
      const m = dt.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (!m) return null;
      // iCal times — assume local Paris time or convert from UTC if 'Z' suffix
      const d = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
      if (dt.endsWith('Z')) {
        // Convert UTC to Paris (UTC+1 or UTC+2 in summer)
        const utc = new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5]));
        const paris = new Date(utc.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        return paris;
      }
      return d;
    };

    const start = parseTime(dtstart);
    const end = parseTime(dtend);
    if (start && end) {
      events.push({ start, end, summary });
    }
  }

  return events.sort((a, b) => a.start - b.start);
}

// ─── 空闲时段计算 ───

function findFreeSlots(classEvents, date) {
  const [startH, startM] = CONFIG.dayStart.split(':').map(Number);
  const [endH, endM] = CONFIG.dayEnd.split(':').map(Number);
  const y = date.getFullYear(), mo = date.getMonth(), d = date.getDate();

  const dayStart = new Date(y, mo, d, startH, startM);
  const dayEnd   = new Date(y, mo, d, endH, endM);

  const blocked = [
    { start: new Date(y, mo, d, 12, 0),  end: new Date(y, mo, d, 13, 15) },
    { start: new Date(y, mo, d, 18, 30), end: new Date(y, mo, d, 19, 30) },
  ];

  const travelMin = 60;
  const expanded = classEvents.map(ev => ({
    start: new Date(ev.start.getTime() - travelMin * 60000),
    end:   new Date(ev.end.getTime()   + travelMin * 60000),
  }));

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
    if (evEnd > cursor) cursor = new Date(evEnd);
  }

  if (cursor < dayEnd) {
    const gap = (dayEnd - cursor) / 60000;
    if (gap >= CONFIG.minSlotMinutes) {
      slots.push({ start: new Date(cursor), end: dayEnd, minutes: gap });
    }
  }

  return slots;
}

function slotToSessions(slot) {
  const sessions = [];
  let cursor = new Date(slot.start);
  const totalMin = CONFIG.sessionMinutes + CONFIG.bufferMinutes;

  while ((slot.end - cursor) / 60000 >= CONFIG.sessionMinutes) {
    const sessionEnd = new Date(cursor.getTime() + CONFIG.sessionMinutes * 60000);
    sessions.push({ start: new Date(cursor), end: sessionEnd });
    cursor = new Date(cursor.getTime() + totalMin * 60000);
  }
  return sessions;
}

// ─── 简化排程 ───

function planDay(date, classEvents) {
  const dow = date.getDay();

  if (CONFIG.freeDays.includes(dow)) {
    return { schedule: [], freeDay: true };
  }

  const isWeekend = (dow === 0 || dow === 6);
  const freeSlots = findFreeSlots(classEvents, date);

  let allSessions = [];
  const sortedEvents = [...classEvents].sort((a, b) => a.start - b.start);

  for (const slot of freeSlots) {
    const blockSessions = slotToSessions(slot);
    let precedingClass = null;
    for (const ev of sortedEvents) {
      if (ev.end <= slot.start && (slot.start - ev.end) / 60000 <= 75) {
        precedingClass = ev.summary;
      }
    }
    const affinity = classAffinityCourse(precedingClass);
    for (const s of blockSessions) {
      s.affinity = affinity;
      allSessions.push(s);
    }
  }

  const courseOrder = ['cpp', 'math', 'arch'];
  const classCount = classEvents.length;
  let maxBlocks = classCount >= 5 ? 1 : classCount >= 3 ? 2 : 3;
  maxBlocks = Math.min(maxBlocks, allSessions.length, courseOrder.length);

  const affinityCourses = new Set();
  for (const s of allSessions) {
    if (s.affinity) affinityCourses.add(s.affinity);
  }

  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const rotateOffset = dayOfYear % courseOrder.length;

  const pickedCourses = [];
  for (const cid of affinityCourses) {
    if (pickedCourses.length >= maxBlocks) break;
    pickedCourses.push(cid);
  }
  for (let i = 0; i < courseOrder.length && pickedCourses.length < maxBlocks; i++) {
    const cid = courseOrder[(rotateOffset + i) % courseOrder.length];
    if (!pickedCourses.includes(cid)) pickedCourses.push(cid);
  }

  // 选时间块：优先晚间
  const sortedByPriority = [...allSessions].sort((a, b) => {
    const aEve = a.start.getHours() >= 18 ? 0 : 1;
    const bEve = b.start.getHours() >= 18 ? 0 : 1;
    return aEve - bEve || a.start - b.start;
  });
  const selectedSessions = sortedByPriority.slice(0, pickedCourses.length)
    .sort((a, b) => a.start - b.start);

  const schedule = [];
  for (let i = 0; i < selectedSessions.length; i++) {
    const session = selectedSessions[i];
    const cid = pickedCourses[i];
    const course = CONFIG.mainCourses.find(c => c.id === cid);
    if (course) {
      schedule.push({
        courseIcon: course.icon,
        courseName: course.name,
        timeStart: session.start,
        timeEnd: session.end,
      });
    }
  }

  return { schedule, freeDay: false, isWeekend, classCount: classEvents.length, freeSlotCount: freeSlots.length };
}

function classAffinityCourse(summary) {
  if (!summary) return null;
  const s = summary.toLowerCase();
  if (s.includes('mc2') || s.includes('maths et calcul') || s.includes('calcul')) return 'math';
  if (s.includes('numeration') || s.includes('logique') || s.includes('architecture')) return 'arch';
  if (s.includes('c++') || s.includes('programmation') || s.includes('coding')) return 'cpp';
  return null;
}

// ─── Telegram 发送 ───

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error('Telegram error:', data);
    process.exit(1);
  }
  console.log('Message sent successfully');
}

// ─── 构建消息 ───

function buildMessage(date, classEvents, plan) {
  const lines = [];
  const greetHour = date.getHours();
  const greeting = greetHour < 12 ? '🌅 早上好' : greetHour < 18 ? '☀️ 下午好' : '🌙 晚上好';

  lines.push(`${greeting}！`);
  lines.push(`📅 *${fmtDate(date)}* — Chronos 每日计划\n`);

  // 今日课程
  if (classEvents.length > 0) {
    lines.push(`🏫 *今日课程 (${classEvents.length}节)*`);
    for (const ev of classEvents) {
      const sh = fmt(ev.start.getHours(), ev.start.getMinutes());
      const eh = fmt(ev.end.getHours(), ev.end.getMinutes());
      lines.push(`  📌 ${sh}–${eh}  ${ev.summary}`);
    }
    lines.push('');
  } else {
    lines.push('🏫 今日无课\n');
  }

  // 学习计划
  if (plan.freeDay) {
    lines.push('🎉 *今天是自由日，好好放松！*');
  } else if (plan.schedule.length === 0) {
    lines.push('📚 今日课太多，没有空闲时段排学习');
  } else {
    lines.push(`📚 *学习计划 (${plan.schedule.length}块 × 40min)*`);
    for (const s of plan.schedule) {
      const sh = fmt(s.timeStart.getHours(), s.timeStart.getMinutes());
      const eh = fmt(s.timeEnd.getHours(), s.timeEnd.getMinutes());
      lines.push(`  ${s.courseIcon} ${sh}–${eh}  *${s.courseName}*`);
    }
  }

  lines.push('');
  lines.push(`🔗 [打开 Chronos](https://jamespan-spst.github.io/chronos-clock/)`);

  return lines.join('\n');
}

// ─── 提醒模式（课前15分钟） ───

function buildReminder(date, classEvents, plan) {
  const now = date.getTime();
  const upcoming = [];

  // 检查 15 分钟内有没有学习 session 开始
  for (const s of plan.schedule) {
    const diff = (s.timeStart.getTime() - now) / 60000;
    if (diff > 0 && diff <= 20) {
      upcoming.push(s);
    }
  }

  if (upcoming.length === 0) return null;

  const lines = ['⏰ *学习提醒*\n'];
  for (const s of upcoming) {
    const sh = fmt(s.timeStart.getHours(), s.timeStart.getMinutes());
    lines.push(`${s.courseIcon} ${sh} 开始学 *${s.courseName}*`);
  }
  lines.push('\n🔗 [打开 Chronos](https://jamespan-spst.github.io/chronos-clock/)');
  return lines.join('\n');
}

// ─── 主流程 ───

async function main() {
  const mode = process.argv[2] || 'morning'; // 'morning' | 'reminder'
  const now = parisNow();

  console.log(`Mode: ${mode}, Paris time: ${now.toISOString()}`);

  const classEvents = await fetchClassEvents(now);
  console.log(`Found ${classEvents.length} class events`);

  const plan = planDay(now, classEvents);

  if (mode === 'morning') {
    const msg = buildMessage(now, classEvents, plan);
    await sendTelegram(msg);
  } else if (mode === 'reminder') {
    const msg = buildReminder(now, classEvents, plan);
    if (msg) {
      await sendTelegram(msg);
    } else {
      console.log('No upcoming session in the next 20 minutes, skipping');
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
