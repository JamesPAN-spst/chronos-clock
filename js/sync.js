// ═══════════════════════════════════════════════════
//  Chronos · GitHub 每日同步模块
//  Contents API — 每日 JSON 上传 + 自动清理
// ═══════════════════════════════════════════════════

const Sync = {
  GH_TOKEN_KEY: 'clock_gh_token',
  GH_REPO_KEY: 'clock_gh_repo',
  GH_RETENTION_KEY: 'clock_gh_retention',
  SYNC_DIR: 'chronos-data',

  getConfig() {
    return {
      token: localStorage.getItem(this.GH_TOKEN_KEY) || '',
      repo: localStorage.getItem(this.GH_REPO_KEY) || '',
      retention: parseInt(localStorage.getItem(this.GH_RETENTION_KEY)) || 30
    };
  },

  saveConfig(token, repo, retention) {
    if (token) localStorage.setItem(this.GH_TOKEN_KEY, token);
    if (repo)  localStorage.setItem(this.GH_REPO_KEY, repo);
    localStorage.setItem(this.GH_RETENTION_KEY, String(retention || 30));
  },

  isConfigured() {
    const c = this.getConfig();
    return !!(c.token && c.repo);
  },

  // ─── 构建当日同步数据 ───
  buildDailyData(date, drawer, trash) {
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    const todayEvents = ICalParser.getEventsForDate(App.allEvents, date);
    const plan = Scheduler.planDay(date, todayEvents);
    const weekly = Scheduler.getWeeklyStats();
    const courseProgress = Scheduler.getCourseProgress();

    const tasks = plan.schedule.map(t => {
      const key = `${t.courseId}_${t.unitIdx}_${t.chapterIdx}`;
      const inDrawer = drawer.some(d => d.key === key);
      const inTrash  = trash.some(d => d.key === key);
      const isDone   = t.type === 'review'
        ? Scheduler.isReviewDone(t.courseId, t.unitIdx)
        : Scheduler.isDone(t.courseId, t.unitIdx, t.chapterIdx);

      return {
        courseId: t.courseId,
        courseName: t.courseName,
        title: t.title,
        type: t.type,
        status: inDrawer || isDone ? 'completed' : inTrash ? 'skipped' : 'pending'
      };
    });

    return {
      date: dateStr,
      generated: new Date().toISOString(),
      tasks,
      drawer: drawer.map(d => ({ courseId: d.courseId, title: d.title })),
      trash:  trash.map(d => ({ courseId: d.courseId, title: d.title })),
      stats: {
        weekLearned: weekly.learned,
        weekReviewed: weekly.reviewed,
        courses: courseProgress.map(c => ({ id: c.id, percent: c.percent }))
      }
    };
  },

  // ─── 上传到 GitHub ───
  async upload(data) {
    const { token, repo } = this.getConfig();
    if (!token || !repo) throw new Error('未配置 GitHub Token / 仓库');

    const path = `${this.SYNC_DIR}/${data.date}.json`;
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

    // 检查文件是否已存在（需要 sha 来更新）
    let sha = null;
    try {
      const check = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (check.ok) {
        sha = (await check.json()).sha;
      }
    } catch { /* file doesn't exist yet */ }

    const body = { message: `chronos: ${data.date}`, content: encoded };
    if (sha) body.sha = sha;

    const resp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return true;
  },

  // ─── 清理过期文件 ───
  async cleanOld() {
    const { token, repo, retention } = this.getConfig();
    if (!token || !repo) throw new Error('未配置 GitHub');

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${this.SYNC_DIR}`;
    const resp = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!resp.ok) {
      if (resp.status === 404) return 0; // 目录不存在
      throw new Error(`获取目录失败: HTTP ${resp.status}`);
    }

    const files = await resp.json();
    if (!Array.isArray(files)) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retention);
    const pad = n => String(n).padStart(2, '0');
    const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;

    let deleted = 0;
    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      const dateInName = file.name.replace('.json', '');
      if (dateInName < cutoffStr) {
        try {
          await fetch(file.url, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: `cleanup: ${file.name}`, sha: file.sha })
          });
          deleted++;
        } catch { /* skip individual failures */ }
      }
    }
    return deleted;
  },

  // ─── 自动同步（默认上传当日日程完成情况）───
  async autoSync(drawer, trash) {
    if (!this.isConfigured()) return;
    try {
      const data = this.buildDailyData(new Date(), drawer || [], trash || []);
      await this.upload(data);
      return true;
    } catch {
      return false;
    }
  }
};
