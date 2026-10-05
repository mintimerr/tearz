# @tearz/assessment

Shared psychometric Assessment Engine for Tearz placement.

- **Single source of truth** for client and server (import this package; do not duplicate).
- LLM must never set CEFR / theta / posterior.
- CEFR band edges are **`cefrBandCalibrationStatus: 'provisional'`** — operational mapping only; recalibrate on external CEFR-labelled data later.

## Scripts

```bash
cd shared/assessment
npm install
npm test
npm run typecheck
npm run audit   # model-recovery diagnostics (synthetic only)
npm run audit:orchestrator  # adaptive orchestrator sequences + MC
```

## Public API

See `src/index.ts`: `createAssessmentState`, `applyAnswer`, `finalize`, `createItemFromSpec`, `rankItemsForTheta`, …

Content pipeline (not wired to placement UI):

- `items` — ItemSpecification, GeneratedItem, deterministic/semantic/adversarial quality gate, lifecycle, scoring eligibility
- `languages` — English CEFR operational map + construct registry (`zh`/`fr` stubs)
