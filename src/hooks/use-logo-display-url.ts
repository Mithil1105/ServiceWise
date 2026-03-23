/**
 * Resolves organization logo_url to a display URL.
 * If logo_url is a full URL (legacy), returns it as-is.
 * Otherwise treats it as an R2 key and returns public or signed URL.
 */
import { useQuery } from '@tanstack/react-query';
import { storageGetPublicUrl } from '@/lib/storage';

export function useLogoDisplayUrl(logoUrl: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ['logo-display-url', logoUrl],
    queryFn: async () => {
      if (!logoUrl) return null;
      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl;
      return storageGetPublicUrl(logoUrl, 86400, undefined, 'organization-logos');
    },
    enabled: !!logoUrl,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? null;
}
