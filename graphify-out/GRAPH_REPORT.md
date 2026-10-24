# Graph Report - Brassfeet  (2026-10-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1469 nodes · 5967 edges · 59 communities (56 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 121 edges (avg confidence: 0.85)
- Token cost: 45,222 input · 734 output

## Graph Freshness
- Built from commit: `8c0da951`
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
- Kits & Commerce
- Data Build Script
- App Shell & Navigation
- RNG & Season Events
- Nation Name Pools
- Awards Computation
- Wiki Article Scripts
- Lineup UI Components
- Youth & Fixture Helpers
- Daily Advance Loop
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
- Cup Draws & Fixtures
- Standings & Tables
- TypeScript Config
- Blob Storage Tests
- Account Client API
- E2E Test Runner
- Traits & Player Value
- Docker Compose Config
- Squad Assignment Scripts
- NPM Scripts
- Wiki Parsing Scripts
- Match Processing
- Division Resolution Scripts
- Market & Club Views
- Club Seed Data
- Photo Fetch Scripts
- Membership Scripts
- Alt Fetch Scripts
- Player QID Scripts
- Type Label Scripts
- Club Info Script
- Wiki Fetch Script
- Player Details Script
- Known Levels Data
- Service Worker

## God Nodes (most connected - your core abstractions)
1. `clamp()` - 101 edges
2. `ovrToLevel()` - 85 edges
3. `Panel()` - 79 edges
4. `useGame()` - 77 edges
5. `useCareer()` - 73 edges
6. `MatchSim` - 68 edges
7. `Rng` - 53 edges
8. `addNews()` - 52 edges
9. `Table()` - 52 edges
10. `Icon()` - 51 edges

## Surprising Connections (you probably didn't know these)
- `career()` --calls--> `newCareer()`  [EXTRACTED]
  tests/helpers.ts → src/engine/career/create.ts
- `plan()` --calls--> `defaultSubPlan()`  [EXTRACTED]
  tests/subs-stats.test.ts → src/engine/match/subs.ts
- `rule()` --calls--> `newRule()`  [EXTRACTED]
  tests/subs-stats.test.ts → src/engine/match/subs.ts
- `world()` --calls--> `buildDefaultWorld()`  [EXTRACTED]
  tests/helpers.ts → src/engine/universe/world.ts
- `makeCore()` --calls--> `createCore()`  [EXTRACTED]
  tests/blobs-store.test.ts → server/core.mjs

## Import Cycles
- None detected.

## Communities (59 total, 3 thin omitted)

### Community 0 - "Career Setup & Calendar"
Cohesion: 0.06
Nodes (83): setObjectives(), newCareer(), acceptJob(), seedUserStaff(), dayOf(), EPOCH, fmtDay(), inWindow() (+75 more)

### Community 1 - "Save Migration & Validation"
Cohesion: 0.06
Nodes (26): AdvanceResult, resetIndex(), pruneOldSeasons(), migrate(), validateCareerShape(), validateWorldShape(), b64(), check() (+18 more)

### Community 2 - "Live Match Simulation"
Cohesion: 0.09
Nodes (14): finishLiveMatch(), lastName(), MatchOutcome, MatchSim, pick(), simulateMatch(), defaultSubPlan(), CardEv (+6 more)

### Community 3 - "Match Engine & Lineups"
Cohesion: 0.07
Nodes (45): vitest, Slot, PlayerFilter, MatchInput, PASS_W, PlayerLine, PS, SideInput (+37 more)

### Community 4 - "UI Constants & Finances"
Cohesion: 0.10
Nodes (49): TIEBREAK_NAMES, setFinances(), universeStats(), fmtMoney(), ATTR_GROUPS, ATTRS, levelLabel(), POS_NAME (+41 more)

### Community 5 - "Transfers & Decisions"
Cohesion: 0.14
Nodes (43): resolveDecision(), endSeason(), post(), cancelProject(), weeklyKitSales(), closeSpell(), moveToClub(), removeFromClub() (+35 more)

### Community 6 - "Random Utils & Real Data"
Cohesion: 0.11
Nodes (34): clamp(), COMMONS_THUMB, REAL_COACHES, REAL_PHOTOS, REAL_SQUADS, RealPlayerRow, batchCreate(), createClub() (+26 more)

### Community 7 - "Player Stats & Rosters"
Cohesion: 0.11
Nodes (40): addMissed(), addStats(), MAX_SENIOR, MIN_SENIOR, addInto(), archivePlayer(), archiveSeason(), avgRating() (+32 more)

### Community 8 - "Player Attributes & Ratings"
Cohesion: 0.10
Nodes (40): invalidateRatings(), NAME_POOLS, updatePlayer(), A, ATTR_COUNT, attributeWarnings(), AttrKey, clampAttrs() (+32 more)

### Community 9 - "Shared UI Components"
Cohesion: 0.19
Nodes (37): compFixtures(), roundName(), weekdayName(), nationName(), Screen(), ClubName(), Empty(), PageHead() (+29 more)

### Community 10 - "Core Type Definitions"
Cohesion: 0.07
Nodes (39): NewCareerOptions, Day, MakePlayerOpts, Achievement, AchievementKind, AwardResult, BankLoan, CareerEntry (+31 more)

### Community 11 - "Kits & Commerce"
Cohesion: 0.14
Nodes (37): hashString(), canSpend(), currentCollection(), extraMarketing(), launchCollection(), previousDesigns(), restock(), setDiscount() (+29 more)

### Community 12 - "Data Build Script"
Cohesion: 0.07
Nodes (28): artqid, clubinfo, clubsOut, coachesOut, det, FIX_NAT, hex(), infoboxColors() (+20 more)

### Community 13 - "App Shell & Navigation"
Cohesion: 0.18
Nodes (27): react, jobOffers(), fmtLong(), App(), NAV, Shell(), Confirm(), Modal() (+19 more)

### Community 14 - "RNG & Season Events"
Cohesion: 0.14
Nodes (27): simulateVotes(), seniorRequests(), applyDiscipline(), applyInjuries(), clubAfterMatch(), beginSeason(), Rng, seedFrom() (+19 more)

### Community 15 - "Nation Name Pools"
Cohesion: 0.06
Nodes (33): AF_FIRST, AF_LAST, COL_LAST, DE_FIRST, DE_LAST, ECU_LAST, EE_FIRST, EE_LAST (+25 more)

### Community 16 - "Awards Computation"
Cohesion: 0.15
Nodes (28): addAchievement(), awardName(), awardScorerStars(), bestBy(), bump(), candidateScore(), competitionAwards(), computeScorers() (+20 more)

### Community 17 - "Wiki Article Scripts"
Cohesion: 0.14
Nodes (18): ids, out, r, L, out, ids, lab, r (+10 more)

### Community 18 - "Lineup UI Components"
Cohesion: 0.14
Nodes (25): starsOf(), availabilityNote(), validateLineup(), strengthSummary(), POS_SHORT, Col, Cond(), LevelPair() (+17 more)

### Community 19 - "Youth & Fixture Helpers"
Cohesion: 0.15
Nodes (25): pendingDecisions(), clubFixtures(), nextClubFixture(), fmtShort(), developmentStatus(), dismissCandidate(), promotionForecast(), setMentoring() (+17 more)

### Community 20 - "Daily Advance Loop"
Cohesion: 0.15
Nodes (26): ballonDay(), galaDay(), advanceDay(), AdvanceStatus, advanceToNextEvent(), compEventsNews(), dayLabel(), endOfDay() (+18 more)

### Community 21 - "Package Dev Dependencies"
Cohesion: 0.10
Nodes (24): devDependencies, fake-indexeddb@^6.0.0, playwright-core@^1.56.1, @types/node@^22.10.2, @types/react@^18.3.12, @types/react-dom@^18.3.1, typescript@^5.6.3, vite@^5.4.11 (+16 more)

### Community 22 - "Node HTTP Server"
Cohesion: 0.12
Nodes (16): createApp(), serveApi(), { DatabaseSync }, loadConfig(), makeLimiter(), MIME, now(), openDb() (+8 more)

### Community 23 - "Player Level Graphics"
Cohesion: 0.17
Nodes (24): awardsOfPlayer(), setFutureRole(), toggleListed(), playerLevel(), playerLevelLabel(), careerTotals(), levelColor(), Lvl() (+16 more)

### Community 24 - "Progression & Finances"
Cohesion: 0.11
Nodes (23): weeklyBoard(), weekly(), financialHealth(), weeklyWages(), ageGrowth(), ageOf(), decline(), distribute() (+15 more)

### Community 25 - "Competition Defaults"
Cohesion: 0.12
Nodes (23): AWARD_IDS, continental(), CUP(), cupTemplate(), defaultAwards(), defaultCompetitions(), defaultConfig(), defaultCountries() (+15 more)

### Community 26 - "Board & Season Setup"
Cohesion: 0.18
Nodes (20): FIRE_THRESHOLD, KO_PROGRESS, objectiveStatus(), seasonBoardReview(), findClashes(), buildSeason(), ORDER, compKey() (+12 more)

### Community 27 - "Universe Editor"
Cohesion: 0.20
Nodes (22): ClubPatch, deleteClub(), deletePlayer(), duplicatePlayer(), duplicateUniverse(), editorCreatePlayer(), editorMovePlayer(), exportUniverseText() (+14 more)

### Community 28 - "Fixture Date Planning"
Cohesion: 0.23
Nodes (20): ContinentalDates, continentalWeeks(), cupDates(), dayIsWeekend(), daysOfWeek(), domesticMidweeks(), leagueDates(), regionOf() (+12 more)

### Community 29 - "Lineup Logic"
Cohesion: 0.18
Nodes (19): autoLineup(), familiarity(), FORMATION_NAMES, FORMATIONS, isAvailable(), LineupIssue, ORDER, POS_IDX (+11 more)

### Community 30 - "Netlify API Config"
Cohesion: 0.12
Nodes (16): cfg, config, core, env(), loadConfig(), dependencies, @netlify/blobs@^10.7.13, @netlify/functions@^4.3.0 (+8 more)

### Community 31 - "Fixture Conflict Resolution"
Cohesion: 0.21
Nodes (18): conflict(), freeFor(), isFlexible(), placeFixture(), relocate(), addTo(), build(), cache (+10 more)

### Community 32 - "Auth Core Server"
Cohesion: 0.23
Nodes (17): checkPassword(), createCore(), currentUser(), handle(), issueToken(), mailVerification(), newSession(), fail() (+9 more)

### Community 33 - "Fetch Template Scripts"
Cohesion: 0.11
Nodes (9): need, map, todo, out, pairs, red, css, files (+1 more)

### Community 34 - "Cup Draws & Fixtures"
Cohesion: 0.21
Nodes (15): addFixture(), bySeed(), createTies(), drawGroups(), groupPairs(), groupTable(), isDerby(), levelOf() (+7 more)

### Community 35 - "Standings & Tables"
Cohesion: 0.21
Nodes (12): TieState, accumulate(), critValue(), emptyRow(), Points, roundRobin(), sortGroup(), standings() (+4 more)

### Community 36 - "TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noImplicitAny (+6 more)

### Community 37 - "Blob Storage Tests"
Cohesion: 0.21
Nodes (8): blobsStore(), OPS, retry(), sha(), withRetry(), fakeBlobs(), Mail, makeCore()

### Community 38 - "Account Client API"
Cohesion: 0.24
Nodes (12): Account, call(), changePassword(), deleteAccount(), forgot(), Health, login(), logout() (+4 more)

### Community 39 - "E2E Test Runner"
Cohesion: 0.27
Nodes (11): advanceToMatch(), clickNav(), errors, game(), lastLink(), main(), ok(), results (+3 more)

### Community 40 - "Traits & Player Value"
Cohesion: 0.21
Nodes (11): levelExact(), cache, TRAIT_MAP, TraitDef, TRAITS, ZERO, ageValueFactor(), baseValueForLevel() (+3 more)

### Community 41 - "Docker Compose Config"
Cohesion: 0.17
Nodes (11): BASE_URL, TRUST_PROXY, build, environment, ports, restart, volumes, services (+3 more)

### Community 42 - "Squad Assignment Scripts"
Cohesion: 0.17
Nodes (9): mem, ours, players, raw, res, sizes, squads, tl (+1 more)

### Community 43 - "NPM Scripts"
Cohesion: 0.18
Nodes (11): scripts, build, build:single, dev, e2e, preview, serve, start (+3 more)

### Community 44 - "Wiki Parsing Scripts"
Cohesion: 0.25
Nodes (10): headingsOf(), nameOf(), needTpl, nm(), out, parseParams(), report, res (+2 more)

### Community 45 - "Match Processing"
Cohesion: 0.31
Nodes (10): aiTactics(), applyOutcome(), buildSide(), createLiveMatch(), matchInput(), userMatchNews(), knockoutContext(), pitchFactor() (+2 more)

### Community 46 - "Division Resolution Scripts"
Cohesion: 0.24
Nodes (5): COUNTRY_QID, DIVS, all, out, p118

### Community 47 - "Market & Club Views"
Cohesion: 0.51
Nodes (8): playerMarketStatus(), Money, PName(), potRange(), ClubView(), Market(), Negotiation(), Tab

### Community 48 - "Club Seed Data"
Cohesion: 0.22
Nodes (7): ClubSeed, DIVISIONS, DivisionSeed, META, NAME_PATTERNS, PALETTE, STADIUM_PATTERNS

### Community 49 - "Photo Fetch Scripts"
Cohesion: 0.25
Nodes (5): det, files, lic, todo, vals

### Community 50 - "Membership Scripts"
Cohesion: 0.33
Nodes (5): clubIds, ids, raw, t2, todo

### Community 51 - "Alt Fetch Scripts"
Cohesion: 0.40
Nodes (3): arts, res, ws

### Community 53 - "Type Label Scripts"
Cohesion: 0.40
Nodes (4): cnt, lab, top, types

### Community 54 - "Club Info Script"
Cohesion: 0.50
Nodes (3): ids, out, r

### Community 55 - "Wiki Fetch Script"
Cohesion: 0.67
Nodes (3): arts, raw(), sleep()

### Community 56 - "Player Details Script"
Cohesion: 0.50
Nodes (3): ids, map, todo

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Match Engine & Lineups` to `Standings & Tables`, `Transfers & Decisions`, `Blob Storage Tests`, `Player Attributes & Ratings`, `Awards Computation`, `Package Dev Dependencies`, `Node HTTP Server`, `Universe Editor`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `Career Setup & Calendar` be split into smaller, more focused modules?**
  _Cohesion score 0.05539971949509116 - nodes in this community are weakly interconnected._
- **Why does `MatchSim` connect `Live Match Simulation` to `Match Engine & Lineups`, `Random Utils & Real Data`, `Match Processing`, `RNG & Season Events`, `Youth & Fixture Helpers`, `Daily Advance Loop`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Save Migration & Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.060350877192982454 - nodes in this community are weakly interconnected._
- **Why does `Rng` connect `RNG & Season Events` to `Career Setup & Calendar`, `Cup Draws & Fixtures`, `Standings & Tables`, `Live Match Simulation`, `Transfers & Decisions`, `Random Utils & Real Data`, `Match Engine & Lineups`, `Player Attributes & Ratings`, `Match Processing`, `Division Resolution Scripts`, `Awards Computation`, `Daily Advance Loop`, `Progression & Finances`, `Board & Season Setup`, `Universe Editor`, `Fixture Date Planning`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Live Match Simulation` be split into smaller, more focused modules?**
  _Cohesion score 0.08857808857808858 - nodes in this community are weakly interconnected._
- **Should `Match Engine & Lineups` be split into smaller, more focused modules?**
  _Cohesion score 0.0707070707070707 - nodes in this community are weakly interconnected._