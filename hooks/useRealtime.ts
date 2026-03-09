import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeSubscription(table: string, queryKeys: string[]) {
    const queryClient = useQueryClient();
    const queryKeyToken = queryKeys.join('::');

    useEffect(() => {
        const channel = supabase
            .channel(`${table}_changes`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: table },
                () => {
                    queryClient.invalidateQueries({
                        predicate: (query) => {
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
                        },
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, queryKeyToken, queryClient]);
}
