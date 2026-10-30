package calculator

import (
	"errors"
	"math"
)

var ErrInvalidExpression = errors.New("invalid expression")

// Evaluate applies powers first (right associative), then multiplication,
// division and percent-of, then addition and subtraction (left associative).
// Structured operands/operators avoid interpreting arbitrary expression text.
func Evaluate(operands []float64, operators []Operation) (float64, error) {
	if len(operands) == 0 || len(operands) > 128 || len(operators) != len(operands)-1 {
		return 0, ErrInvalidExpression
	}
	for _, value := range operands {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return 0, ErrInvalidExpression
		}
	}
	for _, op := range operators {
		if precedence(op) == 0 {
			return 0, ErrInvalidExpression
		}
	}
	values := []float64{operands[0]}
	ops := []Operation{}
	reduce := func() error {
		last := len(values) - 1
		result, err := Calculate(ops[len(ops)-1], []float64{values[last-1], values[last]})
		if err != nil {
			return err
		}
		values = append(values[:last-1], result)
		ops = ops[:len(ops)-1]
		return nil
	}
	for i, op := range operators {
		for len(ops) > 0 && (precedence(ops[len(ops)-1]) > precedence(op) || (precedence(ops[len(ops)-1]) == precedence(op) && op != Power)) {
			if err := reduce(); err != nil {
				return 0, err
			}
		}
		ops = append(ops, op)
		values = append(values, operands[i+1])
	}
	for len(ops) > 0 {
		if err := reduce(); err != nil {
			return 0, err
		}
	}
	return values[0], nil
}

func precedence(op Operation) int {
	switch op {
	case Add, Subtract:
		return 1
	case Multiply, Divide, Percentage:
		return 2
	case Power:
		return 3
	default:
		return 0
	}
}
