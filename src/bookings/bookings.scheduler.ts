import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { Booking, BookingDocument, BookingStatus, PaymentStatus, CancelledBy } from './schema/booking.schema';

/** Hours after creation that an unpaid PENDING booking is auto-cancelled */
const AUTO_CANCEL_HOURS = 24;

/** Hours after check-in time with no actualCheckIn before marking NO_SHOW */
const NO_SHOW_GRACE_HOURS = 24;

@Injectable()
export class BookingsScheduler {
    private readonly logger = new Logger(BookingsScheduler.name);

    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    ) { }

    // ════════════════════════════════════════════════════════════════════════════
    // AUTO-CANCEL UNPAID BOOKINGS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Every hour: find PENDING bookings that have been waiting more than
     * AUTO_CANCEL_HOURS without payment and cancel them automatically.
     * This frees up the calendar for other guests.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async autoCancelUnpaidBookings(): Promise<void> {
        const cutoff = new Date(Date.now() - AUTO_CANCEL_HOURS * 3_600_000);

        try {
            const result = await this.bookingModel.updateMany(
                {
                    status: BookingStatus.PENDING,
                    paymentStatus: PaymentStatus.UNPAID,
                    createdAt: { $lt: cutoff },
                },
                {
                    $set: {
                        status: BookingStatus.CANCELLED,
                        'cancellation.cancelledBy': CancelledBy.SYSTEM,
                        'cancellation.cancelledAt': new Date(),
                        'cancellation.reason':
                            `Automatically cancelled: payment not received within ${AUTO_CANCEL_HOURS} hours`,
                        'cancellation.refundAmount': 0,
                    },
                },
            );

            if (result.modifiedCount > 0) {
                this.logger.log(
                    `Auto-cancel job: cancelled ${result.modifiedCount} unpaid booking(s) ` +
                    `(older than ${AUTO_CANCEL_HOURS}h)`,
                );
            }
        } catch (err: any) {
            this.logger.error(`Auto-cancel job failed: ${err.message}`, err.stack);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // AUTO NO-SHOW DETECTION
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Daily at 10:00: find CONFIRMED bookings whose check-in date passed more
     * than NO_SHOW_GRACE_HOURS ago with no actualCheckIn recorded.
     * Marks them as NO_SHOW, which triggers the no-refund path.
     */
    @Cron('0 10 * * *') // Every day at 10:00 AM
    async detectNoShows(): Promise<void> {
        const graceCutoff = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 3_600_000);

        try {
            const result = await this.bookingModel.updateMany(
                {
                    status: BookingStatus.CONFIRMED,
                    actualCheckIn: { $exists: false },
                    checkIn: { $lt: graceCutoff },
                },
                {
                    $set: {
                        status: BookingStatus.NO_SHOW,
                        'cancellation.cancelledBy': CancelledBy.SYSTEM,
                        'cancellation.cancelledAt': new Date(),
                        'cancellation.reason': 'Guest did not check in within grace period',
                        'cancellation.refundAmount': 0,
                    },
                },
            );

            if (result.modifiedCount > 0) {
                this.logger.log(
                    `No-show job: marked ${result.modifiedCount} booking(s) as NO_SHOW`,
                );
            }
        } catch (err: any) {
            this.logger.error(`No-show detection job failed: ${err.message}`, err.stack);
        }
    }
}
