import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/calculator';
import { errorMessage } from './errorMessage';

describe('error presentation', () => {
  it.each([
    ['division_by_zero', "You can't divide by zero."],
    ['negative_sqrt', 'Square root needs a number of 0 or more.'],
    ['non_real_result', 'This calculation has no real-number result.'],
    ['result_overflow', 'That result is too large to show.'],
    ['invalid_response', 'The calculator service sent an invalid response. Try again.'],
    ['network_error', "Couldn't reach the calculator service. Try again."],
    ['request_timeout', 'The calculator service took too long. Try again.'],
  ])('maps %s by code, independently of backend wording', (code, message) => {
    expect(errorMessage(new ApiError(code, 'neutral API explanation', 422))).toBe(message);
  });
  it.each([new Error('internal detail'), new ApiError('unknown_error', 'internal detail', 500), new ApiError('constructor', 'internal detail', 500)])('uses generic copy for an unexpected failure', (error) => {
    expect(errorMessage(error)).toBe('Something went wrong. Try again.');
  });
});
