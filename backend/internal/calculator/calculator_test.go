package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		want     float64
		wantErr  error
	}{
		{"add", Add, []float64{2, 3}, 5, nil},
		{"add negatives", Add, []float64{-2, -3.5}, -5.5, nil},
		{"subtract", Subtract, []float64{10, 4}, 6, nil},
		{"multiply", Multiply, []float64{6, 7}, 42, nil},
		{"multiply by zero", Multiply, []float64{6, 0}, 0, nil},
		{"divide", Divide, []float64{12, 4}, 3, nil},
		{"divide fraction", Divide, []float64{1, 4}, 0.25, nil},
		{"divide by zero", Divide, []float64{1, 0}, 0, ErrDivisionByZero},
		{"zero divided by zero", Divide, []float64{0, 0}, 0, ErrDivisionByZero},
		{"power", Power, []float64{2, 10}, 1024, nil},
		{"power negative exponent", Power, []float64{2, -1}, 0.5, nil},
		{"power of negative to fraction is NaN", Power, []float64{-8, 0.5}, 0, ErrNonFinite},
		{"sqrt", Sqrt, []float64{16}, 4, nil},
		{"sqrt zero", Sqrt, []float64{0}, 0, nil},
		{"sqrt negative", Sqrt, []float64{-1}, 0, ErrNegativeSqrt},
		{"percentage", Percentage, []float64{15, 200}, 30, nil},
		{"percentage seven", Percentage, []float64{7, 100}, 7, nil},
		{"percentage twenty nine", Percentage, []float64{29, 100}, 29, nil},
		{"percentage avoid intermediate overflow", Percentage, []float64{1e308, 100}, 1e308, nil},
		{"overflow", Multiply, []float64{math.MaxFloat64, 10}, 0, ErrNonFinite},
		{"unknown operation", Operation("modulo"), []float64{1, 2}, 0, ErrUnknownOperation},
		{"empty operation", Operation(""), []float64{1, 2}, 0, ErrUnknownOperation},
		{"too few operands", Add, []float64{1}, 0, ErrOperandCount},
		{"too many operands", Sqrt, []float64{1, 2}, 0, ErrOperandCount},
		{"nil operands", Add, nil, 0, ErrOperandCount},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.operands)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Calculate(%q, %v) error = %v, want %v", tt.op, tt.operands, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Calculate(%q, %v) = %v, want %v", tt.op, tt.operands, got, tt.want)
			}
		})
	}
}

func TestErrorMessagesAreDescriptive(t *testing.T) {
	_, err := Calculate(Add, []float64{1})
	if got, want := err.Error(), "wrong number of operands: add takes 2, got 1"; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
	_, err = Calculate("modulo", []float64{1, 2})
	if got, want := err.Error(), `unknown operation: "modulo"`; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
}
