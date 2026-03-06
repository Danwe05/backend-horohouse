import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Booking, BookingSchema }   from './schema/booking.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema }         from '../users/schemas/user.schema';
import { BookingsService }          from './bookings.service';
import { BookingsController }       from './bookings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name,  schema: BookingSchema  },
      // Re-import Property & User so the service can query them directly
      { name: Property.name, schema: PropertySchema },
      { name: User.name,     schema: UserSchema     },
    ]),
  ],
  controllers: [BookingsController],
  providers:   [BookingsService],
  exports:     [BookingsService], // export so other modules (e.g. reviews) can use it
})
export class BookingsModule {}
