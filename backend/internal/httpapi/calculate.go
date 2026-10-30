package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/aydogdu/calculator/backend/internal/calculator"
)

const maxBodyBytes = 1 << 20
const bodyLimitMessage = "Request body exceeds the 1 MiB limit."

type calculateRequest struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []*float64           `json:"operands"`
}

type calculateResponse struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []float64            `json:"operands"`
	Result    float64              `json:"result"`
}

func handleCalculate() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > maxBodyBytes {
			writeError(w, http.StatusBadRequest, "invalid_json", bodyLimitMessage)
			return
		}
		var req *calculateRequest
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil || req == nil {
			writeDecodeError(w, err,
				`request body must be a JSON object like {"operation":"add","operands":[1,2]}`)
			return
		}

		if err := dec.Decode(new(any)); err != io.EOF {
			writeDecodeError(w, err, "request body must contain exactly one JSON object")
			return
		}
		operands := make([]float64, len(req.Operands))
		for i, operand := range req.Operands {
			if operand == nil {
				writeError(w, http.StatusBadRequest, "invalid_json", "operands must be JSON numbers")
				return
			}
			operands[i] = *operand
		}
		result, err := calculator.Calculate(req.Operation, operands)
		if err != nil {
			status, code := classify(err)
			message := err.Error()
			if errors.Is(err, calculator.ErrNonReal) {
				message = "This calculation has no real-number result."
			} else if errors.Is(err, calculator.ErrNonFinite) {
				message = "That result is too large to show."
			}
			writeError(w, status, code, message)
			return
		}
		writeJSON(w, http.StatusOK, calculateResponse{Operation: req.Operation, Operands: operands, Result: result})
	})
}

// classify maps domain errors to an HTTP status and a stable machine-readable code.
func classify(err error) (int, string) {
	switch {
	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusBadRequest, "unknown_operation"
	case errors.Is(err, calculator.ErrOperandCount):
		return http.StatusBadRequest, "invalid_operands"
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, "division_by_zero"
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return http.StatusUnprocessableEntity, "negative_sqrt"
	case errors.Is(err, calculator.ErrNonFinite):
		return http.StatusUnprocessableEntity, "result_out_of_range"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}

func writeDecodeError(w http.ResponseWriter, err error, fallback string) {
	var limit *http.MaxBytesError
	if errors.As(err, &limit) {
		writeError(w, http.StatusBadRequest, "invalid_json", bodyLimitMessage)
		return
	}
	writeError(w, http.StatusBadRequest, "invalid_json", fallback)
}
