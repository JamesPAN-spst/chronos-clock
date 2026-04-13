// ═══════════════════════════════════════════════════
//  学习课程配置 — 所有 GitHub Pages 学习链接
// ═══════════════════════════════════════════════════

const CONFIG = {
  // vCal 订阅地址
  icalURL: 'https://adeconsult.app.u-pariscite.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=74596&projectId=0&calType=vcal&nbWeeks=4',

  // CORS 代理（GitHub Pages 无法直接跨域请求 iCal）
  corsProxy: 'https://api.allorigins.win/raw?url=',

  // 每日学习时间范围
  dayStart: '08:00',
  dayEnd: '23:30',

  // 学习会话参数
  sessionMinutes: 40,
  bufferMinutes: 5,
  minSlotMinutes: 45, // session + buffer

  // 每周目标：3 个单元（跨三门主课分配）
  weeklyUnits: 3,
  chaptersPerUnit: 4,

  // 每日学习上限（避免排满一整天）
  maxDailySessions: 4,

  // 周五留给用户
  freeDays: [5], // 5 = Friday

  // 路程时间（分钟），仅供参考不自动占用
  commuteMinutes: 120,

  // ─── 三门主课 ───
  mainCourses: [
    {
      id: 'cpp',
      name: 'C++ 全栈',
      color: '#4FC3F7',
      icon: 'C++',
      baseURL: 'https://jamespan-spst.github.io/cst/',
      units: [
        {
          title: 'C++ 基础 Fundamentals',
          chapters: [
            { title: '1.1 环境搭建与 Hello World', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.2 变量、类型与运算符', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.3 控制流与循环', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.4 函数与作用域', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.5 数组与指针基础', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.6 引用与 const', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.7 字符串 string', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.8 结构体 struct', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.9 枚举与联合体', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.10 文件 I/O', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.11 预处理器', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.12 编译与链接', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '1.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: '面向对象编程 OOP',
          chapters: [
            { title: '2.1 类与对象', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.2 构造与析构', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.3 封装与访问控制', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.4 继承', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.5 多态与虚函数', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.6 抽象类与接口', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.7 运算符重载', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.8 友元与嵌套类', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '2.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: 'STL & Algorithms',
          chapters: [
            { title: '3.1 容器概览', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.2 vector & deque', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.3 list & forward_list', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.4 set & map', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.5 unordered 容器', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.6 迭代器', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.7 算法库', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.8 函数对象与 lambda', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '3.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: '现代 C++ (C++11~23)',
          chapters: [
            { title: '4.1 auto & decltype', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.2 移动语义 & 右值引用', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.3 智能指针', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.4 constexpr & consteval', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.5 结构化绑定 & optional', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.6 Ranges & Views', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.7 Concepts & Modules', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.8 协程 Coroutines', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '4.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: '内存管理 Memory',
          chapters: [
            { title: '5.1 栈 vs 堆', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '5.2 new/delete 深入', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '5.3 内存对齐与缓存', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '5.4 内存池 & allocator', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '5.5 内存泄漏检测', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '5.6 RAII 深入', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '5.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: '模板与泛型 Templates',
          chapters: [
            { title: '6.1 函数模板', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '6.2 类模板', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '6.3 模板特化', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '6.4 变参模板', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '6.5 SFINAE & enable_if', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '6.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: '并发编程 Concurrency',
          chapters: [
            { title: '7.1 线程基础', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '7.2 互斥量与锁', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '7.3 条件变量', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '7.4 原子操作', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '7.5 async & future', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '7.6 线程池', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '7.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: '设计模式 Design Patterns',
          chapters: [
            { title: '8.1 单例 & 工厂', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '8.2 观察者 & 策略', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '8.3 装饰器 & 适配器', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '8.4 命令 & 状态', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '8.5 组合 & 访问者', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '8.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
        {
          title: '构建与工具链 Build & CI',
          chapters: [
            { title: '9.1 CMake 入门', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '9.2 单元测试', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '9.3 CI/CD 流水线', url: 'https://jamespan-spst.github.io/cst/' },
            { title: '9.P 实战项目', url: 'https://jamespan-spst.github.io/cst/' },
          ]
        },
      ]
    },
    {
      id: 'math',
      name: '数学全景',
      color: '#81C784',
      icon: 'MTH',
      baseURL: 'https://jamespan-spst.github.io/math_univers/',
      units: [
        {
          title: 'MC2 — 微积分+线性代数',
          chapters: [
            { title: 'MC2 微积分+线代', url: 'https://jamespan-spst.github.io/math_univers/modules/foundation/mc2.html' },
          ]
        },
        {
          title: 'EDO — 常微分方程',
          chapters: [
            { title: '一阶常微分方程', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/edo/ch01.html' },
            { title: '存在唯一性定理', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/edo/ch02.html' },
            { title: '高阶线性方程', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/edo/ch03.html' },
            { title: '线性微分方程组', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/edo/ch04.html' },
            { title: '定性理论与相图', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/edo/ch05.html' },
            { title: '稳定性与 Lyapunov 方法', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/edo/ch06.html' },
          ]
        },
        {
          title: 'Topologie — 点集拓扑',
          chapters: [
            { title: '拓扑空间的定义', url: 'https://jamespan-spst.github.io/math_univers/modules/geometry/topology/ch01.html' },
            { title: '连续映射与同胚', url: 'https://jamespan-spst.github.io/math_univers/modules/geometry/topology/ch02.html' },
            { title: '分离公理', url: 'https://jamespan-spst.github.io/math_univers/modules/geometry/topology/ch03.html' },
            { title: '构造新空间', url: 'https://jamespan-spst.github.io/math_univers/modules/geometry/topology/ch04.html' },
            { title: '紧致性', url: 'https://jamespan-spst.github.io/math_univers/modules/geometry/topology/ch05.html' },
            { title: '连通性', url: 'https://jamespan-spst.github.io/math_univers/modules/geometry/topology/ch06.html' },
            { title: '完备度量空间', url: 'https://jamespan-spst.github.io/math_univers/modules/geometry/topology/ch07.html' },
          ]
        },
        {
          title: 'Groupes — 群论',
          chapters: [
            { title: '什么是群？', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/groups/ch01.html' },
            { title: '子群与陪集', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/groups/ch02.html' },
            { title: '正规子群与商群', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/groups/ch03.html' },
            { title: '同态与同构', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/groups/ch04.html' },
            { title: '群作用', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/groups/ch05.html' },
            { title: 'Sylow 定理', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/groups/ch06.html' },
          ]
        },
        {
          title: 'Analyse réelle — 实分析',
          chapters: [
            { title: '测度空间', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/real-analysis/ch01.html' },
            { title: 'Lebesgue 测度的构造', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/real-analysis/ch02.html' },
            { title: 'Lebesgue 积分', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/real-analysis/ch03.html' },
            { title: '收敛定理', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/real-analysis/ch04.html' },
            { title: 'Lp 空间', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/real-analysis/ch05.html' },
            { title: '乘积测度与 Fubini', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/real-analysis/ch06.html' },
            { title: 'Radon-Nikodym 与符号测度', url: 'https://jamespan-spst.github.io/math_univers/modules/analysis/real-analysis/ch07.html' },
          ]
        },
        {
          title: 'Anneaux — 环论',
          chapters: [
            { title: '环的基本概念', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/rings/ch01.html' },
            { title: '理想与商环', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/rings/ch02.html' },
            { title: '多项式环', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/rings/ch03.html' },
            { title: '域扩张', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/rings/ch04.html' },
            { title: 'Galois 理论初步', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/rings/ch05.html' },
            { title: '有限域', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/rings/ch06.html' },
          ]
        },
        {
          title: 'Algèbre lin. II — 线代进阶',
          chapters: [
            { title: '对偶空间', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/linear-adv/ch01.html' },
            { title: '最小多项式与 Cayley-Hamilton', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/linear-adv/ch02.html' },
            { title: 'Jordan 标准形', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/linear-adv/ch03.html' },
            { title: '双线性形式与二次型', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/linear-adv/ch04.html' },
            { title: '张量积', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/linear-adv/ch05.html' },
            { title: '谱定理与矩阵分解', url: 'https://jamespan-spst.github.io/math_univers/modules/algebra/linear-adv/ch06.html' },
          ]
        },
      ]
    },
    {
      id: 'arch',
      name: '计算机结构',
      color: '#FFB74D',
      icon: 'HW',
      baseURL: 'https://jamespan-spst.github.io/Computer_Architecture/',
      units: [
        {
          title: 'Phase 0 — 电子基础',
          chapters: [
            { title: '电压·电流·电阻', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-1-electronics/ch01.html' },
            { title: '电容·电感', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-1-electronics/ch02.html' },
            { title: '晶体管 Diode/Transistor', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-1-electronics/ch03.html' },
            { title: 'CMOS 逻辑', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-1-electronics/ch04.html' },
          ]
        },
        {
          title: 'Phase 1 — 数字逻辑',
          chapters: [
            { title: '布尔代数·逻辑门', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-2-logic/ch01.html' },
            { title: '组合电路·加法器·MUX', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-2-logic/ch03.html' },
            { title: '时序电路·触发器', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-3-memory/ch01.html' },
            { title: '有限状态机 FSM', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-2-logic/ch04.html' },
          ]
        },
        {
          title: 'Phase 2 — 存储与时序',
          chapters: [
            { title: 'SRAM & DRAM', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-3-memory/ch03.html' },
            { title: 'Flash & SSD', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-3-memory/ch03.html' },
            { title: '时钟域与同步', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-3-memory/ch04.html' },
            { title: '存储层次概览', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-3-memory/ch03.html' },
          ]
        },
        {
          title: 'Phase 3 — 处理器 CPU',
          chapters: [
            { title: '指令集架构 ISA', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-5-software-hardware/ch01.html' },
            { title: '数据通路 Datapath', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-4-cpu/ch01.html' },
            { title: '流水线 Pipeline', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-4-cpu/ch02.html' },
            { title: '分支预测·乱序执行', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-4-cpu/ch04.html' },
          ]
        },
        {
          title: 'Phase 3 — Cache 与虚拟内存',
          chapters: [
            { title: 'Cache 原理·映射策略', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-4-cpu/ch03.html' },
            { title: '替换与写策略', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-4-cpu/ch03.html' },
            { title: '虚拟内存·TLB', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-5-software-hardware/ch04.html' },
            { title: '多级 Cache 设计', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-4-cpu/ch03.html' },
          ]
        },
        {
          title: 'Phase 4 — 软硬交界',
          chapters: [
            { title: '中断与异常', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-5-software-hardware/ch03.html' },
            { title: 'I/O 系统与 DMA', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-6-bus-network/ch04.html' },
            { title: '汇编到可执行', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-5-software-hardware/ch02.html' },
            { title: '系统调用与特权级', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-5-software-hardware/ch03.html' },
          ]
        },
        {
          title: 'Phase 5 — 互联与总线',
          chapters: [
            { title: '总线协议 AXI/PCIe', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-6-bus-network/ch01.html' },
            { title: '片上网络 NoC', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-6-bus-network/ch03.html' },
            { title: '多核互联·一致性', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-4-cpu/ch05.html' },
            { title: 'GPU 架构入门', url: 'https://jamespan-spst.github.io/Computer_Architecture/stage-7-gpu-graphics/ch01.html' },
          ]
        },
      ]
    }
  ],

  // ─── 周末 / 自由时间可选课程 ───
  weekendCourses: [
    {
      id: 'cs_overview',
      name: 'CS Overview',
      color: '#CE93D8',
      icon: 'CS',
      url: 'https://jamespan-spst.github.io/ComputerScienceOverview/'
    },
    {
      id: 'algo',
      name: '算法互动',
      color: '#F48FB1',
      icon: 'ALG',
      url: 'https://jamespan-spst.github.io/algo_interactive/'
    },
    {
      id: 'python',
      name: 'Python3 教程',
      color: '#90CAF9',
      icon: 'py',
      url: 'https://www.runoob.com/python3/python3-tutorial.html'
    },
  ],

  // ─── 考试周复习课程 ───
  examCourses: [
    {
      id: 'review_mc2',
      name: 'MC2 复习',
      color: '#A5D6A7',
      icon: 'REV',
      url: 'https://jamespan-spst.github.io/review_math_cm2/'
    },
    {
      id: 'review_edo',
      name: 'EDO 复习',
      color: '#FFCC80',
      icon: 'ODE',
      url: 'https://jamespan-spst.github.io/edo_review/'
    },
    {
      id: 'review_numlog',
      name: '数字逻辑复习',
      color: '#EF9A9A',
      icon: 'LOG',
      url: 'https://jamespan-spst.github.io/numlog/'
    },
    {
      id: 'review_calculs',
      name: '数学分析精练',
      color: '#80CBC4',
      icon: 'CAL',
      url: 'https://jamespan-spst.github.io/math_calculs/'
    },
  ]
};
