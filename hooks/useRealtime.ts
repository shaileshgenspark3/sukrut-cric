import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRealtimeSubscription(table: string, queryKeys: string[]) {
    const queryClient = useQueryClient();

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
    }, [table, queryKeys, queryClient]);
}
