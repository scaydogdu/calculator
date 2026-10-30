# AI assistance and development record

AI assistance was used for planning, implementation, test design and review. Codex implemented changes; Claude performed earlier QA reviews. The code and tests are AI-assisted work, not a claim of entirely manual development or completion within the original 2–4 hour time box.

The brief requested React and a Go REST API, prioritizing correctness and readable, testable code. Addition, subtraction, multiplication and division were required; power, square root, percentage and Docker were optional extensions.

Selected requests included:

> first step is to check github repositories for best practices and then come up with a plan.

> let's improve it to react query it will be better.

Later review identified misleading rounding of large results, excessive request-flow complexity and offline requests waiting without a deadline. The corrective pass preserves scientific notation, removes Query/caching, consolidates request handling, separates domain error codes and makes immediate evaluation visible. Tests cover those behaviors through the API and UI.

The earlier implementation plans, progress log, detailed QA reports and screenshots remain accessible in [the Git record before this cleanup](https://github.com/scaydogdu/calculator/tree/2c2bf2a53d4c5b981dbec15b3a9b0ffd7aa88451/docs). They were removed from the current tree to keep the submission focused; AI assistance remains disclosed here.

Earlier commit IDs changed during development. This correction pass uses ordinary follow-up commits and does not rewrite existing history or timestamps. The elapsed project timeline should not be presented as a 2–4 hour implementation.
