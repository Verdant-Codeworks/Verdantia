import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.SERVER_PORT || 3001;
  const corsOrigin = process.env.SERVER_CORS_ORIGIN || 'http://localhost:5173';

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port);
  console.log(`Verdantia server running on port ${port}`);
}
bootstrap();
