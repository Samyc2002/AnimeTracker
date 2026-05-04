import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://animetracker.lol/sitemap.xml',
    host: 'https://animetracker.lol',
  }
}
