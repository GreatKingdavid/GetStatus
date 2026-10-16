import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.enableCors({
  // origin: [
  //   "http://localhost:5500",
  //   "http://127.0.0.1:5500",
  //   "https://getstatus-1.onrender.com",
    
  // ],
  app.enableCors({
  origin: true,
  credentials: true,
});
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();