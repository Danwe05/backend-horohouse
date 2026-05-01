import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Booking, BookingDocument, BookingStatus, PaymentStatus, CancelledBy } from './schema/booking.schema';
import { Property, PropertyDocument, PropertyStatus, ApprovalStatus } from '../properties/schemas/property.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { RoomsService } from '../rooms/rooms.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateBookingDto,
  CancelBookingDto,
  RespondToBookingDto,
  UpdatePaymentDto,
  BookingQueryDto,
} from './dto/booking.dto';
import { HostStatsDto } from './dto/host-stats.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Platform service fee percentage (e.g. 0.10 = 10%) */
const SERVICE_FEE_RATE = 0.10;

/** How many hours after creation an unpaid PENDING booking is auto-cancelled */
const AUTO_CANCEL_HOURS = 24;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PaginatedBookings {
  bookings: Booking[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AvailabilityResult {
  available: boolean;
  unavailableDates: { from: Date; to: Date }[];  // host-blocked ranges
  bookedRanges: { checkIn: Date; checkOut: Date }[];  // confirmed bookings
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly roomsService: RoomsService,
    private readonly notificationsService: NotificationsService,
  ) { }

  // ════════════════════════════════════════════════════════════════════════════
  // PUBLIC — GUEST ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Create a new booking request.
   * Validates: property exists & is short-term, dates are free, min/max nights,
   * max guests. Computes full price breakdown. If property.isInstantBookable,
   * status is set to CONFIRMED immediately.
   */
  async createBooking(dto: CreateBookingDto, guest: User): Promise<Booking> {
    // ── 1. Resolve & validate the property ──────────────────────────────────
    const property = await this.propertyModel
      .findById(dto.propertyId)
      .populate('ownerId', 'name email phoneNumber')
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.approvalStatus !== ApprovalStatus.APPROVED || !property.isActive) {
      throw new BadRequestException('This property is not available for booking');
    }

    if (property.listingType !== 'short_term') {
      throw new BadRequestException(
        'This property does not accept short-term bookings. Use the inquiry system instead.',
      );
    }

    if (property.availability !== PropertyStatus.ACTIVE) {
      throw new BadRequestException('This property is not currently available');
    }

    // ── 2. Parse & validate dates ────────────────────────────────────────────
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new BadRequestException('Invalid check-in or check-out date');
    }

    if (checkIn < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }

    if (checkOut <= checkIn) {
      throw new BadRequestException('Check-out must be after check-in');
    }

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );

    const minNights = (property as any).minNights ?? 1;
    const maxNights = (property as any).maxNights ?? 365;

    if (nights < minNights) {
      throw new BadRequestException(
        `Minimum stay for this property is ${minNights} night(s)`,
      );
    }

    if (nights > maxNights) {
      throw new BadRequestException(
        `Maximum stay for this property is ${maxNights} night(s)`,
      );
    }

    // ── 2b. Advance notice & booking window validation ───────────────────────
    const advanceNoticeDays = (property as any).advanceNoticeDays ?? 0;
    const bookingWindowDays = (property as any).bookingWindowDays ?? 365;
    const daysTilCheckin = Math.ceil(
      (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysTilCheckin < advanceNoticeDays) {
      throw new BadRequestException(
        `This property requires at least ${advanceNoticeDays} day(s) advance notice before check-in`,
      );
    }

    if (daysTilCheckin > bookingWindowDays) {
      throw new BadRequestException(
        `Bookings can only be made up to ${bookingWindowDays} day(s) in advance for this property`,
      );
    }

    // ── 3. Check guest count ─────────────────────────────────────────────────
    const maxGuests = (property as any).shortTermAmenities?.maxGuests ?? 99;
    const totalGuests = dto.guests.adults + (dto.guests.children ?? 0);

    if (totalGuests > maxGuests) {
      throw new BadRequestException(
        `This property accommodates a maximum of ${maxGuests} guest(s)`,
      );
    }

    // ── 4. Availability check ────────────────────────────────────────────────
    // If a roomId is provided, delegate to room-level check; otherwise check property-wide
    if (dto.roomId) {
      await this.roomsService.assertRoomDatesAvailable(dto.roomId, checkIn, checkOut);
    } else {
      await this.assertDatesAvailable(dto.propertyId, checkIn, checkOut);
    }

    // ── 5. Build price breakdown ─────────────────────────────────────────────
    const priceBreakdown = this.computePrice(property, nights);

    // ── 6. Determine host ────────────────────────────────────────────────────
    const hostId = (property.agentId ?? property.ownerId) as Types.ObjectId;

    // ── 7. Instant book? ─────────────────────────────────────────────────────
    const isInstantBook = !!(property as any).isInstantBookable;
    const initialStatus = isInstantBook ? BookingStatus.CONFIRMED : BookingStatus.PENDING;
    const confirmedAt = isInstantBook ? new Date() : undefined;

    // ── 8. Persist ───────────────────────────────────────────────────────────
    const booking = new this.bookingModel({
      propertyId: new Types.ObjectId(dto.propertyId),
      ...(dto.roomId ? { roomId: new Types.ObjectId(dto.roomId) } : {}),
      guestId: guest._id,
      hostId,
      checkIn,
      checkOut,
      nights,
      guests: {
        adults: dto.guests.adults,
        children: dto.guests.children ?? 0,
        infants: dto.guests.infants ?? 0,
      },
      priceBreakdown,
      currency: dto.currency ?? (property as any).currency ?? 'XAF',
      status: initialStatus,
      paymentStatus: PaymentStatus.UNPAID,
      isInstantBook,
      confirmedAt,
      guestNote: dto.guestNote,
    });

    const saved = await booking.save();

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const propertyTitle = (property as any).title ?? 'your property';
    const hostIdStr = hostId.toString();
    const guestIdStr = guest._id.toString();

    if (isInstantBook) {
      // Guest gets immediate confirmation
      await this.notificationsService.notifyBookingConfirmed(guestIdStr, {
        bookingId: saved._id.toString(),
        propertyId: dto.propertyId,
        propertyTitle,
        hostName: (property.ownerId as any)?.name ?? 'Host',
        checkIn: fmt(checkIn),
        checkOut: fmt(checkOut),
      });
    } else {
      // Host gets a booking request to review
      await this.notificationsService.notifyBookingRequest(hostIdStr, {
        bookingId: saved._id.toString(),
        propertyId: dto.propertyId,
        propertyTitle,
        guestName: guest.name,
        checkIn: fmt(checkIn),
        checkOut: fmt(checkOut),
      });
    }

    return saved; 
  }

  /**
   * Guest cancels their own booking.
   * Applies refund logic based on the property's cancellation policy.
   */
  async cancelBooking(
    bookingId: string,
    dto: CancelBookingDto,
    user: User,
  ): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);

    // Only the guest, host, or admin can cancel
    const isGuest = booking.guestId.toString() === user._id.toString();
    const isHost = booking.hostId.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isGuest && !isHost && !isAdmin) {
      throw new ForbiddenException('You are not authorized to cancel this booking');
    }

    const cancellableStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel a booking with status "${booking.status}"`,
      );
    }

    const cancelledBy: CancelledBy = isAdmin
      ? CancelledBy.ADMIN
      : isGuest
        ? CancelledBy.GUEST
        : CancelledBy.HOST;

    // Compute refund based on cancellation policy
    const refundAmount = await this.computeRefund(booking);

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.CANCELLED,
          cancellation: {
            cancelledBy,
            cancelledAt: new Date(),
            reason: dto.reason,
            refundAmount,
            refundStatus: refundAmount > 0 ? 'pending' : undefined,
          },
        },
        { new: true },
      )
      .exec();

    this.logger.log(`Booking ${bookingId} cancelled by ${cancelledBy}`);
    return updated!;
  }

  /**
   * Guest retrieves their own bookings.
   */
  async getGuestBookings(guestId: string, query: BookingQueryDto): Promise<PaginatedBookings> {
    return this.paginateBookings({ guestId: new Types.ObjectId(guestId) }, query);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOST ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Host confirms a pending booking.
   */
  async confirmBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);
    this.assertIsHost(booking, host);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Only PENDING bookings can be confirmed. Current status: ${booking.status}`,
      );
    }

    // Re-check availability (another booking may have snuck in)
    await this.assertDatesAvailable(
      booking.propertyId.toString(),
      booking.checkIn,
      booking.checkOut,
      bookingId, // exclude the current booking itself
    );

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
          hostNote: dto.hostNote,
        },
        { new: true },
      )
      .exec();

    const property = await this.propertyModel.findById(booking.propertyId).select('title').lean();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    await this.notificationsService.notifyBookingConfirmed(booking.guestId.toString(), {
      bookingId: bookingId,
      propertyId: booking.propertyId.toString(),
      propertyTitle: (property as any)?.title ?? 'your property',
      hostName: host.name,
      checkIn: fmt(booking.checkIn),
      checkOut: fmt(booking.checkOut),
    });

    this.logger.log(`Booking ${bookingId} confirmed by host ${host._id}`);
    return updated!;
  }

  /**
   * Host rejects a pending booking.
   */
  async rejectBooking(bookingId: string, dto: RespondToBookingDto, host: User): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);
    this.assertIsHost(booking, host);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only PENDING bookings can be rejected');
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.REJECTED,
          hostNote: dto.hostNote,
          cancellation: {
            cancelledBy: CancelledBy.HOST,
            cancelledAt: new Date(),
            reason: dto.reason,
            refundAmount: 0,
          },
        },
        { new: true },
      )
      .exec();
    const property = await this.propertyModel.findById(booking.propertyId).select('title').lean();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    await this.notificationsService.notifyBookingRejected(booking.guestId.toString(), {
      bookingId: bookingId,
      propertyId: booking.propertyId.toString(),
      propertyTitle: (property as any)?.title ?? 'your property',
      hostName: host.name,
      checkIn: fmt(booking.checkIn),
      checkOut: fmt(booking.checkOut),
    });

    this.logger.log(`Booking ${bookingId} rejected by host ${host._id}`);
    return updated!;
  }

  /**
   * Host marks a booking as completed (after checkout).
   */
  async completeBooking(bookingId: string, host: User): Promise<Booking> {
    const booking = await this.findBookingOrThrow(bookingId);
    this.assertIsHost(booking, host);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only CONFIRMED bookings can be completed');
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(
        bookingId,
        {
          status: BookingStatus.COMPLETED,
          actualCheckOut: new Date(),
        },
        { new: true },
      )
      .exec();

    this.logger.log(`Booking ${bookingId} marked as completed`);
    return updated!;
  }

  /**
   * Host retrieves all bookings for their properties.
   */
  async getHostBookings(hostId: string, query: BookingQueryDto): Promise<PaginatedBookings> {
    return this.paginateBookings({ hostId: new Types.ObjectId(hostId) }, query);
  }

  /**
   * Get all bookings for a specific property (host or admin only — checked in controller).
   */
  async getPropertyBookings(propertyId: string, query: BookingQueryDto): Promise<PaginatedBookings> {
    return this.paginateBookings({ propertyId: new Types.ObjectId(propertyId) }, query);
  }


async getHostStats(hostId: string): Promise<HostStatsDto> {
  const hostObjectId = new Types.ObjectId(hostId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [bookingStats, propertyStats] = await Promise.all([

    this.bookingModel.aggregate([
      { $match: { hostId: hostObjectId } },
      { $facet: {

        completedStays: [
          { $match: { status: { $in: ['completed', 'checked_out'] } } },
          { $count: 'total' },
        ],

        currentMonthEarnings: [
          {
            $match: {
              status: { $in: ['confirmed', 'completed', 'checked_out'] },
              checkIn: { $gte: monthStart },
            },
          },
          { $group: { _id: null, total: { $sum: '$priceBreakdown.totalAmount' } } },
        ],

        occupiedPropertyIds: [
          {
            $match: {
              status: { $in: ['confirmed', 'checked_in'] },
              checkIn: { $lte: now },
              checkOut: { $gte: now },
            },
          },
          { $group: { _id: '$propertyId' } },
        ],
      }},
    ]),

    this.propertyModel.aggregate([
      { $match: { ownerId: hostObjectId, isActive: true } },
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          avgRating: {
            $avg: {
              $cond: [{ $gt: ['$averageRating', 0] }, '$averageRating', null],
            },
          },
        },
      },
    ]),
  ]);

  const bStats = bookingStats[0];
  const completedStays       = bStats.completedStays[0]?.total ?? 0;
  const currentMonthEarnings = bStats.currentMonthEarnings[0]?.total ?? 0;
  const occupiedCount        = bStats.occupiedPropertyIds.length;
  const totalListings        = propertyStats[0]?.totalListings ?? 0;
  const avgRating            = propertyStats[0]?.avgRating ?? 0;
  const occupancyRate        = totalListings > 0 ? (occupiedCount / totalListings) * 100 : 0;
  const isSuperhost          = completedStays >= 10 && avgRating >= 4.8;

  return {
    totalListings,
    completedStays,
    currentMonthEarnings,
    avgRating:      Math.round(avgRating * 10) / 10,
    occupancyRate:  Math.round(occupancyRate * 10) / 10,
    isSuperhost,
  };
}

  // ════════════════════════════════════════════════════════════════════════════
  // AVAILABILITY
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Returns blocked date ranges for a property (or specific room) within a date window.
   * Used by the frontend calendar widget.
   */
  async getAvailability(
    propertyId: string,
    from: Date,
    to: Date,
    roomId?: string,
  ): Promise<AvailabilityResult> {
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) throw new NotFoundException('Property not found');

    // If a roomId is provided, delegate to room-level availability
    if (roomId) {
      const roomResult = await this.roomsService.getRoomAvailability(roomId, from, to);
      return {
        available: roomResult.available,
        unavailableDates: roomResult.unavailableDates.map((r) => ({ from: r.from, to: r.to })),
        bookedRanges: roomResult.bookedRanges.map((r) => ({ checkIn: r.checkIn, checkOut: r.checkOut })),
      };
    }

    // 1. Host-blocked ranges stored directly on the property
    const hostBlockedRanges: { from: Date; to: Date }[] =
      ((property as any).unavailableDates ?? []).filter(
        (r: any) => r.from < to && r.to > from,
      );

    // 2. Confirmed / pending bookings in the window (property-wide, no room)
    const bookedRanges = await this.bookingModel
      .find({
        propertyId: new Types.ObjectId(propertyId),
        roomId: { $exists: false },  // only whole-property bookings
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        checkIn: { $lt: to },
        checkOut: { $gt: from },
      })
      .select('checkIn checkOut')
      .lean()
      .exec() as { checkIn: Date; checkOut: Date }[];

    const available = hostBlockedRanges.length === 0 && bookedRanges.length === 0;

    return { available, unavailableDates: hostBlockedRanges, bookedRanges };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  async getAllBookings(query: BookingQueryDto): Promise<PaginatedBookings> {
    return this.paginateBookings({}, query);
  }

  async getBookingById(bookingId: string, user: User): Promise<Booking> {
    const booking = await this.bookingModel
      .findById(bookingId)
      .populate('propertyId', 'title address city images price')
      .populate('guestId', 'name email phoneNumber profilePicture')
      .populate('hostId', 'name email phoneNumber profilePicture')
      .exec();

    if (!booking) throw new NotFoundException('Booking not found');

    const guestId = (booking.guestId as any)?._id ?? booking.guestId;
    const hostId = (booking.hostId as any)?._id ?? booking.hostId;

    const isGuest = guestId.toString() === user._id.toString();
    const isHost = hostId.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isGuest && !isHost && !isAdmin) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    return booking;
  }

  /**
   * Admin or payment webhook updates payment status.
   */
  async updatePayment(bookingId: string, dto: UpdatePaymentDto): Promise<Booking> {
    const updateData: any = { paymentStatus: dto.paymentStatus };

    if (dto.paymentReference) updateData.paymentReference = dto.paymentReference;
    if (dto.paymentMethod) updateData.paymentMethod = dto.paymentMethod;
    if (dto.paymentStatus === 'paid') updateData.paidAt = new Date();

    const updated = await this.bookingModel
      .findByIdAndUpdate(bookingId, updateData, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Booking not found');
    return updated;
  }

  /**
   * Admin gets overall booking statistics.
   */
  async getBookingStats(): Promise<any> {
    const stats = await this.bookingModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$priceBreakdown.totalAmount' },
        },
      },
    ]);

    const totalBookings = await this.bookingModel.countDocuments();
    const totalRevenue = await this.bookingModel.aggregate([
      { $match: { status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } },
      { $group: { _id: null, total: { $sum: '$priceBreakdown.totalAmount' } } },
    ]);

    return {
      totalBookings,
      totalRevenue: totalRevenue[0]?.total ?? 0,
      byStatus: stats.reduce((acc: any, s: any) => {
        acc[s._id] = { count: s.count, revenue: s.totalRevenue };
        return acc;
      }, {}),
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Throws ConflictException if the given date range overlaps any confirmed
   * or pending booking on the property (excluding `excludeBookingId`).
   */
  private async assertDatesAvailable(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const filter: any = {
      propertyId: new Types.ObjectId(propertyId),
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      // Overlap condition: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    };

    if (excludeBookingId) {
      filter._id = { $ne: new Types.ObjectId(excludeBookingId) };
    }

    const conflict = await this.bookingModel.findOne(filter).select('_id checkIn checkOut').lean();

    if (conflict) {
      throw new ConflictException(
        `The property is already booked from ` +
        `${conflict.checkIn.toISOString().split('T')[0]} to ` +
        `${conflict.checkOut.toISOString().split('T')[0]}`,
      );
    }

    // Also check host-blocked dates stored on the property
    const property = await this.propertyModel
      .findById(propertyId)
      .select('unavailableDates')
      .lean()
      .exec();

    const blocked = ((property as any)?.unavailableDates ?? []) as { from: Date; to: Date }[];
    const isBlocked = blocked.some(
      (r) => new Date(r.from) < checkOut && new Date(r.to) > checkIn,
    );

    if (isBlocked) {
      throw new ConflictException('Selected dates are blocked by the host');
    }
  }

  /**
   * Compute the full price breakdown at booking time.
   * Prices are locked in so later edits to the property don't affect existing bookings.
   */
  private computePrice(property: any, nights: number) {
    const pricePerNight = property.price ?? 0;
    const subtotal = pricePerNight * nights;
    const cleaningFee = property.cleaningFee ?? 0;
    const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
    const taxAmount = 0; // extend as needed
    // Use host-configured discount percentages (fall back to platform defaults)
    const discountAmount = this.computeDiscount(
      subtotal,
      nights,
      property.weeklyDiscountPercent ?? 10,
      property.monthlyDiscountPercent ?? 15,
    );
    const totalAmount = subtotal + cleaningFee + serviceFee + taxAmount - discountAmount;

    return {
      pricePerNight,
      nights,
      subtotal,
      cleaningFee,
      serviceFee,
      taxAmount,
      discountAmount,
      totalAmount,
    };
  }

  /**
   * Apply weekly (≥7 nights) or monthly (≥28 nights) discount using
   * the host-configured percentage rates stored on the property.
   */
  private computeDiscount(
    subtotal: number,
    nights: number,
    weeklyPct: number,
    monthlyPct: number,
  ): number {
    if (nights >= 28) return Math.round(subtotal * (monthlyPct / 100));
    if (nights >= 7) return Math.round(subtotal * (weeklyPct / 100));
    return 0;
  }

  /**
   * Compute refund amount based on the property's cancellation policy
   * and how far in advance the guest is cancelling.
   */
  private async computeRefund(booking: BookingDocument): Promise<number> {
    if (booking.paymentStatus !== PaymentStatus.PAID) return 0;

    const property = await this.propertyModel
      .findById(booking.propertyId)
      .select('cancellationPolicy')
      .lean()
      .exec();

    const policy = (property as any)?.cancellationPolicy ?? 'flexible';
    const paidAmount = booking.priceBreakdown.totalAmount;
    const daysUntilCheckin = Math.ceil(
      (booking.checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    switch (policy) {
      case 'flexible':
        return daysUntilCheckin >= 1 ? paidAmount : 0;

      case 'moderate':
        return daysUntilCheckin >= 5 ? paidAmount : 0;

      case 'strict':
        if (daysUntilCheckin >= 7) return Math.round(paidAmount * 0.5);
        return 0;

      case 'no_refund':
      default:
        return 0;
    }
  }

  /** Reusable paginated query helper */
  private async paginateBookings(
    baseFilter: Record<string, any>,
    query: BookingQueryDto,
  ): Promise<PaginatedBookings> {
    const { page = 1, limit = 20, status, fromDate, toDate, sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const filter: any = { ...baseFilter };

    if (status) filter.status = status;
    if (fromDate) filter.checkIn = { ...(filter.checkIn ?? {}), $gte: new Date(fromDate) };
    if (toDate) filter.checkOut = { ...(filter.checkOut ?? {}), $lte: new Date(toDate) };

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .populate('propertyId', 'title address city images price')
        .populate('guestId', 'name email phoneNumber profilePicture')
        .populate('hostId', 'name email phoneNumber profilePicture')
        .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return { bookings, total, page, totalPages: Math.ceil(total / limit) };
  }

  private async findBookingOrThrow(id: string): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private assertIsHost(booking: Booking, user: User): void {
    const isHost = booking.hostId.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isHost && !isAdmin) {
      throw new ForbiddenException('Only the host or an admin can perform this action');
    }
  }
}
