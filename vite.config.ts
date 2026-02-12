import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/ygo-proxy-generator/',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
