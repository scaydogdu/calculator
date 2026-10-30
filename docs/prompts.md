# AI assistance and selected prompts

AI tools assisted with planning, implementation, test design and review. Codex was used to generate and revise code and tests; Claude was used for earlier reviews.

Selected excerpts from user requests and review feedback:

> Fix: switch to exponent notation (-1.76366841446e13) whenever rounding drops digits from the whole-number part.

Large rounded results now use scientific notation. The unrounded backend value is retained for subsequent calculations.

> Two small handlers sharing a `decodeOperands` helper would read better.

The calculation and expression endpoints have separate handlers with shared request-decoding and operand-validation helpers.

> Show queued input as it’s typed, or dim the keys again while a request runs. Say so when an error discards queued input.

Keys dim during requests while further input is buffered. Errors and timeouts explicitly report when queued input was discarded.

Setup, API behavior and design decisions are documented in the [README](../README.md). The [coverage summary](coverage.md) records test measurements and reproduction commands; the [API specification](openapi.yaml) describes the HTTP contract.
