import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type CalculateFn } from '../../api/calculator';
import { errorMessage } from './errorMessage';
import { initialState, keypadReducer, type Action, type InputAction } from './keypadReducer';

interface Request {
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
}

export function useCalculator(calculate: CalculateFn) {
  const [state, setState] = useState(initialState);
  // Consecutive key events share the latest snapshot, including batched renders.
  const current = useRef(initialState);
  const active = useRef<Request | null>(null);
  const queued = useRef<InputAction[]>([]);

  const update = useCallback((action: Action) => {
    current.current = keypadReducer(current.current, action);
    setState(current.current);
    return current.current;
  }, []);

  const cancel = useCallback(() => {
    queued.current = [];
    const request = active.current;
    active.current = null;
    if (request) {
      clearTimeout(request.timer);
      request.controller.abort();
    }
  }, []);
  useEffect(() => () => cancel(), [cancel]);

  const send = useCallback(function send(action: InputAction) {
    if (action.type === 'clear') cancel();
    if (active.current) {
      queued.current.push(action);
      return;
    }
    const { pending } = update(action);
    if (!pending) return;

    const controller = new AbortController();
    function settle(outcome: Extract<Action, { type: 'resolved' | 'failed' }>) {
      // AC and unmount invalidate the identity even if transport ignores abort.
      if (active.current !== request) return;
      clearTimeout(request.timer);
      active.current = null;
      if (outcome.type === 'failed') {
        const discarded = queued.current.length > 0 ? ' Queued input was discarded.' : '';
        queued.current = [];
        update({ ...outcome, message: outcome.message + discarded });
      } else {
        update(outcome);
      }
      // Stop when replay starts another request; resume after its result.
      while (queued.current.length && !active.current) send(queued.current.shift()!);
    }
    const request: Request = {
      controller,
      timer: setTimeout(() => {
        const error = new ApiError('request_timeout', 'Request timed out.', 0);
        controller.abort();
        settle({ type: 'failed', message: errorMessage(error) });
      }, 20_000),
    };
    active.current = request;
    void (async () => {
      try {
        const result = await calculate(pending.request, controller.signal);
        settle({ type: 'resolved', result: result.result });
      } catch (error) {
        settle({ type: 'failed', message: errorMessage(error) });
      }
    })();
  }, [calculate, update, cancel]);

  return { state, send };
}
