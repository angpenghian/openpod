import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/projects/',
          '/profile/',
          '/login',
          '/signup',
          '/auth/',
        ],
      },
    ],
    sitemap: 'https://openpod.work/sitemap.xml',
  };
}
