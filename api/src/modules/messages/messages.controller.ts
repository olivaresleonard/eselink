import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MessagesService } from './messages.service.js';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(@Query('accountId') accountId?: string) {
    return this.messagesService.list({ accountId });
  }

  @Get('thread')
  thread(
    @Query('accountId') accountId: string,
    @Query('resource') resource: string,
  ) {
    return this.messagesService.getThread({ accountId, resource });
  }

  @Post('mark-read')
  markRead(
    @Body()
    body: {
      accountId: string;
      resource: string;
    },
  ) {
    return this.messagesService.markAsRead(body);
  }

  @Post('reply')
  reply(
    @Body()
    body: {
      accountId: string;
      resource: string;
      text: string;
      toUserId?: string;
    },
  ) {
    return this.messagesService.reply(body);
  }
}
