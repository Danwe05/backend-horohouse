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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = exports.User = exports.StudentVerificationStatus = exports.UserRole = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["AGENT"] = "agent";
    UserRole["LANDLORD"] = "landlord";
    UserRole["REGISTERED_USER"] = "registered_user";
    UserRole["GUEST"] = "guest";
    UserRole["STUDENT"] = "student";
})(UserRole || (exports.UserRole = UserRole = {}));
var StudentVerificationStatus;
(function (StudentVerificationStatus) {
    StudentVerificationStatus["UNVERIFIED"] = "unverified";
    StudentVerificationStatus["PENDING"] = "pending";
    StudentVerificationStatus["VERIFIED"] = "verified";
    StudentVerificationStatus["REJECTED"] = "rejected";
})(StudentVerificationStatus || (exports.StudentVerificationStatus = StudentVerificationStatus = {}));
let User = class User {
    name;
    email;
    phoneNumber;
    role;
    profilePicture;
    favorites;
    preferences;
    searchHistory;
    recentlyViewed;
    isActive;
    specialties;
    languages;
    serviceAreas;
    emailVerified;
    phoneVerified;
    googleId;
    password;
    averageRating;
    reviewCount;
    phoneVerificationCode;
    phoneVerificationExpires;
    emailVerificationToken;
    emailVerificationExpires;
    resetPasswordToken;
    resetPasswordExpires;
    twoFactorEnabled;
    twoFactorSecret;
    sessions;
    licenseNumber;
    agency;
    bio;
    website;
    propertiesListed;
    propertiesSold;
    tenants;
    totalRentalIncome;
    occupancyRate;
    studentProfile;
    emailNotifications;
    smsNotifications;
    pushNotifications;
    location;
    address;
    city;
    country;
    onboardingCompleted;
    agentPreferences;
    createdAt;
    updatedAt;
    _id;
};
exports.User = User;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true, lowercase: true, trim: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "phoneNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: Object.values(UserRole), default: UserRole.REGISTERED_USER }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null }),
    __metadata("design:type", String)
], User.prototype, "profilePicture", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [{ type: mongoose_2.Types.ObjectId, ref: 'Property' }], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "favorites", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], User.prototype, "preferences", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [Object], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "searchHistory", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                propertyId: { type: mongoose_2.Types.ObjectId, ref: 'Property' },
                viewedAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], User.prototype, "recentlyViewed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "specialties", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: ['English'] }),
    __metadata("design:type", Array)
], User.prototype, "languages", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [String], default: [] }),
    __metadata("design:type", Array)
], User.prototype, "serviceAreas", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "phoneVerified", void 0);
__decorate([
    (0, mongoose_1.Prop)({ unique: true, sparse: true }),
    __metadata("design:type", String)
], User.prototype, "googleId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "averageRating", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "reviewCount", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "phoneVerificationCode", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], User.prototype, "phoneVerificationExpires", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "emailVerificationToken", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], User.prototype, "emailVerificationExpires", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "resetPasswordToken", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], User.prototype, "resetPasswordExpires", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "twoFactorEnabled", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "twoFactorSecret", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                id: { type: String, required: true },
                refreshToken: { type: String, required: true },
                device: { type: String, required: true },
                ipAddress: { type: String, required: true },
                userAgent: { type: String, required: true },
                location: { type: String },
                isActive: { type: Boolean, default: true },
                lastActive: { type: Date, default: Date.now },
                createdAt: { type: Date, default: Date.now },
                expiresAt: { type: Date, required: true },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], User.prototype, "sessions", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "licenseNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "agency", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "bio", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "website", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "propertiesListed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "propertiesSold", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: [
            {
                _id: { type: mongoose_2.Types.ObjectId, default: () => new mongoose_2.Types.ObjectId() },
                tenantName: { type: String, required: true },
                tenantEmail: { type: String },
                tenantPhone: { type: String },
                tenantUserId: { type: mongoose_2.Types.ObjectId, ref: 'User' },
                propertyId: { type: mongoose_2.Types.ObjectId, ref: 'Property', required: true },
                leaseStart: { type: Date, required: true },
                leaseEnd: { type: Date, required: true },
                monthlyRent: { type: Number, required: true },
                depositAmount: { type: Number },
                status: { type: String, enum: ['active', 'ended', 'pending'], default: 'active' },
                notes: { type: String },
            },
        ],
        default: [],
    }),
    __metadata("design:type", Array)
], User.prototype, "tenants", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "totalRentalIncome", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "occupancyRate", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            universityName: { type: String },
            faculty: { type: String },
            studyLevel: { type: String },
            enrollmentYear: { type: Number },
            studentIdUrl: { type: String },
            studentIdPublicId: { type: String },
            verificationStatus: {
                type: String,
                enum: Object.values(StudentVerificationStatus),
                default: StudentVerificationStatus.UNVERIFIED,
            },
            verificationSubmittedAt: { type: Date },
            verificationReviewedAt: { type: Date },
            verificationRejectionReason: { type: String },
            campusCity: { type: String },
            campusLatitude: { type: Number },
            campusLongitude: { type: Number },
            roommateProfileId: { type: mongoose_2.Types.ObjectId, ref: 'RoommateProfile' },
            ambassadorCode: { type: String },
            isAmbassador: { type: Boolean, default: false },
            ambassadorEarnings: { type: Number, default: 0 },
        },
        default: null,
    }),
    __metadata("design:type", Object)
], User.prototype, "studentProfile", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "emailNotifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "smsNotifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "pushNotifications", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number],
            default: [0, 0],
        },
    }),
    __metadata("design:type", Object)
], User.prototype, "location", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "address", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "city", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], User.prototype, "country", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "onboardingCompleted", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: null }),
    __metadata("design:type", Object)
], User.prototype, "agentPreferences", void 0);
exports.User = User = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        autoIndex: true,
    })
], User);
exports.UserSchema = mongoose_1.SchemaFactory.createForClass(User);
exports.UserSchema.index({ location: '2dsphere' });
exports.UserSchema.index({ 'preferences.preferredLocation': '2dsphere' });
exports.UserSchema.index({ 'recentlyViewed.propertyId': 1 });
exports.UserSchema.index({ 'sessions.id': 1 });
exports.UserSchema.index({ 'sessions.refreshToken': 1 });
exports.UserSchema.index({ 'sessions.expiresAt': 1 });
exports.UserSchema.index({ 'sessions.isActive': 1 });
exports.UserSchema.index({ role: 1 });
exports.UserSchema.index({ city: 1 });
exports.UserSchema.index({ country: 1 });
exports.UserSchema.index({ isActive: 1 });
exports.UserSchema.index({ 'studentProfile.verificationStatus': 1 });
exports.UserSchema.index({ 'studentProfile.ambassadorCode': 1 }, { sparse: true });
exports.UserSchema.index({ 'studentProfile.roommateProfileId': 1 }, { sparse: true });
exports.UserSchema.index({ role: 1, 'studentProfile.campusCity': 1 });
exports.UserSchema.virtual('id').get(function () {
    return this._id.toString();
});
exports.UserSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        delete ret._id;
        delete ret.password;
        delete ret.phoneVerificationCode;
        delete ret.emailVerificationToken;
        delete ret.resetPasswordToken;
        if (ret.studentProfile?.studentIdPublicId) {
            delete ret.studentProfile.studentIdPublicId;
        }
        if (ret.sessions && Array.isArray(ret.sessions)) {
            ret.sessions = ret.sessions.map((session) => {
                const { refreshToken, ...sessionWithoutToken } = session;
                return sessionWithoutToken;
            });
        }
        return ret;
    },
});
//# sourceMappingURL=user.schema.js.map