// Package calculator holds the arithmetic and its domain rules. It knows
// nothing about HTTP or JSON.
package calculator

import (
	"errors"
	"fmt"
	"math"
)

// Operation names an arithmetic operation.
type Operation string

const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage" // a percent of b: (a / 100) * b
)

var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrOperandCount     = errors.New("wrong number of operands")
	ErrDivisionByZero   = errors.New("division by zero")
	ErrNegativeSqrt     = errors.New("square root of a negative number")
	ErrOverflow         = errors.New("result exceeds the float64 range")
	ErrNonReal          = errors.New("result is not a real number")
)

type spec struct {
	arity int
	apply func(x []float64) (float64, error)
}

var operations = map[Operation]spec{
	Add:      {2, func(x []float64) (float64, error) { return x[0] + x[1], nil }},
	Subtract: {2, func(x []float64) (float64, error) { return x[0] - x[1], nil }},
	Multiply: {2, func(x []float64) (float64, error) { return x[0] * x[1], nil }},
	Divide: {2, func(x []float64) (float64, error) {
		if x[1] == 0 {
			return 0, ErrDivisionByZero
		}
		return x[0] / x[1], nil
	}},
	Power: {2, func(x []float64) (float64, error) {
		if x[0] == 0 && x[1] < 0 {
			return 0, ErrDivisionByZero
		}
		return math.Pow(x[0], x[1]), nil
	}},
	Sqrt: {1, func(x []float64) (float64, error) {
		if x[0] < 0 {
			return 0, ErrNegativeSqrt
		}
		return math.Sqrt(x[0]), nil
	}},
	Percentage: {2, func(x []float64) (float64, error) {
		// Multiplying first avoids premature underflow; scale first only
		// when the intermediate product would overflow.
		product := x[0] * x[1]
		if math.IsInf(product, 0) {
			return x[0] / 100 * x[1], nil
		}
		return product / 100, nil
	}},
}

// Calculate applies op to operands. Errors wrap one of the Err* values above.
func Calculate(op Operation, operands []float64) (float64, error) {
	s, ok := operations[op]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperation, op)
	}
	if len(operands) != s.arity {
		return 0, fmt.Errorf("%w: %s takes %d, got %d", ErrOperandCount, op, s.arity, len(operands))
	}
	result, err := s.apply(operands)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(result) {
		return 0, ErrNonReal
	}
	if math.IsInf(result, 0) {
		return 0, ErrOverflow
	}
	return result, nil
}
