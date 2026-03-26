import { Model } from 'mongoose';
import { BookingDocument } from './schema/booking.schema';
export declare class BookingsScheduler {
    private bookingModel;
    private readonly logger;
    constructor(bookingModel: Model<BookingDocument>);
    autoCancelUnpaidBookings(): Promise<void>;
    detectNoShows(): Promise<void>;
}
