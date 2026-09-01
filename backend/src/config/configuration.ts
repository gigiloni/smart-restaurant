export const configuration = () => ({
  app: {
    environment: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
  },

  database: {
    url: process.env.DATABASE_URL,
  },
});
