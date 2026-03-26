"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var BookingsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsScheduler = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const mongoose_2 = require("mongoose");
const booking_schema_1 = require("./schema/booking.schema");
const AUTO_CANCEL_HOURS = 24;
const NO_SHOW_GRACE_HOURS = 24;
let BookingsScheduler = BookingsScheduler_1 = class BookingsScheduler {
    bookingModel;
    logger = new common_1.Logger(BookingsScheduler_1.name);
    constructor(bookingModel) {
        this.bookingModel = bookingModel;
    }
    async autoCancelUnpaidBookings() {
        const cutoff = new Date(Date.now() - AUTO_CANCEL_HOURS * 3_600_000);
        try {
            const result = await this.bookingModel.updateMany({
                status: booking_schema_1.BookingStatus.PENDING,
                paymentStatus: booking_schema_1.PaymentStatus.UNPAID,
                createdAt: { $lt: cutoff },
            }, {
                $set: {
                    status: booking_schema_1.BookingStatus.CANCELLED,
                    'cancellation.cancelledBy': booking_schema_1.CancelledBy.SYSTEM,
                    'cancellation.cancelledAt': new Date(),
                    'cancellation.reason': `Automatically cancelled: payment not received within ${AUTO_CANCEL_HOURS} hours`,
                    'cancellation.refundAmount': 0,
                },
            });
            if (result.modifiedCount > 0) {
                this.logger.log(`Auto-cancel job: cancelled ${result.modifiedCount} unpaid booking(s) ` +
                    `(older than ${AUTO_CANCEL_HOURS}h)`);
            }
        }
        catch (err) {
            this.logger.error(`Auto-cancel job failed: ${err.message}`, err.stack);
        }
    }
    async detectNoShows() {
        const graceCutoff = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 3_600_000);
        try {
            const result = await this.bookingModel.updateMany({
                status: booking_schema_1.BookingStatus.CONFIRMED,
                actualCheckIn: { $exists: false },
                checkIn: { $lt: graceCutoff },
            }, {
                $set: {
                    status: booking_schema_1.BookingStatus.NO_SHOW,
                    'cancellation.cancelledBy': booking_schema_1.CancelledBy.SYSTEM,
                    'cancellation.cancelledAt': new Date(),
                    'cancellation.reason': 'Guest did not check in within grace period',
                    'cancellation.refundAmount': 0,
                },
            });
            if (result.modifiedCount > 0) {
                this.logger.log(`No-show job: marked ${result.modifiedCount} booking(s) as NO_SHOW`);
            }
        }
        catch (err) {
            this.logger.error(`No-show detection job failed: ${err.message}`, err.stack);
        }
    }
};
exports.BookingsScheduler = BookingsScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsScheduler.prototype, "autoCancelUnpaidBookings", null);
__decorate([
    (0, schedule_1.Cron)('0 10 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsScheduler.prototype, "detectNoShows", null);
exports.BookingsScheduler = BookingsScheduler = BookingsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], BookingsScheduler);
//# sourceMappingURL=bookings.scheduler.js.map