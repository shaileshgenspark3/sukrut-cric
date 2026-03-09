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
                    queryClient.invalidateQueries({ queryKey: queryKeys });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, queryKeyToken, queryClient]);
}
