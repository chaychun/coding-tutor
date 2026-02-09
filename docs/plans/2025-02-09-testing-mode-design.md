# Testing Mode Toggle — Design

## Summary

A dev-only toggle in the chatbox that switches the AI from tutor mode to testing mode. When enabled, the AI drops the teaching persona, becomes direct and technical, echoes raw inputs for debugging, and generates tool calls on demand without pedagogical gating.

## UI

- Toggle switch in `PromptInputActions` bar, left side
- Gated by `NODE_ENV === "development"` (automatic in dev, no env file needed)
- State owned by `SessionPage` — session-scoped, not per-message, not persisted
- Visual indicator when active (accent-colored label)

## Data Flow

1. `SessionPage` owns `testingMode` state (`useState(false)`)
2. `Chat` receives `testingMode` + `onTestingModeChange`, passes to `MessageInput`
3. `SessionPage.handleSendMessage` always passes current `testingMode` to `useChat.sendMessage`
4. `sendMessage` includes `testingMode` in fetch body to `/api/chat`
5. API route passes `testingMode` to `getTutorSystemPrompt()`

## System Prompt Strategy

When `testingMode` is true, the prompt is **wrapped** — a testing preamble goes BEFORE the tutor prompt with explicit override language:

- Preamble position ensures LLM weights it heavily
- "Override everything below" language
- Directives: be direct, keep responses short, explain tool calls, echo raw inputs, generate tools on demand, flag broken data
- Original tutor prompt kept below for tool/capability reference

## Debug Echo for Interactive Actions

When `testingMode` is true and the action is `submit`, `hint`, or `concept_answer`, the API route prepends a debug block to the prompt text showing the raw action type and input data. This ensures the AI sees and can comment on the exact data it received.

## Files Changed

1. `src/lib/agent/systemPrompt.ts` — add `testingMode` param, wrap prompt with preamble
2. `src/app/api/chat/route.ts` — add `testingMode` to request interface, pass to system prompt, prepend debug echo
3. `src/hooks/useChat.ts` — add `testingMode` param to `sendMessage`
4. `src/app/projects/[projectId]/sessions/[sessionId]/page.tsx` — own `testingMode` state, pass through
5. `src/components/Chat/Chat.tsx` — accept and pass `testingMode` + `onTestingModeChange`
6. `src/components/Chat/MessageInput.tsx` — render toggle switch, gated by env var
