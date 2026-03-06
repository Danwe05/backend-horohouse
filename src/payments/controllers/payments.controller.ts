import {
  Controller, Post, Get, Body, Param, Query,
  Req, UseGuards, HttpCode, HttpStatus, Headers, BadRequestException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiBearerAuth, ApiQuery, ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from '../services/payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.guard';
import { Roles } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/schemas/user.schema';
import {
  InitializePaymentDto, VerifyPaymentDto,
  TransactionQueryDto, FlutterwaveWebhookDto,
} from '../dto/payment.dto';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ── Generic payment (subscriptions, boosts, etc.) ─────────────────────────

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initialize a new payment' })
  @ApiResponse({ status: 201, description: 'Payment initialized successfully' })
  async initializePayment(
    @Body() initializePaymentDto: InitializePaymentDto,
    @Req() req: any,
  ) {
    return this.paymentsService.initializePayment(initializePaymentDto, req.user);
  }

  // ── Booking payment ───────────────────────────────────────────────────────
  // NEW: dedicated endpoint for booking pay-to-request flow.
  // Returns { transaction, paymentLink, txRef } — frontend opens inline modal with paymentLink.

  @Post('bookings/:bookingId/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Initiate inline Flutterwave payment for a booking',
    description:
      'Creates a pending transaction and returns a Flutterwave payment link. ' +
      'Pass the link to the FlutterwaveCheckout SDK to open the inline modal. ' +
      'Idempotent — returns the same link if called again while payment is still pending. ' +
      'Only the booking guest can call this endpoint.',
  })
  @ApiParam({ name: 'bookingId', description: 'ID of the booking to pay for' })
  @ApiResponse({
    status: 201,
    description: 'Returns { transaction, paymentLink, txRef }',
    schema: {
      example: {
        txRef:       'HH-BOO-1714000000000-AB1C2D',
        paymentLink: 'https://checkout.flutterwave.com/v3/hosted/pay/...',
        transaction: { _id: '...', status: 'pending', amount: 150000, currency: 'XAF' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already paid, cancelled, or booking is invalid' })
  @ApiResponse({ status: 403, description: 'Caller is not the booking guest' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async initiateBookingPayment(
    @Param('bookingId') bookingId: string,
    @Req() req: any,
  ) {
    return this.paymentsService.initiateBookingPayment(bookingId, req.user);
  }

  // ── Verify payment ────────────────────────────────────────────────────────

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify payment status' })
  async verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto, @Req() req: any) {
    return this.paymentsService.verifyPayment(verifyPaymentDto, req.user);
  }

  // ── Transaction queries ───────────────────────────────────────────────────

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user transactions' })
  @ApiQuery({ name: 'page',          required: false, type: Number })
  @ApiQuery({ name: 'limit',         required: false, type: Number })
  @ApiQuery({ name: 'status',        required: false, type: String })
  @ApiQuery({ name: 'type',          required: false, type: String })
  @ApiQuery({ name: 'paymentMethod', required: false, type: String })
  @ApiQuery({ name: 'startDate',     required: false, type: String })
  @ApiQuery({ name: 'endDate',       required: false, type: String })
  async getUserTransactions(@Req() req: any, @Query() query: TransactionQueryDto) {
    return this.paymentsService.getUserTransactions(req.user.id, query);
  }

  @Get('transactions/reference/:txRef')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transaction by Flutterwave reference' })
  async getTransactionByReference(@Param('txRef') txRef: string, @Req() req: any) {
    return this.paymentsService.getTransactionByReference(txRef, req.user.id);
  }

  @Get('transactions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get transaction by ID' })
  async getTransactionById(@Param('id') id: string, @Req() req: any) {
    return this.paymentsService.getTransactionById(id, req.user.id);
  }

  // ── Webhook (public — Flutterwave calls this directly) ────────────────────

  @Post('webhook/flutterwave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flutterwave webhook receiver' })
  async handleFlutterwaveWebhook(
    @Body() payload: FlutterwaveWebhookDto,
    @Headers('verif-hash') signature: string,
  ) {
    if (!signature) throw new BadRequestException('Missing webhook signature');
    await this.paymentsService.handleWebhook(payload, signature);
    return { status: 'success', message: 'Webhook processed successfully' };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @Get('admin/transactions')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all transactions (Admin)' })
  async getAllTransactions(@Query() query: TransactionQueryDto) {
    return { message: 'Admin transactions endpoint' };
  }

  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get payment analytics (Admin)' })
  async getPaymentAnalytics() {
    return { message: 'Payment analytics endpoint' };
  }
}