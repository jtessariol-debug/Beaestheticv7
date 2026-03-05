import { supabase } from './supabase';

export async function getSiteContent(id: string) {
    if (!supabase) {
        return {
            data: null,
            error: new Error('Supabase no esta configurado.'),
        };
    }

    return supabase
        .from('site_content')
        .select('*')
        .eq('id', id)
        .single();
}

export async function saveSiteContent(id: string, content: any) {
    if (!supabase) {
        return {
            data: null,
            error: new Error('Supabase no esta configurado.'),
        };
    }

    return supabase
        .from('site_content')
        .upsert({
            id: id,
            content: content,
            updated_at: new Date().toISOString(),
        });
}

