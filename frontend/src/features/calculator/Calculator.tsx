import { useState, type FormEvent } from 'react';
import { calculate as apiCalculate, type CalculateFn, type Operation } from '../../api/calculator';
import { formatExpression } from './format';
import { NumberField } from './NumberField';
import { OPERATIONS, getOperation } from './operations';
import { useCalculation } from './useCalculation';
import { validateInputs, type FieldErrors } from './validation';

interface CalculatorProps {
  calculate?: CalculateFn;
}

export function Calculator({ calculate = apiCalculate }: CalculatorProps) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [operation, setOperation] = useState<Operation>('add');
  const [errors, setErrors] = useState<FieldErrors>({});
  const { state, run, reset } = useCalculation(calculate);
  const { arity } = getOperation(operation);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateInputs(arity, a, b);
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    setErrors({});
    void run(operation, validated.operands);
  }

  return (
    <form className="calculator" onSubmit={handleSubmit} noValidate>
      <NumberField id="a" label={arity === 1 ? 'Number' : 'First number'} value={a} onChange={setA} error={errors.a} />

      <fieldset className="operations">
        <legend>Operation</legend>
        {OPERATIONS.map((op) => (
          <label key={op.id} className="operation" title={op.label}>
            <input
              type="radio"
              name="operation"
              value={op.id}
              checked={operation === op.id}
              onChange={() => {
                reset();
                setErrors({});
                setOperation(op.id);
              }}
              aria-label={op.label}
            />
            <span aria-hidden="true">{op.symbol}</span>
          </label>
        ))}
      </fieldset>

      {arity === 2 && <NumberField id="b" label="Second number" value={b} onChange={setB} error={errors.b} />}

      <button type="submit" disabled={state.status === 'loading'}>
        {state.status === 'loading' ? 'Calculating…' : 'Calculate'}
      </button>

      <output className="result" aria-live="polite">
        {state.status === 'success' &&
          formatExpression(state.result.operation, state.result.operands, state.result.result)}
      </output>
      {state.status === 'error' && <p role="alert" className="error">{state.message}</p>}
    </form>
  );
}
