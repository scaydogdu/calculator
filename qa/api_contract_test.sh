#!/usr/bin/env bash
# Black-box contract test for the calculator API. It is independent of the
# implementation and only speaks HTTP.
#
# Usage: qa/api_contract_test.sh [base_url]   (default http://localhost:8080)
# Requires: curl, jq
set -uo pipefail

BASE="${1:-http://localhost:8080}"
CALC="$BASE/api/v1/calculate"
pass=0
fail=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

# check NAME METHOD URL BODY WANT_STATUS JQ_ASSERTION
# JQ_ASSERTION is a jq expression that must evaluate to true on the response body.
check() {
  local name=$1 method=$2 url=$3 body=$4 want=$5 assertion=$6
  local tmp headers status
  tmp=$(mktemp)
  headers=$(mktemp)
  if [[ -n $body ]]; then
    status=$(curl -s -o "$tmp" -D "$headers" -w '%{http_code}' -X "$method" "$url" \
      -H 'Content-Type: application/json' --data-binary "$body")
  else
    status=$(curl -s -o "$tmp" -D "$headers" -w '%{http_code}' -X "$method" "$url")
  fi

  local problems=()
  [[ $status == "$want" ]] || problems+=("status $status, want $want")
  grep -qi '^content-type: application/json' "$headers" || problems+=("Content-Type is not application/json")
  if ! jq -e "$assertion" "$tmp" >/dev/null 2>&1; then
    problems+=("assertion failed: $assertion")
  fi
  # Every non-2xx response must use the error envelope.
  if [[ $status != 2* ]] && ! jq -e '(.error.code|type=="string") and (.error.message|type=="string" and length>0)' "$tmp" >/dev/null 2>&1; then
    problems+=("missing {error:{code,message}} envelope")
  fi

  if ((${#problems[@]} == 0)); then
    green "PASS  $name"
    pass=$((pass + 1))
  else
    red "FAIL  $name"
    for p in "${problems[@]}"; do echo "        - $p"; done
    echo "        body: $(head -c 300 "$tmp")"
    fail=$((fail + 1))
  fi
  rm -f "$tmp" "$headers"
}

ok() { check "$1" POST "$CALC" "$2" 200 "$3"; }
err() { check "$1" POST "$CALC" "$2" "$3" ".error.code == \"$4\""; }

echo "Calculator API contract test against $BASE"
echo

echo "## Health"
check "healthz" GET "$BASE/healthz" "" 200 '.status == "ok"'

echo "## Happy path"
ok "add" '{"operation":"add","operands":[2,3]}' '.result == 5 and .operation == "add" and .operands == [2,3]'
ok "add negatives" '{"operation":"add","operands":[-2,-3.5]}' '.result == -5.5'
ok "add floats (raw float64)" '{"operation":"add","operands":[0.1,0.2]}' '.result > 0.3 and .result < 0.3000001'
ok "subtract" '{"operation":"subtract","operands":[10,4]}' '.result == 6'
ok "multiply" '{"operation":"multiply","operands":[6,7]}' '.result == 42'
ok "multiply by zero" '{"operation":"multiply","operands":[6,0]}' '.result == 0'
ok "divide" '{"operation":"divide","operands":[7,2]}' '.result == 3.5'
ok "power" '{"operation":"power","operands":[2,10]}' '.result == 1024'
ok "power negative exponent" '{"operation":"power","operands":[2,-1]}' '.result == 0.5'
ok "sqrt" '{"operation":"sqrt","operands":[144]}' '.result == 12 and .operands == [144]'
ok "sqrt zero" '{"operation":"sqrt","operands":[0]}' '.result == 0'
ok "percentage (a% of b)" '{"operation":"percentage","operands":[15,200]}' '.result == 30'
ok "scientific notation input" '{"operation":"multiply","operands":[1e3,2]}' '.result == 2000'
ok "whitespace around body" '  {"operation":"add","operands":[1,1]}  ' '.result == 2'

echo "## Math errors (422)"
err "divide by zero" '{"operation":"divide","operands":[1,0]}' 422 division_by_zero
err "zero divided by zero" '{"operation":"divide","operands":[0,0]}' 422 division_by_zero
err "sqrt negative" '{"operation":"sqrt","operands":[-4]}' 422 negative_sqrt
err "overflow multiply" '{"operation":"multiply","operands":[1e308,10]}' 422 result_out_of_range
err "overflow power" '{"operation":"power","operands":[2,1024]}' 422 result_out_of_range
err "NaN power" '{"operation":"power","operands":[-8,0.5]}' 422 result_out_of_range

echo "## Request errors (400)"
err "unknown operation" '{"operation":"modulo","operands":[1,2]}' 400 unknown_operation
err "missing operation" '{"operands":[1,2]}' 400 unknown_operation
err "wrong arity (binary)" '{"operation":"add","operands":[1]}' 400 invalid_operands
err "wrong arity (unary)" '{"operation":"sqrt","operands":[1,2]}' 400 invalid_operands
err "missing operands" '{"operation":"add"}' 400 invalid_operands
err "null operands" '{"operation":"add","operands":null}' 400 invalid_operands
err "malformed json" '{"operation":' 400 invalid_json
err "string operand" '{"operation":"add","operands":["1",2]}' 400 invalid_json
err "null operand element" '{"operation":"add","operands":[null,2]}' 400 invalid_json
err "number beyond float64" '{"operation":"add","operands":[1e400,2]}' 400 invalid_json
err "unknown field" '{"operation":"add","operands":[1,2],"extra":true}' 400 invalid_json
err "trailing data" '{"operation":"add","operands":[1,2]}{}' 400 invalid_json
err "array body" '[1,2]' 400 invalid_json
err "operation wrong type" '{"operation":1,"operands":[1,2]}' 400 invalid_json
check "empty body" POST "$CALC" "" 400 '.error.code == "invalid_json"'

big=$(mktemp)
python3 -c 'import sys; sys.stdout.write("{\"operation\":\"add\",\"operands\":[" + ",".join(["1"]*600000) + "]}")' >"$big"
check "body over 1 MiB" POST "$CALC" "@$big" 400 '.error.code == "invalid_json"'
rm -f "$big"

echo "## Routing"
check "GET calculate -> 405" GET "$CALC" "" 405 '.error.code == "method_not_allowed"'
allow=$(curl -s -o /dev/null -D - -X GET "$CALC" | tr -d '\r' | awk -F': ' 'tolower($1)=="allow"{print $2}')
if [[ $allow == "POST" ]]; then green "PASS  405 has Allow: POST"; pass=$((pass + 1)); else red "FAIL  405 Allow header = '$allow'"; fail=$((fail + 1)); fi
check "unknown api route -> 404" GET "$BASE/api/v1/nope" "" 404 '.error.code == "not_found"'

echo
echo "Passed: $pass  Failed: $fail"
((fail == 0))
