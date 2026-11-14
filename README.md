# Onyx Chess

A premium chess game for Android (and iOS/web) built with Expo + React Native. You can play a real Stockfish engine at 10 calibrated levels, switch between 3D and classic 2D boards, solve engine-verified puzzles, take guided lessons, and level up through real progression. Everything runs offline.

## Run it on your Android phone (fastest)

1. Install Node.js 22.13+ (or 24.3+) on your computer.
2. In this folder:
   ```bash
   npm install
   npx expo start
   ```
3. Press **a** with your phone connected by USB, or scan the QR code with **Expo Go** (SDK 58). Your phone and computer must be on the same Wi-Fi network.

## Get the APK

Every push to `main` builds an installable APK with GitHub Actions (`.github/workflows/android-apk.yml`) and attaches it to a new release. Open the repository's **Releases** page on your phone and tap the `.apk` file.

## Build an APK with Expo instead

```bash
npx eas-cli@latest login        # free Expo account
npx eas-cli@latest build -p android --profile preview
```
EAS builds the APK in the cloud and gives you a download link, so you don't need Android Studio. Use `--profile production` for a Play Store `.aab`.

## What's inside

| Area | Implementation |
|---|---|
| Rules | `chess.js` wrapped by `src/chess/ChessGame.ts`: the only thing that decides whether a move is legal. It covers castling, en passant, promotion, check, mate, stalemate, threefold repetition, the 50-move rule, insufficient material, and timeout against insufficient material. |
| Engine | Stockfish 19 (lite NNUE, WASM) embedded in the app and run in two Web Workers inside a hidden WebView (`src/engine/EngineHost.tsx`). Worker **play** makes the AI moves; worker **analysis** (always full strength) handles hints, coaching and reviews. A crashed worker is recreated automatically. |
| AI levels | `src/engine/levels.ts`. Levels 1–3 pick among Stockfish's top candidate moves using a temperature, so their mistakes look human (they never play random moves). Levels 4–9 use Stockfish's `UCI_LimitStrength`/`UCI_Elo`. Level 10 is full strength. Every engine move is re-validated by the rules library before it is played. |
| Coaching | `src/engine/explain.ts` turns engine evaluations into plain-language explanations: forks, pins, skewers, hanging pieces, mate threats, material won, and better alternatives. |
| 3D | React Three Fiber on `expo-gl`. Pieces are revolved from original designs, and board textures (wood, marble, stone, lacquer) are generated in code. The scene only renders while something animates (`frameloop="demand"`), which saves battery. Quality settings: Battery saver / Balanced / High. If the device can't run 3D, the app falls back to 2D automatically. |
| 2D | SVG pieces drawn from the same designs as the 3D set, with tap or drag to move and animated moves. |
| Progression | `src/progression/` covers XP, levels, unlocks, 26 achievements, daily and weekly missions, streaks, ranked Elo and puzzle rating. It is a pure reducer and is unit-tested. |
| Content | 18 lessons and 15 challenges, all checked by Stockfish (`npx tsx scripts/validate-content.ts`). The puzzles come from engine games, and each one has a single verified winning solution (`scripts/generate-puzzles.ts`). |
| Storage | Zustand + AsyncStorage, with one adapter (`src/data/storage.ts`). Each store is versioned, so cloud sync or accounts can be added later without restructuring. |
| Sound | Original sound effects and an ambient music loop, all synthesised by `scripts/generate-sounds.py`. |

## Scripts

```bash
npm test                                   # unit + engine integration tests
npx tsc --noEmit                           # type check
npx tsx scripts/validate-content.ts        # verify lessons/challenges with Stockfish
npx tsx scripts/generate-puzzles.ts 100 out.json 7   # generate more puzzles
npx tsx scripts/merge-puzzles.ts a.json b.json       # validate + install puzzles
npx tsx scripts/calibrate.ts               # AI level-vs-level matches
node scripts/build-engine-assets.js        # re-embed Stockfish after upgrading it
```

## Project layout

```
src/app/          screens (expo-router)
src/chess/        rules wrapper, piece tracking for animations
src/engine/       Stockfish host, UCI, AI levels, analysis, explanations
src/board/        shared board contract, themes, piece designs
src/render2d/     2D board      src/render3d/  3D board
src/features/     game session, launching, history
src/progression/  XP / achievements / missions / rating (pure logic)
src/content/      lessons, challenges, puzzles
src/data/         persisted stores
src/ui/           design system
```

## Licences

Stockfish is GPLv3 (https://stockfishchess.org). If you publish this app with Stockfish included, you must make the app's source code available under GPLv3-compatible terms. chess.js is BSD-2. All piece designs, textures, sounds and music were created for this project.
