/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['sharp'],

  async headers() {
    return [
      // Fonts, the Webflow runtime and the seeded media are content-addressed
      // by filename — safe to cache hard.
      {
        source: '/:dir(media|fonts|js|css)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

module.exports = nextConfig
