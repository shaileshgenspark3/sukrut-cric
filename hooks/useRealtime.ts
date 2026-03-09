import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeSubscription(table: string, queryKeys: string[]) {
    const queryClient = useQueryClient();
    const queryKeyToken = queryKeys.join('::');
    const channelIdRef = useRef(
        `${table}_changes:${queryKeyToken}:${Math.random().toString(36).slice(2, 10)}`
    );

    useEffect(() => {
        const matchesQueryKey = (query: { queryKey: readonly unknown[] }) => {
            if (!Array.isArray(query.queryKey) || query.queryKey.length === 0) {
                return false;
            }

            if (queryKeys.length === 1) {
                return query.queryKey[0] === queryKeys[0];
            }

            if (query.queryKey.length !== queryKeys.length) {
                return false;
            }

            return queryKeys.every((key, index) => query.queryKey[index] === key);
        };

        const channel = supabase
            .channel(channelIdRef.current)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: table },
                () => {
                    void queryClient.invalidateQueries({
                        predicate: matchesQueryKey,
                        refetchType: 'active',
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, queryKeyToken, queryClient]);
}
