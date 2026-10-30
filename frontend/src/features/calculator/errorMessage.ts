import { ApiError } from '../../api/calculator';

const messages = new Map([
  ['division_by_zero', "You can't divide by zero."],
  ['negative_sqrt', 'Square root needs a number of 0 or more.'],
  ['non_real_result', 'This calculation has no real-number result.'],
  ['result_overflow', 'That result is too large to show.'],
  ['invalid_response', 'The calculator service sent an invalid response. Try again.'],
  ['network_error', "Couldn't reach the calculator service. Try again."],
  ['request_timeout', 'The calculator service took too long. Try again.'],
]);

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? messages.get(error.code) ?? 'Something went wrong. Try again.'
    : 'Something went wrong. Try again.';
}
