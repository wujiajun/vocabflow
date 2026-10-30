# VocabFlow 开发交接

核对日期：2026-10-29。本文依据当前工作区代码、配置和本次会话历史整理，供 Claude Code 等后续开发助手使用。接手时先读根目录、`backend/`、`frontend/` 中适用的 `AGENTS.md`，不要假定工具会自动加载这些规则。

本文区分“已有实现”“历史验证通过”和“待确认”。本次只维护文档，没有重新安装依赖、启动服务或重跑完整测试；不能把历史结果当作当前工作区的新验证结果。

## 1. 项目目标与用户

VocabFlow 是面向个人英语学习者的词汇学习平台：用户在日常生活中遇到生词或短语，只需录入词/短语，系统保存到个人词库，并补充结构化学习信息，再逐步支持每日学习和复习。

长期产品链路：记录 → 补充学习内容 → 学习 → 练习 → 评估 → 更新掌握度 → 安排复习 → 复习。目前只实现了其中一部分，不能把愿景写成现成功能。

用户配置包含 CLB 等级和每日新词目标；原始需求未明确限定国籍、考试或商业客户群，更细的目标用户画像、商业模式和正式发布计划均为**待确认**。

## 2. 技术栈与目录

后端：Java 21、Spring Boot 3.5.11、Spring MVC/Security、Jakarta Validation、Spring Data JPA、MySQL、Flyway、Maven Wrapper 3.9.11。测试使用 JUnit/Mockito/MockMvc、H2 和 MySQL 8.4 Testcontainers。Java 格式化使用 Spotless 2.43.0 + Google Java Format 1.19.2。

前端：React 19、严格模式 TypeScript 6、Vite 8、npm、Node 24（fnm）。React Router 使用 Declarative Mode，TanStack Query 管理服务端状态，Tailwind 使用官方 Vite 插件。测试使用 Vitest、jsdom、React Testing Library、jest-dom 和 user-event；lint 使用 Oxlint。

当前前端锁文件记录：React 19.2.8、TypeScript 6.0.3、Vite 8.2.2、React Router 8.3.0、TanStack Query 5.102.8、Tailwind 4.3.3、Vitest 4.1.11、Oxlint 1.80.0。`package.json` 使用版本范围，重现安装以 `package-lock.json` 为准。

```text
vocabflow/
├── AGENTS.md                  仓库规则与两端质量门
├── HANDOFF.md                 本交接文档
├── README.md                  产品/API说明；部分内容已过时，见第8节
├── .node-version              Node 24
├── .gitignore                 构建产物、依赖、IDE和本地环境文件忽略规则
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
│       │   └── shared/        公共Web错误响应与JSON支持
│       ├── main/resources/   application配置与db/migration/V1…V4
│       └── test/java/        快速测试与integration/*IT
├── frontend/
│   ├── AGENTS.md              前端工程约定
│   ├── package*.json          npm脚本、依赖和锁文件
│   ├── vite.config.ts         React/Tailwind、开发代理、Vitest
│   ├── tsconfig*.json         strict TypeScript项目配置
│   ├── .oxlintrc.json         React/hooks/TypeScript lint规则
│   └── src/
│       ├── main.tsx          StrictMode、BrowserRouter入口
│       ├── app/              App、根Providers、路由
│       ├── features/auth/    API、类型、认证hooks、路由守卫、登录/注册/应用壳
│       ├── shared/api/       原生fetch客户端、token存储
│       ├── index.css         Tailwind导入与基础样式
│       └── test/setup.ts     jest-dom/Vitest初始化
└── docs/                     当前仅.gitkeep，无独立长期设计文档
```

关键阅读入口：

- `IdentityController.java`：注册/登录/登出/当前用户的真实 API DTO。
- `VocabularyController.java`：创建/分页/详情接口；`id` 是个人 `UserVocabulary` 的 ID。
- `LearningVocabularyQuery.java` / `JpaLearningVocabularyQuery.java`：学习模块访问词汇的端口和实现，不能绕过它直接依赖词汇 JPA。
- `DailyLearningPlanService.java`、`DailyLearningPlanInsertTransaction.java`、`DailyLearningPlanConflictRecovery.java`：事务和并发恢复。
- `ApiError.java` / `ApiErrorResponseFactory.java`：统一错误 JSON；MVC 与 Spring Security 仍是独立处理链。
- `frontend/src/features/auth/hooks/useAuth.ts`：当前用户查询与认证 mutation。
- `frontend/src/shared/api/apiClient.ts` / `tokenStorage.ts`：HTTP 和 token 唯一集中入口。

## 3. 安装、启动、测试、构建

所有命令均从仓库根目录起步。根目录没有 `pom.xml` 或 `package.json`；分别进入对应子目录。依赖首次下载需要网络；不要通过修改全局环境解决项目问题。

### 工具链检查

```sh
java -version
node --version
npm --version
```

本次读取的本机版本为 Temurin Java 21.0.11、Node v24.20.0、npm 11.19.0。Node 由 fnm 管理，根 `.node-version` 为 24。已配置 fnm 的终端可在仓库根目录运行 `fnm use`；不要写死个人机器上 fnm 的绝对路径。新机器若缺少工具，先报告并取得明确安装授权。

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
- IntelliJ 导入 `backend/pom.xml`，使用 JDK 21。

### 后端启动

默认方式使用 MySQL；先在进程环境中配置第9节变量，并准备可连接的数据库/账号：

```sh
cd backend
./mvnw spring-boot:run
```

只做隔离本地 API 联调时，可使用现有 H2 `test` profile，无需本地 MySQL：

```sh
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=test
```

后端默认端口 8080。`test` profile 数据在进程结束后丢失，账号与 token 在重启后不能视为继续有效。`dev` profile 仍使用 MySQL；`dev`/`test` 的配置仅用于本地/测试，不能用于生产。当前 `pom.xml` 的未提交 preview 改动尚待确认，见第5、8节。

### 前端安装与质量门

已有锁文件，新环境用 `npm ci` 重现依赖。仅在确需调整依赖时用 `npm install` 并审阅锁文件变化。

```sh
cd frontend
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run test` 默认非交互；`npm run test:watch` 用于开发观察。`build` 包含 TypeScript检查及 Vite构建，产物在 `frontend/dist/`。

### 前端启动与联调

在另一个终端运行：

```sh
cd frontend
npm run dev
```

访问 Vite 输出的地址，默认端口通常为 5173，以实际输出为准。Vite 开发代理将 `/api` 原路径转发至后端 8080，前端请求应始终使用相对 `/api/v1/...`。后端须同时运行。

构建预览：

```sh
cd frontend
npm run preview
```

该代理不是静态构建产物的一部分。当前安装的Vite实现会在未单独设置 `preview.proxy` 时让预览服务继承 `server.proxy`，但本次没有启动preview验证；不要将本地dev/preview代理等同于生产反向代理，生产转发方案仍待确定。

### 验证记录的边界

- 历史会话记录：后端完整验证曾通过（17个快速测试、10个MySQL集成测试），包括迁移、持久化约束和计划失败回滚；这些记录早于当前未提交的 `pom.xml` 改动。
- 2026-10-20 的3A实现记录：前端 typecheck/lint/test/build通过，12个测试；以H2 test profile启动后端，通过Vite代理的register/login/me/logout均返回200。
- 该联调是HTTP级验证，不等于真实浏览器中注册→登录→刷新→登出的完整验收。此浏览器验收、首次 `/me` 失败恢复和多标签行为仍待补充。
- 本次文档任务没有重跑以上命令；接手修改代码后按对应质量门复验，不沿用历史成功结论。

## 4. 当前进度：已有实现

### 后端 Milestone 1 与加固

- 注册、登录、当前用户、登出/token撤销；BCrypt密码存储。
- 用户CLB等级、每日新词目标。
- 单词/短语创建、个人词库分页、详情、跨用户访问隔离。
- `VocabularyItem`（共享内容）与 `UserVocabulary`（用户学习关系）分离；词条规范化及重复关系约束。
- 可替换的词汇补全端口、确定性 fake实现、补全状态；没有真实AI/字典调用。
- API DTO/领域对象/JPA分离，仓储端口与持久化适配器；统一API错误模型/工厂。
- Flyway、MySQL、H2快速测试、MySQL Testcontainers兼容性测试、Spotless。

### 后端 Milestone 2

- 每个用户/日期只有一个持久化 DailyLearningPlan，重复请求返回既有计划。
- 从个人 `NEW` 词汇按 `createdAt ASC, id ASC` 选取至每日目标；不足时取全部。
- 计划项区分 NEW/REVIEW，存储快照及显式 `item_order`，重载后顺序保持稳定。
- `DueReviewProvider` 已有边界，当前实现返回空列表。
- 显式应用层只读事务、独立写事务和独立冲突重读事务；聚合保存失败回滚。
- `GET /api/v1/learning/daily-plan` 及可选日期参数；缺省日期按UTC计算。

### 前端基础与 Milestone 3A

- Router、QueryClient、Tailwind、Vitest/RTL、Oxlint、strict TypeScript、开发代理。
- 登录/注册表单、校验、提交禁用/加载状态及错误显示。
- token集中持久化、`/me` bootstrap、401清会话、public-only/保护路由。
- 登出无论后端成功或失败均清本地认证状态。
- 最小登录后应用壳，显示当前邮箱与登出按钮。
- 3A实现已在当前工作区，**不是全部已提交**，也不是已完成生产安全/完整浏览器验收。

### 当前接口与路由

| 入口 | 当前契约/行为 |
| --- | --- |
| POST `/api/v1/auth/register` | email、password、clbLevel、dailyNewVocabularyGoal；返回用户，不发token |
| POST `/api/v1/auth/login` | email、password；返回 `{accessToken,user}` |
| GET `/api/v1/auth/me` | Bearer认证，返回 `{id,email,clbLevel,dailyNewVocabularyGoal}`，无密码字段 |
| POST `/api/v1/auth/logout` | Bearer认证，响应无业务JSON正文 |
| POST/GET `/api/v1/vocabulary` | 创建/分页，身份由principal获取 |
| GET `/api/v1/vocabulary/{id}` | 查询个人词库关系的详情，限制归属 |
| GET `/api/v1/learning/daily-plan` | 返回 `{date,newVocabularyGoal,newItems,reviewItems}`，注意goal字段名与用户DTO不同 |
| 前端 `/` | 根据认证状态跳 `/login` 或 `/app` |
| 前端 `/login`、`/register` | 已登录者跳 `/app`；未登录者显示表单 |
| 前端 `/app` | 保护路由，只是应用壳，未实现词汇/学习界面 |

错误响应统一为 `{code,message,timestamp}`。前端不要创造另一套后端错误格式。CLB支持1–12，注册密码至少8字符，目标1–100；表单显式提供CLB和目标。

## 5. 进行中与工作区状态

此前记录的未提交/未跟踪改动已全部在提交 `84710db`（分支 `claude-code-continue`）中提交，提交后工作区干净：

- `frontend/src/features/`、`frontend/src/shared/`（3A认证实现及测试）已纳入Git跟踪。
- `frontend/src/app/providers/AppProviders.tsx`、`frontend/src/app/router/AppRouter.tsx` 的修改已提交；旧基础演示测试 `frontend/src/app/App.test.tsx` 的删除已提交，由认证测试替代。
- `backend/pom.xml` 新增的 `maven-compiler-plugin`（Java21 source/target 及 `--enable-preview`）也已随该提交入库；但其来源、用途以及是否应保留仍为**待确认**，提交不代表已确认需要。

当前Git提交已包含全部3A实现。接手时仍以 `git status` 为准，不要使用reset/clean覆盖工作区，也不要自动提交。

历史会话称3A实现及所列检查已完成，未记录仍在运行的开发任务或必须安装工具才能解决的阻塞。实际继续点是3A人工验收与第8节可证实缺口的收尾。不能凭空声称已有进行一半的Vocabulary/学习UI。

## 6. 待办事项（建议优先级，后续里程碑范围待确认）

1. **P0：交接完整性与当前基线。** 审阅未提交3A文件，确认 `pom.xml` preview改动的意图，再执行当前两端质量门。保留原作者改动，未经指示不回滚。
2. **P0：3A认证收尾。** 为首次 `/me` 网络/5xx失败设计明确错误、重试或退出路径；补真实浏览器的注册、登录、刷新、保护路由、登出和过期token验收。
3. **P1：补关键测试与HTTP边界。** 明确测试注册400（现有错误测试实际是409）、正常空响应登出、登录后 `/me`刷新、已登录访问公共路由、网络失败及成功响应空JSON等。无需引入新测试框架。
4. **P1：文档/页面元信息。** 更新两份过时README；修正 `index.html` 的默认标题及失效favicon引用。
5. **P2：下一步产品UI，范围待用户确认。** 当前已有词汇创建/列表/详情和每日计划后端，可优先对接Vocabulary UI，再对接Daily Learning Plan UI；这只是交接建议，未获确认的3B任务清单不能当作已承诺需求。
6. **后续：** 真实字典/AI接入、失败重试、练习、评估、掌握度、间隔复习、音频、用户时区及生产认证/部署加固；具体顺序和规则均待确认。

## 7. 重要设计决定与约定

### 模块边界

- 单体按业务能力拆模块，保持简单；不引入微服务、队列或分布式锁。
- Web → application → domain/仓储端口 ← persistence adapter → Spring Data JPA → MySQL。
- 领域不依赖Spring/JPA/HTTP/AI厂商；应用服务允许使用Spring事务注解，但不能直接使用JPA实体/仓储。
- 学习只依赖词汇查询端口；保留DTO、领域和实体映射，禁止为让测试通过而给JPA实体随意添加值相等语义。

### 词汇、日期和事务

- 共享词条与个人关系分离，避免重复维护内容并保证用户隔离。`VocabularyTerm` 保留清理空白后的显示大小写，`normalized()` 用 `Locale.ROOT` 转小写匹配；数据库分别保存 `term` 和 `normalized_term`。不要把规范化值当显示文本，也不要顺手改变重复规则。
- 计划是当日持久化快照；已有计划不重选。创建计划不会推进词汇学习状态，因此不同日期目前可能再次选到相同NEW词；不是已实现的复习算法。
- UTC `Instant` / `DATETIME(6)`，学习日期 `LocalDate`；计划默认“今天”不是用户本地时区。
- `getOrCreate` 为应用层 `readOnly`事务；插入/flush通过独立Spring bean的 `REQUIRES_NEW`写事务完成；重复异常在该事务结束后被adapter捕获；winner reload通过另一bean的 `REQUIRES_NEW + readOnly`执行。
- 这是显式编排多个事务，不是整个use case只有一个可统一回滚的数据库事务。计划和全部项由同一写事务保存；不能把异常捕获移到仍会rollback-only的共享事务，也不能通过同类self-invocation让传播注解失效。

### 认证与前端状态

- 后端用BCrypt与自定义HMAC-SHA256签名Bearer token；该token不是标准三段JWT，前端应当作不透明字符串，不解码依赖内部格式。
- 登出保存token哈希用于撤销；后端始终是授权与用户隔离的最终边界。
- token集中暂存localStorage；待生产认证加固时重评HttpOnly cookie方案，不在后续普通UI任务中重构后端认证。
- TanStack Query是当前用户唯一服务端状态源，Context仅协调token；页面/组件 → feature hooks → Query/mutation → feature API → shared fetch client。
- 登录成功会先使用login响应中的user填充cache，再invalidate当前用户查询；不是“必须等新一次 `/me`成功才准入”的严格屏障。
- Router保持Declarative Mode；不要引入loaders/actions/SSR/framework mode。保持Oxlint及strict TypeScript，避免无理由 `any`。
- 不默认引入Redux/Zustand/MobX/Axios/Next.js/GraphQL/大型UI框架；保持小组件、组合和移动优先。

## 8. 已知问题、坑与保护范围

以下为源码确认或历史记录的边界，本次没有修改这些实现：

| 问题/边界 | 影响与继续开发注意事项 |
| --- | --- |
| 首次 `/me` 非401失败 | `useAuth.ts` 无cache时返回unknown；守卫一直显示“Checking your session…”且无明确错误/手动恢复入口，是可确认的UX缺口 |
| HTTP成功正文处理 | `apiClient.ts` 对204/非JSON直接返回空；200+JSON但空/非法正文会抛解析错误，尚无对应测试，不能泛称已覆盖全部空响应 |
| 401与跨标签同步 | 目前仅 `/me` 的401驱动清token，shared client无统一401处理；Context不监听storage事件。新增用户数据query前需考虑失效与缓存隔离 |
| localStorage | 暴露于同源脚本/XSS；只是当前获准的临时MVP方案，读写失败也尚未专门处理 |
| 真浏览器验收不足 | 历史curl联调与mock测试不能证明刷新、重定向时序、重复提交和完整登录UI都在浏览器中验收通过 |
| README/元信息滞后 | 根README仍说前端未开始且未完整反映learning模块；前端README是模板；index.html标题仍为vite-scaffold且引用不存在的favicon.svg |
| preview编译配置 | 当前未提交pom改动未重新验证，不代表项目确实需要Java preview；先确认意图，勿自动删除/扩散运行参数 |
| fake补全与复习占位 | deterministic fake不是AI；reviewItems当前为空；没有掌握度/评估/复习调度。不能为充数据编造业务算法 |
| 并发测试边界 | 已有服务mock冲突路径、MySQL重复键和失败回滚测试；不等于已做多线程端到端get-or-create竞争测试 |
| 词汇并发创建（待验证） | 词汇adapter的重复异常处理仍参与VocabularyService外层事务，不同于learning的隔离事务；真实竞争下的rollback-only行为待验证，不应写成已修复或已复现bug |
| token后续加固 | 当前token未含随机nonce，同用户同秒签发可能得到相同token；撤销记录未见过期清理任务。这些应单独评估，不能在普通前端任务中改变签名格式 |
| 生产部署 | Vite本地服务的proxy不随dist部署；尚无完整生产SPA回退/同源API转发/CORS部署方案，禁止把开发默认DB连接及profile当生产模板 |

必须保护：

- 不重写已完成认证/安全/词汇持久化解耦/学习事务加固，除非当前任务明确包含必要修改。
- 不编辑既有Flyway V1–V4内容；后续用新迁移。不要切换Hibernate为自动建表来让测试通过。
- 增加迁移时同步维护 `MysqlFlywayIT` 中当前固定的迁移数量断言。MySQL测试会清空测试数据表，不能手工改连个人/生产数据库。
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
| `VOCABFLOW_AUTH_SECRET` | 默认profile所需HMAC签名密钥；从外部提供，勿写进仓库/日志 |
| `SPRING_PROFILES_ACTIVE` | Spring可选profile选择入口；也可用上述Maven启动参数选择profile |
| `SERVER_PORT` | Spring可选端口覆盖入口；若改变需同步考虑Vite代理目标 |

前四项是项目配置明确引用的变量；后两项是Spring标准可选配置入口，不是新加的项目必需变量。未发现当前前端读取任何自定义 `VITE_*` 环境变量；不需要为此编造API key或base URL变量。

配置文件职责：

- `backend/src/main/resources/application.yml`：MySQL、Flyway、Hibernate validate、关闭Open-in-View、UTC和认证配置。
- `application-dev.yml`：本地开发覆盖，仍依赖MySQL。
- `application-test.yml`：H2隔离测试/本地联调与测试用认证配置；不得部署到生产。
- MySQL集成基类使用容器动态JDBC参数覆盖datasource，不依赖个人数据库环境变量。
- `frontend/vite.config.ts`：开发代理和Vitest/Tailwind集成；API客户端用相对路径。
- `.env`被忽略不等于自动注入：当前Maven Wrapper/Spring启动脚本未配置自动加载仓库根 `.env`，后端变量需由进程环境/IDE等传入。Vite若日后使用 `VITE_*`，其值会进入客户端，不可放秘密。

需要用户确认：更细用户画像和下一里程碑范围、当前preview编译配置的目的、3A最终浏览器验收结果，以及生产部署/认证硬化方案。未经确认，不把这些事项当成既定设计。
