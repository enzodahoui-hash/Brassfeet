# Graph Report - Brassfeet  (2026-10-24)

## Corpus Check
- 287 files · ~389,966 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 44 file(s) not represented in the graph (top: .csv 37, (none) 4, .toml 1)

## Summary
- 2935 nodes · 7947 edges · 180 communities (100 shown, 80 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a1d4f2b3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- management.test.ts
- GameStore
- Match Engine & Lineups
- matches.ts
- types.ts
- useGame
- attributes.ts
- Player Attributes & Ratings
- Shared UI Components
- Core Type Definitions
- MatchSim
- Data Build Script
- sparql.mjs
- Security Misconfiguration Reference
- Player.tsx
- Awards Computation
- Wiki Article Scripts
- Lineup UI Components
- Editor.tsx
- nations.ts
- clamp
- Node HTTP Server
- Player Level Graphics
- Progression & Finances
- Competition Defaults
- Board & Season Setup
- Universe Editor
- advance.ts
- Lineup Logic
- Netlify API Config
- season.ts
- engine.ts
- Fetch Template Scripts
- Server-Side Request Forgery (SSRF) Prevention Reference
- core.py
- Panel
- Blob Storage Tests
- Account Client API
- E2E Test Runner
- package.json
- Docker Compose Config
- Squad Assignment Scripts
- NPM Scripts
- Wiki Parsing Scripts
- format_ascii_box
- Division Resolution Scripts
- awards.ts
- Python Security Patterns
- Photo Fetch Scripts
- Membership Scripts
- Alt Fetch Scripts
- Player QID Scripts
- Cross-Site Request Forgery (CSRF) Prevention Reference
- SaveManager
- useCareer
- storage.ts
- Known Levels Data
- Service Worker
- Football Manager BR (nome provisório)
- api.mts
- core.mjs
- UI/UX Pro Max - Design Intelligence
- [...path].mjs
- kits.ts
- 5. Re-render Optimization
- CatalogRefreshTest
- 7. JavaScript Performance
- Quick Reference
- compilerOptions
- .autoManage
- blobs-store.test.ts
- account.ts
- Pre-Delivery Checklist (canonical — the only one)
- Quick Reference
- run.mjs
- remote.ts
- _style_is_dark_primary
- 6. Rendering Performance
- jogo
- assign.mjs
- Security Review Specification
- 3. Server-Side Performance
- scripts
- parsewiki.mjs
- StatsViews.tsx
- Auditoria — Brassfeet / "Mandante"
- vercel.json
- React Best Practices
- Sections
- resolve.mjs
- photos.mjs
- Frontend Design
- TestThresholdGate
- test_skill_script_paths.py
- 1. Eliminating Waterfalls
- 2. Bundle Size Optimization
- CatalogSummaryLineEndingsTest
- React Best Practices
- memberships.mjs
- .outcome
- TestStackFlagWithDesignSystem
- TestMetricMath
- 4. Client-Side Data Fetching
- Web Interface Guidelines
- fetchalt.mjs
- playerqids.mjs
- async-cheap-condition-before-await.md
- Prefer Statically Analyzable Paths
- server-hoist-static-io.md
- squads.mjs
- known-levels.ts
- CLAUDE.md
- advanced-effect-event-deps.md
- advanced-event-handler-refs.md
- advanced-init-once.md
- advanced-use-latest.md
- async-api-routes.md
- async-dependencies.md
- async-parallel.md
- async-suspense-boundaries.md
- bundle-barrel-imports.md
- bundle-conditional.md
- bundle-defer-third-party.md
- bundle-dynamic-imports.md
- bundle-preload.md
- client-event-listeners.md
- client-localstorage-schema.md
- client-passive-event-listeners.md
- client-swr-dedup.md
- js-batch-dom-css.md
- js-cache-function-results.md
- js-cache-property-access.md
- js-cache-storage.md
- js-combine-iterations.md
- js-early-exit.md
- js-flatmap-filter.md
- js-hoist-regexp.md
- js-index-maps.md
- js-length-check-first.md
- js-min-max-loop.md
- js-request-idle-callback.md
- js-set-map-lookups.md
- js-tosorted-immutable.md
- rendering-activity.md
- rendering-animate-svg-wrapper.md
- rendering-conditional-render.md
- rendering-content-visibility.md
- rendering-hoist-jsx.md
- rendering-hydration-no-flicker.md
- rendering-hydration-suppress-warning.md
- rendering-resource-hints.md
- rendering-script-defer-async.md
- rendering-svg-precision.md
- rendering-usetransition-loading.md
- rerender-defer-reads.md
- rerender-dependencies.md
- rerender-derived-state.md
- rerender-derived-state-no-effect.md
- rerender-functional-setstate.md
- rerender-lazy-state-init.md
- rerender-memo.md
- rerender-memo-with-default-value.md
- rerender-move-effect-to-event.md
- rerender-simple-expression-in-memo.md
- rerender-split-combined-hooks.md
- rerender-transitions.md
- rerender-use-deferred-value.md
- rerender-use-ref-transient-values.md
- server-after-nonblocking.md
- server-auth-actions.md
- server-cache-lru.md
- server-dedup-props.md
- server-parallel-fetching.md
- server-parallel-nested-fetching.md
- server-serialization.md
- _template.md
- sw.js

## God Nodes (most connected - your core abstractions)
1. `clamp()` - 101 edges
2. `ovrToLevel()` - 85 edges
3. `Panel()` - 79 edges
4. `useGame()` - 78 edges
5. `useCareer()` - 73 edges
6. `MatchSim` - 68 edges
7. `Rng` - 53 edges
8. `Table()` - 53 edges
9. `addNews()` - 52 edges
10. `Icon()` - 52 edges

## Surprising Connections (you probably didn't know these)
- `3.3 Avoid Shared Module State for Request Data` --references--> `currentUser()`  [INFERRED]
  .claude/skills/vercel-react-best-practices/AGENTS.md → server/core.mjs
- `Avoid Shared Module State for Request Data` --references--> `currentUser()`  [INFERRED]
  .claude/skills/vercel-react-best-practices/rules/server-no-shared-module-state.md → server/core.mjs
- `3. Pendências na tela do usuário` --references--> `pendingDecisions()`  [INFERRED]
  AUDITORIA.md → src/engine/career/decisions.ts
- `5.4 Don't Define Components Inside Components` --references--> `Avatar()`  [INFERRED]
  .claude/skills/vercel-react-best-practices/AGENTS.md → src/ui/components/graphics.tsx
- `4.2 Performance de interface — prioridade MÉDIA` --references--> `useGame()`  [INFERRED]
  AUDITORIA.md → src/ui/store.ts

## Import Cycles
- None detected.

## Communities (180 total, 80 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.11
Nodes (57): userFixtureToday(), pendingDecisions(), clubFixtures(), fixturesOn(), nextClubFixture(), jobOffers(), compFixtures(), roundName() (+49 more)

### Community 1 - "management.test.ts"
Cohesion: 0.06
Nodes (66): expireDecisions(), resolveDecision(), defaultFinanceSettings(), injectCapital(), monthlyFinance(), performanceIndex(), takeBankLoan(), EXPENSE_CATS (+58 more)

### Community 2 - "GameStore"
Cohesion: 0.15
Nodes (7): AdvanceResult, createLiveMatch(), SaveMeta, UniverseMeta, SeasonSummary, GameStore, tick()

### Community 3 - "Match Engine & Lineups"
Cohesion: 0.06
Nodes (14): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), persist_design_system(), safe_slug(), _write_persisted_file(), apply_decision_rules(), _object_without_duplicates() (+6 more)

### Community 4 - "matches.ts"
Cohesion: 0.09
Nodes (43): Arquitetura, Documento de continuidade, Estado atual, Pontos sensíveis, Próximos passos sugeridos, markRecovering(), addMissed(), addStats() (+35 more)

### Community 5 - "types.ts"
Cohesion: 0.07
Nodes (43): Day, CreatorPreview, StatRow, Achievement, AchievementKind, AwardCandidate, AwardResult, AwardWindow (+35 more)

### Community 6 - "useGame"
Cohesion: 0.15
Nodes (40): fmtMoney(), levelLabel(), App(), Confirm(), Field(), Modal(), NumInput(), Toasts() (+32 more)

### Community 7 - "attributes.ts"
Cohesion: 0.07
Nodes (44): advanceDay(), advanceToNextEvent(), playAIFixtures(), recovering(), playFixture(), A, ATTR_COUNT, AttrKey (+36 more)

### Community 8 - "Player Attributes & Ratings"
Cohesion: 0.07
Nodes (43): read_rows(), TestAccessibilityGuidance, TestChartsTypographyAndIcons, TestCurrentReactGuidance, TestSemanticColors, _catalog_date(), _check_app_interface_contract(), _check_catalog_contract() (+35 more)

### Community 9 - "Shared UI Components"
Cohesion: 0.06
Nodes (15): _button_outline_text_color(), _contrast_ratio(), _derive_dark_palette(), DesignSystemGenerator, _filter_anti_patterns_for_mode(), format_master_md(), _palette_is_dark(), _relative_luminance() (+7 more)

### Community 10 - "Core Type Definitions"
Cohesion: 0.07
Nodes (64): continentalDates, continentalWeeks(), cupDates(), dayIsWeekend(), daysOfWeek(), domesticMidweeks(), leagueDates(), regionOf() (+56 more)

### Community 11 - "MatchSim"
Cohesion: 0.12
Nodes (9): lastName(), MatchOutcome, MatchSim, pick(), CardEv, GoalEv, MatchEvent, SubLog (+1 more)

### Community 12 - "Data Build Script"
Cohesion: 0.11
Nodes (43): moveToClub(), removeFromClub(), aiMarketWeek(), aiSquadMaintenance(), askingPrice(), BidResult, cancelNegotiation(), completeTransfer() (+35 more)

### Community 13 - "sparql.mjs"
Cohesion: 0.10
Nodes (26): ids, out, r, ids, out, r, L, out (+18 more)

### Community 14 - "Security Misconfiguration Reference"
Cohesion: 0.05
Nodes (38): Admin/Debug Endpoints, Configuration Files to Check, Content Security Policy, Cookie Security, CORS Misconfiguration, Dangerous Patterns, Dangerous Patterns, Dangerous Patterns (+30 more)

### Community 15 - "Player.tsx"
Cohesion: 0.10
Nodes (55): Don't Define Components Inside Components, awardsOfPlayer(), starsOf(), availabilityNote(), validateLineup(), strengthSummary(), playerMarketStatus(), setFutureRole() (+47 more)

### Community 16 - "Awards Computation"
Cohesion: 0.07
Nodes (28): artqid, clubinfo, clubsOut, coachesOut, det, FIX_NAT, hex(), infoboxColors() (+20 more)

### Community 17 - "Wiki Article Scripts"
Cohesion: 0.06
Nodes (35): 1. Avoid Native Serialization, 2. Sign Serialized Data, 3. Type-Restricted Deserialization, 4. Input Validation, Dangerous Functions, Dangerous Patterns, Dangerous Patterns, Dangerous Patterns (+27 more)

### Community 18 - "Lineup UI Components"
Cohesion: 0.06
Nodes (8): _resolve_dial(), read_rows(), split_values(), style_identities(), TestGeneratedCatalogContract, TestLandingAndStackContract, TestReasoningContract, TestStyleIdentityContract

### Community 19 - "Editor.tsx"
Cohesion: 0.08
Nodes (35): react, TIEBREAK_NAMES, NATIONS, setFinances(), universeStats(), ATTR_GROUPS, ATTRS, stylesFor() (+27 more)

### Community 20 - "nations.ts"
Cohesion: 0.06
Nodes (33): AF_FIRST, AF_LAST, COL_LAST, DE_FIRST, DE_LAST, ECU_LAST, EE_FIRST, EE_LAST (+25 more)

### Community 21 - "clamp"
Cohesion: 0.06
Nodes (89): invalidateRatings(), clamp(), ClubSeed, DIVISIONS, DivisionSeed, META, NAME_PATTERNS, PALETTE (+81 more)

### Community 22 - "Node HTTP Server"
Cohesion: 0.06
Nodes (32): Base Image Issues, Build-Time Secrets, COPY vs ADD, Docker Compose Security, Docker Security Reference, Docker Socket Access, Dockerfile Security, .dockerignore (+24 more)

### Community 23 - "Player Level Graphics"
Cohesion: 0.06
Nodes (32): Attack Vector, Build Pipeline Security, Common Typosquatting Patterns, Dependency Confusion, Detection, Detection Patterns, Generation, Grep Patterns for Detection (+24 more)

### Community 24 - "Progression & Finances"
Cohesion: 0.10
Nodes (6): _exact_stack_identifier(), search_stack(), _rows(), TestNativeDesktopStackFreshness, _rows(), TestWebStackFreshness

### Community 25 - "Competition Defaults"
Cohesion: 0.06
Nodes (30): Always Flag, Angular, Any Type Warnings, Auto-Escaped (Do Not Flag), Auto-Escaped (Do Not Flag), Auto-Escaped (Do Not Flag), Check Context, Express / Node.js (+22 more)

### Community 26 - "Board & Season Setup"
Cohesion: 0.06
Nodes (30): 1. Data Classification, 2. Minimize Data Collection, 3. Encryption at Rest, 4. Encryption in Transit, API Response Filtering, Authentication Credentials, Cache Headers, Cache Security (+22 more)

### Community 27 - "Universe Editor"
Cohesion: 0.09
Nodes (6): search(), _style_search_destination(), TestDiagnosticsContracts, TestSearchDomains, TestStyleTaxonomy, TestTextLayoutRetrieval

### Community 28 - "advance.ts"
Cohesion: 0.10
Nodes (45): ballonDay(), galaDay(), AdvanceStatus, compEventsNews(), dayLabel(), endOfDay(), nextUserFixture(), seniorRequests() (+37 more)

### Community 29 - "Lineup Logic"
Cohesion: 0.07
Nodes (29): API Key Security, API Security Reference, Authentication, Authorization, Batching Attack Prevention, Content-Type Validation, CORS Configuration, Disable Introspection in Production (+21 more)

### Community 30 - "Netlify API Config"
Cohesion: 0.07
Nodes (29): Authentication Bypass on Error, Cleanup on Error, Dangerous Patterns, Dangerous Patterns, Differential Error Messages, Error-Based SQL Injection Indicators, Error Handling Security Reference, Exception Swallowing (+21 more)

### Community 31 - "season.ts"
Cohesion: 0.13
Nodes (31): FIRE_THRESHOLD, KO_PROGRESS, objectiveStatus(), seasonBoardReview(), setObjectives(), weeklyBoard(), findClashes(), newCareer() (+23 more)

### Community 32 - "engine.ts"
Cohesion: 0.09
Nodes (32): Slot, PlayerFilter, PASS_W, PlayerLine, PS, SideInput, Str, SubsInfo (+24 more)

### Community 33 - "Fetch Template Scripts"
Cohesion: 0.07
Nodes (27): Account Lockout, Authentication Security Reference, Brute Force Protection, Concurrent Session Control, Cookie Security Attributes, Email Address Changes, Error Messages, Exponential Backoff (+19 more)

### Community 34 - "Server-Side Request Forgery (SSRF) Prevention Reference"
Cohesion: 0.07
Nodes (27): 1. Input Validation (Allowlist), 2. Block Internal Networks (Denylist), 3. Disable Redirects, 4. DNS Rebinding Protection, 5. Cloud Metadata Protection, Alternate Representations, Attack Scenarios, AWS IMDSv2 (+19 more)

### Community 35 - "core.py"
Cohesion: 0.06
Nodes (25): _contains_phrase(), detect_domain(), _domain_keywords(), _exact_match_diagnostic(), _exact_row_identity(), _file_signature(), _legacy_successor_guidance(), _load_csv() (+17 more)

### Community 36 - "Panel"
Cohesion: 0.27
Nodes (17): 4.1 Acessibilidade — prioridade ALTA (barato, alto impacto), nationName(), POS_SHORT, careerTotals(), clickable(), Empty(), Table(), Tabs() (+9 more)

### Community 37 - "Blob Storage Tests"
Cohesion: 0.07
Nodes (26): 1. Deny by Default, 2. Enforce Least Privilege, 3. Validate Permissions on Every Request, Access Control Models, Attribute-Based Access Control (ABAC), Authorization Security Reference, Authorization Testing, Common Vulnerabilities (+18 more)

### Community 38 - "Account Client API"
Cohesion: 0.07
Nodes (26): Asymmetric Encryption, Cipher Modes, Common Vulnerabilities, Core Principles, Cryptographic Security Reference, Cryptographically Secure PRNGs (CSPRNG), ECB Mode Patterns, Encryption Algorithms (+18 more)

### Community 39 - "E2E Test Runner"
Cohesion: 0.07
Nodes (26): Angular, Content Security Policy (CSP), Cross-Site Scripting (XSS) Prevention Reference, CSS Context, Dangerous Sources, Django/Jinja2, DOM-based XSS Prevention, Framework-Specific Considerations (+18 more)

### Community 40 - "package.json"
Cohesion: 0.10
Nodes (24): devDependencies, fake-indexeddb@^6.0.0, playwright-core@^1.56.1, @types/node@^22.10.2, @types/react@^18.3.12, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.11 (+16 more)

### Community 41 - "Docker Compose Config"
Cohesion: 0.08
Nodes (25): Archive (ZIP) Handling, Characters to Block, Dangerous File Types, Defense in Depth Approach, File Permissions, File Security Reference, File Upload Security, Filename Sanitization (+17 more)

### Community 42 - "Squad Assignment Scripts"
Cohesion: 0.08
Nodes (25): Alert Configuration, Attack Vector, Audit Trail Requirements, Dangerous Patterns, Events That Must Be Logged, Grep Patterns for Detection, Immutable Audit Logs, Insecure Patterns (+17 more)

### Community 43 - "NPM Scripts"
Cohesion: 0.08
Nodes (25): Authentication, Cross-Site WebSocket Hijacking (CSWSH), Detection, DOM Clobbering, DOM Clobbering, Grep Patterns for Detection, LLM Prompt Injection, LLM Prompt Injection (+17 more)

### Community 44 - "Wiki Parsing Scripts"
Cohesion: 0.08
Nodes (25): 1. Detect Context, 2. Load Language Guide, 3. Load Infrastructure Guide (if applicable), 4. Research Before Flagging, 5. Verify Exploitability, 6. Report HIGH Confidence Only, Always Flag (Critical), Always Flag (High) (+17 more)

### Community 45 - "format_ascii_box"
Cohesion: 0.12
Nodes (10): ansi_ljust(), format_ascii_box(), add_wrapped(), wrap_text(), format_markdown(), generate_design_system(), hex_to_ansi(), _mode_support_labels() (+2 more)

### Community 46 - "Division Resolution Scripts"
Cohesion: 0.11
Nodes (17): createApp(), serveApi(), { DatabaseSync }, loadConfig(), makeLimiter(), MIME, now(), openDb() (+9 more)

### Community 47 - "awards.ts"
Cohesion: 0.19
Nodes (25): addAchievement(), awardName(), awardScorerStars(), bestBy(), bump(), candidateScore(), competitionAwards(), computeScorers() (+17 more)

### Community 48 - "Python Security Patterns"
Cohesion: 0.08
Nodes (24): Always Flag, Auto-Escaped (Do Not Flag), Check Context, Common Mistakes, Django, Django Security Settings, FastAPI, Flag These (+16 more)

### Community 49 - "Photo Fetch Scripts"
Cohesion: 0.08
Nodes (24): 1. Race Conditions, 2. Workflow Bypass, 3. Numeric Manipulation, 4. Price/Discount Manipulation, 5. Inventory/Resource Exhaustion, 6. Time-Based Attacks, 7. Parameter Tampering, Business Logic Security Reference (+16 more)

### Community 50 - "Membership Scripts"
Cohesion: 0.14
Nodes (26): vitest, buildSide(), autoLineup(), familiarity(), FORMATION_NAMES, FORMATIONS, isAvailable(), LINEUP_PRESETS (+18 more)

### Community 51 - "Alt Fetch Scripts"
Cohesion: 0.13
Nodes (22): AWARD_IDS, continental(), CUP(), cupTemplate(), defaultAwards(), defaultCompetitions(), defaultConfig(), defaultCountries() (+14 more)

### Community 52 - "Player QID Scripts"
Cohesion: 0.14
Nodes (5): BM25, _get_bm25(), _suggest_identities(), TestBm25CoreBehavior, TestTokenizer

### Community 53 - "Cross-Site Request Forgery (CSRF) Prevention Reference"
Cohesion: 0.09
Nodes (22): 1. GET Requests for State Changes, 1. Synchronizer Token Pattern, 2. CORS Misconfiguration, 2. Double Submit Cookie Pattern (Stateless), 3. SameSite Cookie Attribute, 3. Token in URL, 4. Custom Request Headers, Attack Scenario (+14 more)

### Community 54 - "SaveManager"
Cohesion: 0.20
Nodes (5): careerMeta(), compress(), decompress(), KV, SaveManager

### Community 55 - "useCareer"
Cohesion: 0.16
Nodes (34): dayOf(), fmtDay(), monthName(), FINANCE_MODES, sumBy(), STAFF_ROLES, currentCollection(), setDiscount() (+26 more)

### Community 56 - "storage.ts"
Cohesion: 0.21
Nodes (14): resetIndex(), Data, migrate(), MIGRATIONS, validateCareerShape(), validateWorldShape(), idbKV(), memoryKV() (+6 more)

### Community 57 - "Known Levels Data"
Cohesion: 0.10
Nodes (12): need, arts, raw(), sleep(), map, todo, out, pairs (+4 more)

### Community 58 - "Service Worker"
Cohesion: 0.10
Nodes (20): Dangerous Characters, Injection Prevention Reference, Key Grep Patterns for Detection, Language-Specific Dangerous Functions, LDAP Injection, MongoDB Injection Patterns, NoSQL Injection, ORM Safety Considerations (+12 more)

### Community 59 - "Football Manager BR (nome provisório)"
Cohesion: 0.09
Nodes (20): 1. Netlify (tudo dentro da Netlify, sem servidor próprio), 2. Servidor Node próprio (Render, Railway, Fly.io, VPS, Docker), Como jogar, Como rodar, Contas e salvamentos, Dados reais: de onde vêm e o que é estimado, Editor do Universo e Criador de Craques, Estatísticas do elenco (+12 more)

### Community 60 - "api.mts"
Cohesion: 0.11
Nodes (18): cfg, config, core, env(), loadConfig(), dependencies, @neondatabase/serverless@^0.10.4, @netlify/blobs@^10.7.13 (+10 more)

### Community 61 - "core.mjs"
Cohesion: 0.23
Nodes (17): checkPassword(), createCore(), currentUser(), handle(), issueToken(), mailVerification(), newSession(), fail() (+9 more)

### Community 62 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.11
Nodes (17): Before Delivering App UI, Example Workflow, If a search returns 0 results, Output Formats, Query Contract, Rule Categories by Priority, Running the search tool, Step 1: Analyze User Requirements (+9 more)

### Community 63 - "[...path].mjs"
Cohesion: 0.22
Nodes (11): cfg, core, env(), getSql(), handler(), loadConfig(), parseCookies(), readRawBody() (+3 more)

### Community 64 - "kits.ts"
Cohesion: 0.22
Nodes (19): hashString(), BRANDS, colorDistance(), contrastRatio(), defaultDesign(), defaultKitCollection(), fanPreference(), hexToRgb() (+11 more)

### Community 65 - "5. Re-render Optimization"
Cohesion: 0.12
Nodes (16): 5.10 Subscribe to Derived State, 5.11 Use Functional setState Updates, 5.12 Use Lazy State Initialization, 5.13 Use Transitions for Non-Urgent Updates, 5.14 Use useDeferredValue for Expensive Derived Renders, 5.15 Use useRef for Transient Values, 5.1 Calculate Derived State During Rendering, 5.2 Defer State Reads to Usage Point (+8 more)

### Community 67 - "7. JavaScript Performance"
Cohesion: 0.13
Nodes (15): 7.10 Hoist RegExp Creation, 7.11 Use flatMap to Map and Filter in One Pass, 7.12 Use Loop for Min/Max Instead of Sort, 7.13 Use Set/Map for O(1) Lookups, 7.14 Use toSorted() Instead of sort() for Immutability, 7.1 Avoid Layout Thrashing, 7.2 Build Index Maps for Repeated Lookups, 7.3 Cache Property Access in Loops (+7 more)

### Community 68 - "Quick Reference"
Cohesion: 0.13
Nodes (14): 1. Eliminating Waterfalls (CRITICAL), 2. Bundle Size Optimization (CRITICAL), 3. Server-Side Performance (HIGH), 4. Client-Side Data Fetching (MEDIUM-HIGH), 5. Re-render Optimization (MEDIUM), 6. Rendering Performance (MEDIUM), 7. JavaScript Performance (LOW-MEDIUM), 8. Advanced Patterns (LOW) (+6 more)

### Community 69 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noImplicitAny (+6 more)

### Community 71 - "blobs-store.test.ts"
Cohesion: 0.23
Nodes (8): blobsStore(), OPS, retry(), sha(), withRetry(), fakeBlobs(), Mail, makeCore()

### Community 72 - "account.ts"
Cohesion: 0.24
Nodes (12): Account, call(), changePassword(), deleteAccount(), forgot(), health, login(), logout() (+4 more)

### Community 73 - "Pre-Delivery Checklist (canonical — the only one)"
Cohesion: 0.15
Nodes (12): Accessibility, Common Rules for Professional UI + Pre-Delivery Checklist, Icons & Visual Elements, Interaction, Interaction (App), Layout, Layout & Spacing, Light/Dark Mode (+4 more)

### Community 74 - "Quick Reference"
Cohesion: 0.15
Nodes (12): 10. Charts & Data (LOW), 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Style Selection (HIGH), 5. Layout & Responsive (HIGH), 6. Typography & Color (MEDIUM), 7. Animation (MEDIUM) (+4 more)

### Community 75 - "run.mjs"
Cohesion: 0.27
Nodes (11): advanceToMatch(), clickNav(), errors, game(), lastLink(), main(), ok(), results (+3 more)

### Community 76 - "remote.ts"
Cohesion: 0.32
Nodes (4): b64(), check(), H, remoteKV()

### Community 77 - "_style_is_dark_primary"
Cohesion: 0.21
Nodes (4): _query_wants_dark(), _resolve_color_mode(), _style_is_dark_primary(), TestModeResolution

### Community 78 - "6. Rendering Performance"
Cohesion: 0.17
Nodes (12): 6.10 Use React DOM Resource Hints, 6.11 Use useTransition Over Manual Loading States, 6.1 Animate SVG Wrapper Instead of SVG Element, 6.2 CSS content-visibility for Long Lists, 6.3 Hoist Static JSX Elements, 6.4 Optimize SVG Precision, 6.5 Prevent Hydration Mismatch Without Flickering, 6.6 Suppress Expected Hydration Mismatches (+4 more)

### Community 79 - "jogo"
Cohesion: 0.17
Nodes (11): BASE_URL, TRUST_PROXY, build, environment, ports, restart, volumes, services (+3 more)

### Community 80 - "assign.mjs"
Cohesion: 0.17
Nodes (9): mem, ours, players, raw, res, sizes, squads, tl (+1 more)

### Community 81 - "Security Review Specification"
Cohesion: 0.18
Nodes (10): Intent, Known Limitations, Maintenance Notes, Reference Architecture, Runtime Contract, Scope, Security Review Specification, Source And Evidence Model (+2 more)

### Community 82 - "3. Server-Side Performance"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 83 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:single, dev, e2e, preview, serve, start (+3 more)

### Community 84 - "parsewiki.mjs"
Cohesion: 0.25
Nodes (10): headingsOf(), nameOf(), needTpl, nm(), out, parseParams(), report, res (+2 more)

### Community 85 - "StatsViews.tsx"
Cohesion: 0.21
Nodes (19): avgRating(), conversion(), passPct(), per90(), savePct(), Col, ColSet, CompareModal() (+11 more)

### Community 86 - "Auditoria — Brassfeet / "Mandante""
Cohesion: 0.20
Nodes (9): 1. Resumo executivo, 2. Funções que faltam programar, 3. Pendências na tela do usuário, 4.2 Performance de interface — prioridade MÉDIA, 4.3 Visual / produto — prioridade BAIXA (polish), 4. Melhorias de experiência do jogador, 5. Segurança (passagem leve), 6. Plano sugerido (ordem de valor) (+1 more)

### Community 87 - "vercel.json"
Cohesion: 0.25
Nodes (7): maxDuration, buildCommand, framework, functions, api/[...path].mjs, outputDirectory, $schema

### Community 88 - "React Best Practices"
Cohesion: 0.20
Nodes (9): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns, Abstract, React Best Practices, References (+1 more)

### Community 89 - "Sections"
Cohesion: 0.20
Nodes (9): 1. Eliminating Waterfalls (async), 2. Bundle Size Optimization (bundle), 3. Server-Side Performance (server), 4. Client-Side Data Fetching (client), 5. Re-render Optimization (rerender), 6. Rendering Performance (rendering), 7. JavaScript Performance (js), 8. Advanced Patterns (advanced) (+1 more)

### Community 90 - "resolve.mjs"
Cohesion: 0.24
Nodes (5): COUNTRY_QID, DIVS, all, out, p118

### Community 91 - "photos.mjs"
Cohesion: 0.25
Nodes (5): det, files, lic, todo, vals

### Community 92 - "Frontend Design"
Cohesion: 0.29
Nodes (6): Design principles, Frontend Design, Ground your designs in the subject matter, More on writing in design, Process: plan, review against the brief, build, critique, Restraint and self-critique

### Community 94 - "test_skill_script_paths.py"
Cohesion: 0.38
Nodes (3): resolve(), shipped_invocations(), SkillScriptPathsTest

### Community 95 - "1. Eliminating Waterfalls"
Cohesion: 0.29
Nodes (7): 1.1 Check Cheap Conditions Before Async Flags, 1.2 Defer Await Until Needed, 1.3 Dependency-Based Parallelization, 1.4 Prevent Waterfall Chains in API Routes, 1.5 Promise.all() for Independent Operations, 1.6 Strategic Suspense Boundaries, 1. Eliminating Waterfalls

### Community 96 - "2. Bundle Size Optimization"
Cohesion: 0.29
Nodes (7): 2.1 Avoid Barrel File Imports, 2.2 Conditional Module Loading, 2.3 Defer Non-Critical Third-Party Libraries, 2.4 Dynamic Imports for Heavy Components, 2.5 Prefer Statically Analyzable Paths, 2.6 Preload Based on User Intent, 2. Bundle Size Optimization

### Community 99 - "React Best Practices"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 100 - "memberships.mjs"
Cohesion: 0.33
Nodes (5): clubIds, ids, raw, t2, todo

### Community 105 - "4. Client-Side Data Fetching"
Cohesion: 0.40
Nodes (5): 4.1 Deduplicate Global Event Listeners, 4.2 Use Passive Event Listeners for Scrolling Performance, 4.3 Use SWR for Automatic Deduplication, 4.4 Version and Minimize localStorage Data, 4. Client-Side Data Fetching

### Community 106 - "Web Interface Guidelines"
Cohesion: 0.40
Nodes (4): Guidelines Source, How It Works, Usage, Web Interface Guidelines

### Community 107 - "fetchalt.mjs"
Cohesion: 0.40
Nodes (3): arts, res, ws

### Community 111 - "Prefer Statically Analyzable Paths"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

## Knowledge Gaps
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `React Best Practices` connect `React Best Practices` to `2. Bundle Size Optimization`, `5. Re-render Optimization`, `7. JavaScript Performance`, `4. Client-Side Data Fetching`, `6. Rendering Performance`, `3. Server-Side Performance`, `1. Eliminating Waterfalls`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10675990675990676 - nodes in this community are weakly interconnected._
- **Why does `Avatar()` connect `Player.tsx` to `5. Re-render Optimization`, `Editor.tsx`, `useGame`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `management.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06426906426906427 - nodes in this community are weakly interconnected._
- **Why does `5. Re-render Optimization` connect `5. Re-render Optimization` to `React Best Practices`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `GameStore` be split into smaller, more focused modules?**
  _Cohesion score 0.14838709677419354 - nodes in this community are weakly interconnected._
- **Should `Match Engine & Lineups` be split into smaller, more focused modules?**
  _Cohesion score 0.05834464043419267 - nodes in this community are weakly interconnected._