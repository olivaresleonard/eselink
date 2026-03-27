import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AssignOrderDto } from './dto/assign-order.dto.js';
import { CreateOrderCommentDto } from './dto/create-order-comment.dto.js';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto.js';
import { OrdersImportService } from './orders-import.service.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersImportService: OrdersImportService,
  ) {}

  @Get()
  findAll(@Query() query: GetOrdersQueryDto) {
    return this.ordersService.findUnified(query);
  }

  @Get('flex-today')
  findFlexToday(@Query() query: GetOrdersQueryDto) {
    return this.ordersService.findFlexToday(query);
  }

  @Get('shipping-labels/bulk')
  async downloadShippingLabelsByQuery(
    @Query('orderIds') orderIds: string | string[] | undefined,
    @Res() response: Response,
  ) {
    const normalizedOrderIds = Array.isArray(orderIds)
      ? orderIds.flatMap((value) => value.split(','))
      : typeof orderIds === 'string'
        ? orderIds.split(',')
        : [];
    const label = await this.ordersService.downloadShippingLabels(
      normalizedOrderIds.map((value) => value.trim()).filter(Boolean),
    );
    response.setHeader('Content-Type', label.contentType);
    response.setHeader('Content-Disposition', label.contentDisposition);
    response.send(label.body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOrderDetail(id);
  }

  @Get(':id/shipping-label')
  async downloadShippingLabel(@Param('id') id: string, @Res() response: Response) {
    const label = await this.ordersService.downloadShippingLabel(id);
    response.setHeader('Content-Type', label.contentType);
    response.setHeader('Content-Disposition', label.contentDisposition);
    response.send(label.body);
  }

  @Post('shipping-labels/bulk')
  async downloadShippingLabels(
    @Body() body: { orderIds?: string[] },
    @Res() response: Response,
  ) {
    const label = await this.ordersService.downloadShippingLabels(body.orderIds ?? []);
    response.setHeader('Content-Type', label.contentType);
    response.setHeader('Content-Disposition', label.contentDisposition);
    response.send(label.body);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: AssignOrderDto) {
    return this.ordersService.assignOrder(id, body);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ordersService.cancelOrder(id);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string) {
    return this.ordersService.listComments(id);
  }

  @Post(':id/comments')
  createComment(@Param('id') id: string, @Body() body: CreateOrderCommentDto) {
    return this.ordersService.createComment(id, body);
  }

  @Post('import/:accountId')
  importOrders(@Param('accountId') accountId: string) {
    return this.ordersImportService.importOrders(accountId);
  }

  @Post('refresh-open-snapshots')
  refreshOpenSnapshots(@Query('accountId') accountId?: string) {
    return this.ordersService.refreshOpenSnapshots(accountId);
  }

  @Post('refresh-live')
  refreshLiveOrders(@Query('accountId') accountId?: string) {
    return this.ordersService.refreshLiveOrders(accountId);
  }
}
