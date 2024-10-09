import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Make the PrismaService available globally
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
