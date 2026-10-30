package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExpressionEndpoint(t *testing.T) {
	for _, test := range []struct {
		body   string
		status int
		result float64
		code   string
	}{
		{`{"operands":[2,3,4],"operators":["add","multiply"]}`, 200, 14, ""},
		{`{"operands":[2,3,2],"operators":["power","power"]}`, 200, 512, ""},
		{`{"operands":[8,2,3],"operators":["divide","add"]}`, 200, 7, ""},
		{`{"operands":[1],"operators":[]}`, 200, 1, ""},
		{`{"operands":[1]}`, 400, 0, "invalid_expression"},
		{`{"operands":[1],"operators":null}`, 400, 0, "invalid_expression"},
		{`{"operands":[2,3],"operators":[]}`, 400, 0, "invalid_expression"},
		{`{"operands":[2,3],"operators":["sqrt"]}`, 400, 0, "invalid_expression"},
		{`{"operands":[2,3],"operators":[null]}`, 400, 0, "invalid_expression"},
		{`{"operands":[null],"operators":[]}`, 400, 0, "invalid_json"},
		{`{"operands":[2],"operators":[],"extra":1}`, 400, 0, "unknown_field"},
		{`{"operation":"add","operands":[2,3]}`, 400, 0, "unknown_field"},
		{`null`, 400, 0, "invalid_json"},
		{`{}{} `, 400, 0, "invalid_json"},
		{`{"operands":[2,3,0],"operators":["add","divide"]}`, 422, 0, "division_by_zero"},
		{`{"operands":[-8,0.5],"operators":["power"]}`, 422, 0, "non_real_result"},
		{`{"operands":[1e308,10],"operators":["multiply"]}`, 422, 0, "result_overflow"},
	} {
		rec := httptest.NewRecorder()
		newTestServer().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/evaluate", strings.NewReader(test.body)))
		if rec.Code != test.status {
			t.Fatalf("%s: got %d %s", test.body, rec.Code, rec.Body)
		}
		if test.status == 200 {
			var body struct {
				Result float64 `json:"result"`
			}
			decode(t, rec, &body)
			if body.Result != test.result {
				t.Errorf("got %v want %v", body.Result, test.result)
			}
		} else {
			var body errorResponse
			decode(t, rec, &body)
			if body.Error.Code != test.code {
				t.Errorf("got %s want %s", body.Error.Code, test.code)
			}
		}
	}
	rec := httptest.NewRecorder()
	newTestServer().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/evaluate", nil))
	if rec.Code != 405 || rec.Header().Get("Allow") != "POST" {
		t.Fatalf("method response: %d %v", rec.Code, rec.Header())
	}
}
