import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument, ParticipantInfo } from './schemas/conversation.schema';
import { Message, MessageDocument, MessageStatus } from './schemas/message.schema';
import { PropertyDocument } from '../properties/schemas/property.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateConversationDto, SendMessageDto, GetMessagesQueryDto, GetConversationsQueryDto, EditMessageDto } from './dto/chat.dto';
export declare class ChatService {
    private conversationModel;
    private messageModel;
    private propertyModel;
    private userModel;
    private readonly logger;
    constructor(conversationModel: Model<ConversationDocument>, messageModel: Model<MessageDocument>, propertyModel: Model<PropertyDocument>, userModel: Model<UserDocument>);
    createConversation(userId: string, dto: CreateConversationDto): Promise<Conversation>;
    private findExistingConversation;
    getConversations(userId: string, query: GetConversationsQueryDto): Promise<{
        conversations: {
            unreadCount: number;
            otherUser: Types.ObjectId | undefined;
            _id: Types.ObjectId;
            participants: import("mongoose").FlattenMaps<ParticipantInfo>[];
            propertyId?: Types.ObjectId | undefined;
            lastMessage?: import("mongoose").FlattenMaps<import("./schemas/conversation.schema").LastMessage> | undefined;
            messagesCount: number;
            typingUsers: Record<string, boolean>;
            onlineStatus: Record<string, string>;
            isArchived: boolean;
            archivedAt?: Date | undefined;
            archivedBy: Types.ObjectId[];
            isBlocked: boolean;
            blockedBy?: Types.ObjectId | undefined;
            blockedAt?: Date | undefined;
            metadata?: import("mongoose").FlattenMaps<Record<string, any>> | undefined;
            createdAt: Date;
            updatedAt: Date;
            $assertPopulated: <Paths = {}>(path: string | string[], values?: Partial<Paths> | undefined) => Omit<ConversationDocument, keyof Paths> & Paths;
            $clearModifiedPaths: () => ConversationDocument;
            $clone: () => ConversationDocument;
            $createModifiedPathsSnapshot: () => import("mongoose").ModifiedPathsSnapshot;
            $getAllSubdocs: () => import("mongoose").Document[];
            $ignore: (path: string) => void;
            $isDefault: (path?: string) => boolean;
            $isDeleted: (val?: boolean) => boolean;
            $getPopulatedDocs: () => import("mongoose").Document[];
            $inc: (path: string | string[], val?: number) => ConversationDocument;
            $isEmpty: (path: string) => boolean;
            $isValid: (path: string) => boolean;
            $locals: import("mongoose").FlattenMaps<Record<string, unknown>>;
            $markValid: (path: string) => void;
            $model: {
                <ModelType = Model<unknown, {}, {}, {}, import("mongoose").Document<unknown, {}, unknown, {}, {}> & {
                    _id: Types.ObjectId;
                } & {
                    __v: number;
                }, any>>(name: string): ModelType;
                <ModelType = Model<any, {}, {}, {}, any, any>>(): ModelType;
            };
            $op: "save" | "validate" | "remove" | null;
            $restoreModifiedPathsSnapshot: (snapshot: import("mongoose").ModifiedPathsSnapshot) => ConversationDocument;
            $session: (session?: import("mongoose").ClientSession | null) => import("mongoose").ClientSession | null;
            $set: {
                (path: string | Record<string, any>, val: any, type: any, options?: import("mongoose").DocumentSetOptions): ConversationDocument;
                (path: string | Record<string, any>, val: any, options?: import("mongoose").DocumentSetOptions): ConversationDocument;
                (value: string | Record<string, any>): ConversationDocument;
            };
            $where: import("mongoose").FlattenMaps<Record<string, unknown>>;
            baseModelName?: string | undefined;
            collection: import("mongoose").FlattenMaps<import("mongoose").Collection<import("bson").Document>>;
            db: import("mongoose").FlattenMaps<import("mongoose").Connection>;
            deleteOne: (options?: import("mongoose").QueryOptions) => any;
            depopulate: <Paths = {}>(path?: string | string[]) => import("mongoose").MergeType<ConversationDocument, Paths>;
            directModifiedPaths: () => Array<string>;
            equals: (doc: import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}>) => boolean;
            errors?: import("mongoose").Error.ValidationError | undefined;
            get: {
                <T extends string | number | symbol>(path: T, type?: any, options?: any): any;
                (path: string, type?: any, options?: any): any;
            };
            getChanges: () => import("mongoose").UpdateQuery<ConversationDocument>;
            id?: any;
            increment: () => ConversationDocument;
            init: (obj: import("mongoose").AnyObject, opts?: import("mongoose").AnyObject) => ConversationDocument;
            invalidate: {
                <T extends string | number | symbol>(path: T, errorMsg: string | NativeError, value?: any, kind?: string): NativeError | null;
                (path: string, errorMsg: string | NativeError, value?: any, kind?: string): NativeError | null;
            };
            isDirectModified: {
                <T extends string | number | symbol>(path: T | T[]): boolean;
                (path: string | Array<string>): boolean;
            };
            isDirectSelected: {
                <T extends string | number | symbol>(path: T): boolean;
                (path: string): boolean;
            };
            isInit: {
                <T extends string | number | symbol>(path: T): boolean;
                (path: string): boolean;
            };
            isModified: {
                <T extends string | number | symbol>(path?: T | T[] | undefined, options?: {
                    ignoreAtomics?: boolean;
                } | null): boolean;
                (path?: string | Array<string>, options?: {
                    ignoreAtomics?: boolean;
                } | null): boolean;
            };
            isNew: boolean;
            isSelected: {
                <T extends string | number | symbol>(path: T): boolean;
                (path: string): boolean;
            };
            markModified: {
                <T extends string | number | symbol>(path: T, scope?: any): void;
                (path: string, scope?: any): void;
            };
            model: {
                <ModelType = Model<unknown, {}, {}, {}, import("mongoose").Document<unknown, {}, unknown, {}, {}> & {
                    _id: Types.ObjectId;
                } & {
                    __v: number;
                }, any>>(name: string): ModelType;
                <ModelType = Model<any, {}, {}, {}, any, any>>(): ModelType;
            };
            modifiedPaths: (options?: {
                includeChildren?: boolean;
            }) => Array<string>;
            overwrite: (obj: import("mongoose").AnyObject) => ConversationDocument;
            $parent: () => import("mongoose").Document | undefined;
            populate: {
                <Paths = {}>(path: string | import("mongoose").PopulateOptions | (string | import("mongoose").PopulateOptions)[]): Promise<import("mongoose").MergeType<ConversationDocument, Paths>>;
                <Paths = {}>(path: string, select?: string | import("mongoose").AnyObject, model?: Model<any>, match?: import("mongoose").AnyObject, options?: import("mongoose").PopulateOptions): Promise<import("mongoose").MergeType<ConversationDocument, Paths>>;
            };
            populated: (path: string) => any;
            replaceOne: (replacement?: import("mongoose").AnyObject, options?: import("mongoose").QueryOptions | null) => import("mongoose").Query<any, ConversationDocument, {}, unknown, "find", Record<string, never>>;
            save: (options?: import("mongoose").SaveOptions) => Promise<ConversationDocument>;
            schema: import("mongoose").FlattenMaps<import("mongoose").Schema<any, Model<any, any, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, {
                [x: number]: unknown;
                [x: symbol]: unknown;
                [x: string]: unknown;
            }, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
                [x: number]: unknown;
                [x: symbol]: unknown;
                [x: string]: unknown;
            }>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<{
                [x: number]: unknown;
                [x: symbol]: unknown;
                [x: string]: unknown;
            }> & Required<{
                _id: unknown;
            }> & {
                __v: number;
            }>>;
            set: {
                <T extends string | number | symbol>(path: T, val: any, type: any, options?: import("mongoose").DocumentSetOptions): ConversationDocument;
                (path: string | Record<string, any>, val: any, type: any, options?: import("mongoose").DocumentSetOptions): ConversationDocument;
                (path: string | Record<string, any>, val: any, options?: import("mongoose").DocumentSetOptions): ConversationDocument;
                (value: string | Record<string, any>): ConversationDocument;
            };
            toJSON: {
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                    virtuals: true;
                    flattenObjectIds: true;
                }): Omit<{
                    [x: string]: any;
                }, "__v">;
                (options: import("mongoose").ToObjectOptions & {
                    virtuals: true;
                    flattenObjectIds: true;
                }): {
                    [x: string]: any;
                };
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                    virtuals: true;
                }): Omit<any, "__v">;
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                    flattenObjectIds: true;
                }): {
                    [x: string]: any;
                    [x: number]: any;
                    [x: symbol]: any;
                };
                (options: import("mongoose").ToObjectOptions & {
                    virtuals: true;
                }): any;
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                }): Omit<any, "__v">;
                (options?: import("mongoose").ToObjectOptions & {
                    flattenMaps?: true;
                    flattenObjectIds?: false;
                }): import("mongoose").FlattenMaps<any>;
                (options: import("mongoose").ToObjectOptions & {
                    flattenObjectIds: false;
                }): import("mongoose").FlattenMaps<any>;
                (options: import("mongoose").ToObjectOptions & {
                    flattenObjectIds: true;
                }): {
                    [x: string]: any;
                };
                (options: import("mongoose").ToObjectOptions & {
                    flattenMaps: false;
                }): any;
                (options: import("mongoose").ToObjectOptions & {
                    flattenMaps: false;
                    flattenObjectIds: true;
                }): any;
                <T = any>(options?: import("mongoose").ToObjectOptions & {
                    flattenMaps?: true;
                    flattenObjectIds?: false;
                }): import("mongoose").FlattenMaps<T>;
                <T = any>(options: import("mongoose").ToObjectOptions & {
                    flattenObjectIds: false;
                }): import("mongoose").FlattenMaps<T>;
                <T = any>(options: import("mongoose").ToObjectOptions & {
                    flattenObjectIds: true;
                }): import("mongoose").ObjectIdToString<import("mongoose").FlattenMaps<T>>;
                <T = any>(options: import("mongoose").ToObjectOptions & {
                    flattenMaps: false;
                }): T;
                <T = any>(options: import("mongoose").ToObjectOptions & {
                    flattenMaps: false;
                    flattenObjectIds: true;
                }): import("mongoose").ObjectIdToString<T>;
            };
            toObject: {
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                    virtuals: true;
                    flattenObjectIds: true;
                }): Omit<any, "__v">;
                (options: import("mongoose").ToObjectOptions & {
                    virtuals: true;
                    flattenObjectIds: true;
                }): any;
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                    flattenObjectIds: true;
                }): Omit<any, "__v">;
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                    virtuals: true;
                }): Omit<any, "__v">;
                (options: import("mongoose").ToObjectOptions & {
                    virtuals: true;
                }): any;
                (options: import("mongoose").ToObjectOptions & {
                    versionKey: false;
                }): Omit<any, "__v">;
                (options: import("mongoose").ToObjectOptions & {
                    flattenObjectIds: true;
                }): any;
                (options?: import("mongoose").ToObjectOptions): any;
                <T>(options?: import("mongoose").ToObjectOptions): import("mongoose").Require_id<T> & {
                    __v: number;
                };
            };
            unmarkModified: {
                <T extends string | number | symbol>(path: T): void;
                (path: string): void;
            };
            updateOne: (update?: import("mongoose").UpdateWithAggregationPipeline | import("mongoose").UpdateQuery<ConversationDocument> | undefined, options?: import("mongoose").QueryOptions | null) => import("mongoose").Query<any, ConversationDocument, {}, unknown, "find", Record<string, never>>;
            validate: {
                <T extends string | number | symbol>(pathsToValidate?: T | T[] | undefined, options?: import("mongoose").AnyObject): Promise<void>;
                (pathsToValidate?: import("mongoose").pathsToValidate, options?: import("mongoose").AnyObject): Promise<void>;
                (options: {
                    pathsToSkip?: import("mongoose").pathsToSkip;
                }): Promise<void>;
            };
            validateSync: {
                (options: {
                    pathsToSkip?: import("mongoose").pathsToSkip;
                    [k: string]: any;
                }): import("mongoose").Error.ValidationError | null;
                <T extends string | number | symbol>(pathsToValidate?: T | T[] | undefined, options?: import("mongoose").AnyObject): import("mongoose").Error.ValidationError | null;
                (pathsToValidate?: import("mongoose").pathsToValidate, options?: import("mongoose").AnyObject): import("mongoose").Error.ValidationError | null;
            };
            __v: number;
        }[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getConversation(conversationId: string, userId: string): Promise<Conversation>;
    sendMessage(userId: string, dto: SendMessageDto): Promise<Message>;
    getMessages(conversationId: string, userId: string, query: GetMessagesQueryDto): Promise<{
        messages: (import("mongoose").FlattenMaps<MessageDocument> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
        hasMore: boolean;
    }>;
    markMessagesAsRead(conversationId: string, userId: string, messageIds: string[]): Promise<void>;
    updateMessageStatus(messageId: string, status: MessageStatus): Promise<void>;
    editMessage(messageId: string, userId: string, dto: EditMessageDto): Promise<Message>;
    deleteMessage(messageId: string, userId: string): Promise<void>;
    archiveConversation(conversationId: string, userId: string, archive: boolean): Promise<Conversation>;
    deleteConversation(conversationId: string, userId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<number>;
    updateTypingIndicator(conversationId: string, userId: string, isTyping: boolean): Promise<void>;
    updateOnlineStatus(userId: string, status: 'online' | 'offline' | 'away'): Promise<void>;
}
