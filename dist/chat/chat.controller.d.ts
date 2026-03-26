import { ChatService } from './chat.service';
import { CallService } from './call.service';
import { CreateConversationDto, SendMessageDto, GetMessagesQueryDto, GetConversationsQueryDto, EditMessageDto, MarkAsReadDto, ArchiveConversationDto } from './dto/chat.dto';
import { InitiateCallDto } from './dto/call.dto';
export declare class ChatController {
    private readonly chatService;
    private readonly callService;
    constructor(chatService: ChatService, callService: CallService);
    createConversation(req: any, dto: CreateConversationDto): Promise<import("./schemas/conversation.schema").Conversation>;
    getConversations(req: any, query: GetConversationsQueryDto): Promise<{
        conversations: {
            unreadCount: number;
            otherUser: import("mongoose").Types.ObjectId | undefined;
            _id: import("mongoose").Types.ObjectId;
            participants: import("mongoose").FlattenMaps<import("./schemas/conversation.schema").ParticipantInfo>[];
            propertyId?: import("mongoose").Types.ObjectId | undefined;
            lastMessage?: import("mongoose").FlattenMaps<import("./schemas/conversation.schema").LastMessage> | undefined;
            messagesCount: number;
            typingUsers: Record<string, boolean>;
            onlineStatus: Record<string, string>;
            isArchived: boolean;
            archivedAt?: Date | undefined;
            archivedBy: import("mongoose").Types.ObjectId[];
            isBlocked: boolean;
            blockedBy?: import("mongoose").Types.ObjectId | undefined;
            blockedAt?: Date | undefined;
            metadata?: import("mongoose").FlattenMaps<Record<string, any>> | undefined;
            createdAt: Date;
            updatedAt: Date;
            $assertPopulated: <Paths = {}>(path: string | string[], values?: Partial<Paths> | undefined) => Omit<import("./schemas/conversation.schema").ConversationDocument, keyof Paths> & Paths;
            $clearModifiedPaths: () => import("./schemas/conversation.schema").ConversationDocument;
            $clone: () => import("./schemas/conversation.schema").ConversationDocument;
            $createModifiedPathsSnapshot: () => import("mongoose").ModifiedPathsSnapshot;
            $getAllSubdocs: () => import("mongoose").Document[];
            $ignore: (path: string) => void;
            $isDefault: (path?: string) => boolean;
            $isDeleted: (val?: boolean) => boolean;
            $getPopulatedDocs: () => import("mongoose").Document[];
            $inc: (path: string | string[], val?: number) => import("./schemas/conversation.schema").ConversationDocument;
            $isEmpty: (path: string) => boolean;
            $isValid: (path: string) => boolean;
            $locals: import("mongoose").FlattenMaps<Record<string, unknown>>;
            $markValid: (path: string) => void;
            $model: {
                <ModelType = import("mongoose").Model<unknown, {}, {}, {}, import("mongoose").Document<unknown, {}, unknown, {}, {}> & {
                    _id: import("mongoose").Types.ObjectId;
                } & {
                    __v: number;
                }, any>>(name: string): ModelType;
                <ModelType = import("mongoose").Model<any, {}, {}, {}, any, any>>(): ModelType;
            };
            $op: "save" | "validate" | "remove" | null;
            $restoreModifiedPathsSnapshot: (snapshot: import("mongoose").ModifiedPathsSnapshot) => import("./schemas/conversation.schema").ConversationDocument;
            $session: (session?: import("mongoose").ClientSession | null) => import("mongoose").ClientSession | null;
            $set: {
                (path: string | Record<string, any>, val: any, type: any, options?: import("mongoose").DocumentSetOptions): import("./schemas/conversation.schema").ConversationDocument;
                (path: string | Record<string, any>, val: any, options?: import("mongoose").DocumentSetOptions): import("./schemas/conversation.schema").ConversationDocument;
                (value: string | Record<string, any>): import("./schemas/conversation.schema").ConversationDocument;
            };
            $where: import("mongoose").FlattenMaps<Record<string, unknown>>;
            baseModelName?: string | undefined;
            collection: import("mongoose").FlattenMaps<import("mongoose").Collection<import("bson").Document>>;
            db: import("mongoose").FlattenMaps<import("mongoose").Connection>;
            deleteOne: (options?: import("mongoose").QueryOptions) => any;
            depopulate: <Paths = {}>(path?: string | string[]) => import("mongoose").MergeType<import("./schemas/conversation.schema").ConversationDocument, Paths>;
            directModifiedPaths: () => Array<string>;
            equals: (doc: import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}>) => boolean;
            errors?: import("mongoose").Error.ValidationError | undefined;
            get: {
                <T extends string | number | symbol>(path: T, type?: any, options?: any): any;
                (path: string, type?: any, options?: any): any;
            };
            getChanges: () => import("mongoose").UpdateQuery<import("./schemas/conversation.schema").ConversationDocument>;
            id?: any;
            increment: () => import("./schemas/conversation.schema").ConversationDocument;
            init: (obj: import("mongoose").AnyObject, opts?: import("mongoose").AnyObject) => import("./schemas/conversation.schema").ConversationDocument;
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
                <ModelType = import("mongoose").Model<unknown, {}, {}, {}, import("mongoose").Document<unknown, {}, unknown, {}, {}> & {
                    _id: import("mongoose").Types.ObjectId;
                } & {
                    __v: number;
                }, any>>(name: string): ModelType;
                <ModelType = import("mongoose").Model<any, {}, {}, {}, any, any>>(): ModelType;
            };
            modifiedPaths: (options?: {
                includeChildren?: boolean;
            }) => Array<string>;
            overwrite: (obj: import("mongoose").AnyObject) => import("./schemas/conversation.schema").ConversationDocument;
            $parent: () => import("mongoose").Document | undefined;
            populate: {
                <Paths = {}>(path: string | import("mongoose").PopulateOptions | (string | import("mongoose").PopulateOptions)[]): Promise<import("mongoose").MergeType<import("./schemas/conversation.schema").ConversationDocument, Paths>>;
                <Paths = {}>(path: string, select?: string | import("mongoose").AnyObject, model?: import("mongoose").Model<any>, match?: import("mongoose").AnyObject, options?: import("mongoose").PopulateOptions): Promise<import("mongoose").MergeType<import("./schemas/conversation.schema").ConversationDocument, Paths>>;
            };
            populated: (path: string) => any;
            replaceOne: (replacement?: import("mongoose").AnyObject, options?: import("mongoose").QueryOptions | null) => import("mongoose").Query<any, import("./schemas/conversation.schema").ConversationDocument, {}, unknown, "find", Record<string, never>>;
            save: (options?: import("mongoose").SaveOptions) => Promise<import("./schemas/conversation.schema").ConversationDocument>;
            schema: import("mongoose").FlattenMaps<import("mongoose").Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, {
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
                <T extends string | number | symbol>(path: T, val: any, type: any, options?: import("mongoose").DocumentSetOptions): import("./schemas/conversation.schema").ConversationDocument;
                (path: string | Record<string, any>, val: any, type: any, options?: import("mongoose").DocumentSetOptions): import("./schemas/conversation.schema").ConversationDocument;
                (path: string | Record<string, any>, val: any, options?: import("mongoose").DocumentSetOptions): import("./schemas/conversation.schema").ConversationDocument;
                (value: string | Record<string, any>): import("./schemas/conversation.schema").ConversationDocument;
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
            updateOne: (update?: import("mongoose").UpdateWithAggregationPipeline | import("mongoose").UpdateQuery<import("./schemas/conversation.schema").ConversationDocument> | undefined, options?: import("mongoose").QueryOptions | null) => import("mongoose").Query<any, import("./schemas/conversation.schema").ConversationDocument, {}, unknown, "find", Record<string, never>>;
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
    getConversation(req: any, id: string): Promise<import("./schemas/conversation.schema").Conversation>;
    archiveConversation(req: any, id: string, dto: ArchiveConversationDto): Promise<import("./schemas/conversation.schema").Conversation>;
    deleteConversation(req: any, id: string): Promise<{
        message: string;
    }>;
    sendMessage(req: any, dto: SendMessageDto): Promise<import("./schemas/message.schema").Message>;
    sendMessageWithAttachments(req: any, dto: SendMessageDto, files: Express.Multer.File[]): Promise<import("./schemas/message.schema").Message>;
    getMessages(req: any, conversationId: string, query: GetMessagesQueryDto): Promise<{
        messages: (import("mongoose").FlattenMaps<import("./schemas/message.schema").MessageDocument> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        totalPages: number;
        hasMore: boolean;
    }>;
    markMessagesAsRead(req: any, dto: MarkAsReadDto & {
        conversationId: string;
    }): Promise<{
        message: string;
    }>;
    editMessage(req: any, messageId: string, dto: EditMessageDto): Promise<import("./schemas/message.schema").Message>;
    deleteMessage(req: any, messageId: string): Promise<{
        message: string;
    }>;
    getUnreadCount(req: any): Promise<{
        unreadCount: number;
    }>;
    getConversationCallHistory(req: any, conversationId: string, limit?: number): Promise<import("./schemas/call.schema").Call[]>;
    getUserCallHistory(req: any, limit?: number): Promise<import("./schemas/call.schema").Call[]>;
    getCall(id: string): Promise<import("./schemas/call.schema").Call>;
    initiateCall(req: any, dto: InitiateCallDto): Promise<import("./schemas/call.schema").Call>;
}
