# Rule: Interactive Questioning & Grilling Trade-Off Standards

When interviewing the user, clarifying requirements, resolving design decisions, or using `/grill-me` with the `ask_question` tool:

1. **Never Present Naked Options**:
   - Every multiple-choice question must provide the architectural context and problem statement in the question description.
   - For every option (including non-recommended ones), outline its key pros, cons, and trade-offs (e.g. latency, complexity, scalability, maintenance overhead, developer experience).

2. **Justify Recommendations**:
   - If an option has the `(Recommended)` prefix, explain the specific rationale for why it was recommended for this project/codebase rather than relying on the tag alone.

3. **Descriptive Option Labels**:
   - In the `options` array, include a concise 1-line tradeoff/benefit summary alongside the option name so the difference between options is immediately clear in the selection UI.
