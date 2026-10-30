package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestEvaluatePrecedence(t *testing.T) {
	for _, test := range []struct {
		name   string
		values []float64
		ops    []Operation
		want   float64
	}{
		{"multiply before addition", []float64{2, 3, 4}, []Operation{Add, Multiply}, 14},
		{"division before addition", []float64{8, 2, 3}, []Operation{Divide, Add}, 7},
		{"power before multiplication", []float64{2, 3, 2}, []Operation{Multiply, Power}, 18},
		{"right associative powers", []float64{2, 3, 2}, []Operation{Power, Power}, 512},
		{"left associative division", []float64{100, 10, 2}, []Operation{Divide, Divide}, 5},
		{"left associative subtraction", []float64{10, 3, 2}, []Operation{Subtract, Subtract}, 5},
		{"mixed precedence", []float64{2, 3, 4, 2, 8, 2}, []Operation{Add, Multiply, Power, Subtract, Divide}, 46},
		{"signed operand", []float64{-2, 2, 3}, []Operation{Power, Add}, 7},
		{"percentage has multiplication precedence", []float64{1, 15, 200}, []Operation{Add, Percentage}, 31},
		{"single value", []float64{42}, nil, 42},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := Evaluate(test.values, test.ops)
			if err != nil || got != test.want {
				t.Fatalf("got %v, %v; want %v", got, err, test.want)
			}
		})
	}
}

func TestEvaluateErrors(t *testing.T) {
	for _, test := range []struct {
		values []float64
		ops    []Operation
		want   error
	}{
		{nil, nil, ErrInvalidExpression},
		{[]float64{1, 2}, nil, ErrInvalidExpression},
		{[]float64{1}, []Operation{Add}, ErrInvalidExpression},
		{[]float64{1, 2}, []Operation{Sqrt}, ErrInvalidExpression},
		{[]float64{1, 2}, []Operation{"unknown"}, ErrInvalidExpression},
		{[]float64{math.Inf(1)}, nil, ErrInvalidExpression},
		{[]float64{math.NaN()}, nil, ErrInvalidExpression},
		{make([]float64, 129), make([]Operation, 128), ErrInvalidExpression},
		{[]float64{2, 3, 0}, []Operation{Add, Divide}, ErrDivisionByZero},
		{[]float64{0, -1}, []Operation{Power}, ErrDivisionByZero},
		{[]float64{-8, 0.5}, []Operation{Power}, ErrNonReal},
		{[]float64{1e308, 10}, []Operation{Multiply}, ErrOverflow},
		{[]float64{1, 2, 1024}, []Operation{Add, Power}, ErrOverflow},
	} {
		_, err := Evaluate(test.values, test.ops)
		if !errors.Is(err, test.want) {
			t.Errorf("%v %v: got %v, want %v", test.values, test.ops, err, test.want)
		}
	}
}
