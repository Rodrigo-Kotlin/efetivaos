import sharp from 'sharp'

await Promise.all([
  sharp('public/favicon.svg').resize(192, 192).png().toFile('public/pwa-192x192.png'),
  sharp('public/favicon.svg').resize(512, 512).png().toFile('public/pwa-512x512.png'),
])
