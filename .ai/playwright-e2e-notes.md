# Playwright E2E — spostrzeżenia

- Global setup/teardown działają lokalnie, ale w środowisku sandbox CLI nie mogłem uruchomić `npx tsx tests/e2e/scripts/list-generations.ts`, bo TSX próbuje otworzyć pipe IPC i dostaje `listen EPERM .../tsx-*.pipe`. Lokalnie (poza sandboxem) komenda działa poprawnie.
- Alternatywne próby (`ts-node`, `node --loader ts-node/esm`) kończyły się błędami ESM/loaderów, więc w repo zostawiłem rekomendację, aby skrypt uruchamiać na własnej maszynie po testach.
- Aby ułatwić kontrolę, skrypt ładuje `.env.test` i zwraca kod wyjścia 1, jeśli znajdzie cokolwiek w `public.vton_generations` dla użytkownika E2E — można go zintegrować z CI po Playwright.
