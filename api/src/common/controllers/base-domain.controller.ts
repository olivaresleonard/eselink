import { Body, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { BaseDomainService } from '../services/base-domain.service.js';

export abstract class BaseDomainController {
  constructor(protected readonly domainService: BaseDomainService) {}

  @Get()
  findAll() {
    return this.domainService.findAll();
  }

  @Get('meta')
  getMetadata() {
    return this.domainService.getMetadata();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.domainService.findOne(id);
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.domainService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.domainService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.domainService.remove(id);
  }
}
