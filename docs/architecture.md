# Architecture

```mermaid
graph TD
    subgraph Client Layer ["React + Vite + Ant Design"]
        UI[Ant Design UI / Tailwind / Icons]
        Voice[Voice Assistant Web Speech API]
        AIChat[AI Copilot Widget]
        State[TanStack Query + Auth Context]
    end

    subgraph Server Layer ["Express Modular Monolith"]
        MW[Helmet / JWT / RBAC / Rate limit]
        AuthCtrl[Auth]
        CircCtrl[Circulation transactions]
        BookCtrl[Catalog]
        FineCtrl[Fines]
        AICtrl[AI Orchestrator]
        subgraph AIService ["AI Engine"]
            AIProvider[OpenAI / Gemini / Anthropic / Mock]
            ToolSandbox[Allowlisted tools]
            NLQuery[Template NL analytics]
        end
    end

    subgraph Database ["MongoDB"]
        DB_User[(Users)]
        DB_Book[(Books + Copies)]
        DB_Circ[(Circulation)]
        DB_Fine[(Fines)]
        DB_Res[(Reservations)]
    end

    UI --> State --> MW
    Voice --> AIChat --> AICtrl --> AIProvider --> ToolSandbox
    ToolSandbox --> DB_Book
    CircCtrl --> DB_Circ
    CircCtrl --> DB_Book
    FineCtrl --> DB_Fine
```

## Circulation transaction

`issue`, `return`, and `renew` run inside `mongoose.startSession()`:

1. Validate member status, borrow cap, unpaid-fine threshold.
2. Mutate copy status (`AVAILABLE` → `ISSUED` / `RESERVED`).
3. On return, compute deterministic fines (grace + daily rate + cap).
4. If a FIFO reservation exists, hold the copy 48h and notify the next member.

## JWT

- Access token: 15 minutes (Authorization Bearer)
- Refresh token: HTTP-only cookie, 7 days, rotated on every `/auth/refresh`
