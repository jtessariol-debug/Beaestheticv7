import { createClient } from '@supabase/supabase-js';
import { Service, ServiceCategory } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

console.log("SUPABASE URL:", supabaseUrl)
console.log("SUPABASE KEY:", supabaseAnonKey)

const hasValidUrl = Boolean(
    supabaseUrl &&
        /^https?:\/\//i.test(supabaseUrl) &&
        !supabaseUrl.includes('YOUR_SUPABASE_URL')
);
const hasValidAnonKey = Boolean(
    supabaseAnonKey &&
        !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY')
);

export const isSupabaseConfigured = Boolean(hasValidUrl && hasValidAnonKey);

let client = null;
if (isSupabaseConfigured) {
    try {
        client = createClient(supabaseUrl as string, supabaseAnonKey as string);
    } catch (error) {
        console.error('Supabase client init failed:', error);
        client = null;
    }
}

export const supabase = client;

const ONE_MB = 1024 * 1024;
export const PRODUCT_IMAGE_BUCKET = 'products';
export const MAX_ORIGINAL_IMAGE_BYTES = 12 * ONE_MB;
export const MAX_PROCESSED_IMAGE_BYTES = 2 * ONE_MB;
export const DEFAULT_MAX_IMAGE_DIMENSION = 1600;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Ocurrio un error inesperado.';

const sanitizeFileName = (name: string): string => {
    const withoutExt = name.replace(/\.[^.]+$/, '');
    return withoutExt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'imagen';
};

const loadImageElement = (file: Blob): Promise<{ image: HTMLImageElement; revoke: () => void }> =>
    new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => resolve({ image, revoke: () => URL.revokeObjectURL(objectUrl) });
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('No se pudo leer la imagen seleccionada.'));
        };
        image.src = objectUrl;
    });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('No se pudo procesar la imagen.'));
                    return;
                }
                resolve(blob);
            },
            type,
            quality
        );
    });

export const optimizeImageForUpload = async (
    file: File,
    options?: {
        maxOriginalBytes?: number;
        maxProcessedBytes?: number;
        maxDimension?: number;
    }
): Promise<File> => {
    const maxOriginalBytes = options?.maxOriginalBytes ?? MAX_ORIGINAL_IMAGE_BYTES;
    const maxProcessedBytes = options?.maxProcessedBytes ?? MAX_PROCESSED_IMAGE_BYTES;
    const maxDimension = options?.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION;

    if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
        throw new Error('Formato no soportado. Usa JPG, PNG, WEBP o AVIF.');
    }

    if (file.size > maxOriginalBytes) {
        throw new Error(`La imagen es demasiado grande. Maximo permitido: ${Math.round(maxOriginalBytes / ONE_MB)}MB.`);
    }

    if (typeof document === 'undefined') {
        return file;
    }

    const { image, revoke } = await loadImageElement(file);
    try {
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        const largerSide = Math.max(width, height);

        if (largerSide > maxDimension) {
            const ratio = maxDimension / largerSide;
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('No se pudo preparar el compresor de imagen.');
        }

        let quality = 0.88;
        let attempts = 0;
        let nextWidth = width;
        let nextHeight = height;
        let output: Blob | null = null;

        while (attempts < 7) {
            canvas.width = nextWidth;
            canvas.height = nextHeight;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            output = await canvasToBlob(canvas, 'image/jpeg', quality);
            if (output.size <= maxProcessedBytes) {
                break;
            }

            if (quality > 0.62) {
                quality -= 0.1;
            } else {
                nextWidth = Math.max(640, Math.round(nextWidth * 0.85));
                nextHeight = Math.max(640, Math.round(nextHeight * 0.85));
            }
            attempts += 1;
        }

        if (!output || output.size > maxProcessedBytes) {
            throw new Error(
                `No se pudo reducir la imagen. Intenta una imagen mas ligera (maximo ${Math.round(maxProcessedBytes / ONE_MB)}MB procesada).`
            );
        }

        const safeName = sanitizeFileName(file.name);
        return new File([output], `${safeName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
        });
    } finally {
        revoke();
    }
};

export const fileToDataUrl = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }
            reject(new Error('No se pudo convertir la imagen.'));
        };
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
    });

const normalizeStorageObjectPath = (rawPath: string, bucket: string): string => {
    let next = decodeURIComponent(rawPath).trim();
    next = next.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\//i, '');
    if (next.startsWith(`${bucket}/`)) {
        next = next.slice(bucket.length + 1);
    }
    next = next.replace(/^\/+/, '');
    next = next.split('?')[0];
    return next;
};

export const normalizeProductImageUrl = (rawUrl: string): string => {
    const trimmed = (rawUrl ?? '').trim();
    if (!trimmed) {
        return '';
    }

    if (
        /^data:image\//i.test(trimmed) ||
        /^blob:/i.test(trimmed) ||
        /^https?:\/\//i.test(trimmed)
    ) {
        return trimmed;
    }

    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }

    if (trimmed.startsWith('/')) {
        return trimmed;
    }

    if (!supabase) {
        return trimmed;
    }

    const objectPath = normalizeStorageObjectPath(trimmed, PRODUCT_IMAGE_BUCKET);
    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(objectPath);
    return data.publicUrl;
};

export const uploadImageToProductStorage = async (
    file: File,
    options?: {
        folder?: string;
        upsert?: boolean;
        maxOriginalBytes?: number;
        maxProcessedBytes?: number;
        maxDimension?: number;
    }
): Promise<{ publicUrl: string; path: string; uploadedFile: File }> => {
    if (!supabase) {
        throw new Error('Supabase no esta configurado.');
    }

    const processed = await optimizeImageForUpload(file, {
        maxOriginalBytes: options?.maxOriginalBytes,
        maxProcessedBytes: options?.maxProcessedBytes,
        maxDimension: options?.maxDimension,
    });

    const folder = options?.folder?.trim() || 'public';
    const uid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e8)}`;
    const safeName = sanitizeFileName(processed.name);
    const path = `${folder}/${uid}-${safeName}.jpg`;

    const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, processed, {
        upsert: options?.upsert ?? false,
        cacheControl: '3600',
        contentType: processed.type,
    });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    return {
        publicUrl: data.publicUrl,
        path,
        uploadedFile: processed,
    };
};

export { getErrorMessage };

const stableStringHash = (value: string): number => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
    }
    return hash;
};

export type RealtimeService = Service & {
    sourceId: string;
    isRealtime: true;
};

export const mapProductToRealtimeService = (product: Partial<Product>): RealtimeService => {
    const sourceId = String(product.id ?? '');
    const hashedId = Math.abs(stableStringHash(sourceId || `${product.name ?? ''}-${product.created_at ?? ''}`)) || 1;

    return {
        id: -hashedId,
        sourceId,
        isRealtime: true,
        name: String(product.name ?? 'Servicio'),
        category: ServiceCategory.ArmonizacionFacial,
        imageUrl: normalizeProductImageUrl(String(product.image_url ?? '')),
        description: String(product.description ?? ''),
    };
};

export type Product = {
    id: string;
    name: string;
    price: number;
    description: string;
    image_url: string;
    stock: number;
    created_at: string;
};
