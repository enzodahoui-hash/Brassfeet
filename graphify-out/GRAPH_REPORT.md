# Graph Report - Brassfeet  (2026-10-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2901 nodes · 7869 edges · 183 communities (100 shown, 83 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 187 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `72d450a2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Career Setup & Calendar
- Save Migration & Validation
- Live Match Simulation
- Match Engine & Lineups
- UI Constants & Finances
- Transfers & Decisions
- Random Utils & Real Data
- Player Stats & Rosters
- Player Attributes & Ratings
- Shared UI Components
- Core Type Definitions
- MatchSim
- Data Build Script
- sparql.mjs
- Security Misconfiguration Reference
- Nation Name Pools
- Awards Computation
- Wiki Article Scripts
- Lineup UI Components
- test_data_contracts.py
- nations.ts
- Package Dev Dependencies
- Node HTTP Server
- Player Level Graphics
- Progression & Finances
- Competition Defaults
- Board & Season Setup
- Universe Editor
- Fixture Date Planning
- Lineup Logic
- Netlify API Config
- Fixture Conflict Resolution
- Auth Core Server
- Fetch Template Scripts
- Server-Side Request Forgery (SSRF) Prevention Reference
- core.py
- TypeScript Config
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
- test_core_data_quality.py
- progression.ts
- subs-stats.test.ts
- Known Levels Data
- Service Worker
- Football Manager BR (nome provisório)
- api.mts
- core.mjs
- UI/UX Pro Max - Design Intelligence
- index.ts
- kits.ts
- 5. Re-render Optimization
- CatalogRefreshTest
- 7. JavaScript Performance
- Quick Reference
- compilerOptions
- detect_domain
- blobs-store.test.ts
- account.ts
- Pre-Delivery Checklist (canonical — the only one)
- Quick Reference
- run.mjs
- value.ts
- _style_is_dark_primary
- 6. Rendering Performance
- jogo
- assign.mjs
- Security Review Specification
- 3. Server-Side Performance
- scripts
- parsewiki.mjs
- .autoManage
- Auditoria — Brassfeet / "Mandante"
- _normalize
- React Best Practices
- Sections
- resolve.mjs
- photos.mjs
- Frontend Design
- TestThresholdGate
- test_skill_script_paths.py
- 1. Eliminating Waterfalls
- 2. Bundle Size Optimization
- _row_identities
- CatalogSummaryLineEndingsTest
- React Best Practices
- memberships.mjs
- .outcome
- TestStackFlagWithDesignSystem
- TestMetricMath
- TestTextLayoutDataContracts
- 4. Client-Side Data Fetching
- Web Interface Guidelines
- fetchalt.mjs
- playerqids.mjs
- TestFixtureValidation
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
- Tactics

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
10. `Icon()` - 51 edges

## Surprising Connections (you probably didn't know these)
- `3. Pendências na tela do usuário` --references--> `pendingDecisions()`  [INFERRED]
  AUDITORIA.md → src/engine/career/decisions.ts
- `5.4 Don't Define Components Inside Components` --references--> `Avatar()`  [INFERRED]
  .claude/skills/vercel-react-best-practices/AGENTS.md → src/ui/components/graphics.tsx
- `4.2 Performance de interface — prioridade MÉDIA` --references--> `useGame()`  [INFERRED]
  AUDITORIA.md → src/ui/store.ts
- `3.3 Avoid Shared Module State for Request Data` --references--> `currentUser()`  [INFERRED]
  .claude/skills/vercel-react-best-practices/AGENTS.md → server/core.mjs
- `Avoid Shared Module State for Request Data` --references--> `currentUser()`  [INFERRED]
  .claude/skills/vercel-react-best-practices/rules/server-no-shared-module-state.md → server/core.mjs

## Import Cycles
- None detected.

## Communities (183 total, 83 thin omitted)

### Community 0 - "Career Setup & Calendar"
Cohesion: 0.05
Nodes (199): 4.1 Acessibilidade — prioridade ALTA (barato, alto impacto), Don't Define Components Inside Components, react, awardsOfPlayer(), starsOf(), userFixtureToday(), pendingDecisions(), clubFixtures() (+191 more)

### Community 1 - "Save Migration & Validation"
Cohesion: 0.05
Nodes (80): expireDecisions(), resolveDecision(), applyDiscipline(), applyInjuries(), applyOutcome(), clubAfterMatch(), createLiveMatch(), matchInput() (+72 more)

### Community 2 - "Live Match Simulation"
Cohesion: 0.06
Nodes (27): AdvanceResult, Data, migrate(), MIGRATIONS, validateCareerShape(), validateWorldShape(), b64(), check() (+19 more)

### Community 3 - "Match Engine & Lineups"
Cohesion: 0.08
Nodes (9): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), persist_design_system(), safe_slug(), _write_persisted_file(), format_output(), read_rows() (+1 more)

### Community 4 - "UI Constants & Finances"
Cohesion: 0.09
Nodes (47): Arquitetura, Documento de continuidade, Estado atual, Pontos sensíveis, Próximos passos sugeridos, addMissed(), addStats(), closeSpell() (+39 more)

### Community 5 - "Transfers & Decisions"
Cohesion: 0.07
Nodes (45): findClashes(), tieState, accumulate(), critValue(), emptyRow(), Points, sortGroup(), standings() (+37 more)

### Community 6 - "Random Utils & Real Data"
Cohesion: 0.10
Nodes (46): TIEBREAK_NAMES, ClubPatch, deleteClub(), deletePlayer(), duplicatePlayer(), duplicateUniverse(), exportUniverseText(), generateYouth() (+38 more)

### Community 7 - "Player Stats & Rosters"
Cohesion: 0.09
Nodes (43): invalidateRatings(), updatePlayer(), ATTR_GROUPS, attributeWarnings(), AttrKey, clampAttrs(), computeOvr(), formAdjust() (+35 more)

### Community 8 - "Player Attributes & Ratings"
Cohesion: 0.10
Nodes (33): _catalog_date(), _check_app_interface_contract(), _check_catalog_contract(), _check_catalog_summary(), _check_color_contract(), _check_core_data_contract(), _check_file(), _check_font_catalog() (+25 more)

### Community 9 - "Shared UI Components"
Cohesion: 0.08
Nodes (12): _button_outline_text_color(), _contrast_ratio(), _derive_dark_palette(), _filter_anti_patterns_for_mode(), format_master_md(), _palette_is_dark(), _relative_luminance(), _select_palette_for_mode() (+4 more)

### Community 10 - "Core Type Definitions"
Cohesion: 0.13
Nodes (39): continentalDates, continentalWeeks(), cupDates(), dayIsWeekend(), daysOfWeek(), domesticMidweeks(), leagueDates(), regionOf() (+31 more)

### Community 11 - "MatchSim"
Cohesion: 0.14
Nodes (4): lastName(), MatchSim, pick(), LiveState

### Community 12 - "Data Build Script"
Cohesion: 0.15
Nodes (38): moveToClub(), removeFromClub(), aiMarketWeek(), aiSquadMaintenance(), askingPrice(), BidResult, cancelNegotiation(), completeTransfer() (+30 more)

### Community 13 - "sparql.mjs"
Cohesion: 0.10
Nodes (26): ids, out, r, ids, out, r, L, out (+18 more)

### Community 14 - "Security Misconfiguration Reference"
Cohesion: 0.05
Nodes (38): Admin/Debug Endpoints, Configuration Files to Check, Content Security Policy, Cookie Security, CORS Misconfiguration, Dangerous Patterns, Dangerous Patterns, Dangerous Patterns (+30 more)

### Community 15 - "Nation Name Pools"
Cohesion: 0.14
Nodes (33): FIRE_THRESHOLD, KO_PROGRESS, objectiveStatus(), seasonBoardReview(), setObjectives(), weeklyBoard(), newCareer(), NewCareerOptions (+25 more)

### Community 16 - "Awards Computation"
Cohesion: 0.07
Nodes (28): artqid, clubinfo, clubsOut, coachesOut, det, FIX_NAT, hex(), infoboxColors() (+20 more)

### Community 17 - "Wiki Article Scripts"
Cohesion: 0.06
Nodes (35): 1. Avoid Native Serialization, 2. Sign Serialized Data, 3. Type-Restricted Deserialization, 4. Input Validation, Dangerous Functions, Dangerous Patterns, Dangerous Patterns, Dangerous Patterns (+27 more)

### Community 18 - "Lineup UI Components"
Cohesion: 0.11
Nodes (4): DesignSystemGenerator, _resolve_dial(), TestReasoningMatch, TestReasoningContract

### Community 19 - "test_data_contracts.py"
Cohesion: 0.09
Nodes (10): apply_decision_rules(), _object_without_duplicates(), parse_decision_rules(), _validate_action(), read_rows(), split_values(), style_identities(), TestGeneratedCatalogContract (+2 more)

### Community 20 - "nations.ts"
Cohesion: 0.06
Nodes (34): AF_FIRST, AF_LAST, COL_LAST, DE_FIRST, DE_LAST, ECU_LAST, EE_FIRST, EE_LAST (+26 more)

### Community 21 - "Package Dev Dependencies"
Cohesion: 0.09
Nodes (26): ClubSeed, DIVISIONS, DivisionSeed, META, NAME_PATTERNS, PALETTE, STADIUM_PATTERNS, COMMONS_THUMB (+18 more)

### Community 22 - "Node HTTP Server"
Cohesion: 0.06
Nodes (32): Base Image Issues, Build-Time Secrets, COPY vs ADD, Docker Compose Security, Docker Security Reference, Docker Socket Access, Dockerfile Security, .dockerignore (+24 more)

### Community 23 - "Player Level Graphics"
Cohesion: 0.06
Nodes (32): Attack Vector, Build Pipeline Security, Common Typosquatting Patterns, Dependency Confusion, Detection, Detection Patterns, Generation, Grep Patterns for Detection (+24 more)

### Community 24 - "Progression & Finances"
Cohesion: 0.10
Nodes (8): _exact_stack_identifier(), _project_row(), search_stack(), _valid_max_results(), _rows(), TestNativeDesktopStackFreshness, _rows(), TestWebStackFreshness

### Community 25 - "Competition Defaults"
Cohesion: 0.06
Nodes (30): Always Flag, Angular, Any Type Warnings, Auto-Escaped (Do Not Flag), Auto-Escaped (Do Not Flag), Auto-Escaped (Do Not Flag), Check Context, Express / Node.js (+22 more)

### Community 26 - "Board & Season Setup"
Cohesion: 0.06
Nodes (30): 1. Data Classification, 2. Minimize Data Collection, 3. Encryption at Rest, 4. Encryption in Transit, API Response Filtering, Authentication Credentials, Cache Headers, Cache Security (+22 more)

### Community 27 - "Universe Editor"
Cohesion: 0.09
Nodes (6): search(), _style_search_destination(), TestDiagnosticsContracts, TestSearchDomains, TestStyleTaxonomy, TestTextLayoutRetrieval

### Community 28 - "Fixture Date Planning"
Cohesion: 0.13
Nodes (27): ballonDay(), galaDay(), advanceDay(), AdvanceStatus, advanceToNextEvent(), compEventsNews(), dayLabel(), endOfDay() (+19 more)

### Community 29 - "Lineup Logic"
Cohesion: 0.07
Nodes (29): API Key Security, API Security Reference, Authentication, Authorization, Batching Attack Prevention, Content-Type Validation, CORS Configuration, Disable Introspection in Production (+21 more)

### Community 30 - "Netlify API Config"
Cohesion: 0.07
Nodes (29): Authentication Bypass on Error, Cleanup on Error, Dangerous Patterns, Dangerous Patterns, Differential Error Messages, Error-Based SQL Injection Indicators, Error Handling Security Reference, Exception Swallowing (+21 more)

### Community 31 - "Fixture Conflict Resolution"
Cohesion: 0.12
Nodes (24): seniorRequests(), Rng, addDecision(), NewsIcon, ovrToLevel(), WeekContext, processRetirements(), retirementChance() (+16 more)

### Community 32 - "Auth Core Server"
Cohesion: 0.20
Nodes (23): batchCreate(), editorCreatePlayer(), editorMovePlayer(), redistributePlayers(), bodyFor(), buildAttrs(), makePlayer(), randomAlt() (+15 more)

### Community 33 - "Fetch Template Scripts"
Cohesion: 0.07
Nodes (27): Account Lockout, Authentication Security Reference, Brute Force Protection, Concurrent Session Control, Cookie Security Attributes, Email Address Changes, Error Messages, Exponential Backoff (+19 more)

### Community 34 - "Server-Side Request Forgery (SSRF) Prevention Reference"
Cohesion: 0.07
Nodes (27): 1. Input Validation (Allowlist), 2. Block Internal Networks (Denylist), 3. Disable Redirects, 4. DNS Rebinding Protection, 5. Cloud Metadata Protection, Alternate Representations, Attack Scenarios, AWS IMDSv2 (+19 more)

### Community 35 - "core.py"
Cohesion: 0.12
Nodes (14): _contains_phrase(), _domain_keywords(), _file_signature(), _get_bm25(), _load_csv(), _load_csv_snapshot(), _load_product_keywords(), _load_rows_or_empty() (+6 more)

### Community 36 - "TypeScript Config"
Cohesion: 0.10
Nodes (23): Slot, MatchOutcome, PASS_W, PlayerLine, PS, Str, SubsInfo, SubSuggestion (+15 more)

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
Nodes (25): devDependencies, fake-indexeddb@^6.0.0, playwright-core@^1.56.1, @types/node@^22.10.2, @types/react@^18.3.12, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.11 (+17 more)

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
Cohesion: 0.10
Nodes (11): ansi_ljust(), format_ascii_box(), add_wrapped(), wrap_text(), format_markdown(), generate_design_system(), hex_to_ansi(), _mode_support_labels() (+3 more)

### Community 46 - "Division Resolution Scripts"
Cohesion: 0.11
Nodes (16): createApp(), serveApi(), { DatabaseSync }, loadConfig(), makeLimiter(), MIME, now(), openDb() (+8 more)

### Community 47 - "awards.ts"
Cohesion: 0.18
Nodes (25): addAchievement(), awardName(), awardScorerStars(), bestBy(), bump(), candidateScore(), competitionAwards(), computeScorers() (+17 more)

### Community 48 - "Python Security Patterns"
Cohesion: 0.08
Nodes (24): Always Flag, Auto-Escaped (Do Not Flag), Check Context, Common Mistakes, Django, Django Security Settings, FastAPI, Flag These (+16 more)

### Community 49 - "Photo Fetch Scripts"
Cohesion: 0.08
Nodes (24): 1. Race Conditions, 2. Workflow Bypass, 3. Numeric Manipulation, 4. Price/Discount Manipulation, 5. Inventory/Resource Exhaustion, 6. Time-Based Attacks, 7. Parameter Tampering, Business Logic Security Reference (+16 more)

### Community 50 - "Membership Scripts"
Cohesion: 0.16
Nodes (21): aiTactics(), buildSide(), autoLineup(), familiarity(), FORMATION_NAMES, FORMATIONS, isAvailable(), LineupIssue (+13 more)

### Community 51 - "Alt Fetch Scripts"
Cohesion: 0.12
Nodes (23): AWARD_IDS, continental(), CUP(), cupTemplate(), defaultAwards(), defaultCompetitions(), defaultConfig(), defaultCountries() (+15 more)

### Community 52 - "Player QID Scripts"
Cohesion: 0.14
Nodes (4): BM25, _suggest_identities(), TestBm25CoreBehavior, TestTokenizer

### Community 53 - "Cross-Site Request Forgery (CSRF) Prevention Reference"
Cohesion: 0.09
Nodes (22): 1. GET Requests for State Changes, 1. Synchronizer Token Pattern, 2. CORS Misconfiguration, 2. Double Submit Cookie Pattern (Stateless), 3. SameSite Cookie Attribute, 3. Token in URL, 4. Custom Request Headers, Attack Scenario (+14 more)

### Community 54 - "test_core_data_quality.py"
Cohesion: 0.16
Nodes (10): read_rows(), TestAccessibilityGuidance, TestChartsTypographyAndIcons, TestCurrentReactGuidance, TestSemanticColors, _check_chart_contract(), _check_typography_contract(), _configured_font_names() (+2 more)

### Community 55 - "progression.ts"
Cohesion: 0.12
Nodes (21): markRecovering(), recovering(), ATTR_COUNT, ATTRS, ageGrowth(), ageOf(), decline(), distribute() (+13 more)

### Community 56 - "subs-stats.test.ts"
Cohesion: 0.18
Nodes (19): SideInput, DEFAULT_REG, defaultSubPlan(), newRule(), ROLE_DEMAND, ROLE_NAME, ruleProblems(), SUB_MODES (+11 more)

### Community 57 - "Known Levels Data"
Cohesion: 0.10
Nodes (12): need, arts, raw(), sleep(), map, todo, out, pairs (+4 more)

### Community 58 - "Service Worker"
Cohesion: 0.10
Nodes (20): Dangerous Characters, Injection Prevention Reference, Key Grep Patterns for Detection, Language-Specific Dangerous Functions, LDAP Injection, MongoDB Injection Patterns, NoSQL Injection, ORM Safety Considerations (+12 more)

### Community 59 - "Football Manager BR (nome provisório)"
Cohesion: 0.10
Nodes (19): 1. Netlify (tudo dentro da Netlify, sem servidor próprio), 2. Servidor Node próprio (Render, Railway, Fly.io, VPS, Docker), Como jogar, Como rodar, Contas e salvamentos, Dados reais: de onde vêm e o que é estimado, Editor do Universo e Criador de Craques, Estatísticas do elenco (+11 more)

### Community 60 - "api.mts"
Cohesion: 0.13
Nodes (17): cfg, config, core, env(), loadConfig(), dependencies, @netlify/blobs@^10.7.13, @netlify/functions@^4.3.0 (+9 more)

### Community 61 - "core.mjs"
Cohesion: 0.23
Nodes (17): checkPassword(), createCore(), currentUser(), handle(), issueToken(), mailVerification(), newSession(), fail() (+9 more)

### Community 62 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.11
Nodes (17): Before Delivering App UI, Example Workflow, If a search returns 0 results, Output Formats, Query Contract, Rule Categories by Priority, Running the search tool, Step 1: Analyze User Requirements (+9 more)

### Community 63 - "index.ts"
Cohesion: 0.24
Nodes (16): conflict(), freeFor(), isFlexible(), placeFixture(), relocate(), addTo(), build(), cache (+8 more)

### Community 64 - "kits.ts"
Cohesion: 0.24
Nodes (17): BRANDS, colorDistance(), contrastRatio(), defaultDesign(), defaultKitCollection(), fanPreference(), hexToRgb(), isNeutral() (+9 more)

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
Cohesion: 0.21
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

### Community 76 - "value.ts"
Cohesion: 0.21
Nodes (11): levelExact(), cache, TRAIT_MAP, TraitDef, TRAITS, ZERO, ageValueFactor(), baseValueForLevel() (+3 more)

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

### Community 86 - "Auditoria — Brassfeet / "Mandante""
Cohesion: 0.20
Nodes (9): 1. Resumo executivo, 2. Funções que faltam programar, 3. Pendências na tela do usuário, 4.2 Performance de interface — prioridade MÉDIA, 4.3 Visual / produto — prioridade BAIXA (polish), 4. Melhorias de experiência do jogador, 5. Segurança (passagem leve), 6. Plano sugerido (ordem de valor) (+1 more)

### Community 87 - "_normalize"
Cohesion: 0.22
Nodes (5): _exact_match_diagnostic(), _legacy_successor_guidance(), _normalize(), _stack_query_requests_legacy(), _stack_row_filter()

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

### Community 97 - "_row_identities"
Cohesion: 0.33
Nodes (3): _exact_row_identity(), _row_identities(), _style_identity()

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
- **83 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `React Best Practices` connect `React Best Practices` to `2. Bundle Size Optimization`, `5. Re-render Optimization`, `7. JavaScript Performance`, `4. Client-Side Data Fetching`, `6. Rendering Performance`, `3. Server-Side Performance`, `1. Eliminating Waterfalls`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Career Setup & Calendar` be split into smaller, more focused modules?**
  _Cohesion score 0.05213112327956194 - nodes in this community are weakly interconnected._
- **Why does `MatchSim` connect `MatchSim` to `Career Setup & Calendar`, `Save Migration & Validation`, `TypeScript Config`, `.outcome`, `Membership Scripts`, `.autoManage`, `Tactics`, `subs-stats.test.ts`, `Fixture Date Planning`, `Fixture Conflict Resolution`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Save Migration & Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.05318352059925094 - nodes in this community are weakly interconnected._
- **Why does `Avatar()` connect `Career Setup & Calendar` to `5. Re-render Optimization`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `Live Match Simulation` be split into smaller, more focused modules?**
  _Cohesion score 0.059720869847452125 - nodes in this community are weakly interconnected._
- **Should `Match Engine & Lineups` be split into smaller, more focused modules?**
  _Cohesion score 0.07541478129713423 - nodes in this community are weakly interconnected._