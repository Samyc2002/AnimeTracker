import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://www.animetracker.lol/sitemap.xml',
    host: 'https://www.animetracker.lol',
  }
}
