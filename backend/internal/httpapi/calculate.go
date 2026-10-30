package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/scaydogdu/calculator/backend/internal/calculator"
)

const maxBodyBytes = 1 << 20
const bodyLimitMessage = "Request body exceeds the 1 MiB limit."

type calculateRequest struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []*float64           `json:"operands"`
}

type expressionRequest struct {
	Operands  []*float64             `json:"operands"`
	Operators []calculator.Operation `json:"operators"`
}

type calculateResponse struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []float64            `json:"operands"`
	Result    float64              `json:"result"`
}

func handleCalculate() http.Handler { return handleCalculation(false) }

func handleEvaluate() http.Handler { return handleCalculation(true) }

func handleCalculation(expression bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Reject known oversize bodies before decoding. MaxBytesReader also
		// enforces the limit when the client does not provide a length.
		if r.ContentLength > maxBodyBytes {
			writeError(w, http.StatusRequestEntityTooLarge, "request_too_large", bodyLimitMessage)
			return
		}
		var req *calculateRequest
		var expr *expressionRequest
		var target any = &req
		if expression {
			target = &expr
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(target); err != nil || (expression && expr == nil) || (!expression && req == nil) {
			writeDecodeError(w, err,
				"Request body must be a valid calculation JSON object.")
			return
		}

		if err := dec.Decode(new(any)); err != io.EOF {
			writeDecodeError(w, err, "Request body must contain exactly one JSON object.")
			return
		}
		numbers := []*float64(nil)
		if expression {
			numbers = expr.Operands
		} else {
			numbers = req.Operands
		}
		operands := make([]float64, len(numbers))
		for i, operand := range numbers {
			if operand == nil {
				writeError(w, http.StatusBadRequest, "invalid_json", "Operands must be JSON numbers.")
				return
			}
			operands[i] = *operand
		}
		var result float64
		var err error
		if expression && expr.Operators == nil {
			err = calculator.ErrInvalidExpression
		} else if expression {
			result, err = calculator.Evaluate(operands, expr.Operators)
		} else {
			result, err = calculator.Calculate(req.Operation, operands)
		}
		if err != nil {
			status, code, message := classify(err)
			writeError(w, status, code, message)
			return
		}
		if expression {
			writeJSON(w, http.StatusOK, map[string]float64{"result": result})
		} else {
			writeJSON(w, http.StatusOK, calculateResponse{Operation: req.Operation, Operands: operands, Result: result})
		}
	})
}

// classify maps domain errors to an HTTP status and a stable machine-readable code.
func classify(err error) (int, string, string) {
	switch {
	case errors.Is(err, calculator.ErrInvalidExpression):
		return http.StatusBadRequest, "invalid_expression", "Expression requires 1 to 128 finite operands and one binary operator between each pair."
	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusBadRequest, "unknown_operation", "Unknown operation. Expected add, subtract, multiply, divide, power, sqrt or percentage."
	case errors.Is(err, calculator.ErrOperandCount):
		return http.StatusBadRequest, "invalid_operands", "Incorrect number of operands for the operation."
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, "division_by_zero", "Division by zero is undefined."
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return http.StatusUnprocessableEntity, "negative_sqrt", "Square root requires a non-negative operand."
	case errors.Is(err, calculator.ErrNonReal):
		return http.StatusUnprocessableEntity, "non_real_result", "The result is not a real number."
	case errors.Is(err, calculator.ErrOverflow):
		return http.StatusUnprocessableEntity, "result_overflow", "The result exceeds the float64 range."
	default:
		return http.StatusInternalServerError, "internal_error", "An internal error occurred."
	}
}

func writeDecodeError(w http.ResponseWriter, err error, fallback string) {
	var limit *http.MaxBytesError
	if errors.As(err, &limit) {
		writeError(w, http.StatusRequestEntityTooLarge, "request_too_large", bodyLimitMessage)
		return
	}
	const prefix = "json: unknown field "
	if err != nil && strings.HasPrefix(err.Error(), prefix) {
		field := strings.TrimPrefix(err.Error(), prefix)
		if len(field) > 80 {
			field = field[:80] + "..."
		}
		writeError(w, http.StatusBadRequest, "unknown_field", "Unknown field "+field+".")
		return
	}
	writeError(w, http.StatusBadRequest, "invalid_json", fallback)
}
