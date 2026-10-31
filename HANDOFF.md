# VocabFlow 开发交接

核对日期：2026-10-30。本文依据当前工作区代码、配置和近期会话中**实际运行**的检查整理，供 Claude Code 等后续开发助手使用。接手时先读根目录、`backend/`、`frontend/` 中适用的 `AGENTS.md`，不要假定工具会自动加载这些规则。

本文区分“已有实现”“本次实际验证过的结果”“历史记录”和“待确认”。第 3 节末尾写明了每项检查实际跑过什么、没跑什么；之后再改代码，不能把这里的结果当作新的验证。

## 1. 项目目标与用户

VocabFlow 是面向个人英语学习者的词汇学习平台：用户在日常生活中遇到生词或短语，只需录入词/短语，系统保存到个人词库，并补充结构化学习信息，再逐步支持每日学习和复习。

长期产品链路：记录 → 补充学习内容 → 学习 → 练习 → 评估 → 更新掌握度 → 安排复习 → 复习。目前只实现了其中一部分，不能把愿景写成现成功能。

用户配置包含 CLB 等级和每日新词目标；原始需求未明确限定国籍、考试或商业客户群，更细的目标用户画像、商业模式和正式发布计划均为**待确认**。

## 2. 技术栈与目录

后端：Java 21、Spring Boot 3.5.11、Spring MVC/Security、Jakarta Validation、Spring Data JPA、MySQL、Flyway、Maven Wrapper 3.9.11。测试使用 JUnit/Mockito/MockMvc、H2 和 MySQL 8.4 Testcontainers。Java 格式化使用 Spotless 2.43.0 + Google Java Format 1.19.2。

前端：React 19、严格模式 TypeScript 6、Vite 8、npm、Node 24（fnm）。React Router 使用 Declarative Mode，TanStack Query 管理服务端状态，Tailwind 使用官方 Vite 插件。测试使用 Vitest、jsdom、React Testing Library、jest-dom 和 user-event；lint 使用 Oxlint。

前端锁文件记录：React 19.2.8、TypeScript 6.0.3、Vite 8.2.2、React Router 8.3.0、TanStack Query 5.102.8、Tailwind 4.3.3、Vitest 4.1.11、Oxlint 1.80.0。`package.json` 使用版本范围，重现安装以 `package-lock.json` 为准。

```text
vocabflow/
├── AGENTS.md                  仓库规则与两端质量门
├── CLAUDE.md                  给 Claude Code 的精简指引（命令、架构要点）
├── HANDOFF.md                 本交接文档
├── README.md                  产品/架构/运行说明（英文）
├── .node-version              Node 24
├── .gitignore                 构建产物、依赖、IDE和本地环境文件忽略规则
├── .claude/agents/            可复用的子代理角色：backend-dev、frontend-dev、browser-verifier
├── .github/workflows/ci.yml   GitHub Actions：backend（spotless:check + verify）和 frontend（npm ci、lint、typecheck、test、build）两个并行 job
├── backend/
│   ├── AGENTS.md              Java/架构/验证规则
│   ├── pom.xml                Spring Boot依赖、Spotless、Failsafe等
│   ├── mvnw / mvnw.cmd        项目内Maven启动脚本
│   ├── .mvn/                 Wrapper下载的Maven缓存；未跟踪安装目录
│   └── src/
│       ├── main/java/com/vocabflow/
│       │   ├── identity/      用户注册、密码验证、当前用户、用户仓储端口
│       │   ├── vocabulary/    共享词条、个人词库、补全内容、学习候选查询
│       │   ├── learning/      每日计划、计划持久化、并发恢复
│       │   ├── security/      Bearer校验、签名/撤销、Security JSON错误
│       │   └── shared/        公共Web错误响应（ApiExceptionHandler）与JSON支持
│       ├── main/resources/   application配置与db/migration/V1…V6
│       └── test/java/        快速测试与integration/*IT
├── frontend/
│   ├── AGENTS.md              前端工程约定
│   ├── README.md              前端说明：命令、结构、路由、测试约定
│   ├── package*.json          npm脚本、依赖和锁文件
│   ├── vite.config.ts         React/Tailwind、开发代理、Vitest
│   ├── tsconfig*.json         strict TypeScript项目配置
│   ├── .oxlintrc.json         React/hooks/TypeScript lint规则
│   ├── public/favicon.svg     站点图标
│   └── src/
│       ├── main.tsx          StrictMode、BrowserRouter入口
│       ├── app/              App、根Providers、路由(AppRouter)、布局(AppShell)
│       ├── features/auth/    登录/注册、当前用户、路由守卫、会话失败恢复
│       ├── features/vocabulary/ 添加表单、分页列表、详情页
│       ├── features/learning/   学习页（首页）和当天进度
│       ├── shared/api/       fetch客户端、token存储、会话事件(sessionEvents)
│       ├── shared/date.ts    本地日历日期工具；useToday.ts：跨过午夜自动更新的“今天”；navigation.ts：详情页“返回”目标
│       ├── shared/speech/    发音：播放按钮、选声音、朗读状态（Web Speech API）
│       ├── index.css         Tailwind导入与基础样式
│       └── test/             Vitest初始化与共享测试工具(utils.tsx)
└── docs/                     ROADMAP.md（建议的后续里程碑，不是已承诺需求）；暂无独立的长期设计文档
```

关键阅读入口：

- `IdentityController.java`：注册/登录/登出/当前用户的真实 API DTO。
- `VocabularyController.java`：创建/分页/详情接口；`id` 是个人 `UserVocabulary` 的 ID。
- `VocabularyService.java`：添加词汇的流程。**故意没有 `@Transactional`**，原因见第 7 节。
- `LearningVocabularyQuery.java` / `JpaLearningVocabularyQuery.java`：学习模块访问词汇的端口和实现，不能绕过它直接依赖词汇 JPA。
- `DailyLearningPlanService.java`、`DailyLearningPlanInsertTransaction.java`、`DailyLearningPlanConflictRecovery.java`：事务和并发恢复。
- `ApiError.java` / `ApiErrorResponseFactory.java` / `ApiExceptionHandler.java`：统一错误 JSON 与异常到状态码的映射；MVC 与 Spring Security 仍是独立处理链。
- `frontend/src/features/auth/hooks/useAuth.ts`：当前用户查询与认证 mutation。
- `frontend/src/shared/api/apiClient.ts` / `tokenStorage.ts` / `sessionEvents.ts`：HTTP、token 和“token 被拒绝”事件的唯一集中入口。
- `frontend/src/features/auth/hooks/AuthTokenProvider.tsx`：token 状态，以及收到 token 被拒绝事件后的登出处理。
- `frontend/src/app/router/AppRouter.tsx`、`frontend/src/app/layout/AppShell.tsx`：全部路由与登录后外壳。

## 3. 安装、启动、测试、构建

所有命令均从仓库根目录起步。根目录没有 `pom.xml` 或 `package.json`；分别进入对应子目录。依赖首次下载需要网络；不要通过修改全局环境解决项目问题。

### 工具链检查

```sh
java -version
node --version
npm --version
```

读取到的本机版本为 Temurin Java 21.0.11、Node v24.20.0、npm 11.19.0。Node 由 fnm 管理，根 `.node-version` 为 24。已配置 fnm 的终端可在仓库根目录运行 `fnm use`；不要写死个人机器上 fnm 的绝对路径。新机器若缺少工具，先报告并取得明确安装授权。

### 后端依赖与质量门

Wrapper 首次运行会下载 Maven，Maven 自动解析依赖，无需全局安装 Maven。

```sh
cd backend
./mvnw spotless:apply
./mvnw spotless:check
./mvnw test
./mvnw verify
./mvnw clean package
```

- `test`：运行快速单元/H2/API测试，不包含 `*IT`。
- `verify`：通过 Failsafe 额外运行 MySQL/Testcontainers 集成测试，是完整后端质量门，需要 Docker 可用。容器使用动态端口，不依赖个人本地 MySQL。
- `clean package`：构建可执行 jar，不替代 `verify`。
- 只跑一个 IT：`./mvnw verify -Dit.test=<类名> -Dtest=skip -Dsurefire.failIfNoSpecifiedTests=false`。
- IntelliJ 导入 `backend/pom.xml`，使用 JDK 21。

### 后端启动

默认方式使用 MySQL；先在进程环境中配置第 9 节变量，并准备可连接的数据库/账号：

```sh
cd backend
./mvnw spring-boot:run
```

只做隔离本地联调时，可使用现有 H2 `test` profile，无需本地 MySQL，也不需要环境变量：

```sh
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=test
```

后端默认端口 8080。`test` profile 的数据在进程结束后丢失；**重启后旧 token 仍有合法签名但对应用户已不存在**，所有受保护接口现在统一返回 401，前端回到登录页并显示“已登出”提示，见第 8 节。`dev` profile 仍使用 MySQL；`dev`/`test` 的配置仅用于本地/测试，不能用于生产。

### 前端安装与质量门

已有锁文件，新环境用 `npm ci` 重现依赖（`node_modules` 不会随 Git 带过来，换目录或重新克隆后必须重装）。仅在确需调整依赖时用 `npm install` 并审阅锁文件变化。

```sh
cd frontend
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run test` 默认非交互；`npm run test:watch` 用于开发观察。`build` 包含 TypeScript 检查及 Vite 构建，产物在 `frontend/dist/`。

### 前端启动与联调

在另一个终端运行：

```sh
cd frontend
npm run dev
```

访问 Vite 输出的地址，默认端口通常为 5173，以实际输出为准；若 5173 已被占用，Vite 会换端口，请看输出。Vite 开发代理将 `/api` 原路径转发至后端 8080，前端请求应始终使用相对 `/api/v1/...`。后端须同时运行。

构建预览 `npm run preview` 在当前安装的 Vite 实现里会继承 `server.proxy`，但没有实际启动验证过；不要将本地 dev/preview 代理等同于生产反向代理，生产转发方案仍待确定。

### 验证记录的边界

**本次实际运行的结果**（2026-10-29 至 10-30，在当前分支代码上）：

- 后端：`./mvnw spotless:check` 通过；`./mvnw test` 123 个测试通过；`./mvnw verify` 通过，包含 25 个 MySQL 8.4 Testcontainers IT。最近一次后端改动是间隔复习（分支 `spaced-repetition-backend`）。最近一次后端改动是 M5 的后端部分（分支 `real-enrichment-backend`：异步补全、领取标记、Claude 适配器、重试接口、每日次数上限，V5 迁移）。**真实的 Claude 适配器只用 Mock HTTP 服务器测过，没有用真实密钥调用过线上 API**；前端还没有轮询和重试按钮。
- **`pom.xml` 里的 `--enable-preview` 没有造成任何编译、测试或集成测试失败**（`test` 与 `verify` 日志里没有出现 preview 相关输出）。它的目的仍然不明，所以仍然不要删除，也不要扩散到别处。
- 前端：`npm run lint`、`typecheck`、`test`（212 个测试）、`build` 全部通过。
- **真实浏览器验证**（内置浏览器，H2 后端 + Vite，由独立的验证会话执行，只验证不改代码），已覆盖：注册、登录、刷新保持登录、登出；添加词汇、重复添加的 409 提示、空白输入；词汇详情与 404；分页（25 条、翻页、添加后回到第 1 页）；今日计划页（空计划、目标 3 取最早 3 个词、少于目标的说明、点击进入详情）；换用户后缓存隔离；375px 手机宽度下无横向滚动（含超长无空格词条）；后端停止后的错误界面与重试；后端重启使用户消失后被登出并看到提示；密码输错和主动登出不出现提示。
- **CI 工作流（`.github/workflows/ci.yml`）**：先在一个**干净的本地克隆**里（没有 `node_modules`、没有 `.mvn/`，`mvnw` 从零下载 Maven）逐条执行了同一批命令，全部通过。随后在 GitHub 上用 PR #3 **真正运行了两次（2026-10-30），两次 `backend` 和 `frontend` 都成功**，已合并（`930a3e9`）。第一次（`@v4` 的 Action）后端约 1.5 分钟、前端约 7.5 分钟，并带有警告：三个 Action 的 `@v4` 用 Node 20（已弃用，被强制用 Node 24 运行），`setup-java@v4` 已停止更新。把三个都升到 `@v5`（经核对其 `action.yml` 声明 `node24`）后第二次运行：后端约 1 分钟，前端约 1 分 40 秒，**这些警告消失了**，只剩一条通知：`ubuntu-latest` 标签从 2026-10-19 起迁移到 Ubuntu 26，目前没有受影响，未固定系统版本。runner 上的 Docker 和 Testcontainers 正常（后端 `verify` 含集成测试，成功）。前端第一次那么慢，第二次快得多，很可能是那天 GitHub Actions 的故障造成的，但这只是推断：没有读到每一步的耗时和日志。没有装 `actionlint`。**分支保护已开启**（2026-10-30，GitHub Rulesets 里的 `Protect main`，对默认分支 `main` 生效）：必须走 PR（必需审批数为 0，因为是一个人开发，GitHub 不允许批准自己的 PR）、必须通过 `backend` 和 `frontend` 两个检查、禁止删除和强制推送；仓库管理员只能在 PR 页面上绕过，留给紧急情况；没有要求线性历史（我们用 merge commit），也没有要求分支必须是最新的。已用公开接口核对这些规则确实在 `main` 上生效。
- **发音功能的浏览器验证**（Claude 桌面应用内置浏览器，Chromium 152，macOS）：该浏览器约 180 个声音，声音列表在首次 `getVoices()` 约 1.5 秒后才加载（应用没有因此出错）；设备默认的 `en-US` 声音是 Samantha，监听 `speak` 调用确认实际选中它，语速 0.9；点击后 `speaking` 为真、`aria-pressed` 随开始和结束切换；再点一次会停止；连续点两个词只有最后一个在读；离开页面立即停止；列表、详情页、今日计划的按钮都在链接之外，点击不跳转；Tab 顺序和 Enter/Space 在键盘上可用，有焦点环；375px 下无横向滚动、按钮 40×40、不与文字重叠（详情页超长标题会让按钮换到下一行）；控制台无异常。
- **前端小修的浏览器验证**（同一内置浏览器，45 个词、3 页）：页码在 URL 里，翻页、刷新保持、浏览器前进后退都正确，请求用 0 起算的页码；`?page=abc`、`0`、`-1`、`1.5` 都按第 1 页处理，且 URL 保持用户输入的样子，不会被改写；`?page=999` 显示“没有第 999 页”和回到第 1 页的按钮，点击后 URL 清掉 `page`；从第 3 页进入详情，用返回链接或浏览器后退都回到第 3 页；在第 3 页添加词后回到第 1 页，新词排在最前；从今日计划进入详情，返回链接是 “Back to today’s plan” 并回到今日计划，直接输入详情地址则回到词汇列表；带无效 token 打开 `/register` 并注册后，登录页没有“已登出”提示，而带无效 token 打开 `/app` 时登录页仍有提示；375px 下无横向滚动；无 JS 异常。**午夜换日没有在真实浏览器里验证**（无法伪造时钟），只有单元测试。
- **没有验证**：发音的口音是否为美式（听不到；用户在自己的浏览器里试听后评价“真实感不错”，但没有说明用的是哪个浏览器，也没有确认口音，所以不能据此断定是美式）、Safari 和 Firefox（Safari/iOS 上“先 `cancel()` 再 `speak()`”有不稳定的已知报告，未在那里验证）、“设备没有美式声音”时提示和详情页提示条的真实表现（那台设备有 en-US，只有单元测试覆盖）、浏览器不支持朗读时不显示按钮的真实表现（单元测试覆盖）；键盘与读屏（读屏器未测）、暗色模式、375px 以外的宽度、前端对 MySQL 后端的联调（浏览器验证只用了 H2）、真实 AI/字典、晚上本地日期与 UTC 日期不同时的真实页面表现（验证时本地与 UTC 同一天，只有单元测试覆盖）、生产部署。
- 后端的并发正确性是在真实 MySQL 容器里用多线程测试验证的，没有做整个应用的压测。

**历史记录**（不是本次运行）：更早的会话记录过 3A 实现的 HTTP 级联调通过，该联调不等于真实浏览器验收。

## 4. 当前进度：已有实现

### 后端 Milestone 1 与加固

- 注册、登录、当前用户、登出/token撤销；BCrypt密码存储；token 有效期 24 小时（`vocabflow.auth.token-hours`）。
- 用户CLB等级、每日新词目标。
- 单词/短语创建、个人词库分页、详情、跨用户访问隔离。
- `VocabularyItem`（共享内容）与 `UserVocabulary`（用户学习关系）分离；词条规范化及重复关系约束。
- 可替换的词汇补全端口、确定性 fake 实现（默认）、Claude 实现（`VOCABFLOW_ENRICHMENT_PROVIDER=claude`，未用真实密钥验证过）、补全状态。
- API DTO/领域对象/JPA分离，仓储端口与持久化适配器；统一API错误模型/工厂。
- Flyway、MySQL、H2快速测试、MySQL Testcontainers兼容性测试、Spotless。

### 后端 Milestone 2

- 每个用户/日期只有一个持久化 DailyLearningPlan，重复请求返回既有计划。**空计划也会被保存。**
- 从个人 `NEW` 词汇按 `createdAt ASC, id ASC` 选取至每日目标；不足时取全部。目标数是创建计划时的快照。
- 计划项区分 NEW/REVIEW，存储快照及显式 `item_order`，重载后顺序保持稳定。
- `DueReviewProvider` 已有边界，当前实现返回空列表。
- 显式应用层只读事务、独立写事务和独立冲突重读事务；聚合保存失败回滚。
- `GET /api/v1/learning/daily-plan` 及可选日期参数；缺省日期按UTC计算。
- **间隔复习（后端）**：`SpacedRepetitionScheduler` 是纯函数，实现 Anki 式 SM-2 的默认参数：学习步骤 1 和 10 分钟，毕业 1 天，Easy 4 天，初始难度系数 2.5，最低 1.3，遗忘后重学 10 分钟，之后间隔回到 1 天；没有随机抖动。过期复习按 Anki 的方式计入延迟（Hard 1/4、Good 1/2、Easy 全部）。词在第一次评分时建 `learning_cards`，每次评分写 `review_logs`。`learning_status` 由卡片决定：学习或重学中是 `LEARNING`，间隔不足 21 天是 `FAMILIAR`，21 天及以上是 `MASTERED`。
- **本机部署（M8）**：`docker-compose.yml` 含 MySQL 8.4、后端、Caddy（托管前端、转发 `/api`、CSP 和安全响应头）。只开放 Web 端口（默认 8088，默认绑定 0.0.0.0，局域网可访问），MySQL 和后端不对外。**只有 HTTP，局域网内密码和 token 是明文**，不能直接上公网；上公网前必须加 HTTPS 和登录频率限制。邀请码在邀请码错误时先于其他校验拒绝，不泄露邮箱是否已注册。`GET /api/v1/health` 公开，只返回状态。备份恢复已实测（备份、改坏、恢复后数据和复习记录都回来，多余的表被清除）。没有从另一台设备实际访问过（只从本机通过局域网 IP 访问），macOS 防火墙可能需要放行。
- **iPhone 主屏幕图标**：iOS 不用 SVG favicon，所以有 `public/apple-touch-icon.png`（180×180，由 favicon 去掉圆角生成）和固定的应用名。没有 PWA manifest。
- **学习页（首页）**：`/app/study`，登录后直接进入。顶部有新词和复习的进度条（原生 `<progress>`，因为 CSP 禁止内联样式）。先只显示词和发音，“Show answer” 后显示音标、释义、例句、搭配和四个评分按钮（带下次时间）。焦点：翻面后到答案，评分后到下一张卡的词，学完到完成标题。没有可学的卡时显示完成页：今天学过的词（可进详情再返回）、“Study more new words”（有新词时）、“Add new words”。新词第一次评分就计入进度，哪怕评 Again。没有键盘快捷键；窄屏要滚动才能看到按钮；同一个词连续出现时焦点停在同名标题上，读屏可能不会提示换了卡。已由独立验证会话在桌面和手机宽度走过流程；屏幕上的第二天复习和 “Reviews” 进度条没看过，只通过接口看过到期数量。
- **Settings 和筛选**：`/app/settings` 改每日词数；词汇列表可按 All、Due today、New、Learning、Familiar、Mastered 筛选，放在 URL 的 `?show=` 里，翻页和返回都保留；添加单词后回到 All。补全失败的词仍占当天名额，学习页提示“waiting for details”，这句对失败的词不准确，还没改。修了次数统计的一个竞争：当天第一次调用同时进来时，后到者可能被误判为超限（词条变 FAILED）。这个修复由确定性单元测试覆盖；MySQL 上的并发测试修复前也没复现。
- **每日进度（后端）**：计划不再固定不变。新词按添加顺序往后追加，已有的词和顺序不变。规则：还没结束且未满每日目标时，读取计划或队列会自动补词；评完一张卡后，没有可学的卡也没有未来的学习步骤，当天就算结束，此后新加的词不再自动加入。`POST /api/v1/learning/study-queue/more`（`{date}`）开始新一批：先补满目标，已满则再多一批（大小等于每日词数，记在 `extra_new_items`），解除结束状态；没有新词可加时什么都不变。补词由 `DailyPlanGrowth` 在独立事务里持行锁完成，和创建、恢复计划的事务分开。队列响应新增 `newStudiedCount`、`newTargetCount`、`reviewsDoneCount`、`finished`、`moreNewWords`、`studiedToday`。
- **学习队列**：`GET /api/v1/learning/study-queue?date=` 返回下一张卡和四个评分各自的结果。顺序：到期的学习步骤、到期复习、当天计划里的新词；都没有时，20 分钟内到期的学习步骤会提前出现（和 Anki 一样）。补全没完成的词只计数不出现。每日目标只限制新词，复习没有上限。
- **计划**：空计划不再保存，当天加词后能生成计划。新词可追加（见“每日进度”）；复习项是生成时的快照，学习队列用的是实时数据，所以两者可能不完全一致。到期复习现在由 `CardDueReviewProvider` 提供。

### 之后的后端修复

- **错误映射**：畸形或缺失的 JSON 请求体 → 400 `MALFORMED_REQUEST`；参数或路径变量类型错误 → 400 `INVALID_PARAMETER`；不存在的路径 → 404 `NOT_FOUND`；方法不对 → 405 `METHOD_NOT_ALLOWED`（带 `Allow` 头）；Content-Type 不支持 → 415 `UNSUPPORTED_MEDIA_TYPE`。兜底的 500 现在会用 ERROR 级别记录方法、路径和完整堆栈，响应体仍是固定文案。
- **词汇并发创建**：多个请求同时添加同一个新词，输掉的请求以前会因共享事务里的 Hibernate 会话被污染而抛 `AssertionFailure`，变成 500。现在已修复，并有真实 MySQL 的并发 IT 覆盖（见第 7 节）。
- **异步补全与领取标记（M5 后端）**：`POST /api/v1/vocabulary` 只保存词条为 `PENDING` 并立刻返回（返回的是保存时的快照，补全结果要通过 GET 读到）；补全由进程内小线程池（2 个线程，队列 200，队列满则词条留在 PENDING，下次添加同一个词会再调度）在后台执行。只有 `claimForEnrichment` 条件更新成功的调用者才能调用 provider：状态在允许集合内，或已是 `PROCESSING` 但开始时间早于 5 分钟前（认为 worker 丢了）。添加路径只允许领取 `PENDING`；重试路径只允许领取 `FAILED`。所以并发添加同一个词只花一次模型调用，进程崩溃留下的 PENDING/PROCESSING 会在下次有人添加该词时被重领（包括该用户已拥有它的情况）。
- **重试**：`POST /api/v1/vocabulary/{id}/enrichment/retry`（id 是 `UserVocabulary` id，只能重试自己词库里状态为 `FAILED` 的词；其他状态 409；超出每日次数 429 `ENRICHMENT_LIMIT_REACHED`；别人的 404）。请求内同步领取，再交给后台执行，响应里是领取后的当前状态。没有无限自动重试。
- **每日次数上限**：`enrichment_usage(user_id, usage_date, request_count)`，按 UTC 日期，每次调用 provider 前原子加一（默认 50，`VOCABFLOW_ENRICHMENT_DAILY_LIMIT`）。次数记在触发补全的那个用户名下（添加者或重试者）。超限时新词仍会保存，但词条被标为 `FAILED`，`failureReason` 是 `Daily enrichment limit reached`，重试接口则直接 429。
- **来源记录**：补全成功时写入 `enrichment_source`（`claude:<模型名>` 或 `fake`）、`enriched_at`；`enrichment_attempts` 记录领取次数；`failureReason` 现在也出现在词汇 API 的响应里。
- **Claude 适配器**：Spring `RestClient` 直连 Messages API，不引入 SDK；`thinking: disabled`、`output_config.format` 要求 JSON Schema，服务端再次严格校验（类型枚举、非空、长度、例句 1–5 条、搭配 0–8 条），不合格或 `stop_reason` 不是 `end_turn` 都算失败。超时 30 秒（`vocabflow.enrichment.claude.timeout-seconds`）。日志只记异常类名，不记密钥、请求或响应内容。配置 `claude` 但没有密钥时应用启动失败。

### 前端

- Router、QueryClient、Tailwind、Vitest/RTL、Oxlint、strict TypeScript、开发代理、favicon。
- 登录/注册表单、校验、提交禁用/加载状态及错误显示；token 集中持久化、`/me` bootstrap、401 清会话、public-only/保护路由；登出无论后端成功或失败均清本地认证状态。
- **会话检查失败恢复**：`/me` 因断网或 5xx 失败时，显示带 Try again 和 Sign out 的恢复界面，不再一直卡在 “Checking your session…”（受保护路由、公开路由和根路由都覆盖）。
- **统一 401 处理**：任何带 token 的请求收到 401，`apiClient` 会通知认证层；认证层清 token、清整个查询缓存并回登录页，登录页显示 “You’ve been signed out. Please sign in again to continue.”。登录和登出请求不触发（`notifyOnUnauthorized: false`），旧 token 的迟到 401 不会结束新会话。
- **缓存隔离**：登出、token 被拒、恢复界面的 Sign out 和新登录前，都会清空整个查询缓存。
- **应用外壳**：登录后有顶栏（邮箱、登出）和 Study / Vocabulary 两个标签。
- **词汇界面**：添加表单（trim、1–255 字符校验、409/400 文案内联显示、成功后清空并保持焦点）、分页列表（最新在前；页码在 URL 里，如 `?page=2`，从 1 开始，无效值按第 1 页处理，页码不存在时提示并可回到第 1 页）、详情页（音标、词性、释义、例句、搭配、状态、添加日期；“返回”链接回到打开它的地方：同一页列表或今日计划，只接受 `/app/` 开头的站内路径）；有加载、可重试错误、空状态。列表里 PENDING/PROCESSING 显示 “Enriching…” 徽章，FAILED 显示 “Details unavailable”；包含未完成词条的列表、未完成的详情每 3 秒重新读取一次，最多 2 分钟（`hooks/pollingConfig.ts`），之后不再自动读取。详情页有 `EnrichmentPanel`：补全中显示 “Filling in the details…” 和 “Check now”；完成时在 `role="status"` 区域朗读 “Details are ready.”；FAILED 显示失败原因和 “Retry details” 按钮（点击后焦点移到状态区；超限等错误内联显示，与失败原因相同时不重复）。刚添加的未完成词条在详情缓存里被标为已过期，打开详情页会立刻向服务器重读，而不是显示添加时的快照（应用的 `staleTime` 是 30 秒）。
- **每日计划**：今日计划页已去掉（`/app/today` 落到学习页），学习页按**浏览器本地日期**请求队列。`GET /learning/daily-plan` 接口还在，前端已不用。
- **发音**：词汇列表每一行、详情页标题旁、学习卡片上都有播放按钮，点击用浏览器自带的 Web Speech API 朗读该词（`shared/speech/`）。优先选 `en-US` 的声音（兼容 Android 的 `en_US` 写法），语速 0.9；再点一次停止，离开页面会停止；浏览器不支持时不渲染按钮；设备上没有美式声音时，按钮提示和详情页会如实说明正在用别的英语声音。按钮放在行的链接旁边，不在链接里面。没有服务端音频，没有自动播放。

### 当前接口与路由

| 入口 | 当前契约/行为 |
| --- | --- |
| POST `/api/v1/auth/register` | email、password、clbLevel、dailyNewVocabularyGoal；返回用户，不发token |
| POST `/api/v1/auth/login` | email、password；返回 `{accessToken,user}` |
| GET `/api/v1/auth/me` | Bearer认证，返回 `{id,email,clbLevel,dailyNewVocabularyGoal}`，无密码字段 |
| POST `/api/v1/auth/logout` | Bearer认证，响应无业务JSON正文 |
| POST/GET `/api/v1/vocabulary` | 创建/分页，身份由principal获取；重复添加返回409；创建返回的 `enrichmentStatus` 通常是 `PENDING` |
| GET `/api/v1/vocabulary?status=&due=` | 可选筛选：`status` 是学习状态；`due=<日期>` 只留当天要学的词（学习中和重学中的，以及到期的复习）；两者可同时用。无效值 400 |
| PATCH `/api/v1/auth/me` | `{dailyNewVocabularyGoal}`，1–100。调高后没结束的当天立即补词；调低不移除已加入的词 |
| GET `/api/v1/vocabulary/{id}` | 查询个人词库关系的详情，限制归属；别人的或不存在的返回404 |
| POST `/api/v1/vocabulary/{id}/enrichment/retry` | 重试 `FAILED` 词条的补全；非 FAILED 409；超过每日次数 429；别人的 404 |
| GET `/api/v1/learning/study-queue` | 下一张卡、各评分结果、各队列数量、`nextDueAt`；`date` 可选 |
| POST `/api/v1/learning/cards/{userVocabularyId}/reviews` | `{rating,version,date}`，返回新的队列；`version` 过期 409，别人的词 404 |
| GET `/api/v1/learning/daily-plan` | 返回 `{date,newVocabularyGoal,newItems,reviewItems}`，注意goal字段名与用户DTO不同；计划项只有 `userVocabularyId、vocabularyItemId、term、type`，没有释义 |
| 前端 `/` | 根据认证状态跳 `/login` 或 `/app` |
| 前端 `/login`、`/register` | 已登录者跳 `/app`；未登录者显示表单 |
| 前端 `/app` | 保护路由，跳到 `/app/vocabulary`；`/app/*` 的未知路径也跳到那里 |
| 前端 `/app/vocabulary`、`/app/vocabulary/:id` | 词汇页、详情页 |
| 前端 `/app/study` | 学习页（首页），`/app/today` 和未知路径都落到这里 |

错误响应统一为 `{code,message,timestamp}`，`code` 取值：`VALIDATION_ERROR`(400)、`MALFORMED_REQUEST`(400)、`INVALID_PARAMETER`(400)、`UNAUTHORIZED`(401)、`INVALID_INVITE_CODE`(403)、`NOT_FOUND`(404)、`METHOD_NOT_ALLOWED`(405)、`CONFLICT`(409)、`UNSUPPORTED_MEDIA_TYPE`(415)、`ENRICHMENT_LIMIT_REACHED`(429)、`INTERNAL_ERROR`(500)。未登录访问不存在的路径会先被安全链拦下，返回 401 而不是 404。前端不要创造另一套后端错误格式。CLB支持1–12，注册密码至少8字符，目标1–100；表单显式提供CLB和目标。

## 5. 进行中与工作区状态

没有未完成的开发任务。分支、合并和 PR 的状态以 `git status`、`git log` 和 GitHub 为准，本文不记录，因为这类信息很快就会过时。不要使用 reset/clean 覆盖工作区，也不要自动提交或推送。

`backend/pom.xml` 里的 `maven-compiler-plugin`（Java 21 source/target 及 `--enable-preview`）来源和用途仍为**待确认**；本次验证了它不影响编译和测试，但没有证明项目需要它。

## 6. 待办事项（建议优先级，范围待用户确认）

按里程碑组织的完整路线图（M4 加固到 M8 上线准备，以及各自需要用户决定的事项）见 `docs/ROADMAP.md`；下面是最近的具体待办。

1. **P1：用户时区。** 后端缺省日期是 UTC，前端目前靠“传浏览器本地日期”绕开；是否把时区作为用户设置存进后端待产品确认。
2. **P1：补全体验（前后端都已做）。** 后端的异步补全、领取标记、重试、次数上限，前端的轮询、重试按钮、失败和超限文案都已完成，并在真实浏览器里对着真实后端（H2、假 provider、每日上限设为 1）验证过：添加、自动补全、超限变 FAILED、详情页失败说明、重试被 429 拒绝。真实 Claude 适配器已由用户用自己的密钥手动试过（单词、短语动词、习语、名词短语，没有报错，用户评价效果可以；自动测试仍只用 Mock）。首次试用发现模型可能返回空词性，现在存为 `null`；校验拒绝的原因会写进日志（只含字段名或停止原因）。**内容和用户选择的 CLB 级别无关**：词条是共享的，提示词固定写 CLB 5–7。**没有验证的**：补全需要超过 2 分钟的情况（轮询停止后只能点 “Check now” 或刷新）；卡死的 PENDING/PROCESSING 在详情页没有办法修复，只有再次添加同一个词才会重领。
3. **后续：** 练习、评估、掌握度、间隔复习（现在复习项永远为空）、音频、生产认证/部署加固；具体顺序和规则均待确认。

## 7. 重要设计决定与约定

### 模块边界

- 单体按业务能力拆模块，保持简单；不引入微服务、队列或分布式锁。
- Web → application → domain/仓储端口 ← persistence adapter → Spring Data JPA → MySQL。
- 领域不依赖Spring/JPA/HTTP/AI厂商；应用服务允许使用Spring事务注解，但不能直接使用JPA实体/仓储。
- 学习只依赖词汇查询端口；保留DTO、领域和实体映射，禁止为让测试通过而给JPA实体随意添加值相等语义。

### 词汇、日期和事务

- 共享词条与个人关系分离，避免重复维护内容并保证用户隔离。`VocabularyTerm` 保留清理空白后的显示大小写，`normalized()` 用 `Locale.ROOT` 转小写匹配；数据库分别保存 `term` 和 `normalized_term`。不要把规范化值当显示文本，也不要顺手改变重复规则。
- 计划是当日持久化快照；已有计划不重选。创建计划不会推进词汇学习状态，因此不同日期目前可能再次选到相同NEW词；不是已实现的复习算法。
- UTC `Instant` / `DATETIME(6)`，学习日期 `LocalDate`；后端缺省的“今天”是UTC日期，不是用户本地日期。前端用浏览器本地日期（用本地年月日拼 `YYYY-MM-DD`，不要用 `toISOString()`）。
- `getOrCreate` 为应用层 `readOnly`事务；插入/flush通过独立Spring bean的 `REQUIRES_NEW`写事务完成；重复异常在该事务结束后被adapter捕获；winner reload通过另一bean的 `REQUIRES_NEW + readOnly`执行。
- 这是显式编排多个事务，不是整个use case只有一个可统一回滚的数据库事务。计划和全部项由同一写事务保存；不能把异常捕获移到仍会rollback-only的共享事务，也不能通过同类self-invocation让传播注解失效。
- **`VocabularyService.add` 故意不加 `@Transactional`。** 两个仓储适配器的 `saveIfAbsent` 在适配器里捕获重复键异常；如果整个方法在一个共享事务里，异常穿过 Spring Data 的事务代理时会把外层事务标成 rollback-only，Hibernate 会话也被污染，之后同一事务里的重新查询会抛 `AssertionFailure`，输掉竞争的请求变成 500。不加外层事务时，每次仓储调用各自一个事务，重复键在事务结束后才被捕获，重新查询也拿到新的快照。代价：新词的“插入”和“补全”是两个独立步骤，补全现在在后台线程里，PENDING 窗口是正常状态；窗口内进程崩溃会留下 PENDING/PROCESSING 词条，靠“再次添加时领取并补全”修复。补全路径（`VocabularyEnrichmentService`、`JpaEnrichmentUsageRepositoryAdapter`）同样不能放进共享事务。**不要为了统一而给它加回外层事务**；并发行为由 `VocabularyConcurrencyIT` 保护。

### 认证与前端状态

- 后端用BCrypt与自定义HMAC-SHA256签名Bearer token；该token不是标准三段JWT，前端应当作不透明字符串，不解码依赖内部格式。
- 登出保存token哈希用于撤销；后端始终是授权与用户隔离的最终边界。
- token集中暂存localStorage；待生产认证加固时重评HttpOnly cookie方案，不在后续普通UI任务中重构后端认证。
- TanStack Query是当前用户唯一服务端状态源，Context仅协调token（以及“是否被意外登出”这个小标记）；页面/组件 → feature hooks → Query/mutation → feature API → shared fetch client。
- **401 处理只在一个地方：** `apiClient` 收到“带token的请求的401”就调用 `notifyTokenRejected(token)`；`AuthTokenProvider` 订阅它。新增功能不需要、也不应该自己处理 401。只有登录和登出这类“建立或结束会话”的请求才传 `notifyOnUnauthorized: false`。
- 会话以任何方式结束时都要清空整个 QueryClient 缓存（`features/auth/hooks/sessionCache.ts`），因为所有缓存数据都属于当前用户。
- 登录成功会先清缓存，再使用login响应中的user填充cache，然后invalidate当前用户查询；不是“必须等新一次 `/me`成功才准入”的严格屏障。
- 前端测试用 `src/test/utils.tsx` 的 `stubApi` 按“方法加路径”桩 fetch，没配置的请求会让测试失败；用假定时器时只伪造 `Date`。
- Router保持Declarative Mode；不要引入loaders/actions/SSR/framework mode。保持Oxlint及strict TypeScript，避免无理由 `any`。
- 不默认引入Redux/Zustand/MobX/Axios/Next.js/GraphQL/大型UI框架；保持小组件、组合和移动优先。

## 8. 已知问题、坑与保护范围

以下为源码确认或验证中观察到的边界：

| 问题/边界 | 影响与继续开发注意事项 |
| --- | --- |
| “用户已不存在的 token” | 已处理：`JwtFilter` 在设置认证前调用 `UserRepository.existsById`，用户不存在就当作没带 token，所有受保护接口统一返回标准 401（此前词汇列表 200、添加词汇 500）。代价是每个带 token 的请求多一次主键查询，规模变大时再考虑缓存。token 校验和用户检查是两次独立查询，两者之间用户被删除的竞态极小，下游原有的 “User no longer exists” 401 作为兜底。没有做停用用户、撤销某用户全部 token、token 加随机数，这些仍在路线图 M4。浏览器验证没有看网络日志，也没有试过过期或签名错误的 token |
| 计划的边界 | 空计划不保存；未结束且未满目标时自动补词；当天结束后新词要等 “Study more new words” 或第二天。复习项是计划生成时的快照，学习队列用实时数据 |
| 词条补全的边界 | 只有再次添加同一个词（或点重试）才会重领丢失的 PENDING/PROCESSING 或 FAILED，没人操作就一直停着；线程池队列满时词条留在 PENDING；每日次数按 UTC 日期；超限会把新词标为 `FAILED`（不是单独的状态）；后端没有定时任务 |
| 词汇列表缓存 | 查询有30秒 `staleTime`。在界面之外（如 curl）添加词汇后，已缓存的列表30秒内切换标签不会更新；用界面添加会正常刷新 |
| 跨标签页同步 | `AuthTokenProvider` 监听 `storage` 事件：另一个标签页登出或换账号，本页会跟着变并清空整个查询缓存，不显示“已登出”提示。降级：浏览器拒绝写入 `localStorage` 时，令牌只保存在当前标签页内存里（`tokenStorage.ts`），本页能用，但刷新后要重新登录，标签页之间也无法同步。真实浏览器验证覆盖了登出、登录、换账号和存储抛 `SecurityError`（用同源 iframe 注入脚本模拟）；没有看切换瞬间的画面（只检查了最终状态，单元测试断言缓存被清），没有测 `window.localStorage` 这个属性本身抛异常的浏览器，也没有在存储失败的情况下刷新确认会话丢失 |
| CI 的遗留事项 | 已在 GitHub 上运行成功两次（见第 3 节）。分支保护已开启（见第 3 节），检查不过就合并不了；仓库管理员只能在 PR 页面绕过，留给紧急情况。遗留：Action 用主版本号引用（`@v5`），没有固定到提交 SHA，以后可以用 Dependabot 管理；`ubuntu-latest` 正在迁移到 Ubuntu 26，若构建因此变化需要固定系统版本；第一次运行时前端 job 偏慢的原因没有查清（第二次正常），如果以后又变慢，看 Actions 页面里每一步的耗时和缓存是否生效 |
| 发音的声音取决于设备 | 用的是浏览器自带的声音：代码会明确挑 `en-US`，但设备上没有美式声音时只能退回别的英语声音，具体音质和口音测试无法验证，不同设备听起来不同；Linux 等环境可能完全没有英语声音（此时不显示按钮）。声音列表在有些浏览器里首次调用为空、之后才加载，代码已用 `voiceschanged` 事件处理。朗读时点击会先 `cancel()` 再 `speak()`，在 Chromium 上验证正常，但 Safari/iOS 上这个组合有不稳定的已知报告，未验证。播放中按钮的悬停提示仍是 “Play pronunciation”（只有 `aria-pressed` 表示状态）。部分浏览器的“在线声音”可能把朗读的文本发给声音提供方（未核实具体浏览器的行为，词汇本身不是敏感信息）。已决定保持现状，不做服务端语音合成（产品负责人，2026-10-30） |
| localStorage | 暴露于同源脚本/XSS；只是当前获准的临时MVP方案。读写失败不会再让应用崩溃（见“跨标签页同步”一行的降级说明） |
| 键盘与读屏 | 已修并在真实浏览器里用纯键盘复验：翻页后焦点留在结果区、换页后焦点进 `main`（首次加载和只换页码不动）、每页有标题、“Skip to main content”链接、添加/登录/注册的错误用 `aria-invalid`/`aria-describedby` 关联、添加成功用常驻状态区域朗读、序号对比度。**读屏软件**：用户用 VoiceOver 听过，反馈没问题（没有说明具体听了哪些页面和操作，也没有试过 NVDA 等其他读屏软件）。**没有验证**：真实浏览器里的 axe 扫描（颜色对比度只能在真实浏览器里量，jsdom 里关掉了这条规则；自动化测试已覆盖其余规则，见下一行）；跳转链接改成文档流内显示后的外观（修之前它盖住了左上角的 “VocabFlow”，改后没在浏览器里再看）；悬停背景上的序号对比度（估算约 4.5，已改深一档但没量过）；窄屏、缩放、高对比度、暗色。已知的小遗留：添加表单的错误在继续输入时不会消失，只在下次提交时清掉；注册页的通用错误会把邮箱、密码、每日目标都标成无效，即使问题只在其中一个；退出登录和登录/注册页互相切换后焦点在 `body` |
| 自动无障碍测试 | `axe-core`（开发依赖，只用于测试）在 `src/app/AxeScan.test.tsx` 里扫登录、注册、词汇列表（含添加错误状态）、详情、今日计划，规则违规会让 CI 失败；每页恰好一个 h1 和 `index.html` 的 `lang` 由测试自己检查（jsdom 不加载 `index.html`，axe 也接受以 h3 开头的页面）。发音按钮要装假的语音接口才会被扫到。它只能抓机械性问题（名称、角色、aria、标题），抓不到焦点顺序、措辞、读屏实际念什么，也抓不到颜色对比度。真实浏览器的对比度扫描（2026-10-30，axe-core `color-contrast`）：登录、注册、列表、详情（完成、补全中、失败、重试被拒）、未找到、页码超范围、今日计划，以及列表和计划项悬停、跳转链接聚焦；两个列表悬停时的灰字为 4.43:1，已改为 `text-slate-600`（7.06:1）。这个扫描是手动的，CI 不跑，jsdom 算不出颜色；其他按钮的悬停和错误状态下的悬停没有逐个实测 |
| 暗色模式 | 暂不支持（已决定，见路线图）。界面只有浅色，声明了 `color-scheme: light`（`index.html` 的 meta 和 `index.css`），系统是暗色时页面仍是浅色，浏览器自带控件也保持浅色 |
| 浏览器验收的覆盖面 | 见第 3 节：读屏软件、MySQL 联调、晚上本地与 UTC 日期不同的真实表现仍未验证 |
| 登出请求在网络日志里显示 `ERR_ABORTED` | 状态是200，验证时没有追查原因，看起来无害，但没有解释清楚 |
| preview编译配置 | `--enable-preview` 已验证不影响编译和测试，但项目是否需要它仍未知；先确认意图，勿自动删除/扩散运行参数 |
| fake补全与复习占位 | deterministic fake不是AI；没有掌握度/评估/复习调度。不能为充数据编造业务算法 |
| 并发测试边界 | 词汇并发创建有真实 MySQL 多线程 IT；学习计划有服务 mock 冲突路径、MySQL 重复键和失败回滚测试，但没有多线程端到端 get-or-create 竞争测试 |
| token后续加固 | 当前token未含随机nonce，同用户同秒签发可能得到相同token；撤销记录未见过期清理任务。这些应单独评估，不能在普通前端任务中改变签名格式 |
| 生产部署 | Vite本地服务的proxy不随dist部署；尚无完整生产SPA回退/同源API转发/CORS部署方案，禁止把开发默认DB连接及profile当生产模板 |

必须保护：

- 不重写已完成认证/安全/词汇持久化解耦/学习事务加固，除非当前任务明确包含必要修改。
- 不编辑既有Flyway V1–V6内容；后续用新迁移。不要切换Hibernate为自动建表来让测试通过。
- 增加迁移时同步维护 `MysqlFlywayIT` 中当前固定的迁移数量断言（现为4）。MySQL测试会清空测试数据表，不能手工改连个人/生产数据库。
- Open-in-View已关闭；当前映射所用关联依赖明确的抓取策略，改为LAZY时必须保证事务内映射/显式fetch，不能依靠控制器持有会话。
- 不把token存在视作唯一认证证明，不信任客户端 `userId`，不输出密码/token/密钥。
- 不删除/削弱测试，不把真实MySQL验证替换成仅H2，也不要自动移除H2；两者承担不同责任。
- 不自动安装/升级JDK、Node、Docker、MySQL，不使用sudo，不修改全局PATH/JAVA_HOME/Maven/npm设置。
- 未获指示不commit/push/reset/rebase/tag，不丢弃已有改动。

## 9. 环境变量与配置（不记录密钥值）

| 变量名 | 用途/要求 |
| --- | --- |
| `VOCABFLOW_DB_URL` | 默认MySQL JDBC连接；application.yml有本地默认值，按部署环境配置 |
| `VOCABFLOW_DB_USERNAME` | 数据库用户名；有本地默认值 |
| `VOCABFLOW_DB_PASSWORD` | 默认profile所需数据库密码；从外部提供 |
| `VOCABFLOW_ENRICHMENT_PROVIDER` | `fake`（默认）或 `claude` |
| `VOCABFLOW_ANTHROPIC_API_KEY` | `claude` 时必需；从外部提供，勿写进仓库/日志 |
| `VOCABFLOW_ENRICHMENT_MODEL` | 默认 `claude-haiku-5-5` |
| `VOCABFLOW_ENRICHMENT_DAILY_LIMIT` | 每用户每天补全调用上限，默认 50 |
| `VOCABFLOW_INVITE_CODE` | 设置后注册必须填写；不设则开放注册（开发和测试）。Compose 要求必须设置 |
| `VOCABFLOW_AUTH_SECRET` | 默认profile所需HMAC签名密钥；从外部提供，勿写进仓库/日志 |
| `SPRING_PROFILES_ACTIVE` | Spring可选profile选择入口；也可用上述Maven启动参数选择profile |
| `SERVER_PORT` | Spring可选端口覆盖入口；若改变需同步考虑Vite代理目标 |

前四项是项目配置明确引用的变量；后两项是Spring标准可选配置入口，不是新加的项目必需变量。未发现当前前端读取任何自定义 `VITE_*` 环境变量；不需要为此编造API key或base URL变量。

配置文件职责：

- `backend/src/main/resources/application.yml`：MySQL、Flyway、Hibernate validate、关闭Open-in-View、UTC和认证配置（含 token 有效期 24 小时）。
- `application-dev.yml`：本地开发覆盖，仍依赖MySQL。
- `application-test.yml`：H2隔离测试/本地联调与测试用认证配置；不得部署到生产。
- MySQL集成基类使用容器动态JDBC参数覆盖datasource，不依赖个人数据库环境变量。
- `frontend/vite.config.ts`：开发代理和Vitest/Tailwind集成；API客户端用相对路径。
- `.env`被忽略不等于自动注入：当前Maven Wrapper/Spring启动脚本未配置自动加载仓库根 `.env`，后端变量需由进程环境/IDE等传入。Vite若日后使用 `VITE_*`，其值会进入客户端，不可放秘密。

需要用户确认：更细用户画像和下一里程碑范围、`--enable-preview` 的目的、生产部署/认证硬化方案、用户时区是否进后端。未经确认，不把这些事项当成既定设计。

## 10. 协作与子会话

`.claude/agents/` 里定义了三个可复用的子代理角色，规则正文引用 `AGENTS.md`/`CLAUDE.md`，不复制：

- `backend-dev`：`backend/` 下的 Java 改动，必须跑 spotless、test、verify。
- `frontend-dev`：`frontend/` 下的 React 功能，必须跑 lint、typecheck、test、build。
- `browser-verifier`：起 H2 后端加 Vite，用内置浏览器走流程，只读不改代码；会复用已在 5173 运行的 Vite，不会 kill 不是它起的进程，结束时只停自己起的。

使用时的经验：

- **已经在运行的会话不会自动加载新建的角色定义**（验证过：当时派发 `browser-verifier` 返回 “not found”）。想用它们，需要新开会话，或让通用子代理先读对应的 `.md` 再照做。新会话能否自动发现这些角色还没有验证。
- 想看过程的任务（如浏览器验证）开**独立会话**，不要用隐藏的后台子代理。反复做的验证只保留**一个**会话，换任务时用清空会话上下文的方式复用，不要每次新开，避免侧边栏堆满已经用完的会话；一次性任务做完后归档。
- 并行只适合互不依赖的任务；两个任务改同一批文件（例如都改前端路由和应用外壳）不要并行，必要时用独立 worktree，合并由用户决定。
- 子会话不 commit、不 push；由主会话核对结果后再提交。
