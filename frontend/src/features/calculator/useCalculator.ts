import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type CalculateFn } from '../../api/calculator';
import { errorMessage } from './errorMessage';
import { initialState, keypadReducer, type Action } from './keypadReducer';

interface Request {
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
}

export function useCalculator(calculate: CalculateFn) {
  const [state, setState] = useState(initialState);
  // Consecutive key events must use the latest reducer snapshot, even when
  // React batches their renders. Both references point at the same snapshot.
  const current = useRef(initialState);
  const active = useRef<Request | null>(null);

  const update = useCallback((action: Action) => {
    current.current = keypadReducer(current.current, action);
    setState(current.current);
    return current.current;
  }, []);

  const cancel = useCallback((reason?: Error) => {
    const request = active.current;
    active.current = null;
    if (request) {
      clearTimeout(request.timer);
      request.controller.abort(reason);
    }
  }, []);
  useEffect(() => () => cancel(), [cancel]);

  const send = useCallback((action: Action) => {
    if (action.type === 'clear') cancel();
    const previous = current.current.pending;
    const { pending } = update(action);
    if (!pending || pending === previous) return;

    const controller = new AbortController();
    const request: Request = {
      controller,
      timer: setTimeout(() => {
        const error = new ApiError('request_timeout', 'Request timed out.', 0);
        cancel(error);
        update({ type: 'failed', message: errorMessage(error) });
      }, 20_000),
    };
    active.current = request;
    // Only input events start I/O. Request identity guards late replies after
    // AC, deadline expiry or unmount, even if a transport ignores abort.
    void (async () => {
      try {
        const result = await calculate(pending.operation, pending.operands, controller.signal);
        if (active.current === request) update({ type: 'resolved', result: result.result });
      } catch (error) {
        if (active.current === request) update({ type: 'failed', message: errorMessage(error) });
      } finally {
        clearTimeout(request.timer);
        if (active.current === request) active.current = null;
      }
    })();
  }, [calculate, update, cancel]);

  return { state, send };
}
