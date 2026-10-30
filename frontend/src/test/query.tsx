import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { createQueryClient } from '../queryClient';

// Each render gets an isolated cache, using the same client setup as the app.
export function createQueryWrapper(client = createQueryClient()) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
